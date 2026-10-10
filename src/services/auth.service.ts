import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { auditLogService } from './auditLog.service';
import { otpService } from './otp.service';
import { AuthUser } from '../types';

export interface RegisterDTO {
  username: string;
  password: string;
  email?: string;
  fullName?: string;
  courtName?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginDTO {
  username: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface OAuthSyncDTO {
  provider: string;
  providerAccountId: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CompleteProfileDTO {
  userId: string;
  fullName: string;
  courtName: string;
  password?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuthService {
  /**
   * Registers a new user (Email provided will automatically be marked verified = true without OTP)
   */
  async register(data: RegisterDTO) {
    const existing = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existing) {
      throw new Error('Username already exists');
    }

    const normalizedEmail = data.email ? data.email.trim().toLowerCase() : null;
    if (normalizedEmail) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existingEmail) {
        throw new Error('อีเมลนี้ถูกใช้งานในระบบแล้ว');
      }
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: normalizedEmail,
        isEmailVerified: !!normalizedEmail,
        passwordHash,
        fullName: data.fullName,
        courtName: data.courtName ? data.courtName.trim() : null,
        isProfileComplete: true,
        role: 'USER',
      },
      select: {
        id: true,
        username: true,
        email: true,
        isEmailVerified: true,
        isProfileComplete: true,
        fullName: true,
        courtName: true,
        role: true,
        createdAt: true,
      },
    });

    // Record audit log
    await auditLogService.createLog({
      userId: user.id,
      action: 'USER_REGISTER',
      resource: 'auth',
      details: { username: user.username, email: user.email, courtName: user.courtName },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: 'SUCCESS',
    });

    const token = this.generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      isProfileComplete: user.isProfileComplete,
      fullName: user.fullName,
      courtName: user.courtName,
    });

    return { user, token };
  }

  /**
   * Authenticates user and issues JWT token
   */
  async login(data: LoginDTO) {
    const user = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (!user) {
      await auditLogService.createLog({
        action: 'USER_LOGIN_FAILED',
        resource: 'auth',
        details: { username: data.username, reason: 'User not found' },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: 'FAILED',
      });
      throw new Error('Invalid username or password');
    }

    if (!user.passwordHash) {
      throw new Error('บัญชีนี้ล็อกอินผ่านระบบภายนอก โปรดใช้ Google หรือ Microsoft เพื่อเข้าสู่ระบบ');
    }

    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      await auditLogService.createLog({
        userId: user.id,
        action: 'USER_LOGIN_FAILED',
        resource: 'auth',
        details: { username: data.username, reason: 'Invalid password' },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: 'FAILED',
      });
      throw new Error('Invalid username or password');
    }

    // Success audit log
    await auditLogService.createLog({
      userId: user.id,
      action: 'USER_LOGIN',
      resource: 'auth',
      details: { username: user.username },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: 'SUCCESS',
    });

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      isProfileComplete: user.isProfileComplete,
      role: user.role,
      fullName: user.fullName,
      courtName: user.courtName,
    };

    const token = this.generateToken(authUser);

    return {
      user: authUser,
      token,
    };
  }

  /**
   * Handles NextAuth OAuth sync (Google, Microsoft, etc.)
   */
  async oauthSync(data: OAuthSyncDTO) {
    const normalizedEmail = data.email ? data.email.trim().toLowerCase() : null;

    // 1. Check if Account link already exists
    const existingAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: data.provider,
          providerAccountId: data.providerAccountId,
        },
      },
      include: {
        user: true,
      },
    });

    if (existingAccount && existingAccount.user) {
      const user = existingAccount.user;
      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        isProfileComplete: user.isProfileComplete,
        role: user.role,
        fullName: user.fullName,
        courtName: user.courtName,
      };

      const token = this.generateToken(authUser);
      return { user: authUser, token };
    }

    // 2. If no account, check if a user exists with matching email
    let user = normalizedEmail
      ? await prisma.user.findUnique({
          where: { email: normalizedEmail },
        })
      : null;

    let isProfileComplete = true;

    if (!user) {
      // 3. Brand new OAuth user
      const baseUsername = normalizedEmail ? normalizedEmail.split('@')[0] : `user_${data.providerAccountId.slice(0, 8)}`;
      let uniqueUsername = baseUsername;
      let counter = 1;

      while (await prisma.user.findUnique({ where: { username: uniqueUsername } })) {
        uniqueUsername = `${baseUsername}_${counter}`;
        counter++;
      }

      isProfileComplete = false; // Must complete profile (FullName, CourtName, Password)

      user = await prisma.user.create({
        data: {
          username: uniqueUsername,
          email: normalizedEmail,
          isEmailVerified: !!normalizedEmail,
          fullName: data.fullName || null,
          isProfileComplete: false,
          role: 'USER',
        },
      });
    }

    // 4. Link provider account
    await prisma.account.create({
      data: {
        userId: user.id,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
      },
    });

    await auditLogService.createLog({
      userId: user.id,
      action: 'USER_OAUTH_LOGIN',
      resource: 'auth',
      details: { provider: data.provider, email: normalizedEmail },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: 'SUCCESS',
    });

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      isProfileComplete: user.isProfileComplete,
      role: user.role,
      fullName: user.fullName,
      courtName: user.courtName,
    };

    const token = this.generateToken(authUser);
    return { user: authUser, token };
  }

  /**
   * Completes profile onboarding for OAuth users (sets fullName, courtName, and password)
   */
  async completeProfile(data: CompleteProfileDTO) {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new Error('ไม่พบข้อมูลผู้ใช้งาน');
    }

    const updateData: any = {
      fullName: data.fullName.trim(),
      courtName: data.courtName.trim(),
      isProfileComplete: true,
    };

    if (data.password && data.password.trim()) {
      const saltRounds = 10;
      updateData.passwordHash = await bcrypt.hash(data.password, saltRounds);
    }

    const updatedUser = await prisma.user.update({
      where: { id: data.userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        isEmailVerified: true,
        isProfileComplete: true,
        fullName: true,
        courtName: true,
        role: true,
        createdAt: true,
      },
    });

    await auditLogService.createLog({
      userId: user.id,
      action: 'USER_ONBOARDING_COMPLETE',
      resource: 'auth',
      details: { courtName: updatedUser.courtName },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: 'SUCCESS',
    });

    const authUser: AuthUser = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      isEmailVerified: updatedUser.isEmailVerified,
      isProfileComplete: updatedUser.isProfileComplete,
      role: updatedUser.role,
      fullName: updatedUser.fullName,
      courtName: updatedUser.courtName,
    };

    const token = this.generateToken(authUser);
    return { user: authUser, token };
  }

  /**
   * Request OTP to bind or change email
   */
  async requestBindEmail(userId: string, newEmail: string, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = newEmail.trim().toLowerCase();

    // Check if another user is already using this email
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing && existing.id !== userId) {
      throw new Error('อีเมลนี้ถูกใช้งานโดยบัญชีอื่นแล้ว');
    }

    return await otpService.sendOtp(normalizedEmail, 'CHANGE_EMAIL', userId, ipAddress, userAgent);
  }

  /**
   * Confirm OTP and bind/change email
   */
  async confirmBindEmail(userId: string, newEmail: string, otp: string, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = newEmail.trim().toLowerCase();

    // Verify OTP
    await otpService.verifyOtp(normalizedEmail, otp, 'CHANGE_EMAIL', ipAddress, userAgent);

    // Update User
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: normalizedEmail,
        isEmailVerified: true,
      },
      select: {
        id: true,
        username: true,
        email: true,
        isEmailVerified: true,
        isProfileComplete: true,
        fullName: true,
        courtName: true,
        role: true,
        createdAt: true,
      },
    });

    await auditLogService.createLog({
      userId,
      action: 'USER_EMAIL_BIND_SUCCESS',
      resource: 'auth',
      details: { email: normalizedEmail },
      ipAddress,
      userAgent,
      status: 'SUCCESS',
    });

    const authUser: AuthUser = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      isEmailVerified: updatedUser.isEmailVerified,
      isProfileComplete: updatedUser.isProfileComplete,
      role: updatedUser.role,
      fullName: updatedUser.fullName,
      courtName: updatedUser.courtName,
    };

    const token = this.generateToken(authUser);
    return { user: authUser, token };
  }

  /**
   * Request OTP for forgot password
   */
  async forgotPassword(email: string, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // To prevent user enumeration attacks, if user does not exist, simulate delay or return success
    if (!user) {
      return { success: true, message: 'หากอีเมลนี้มีอยู่ในระบบ ระบบได้ส่งรหัส OTP เรียบร้อยแล้ว' };
    }

    return await otpService.sendOtp(normalizedEmail, 'RESET_PASSWORD', user.id, ipAddress, userAgent);
  }

  /**
   * Reset password with verified OTP
   */
  async resetPasswordWithOtp(email: string, otp: string, newPassword: string, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = email.trim().toLowerCase();

    // Verify OTP
    const verification = await otpService.verifyOtp(normalizedEmail, otp, 'RESET_PASSWORD', ipAddress, userAgent);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new Error('ไม่พบข้อมูลผู้ใช้งาน');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await auditLogService.createLog({
      userId: user.id,
      action: 'USER_PASSWORD_RESET_SUCCESS',
      resource: 'auth',
      details: { email: normalizedEmail },
      ipAddress,
      userAgent,
      status: 'SUCCESS',
    });

    return { success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที' };
  }

  /**
   * Generates a signed JWT token
   */
  generateToken(user: AuthUser): string {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        isProfileComplete: user.isProfileComplete,
        fullName: user.fullName,
        courtName: user.courtName,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );
  }

  /**
   * Verifies and decodes a JWT token
   */
  verifyToken(token: string): AuthUser {
    return jwt.verify(token, env.JWT_SECRET) as AuthUser;
  }

  /**
   * Retrieves profile of user
   */
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        isEmailVerified: true,
        isProfileComplete: true,
        fullName: true,
        courtName: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Updates profile information (e.g. fullName, courtName)
   */
  async updateProfile(userId: string, fullName?: string, courtName?: string, ipAddress?: string, userAgent?: string) {
    const dataToUpdate: any = {};
    if (fullName !== undefined) dataToUpdate.fullName = fullName;
    if (courtName !== undefined) dataToUpdate.courtName = courtName ? courtName.trim() : null;

    const user = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        username: true,
        email: true,
        isEmailVerified: true,
        isProfileComplete: true,
        fullName: true,
        courtName: true,
        role: true,
        createdAt: true,
      },
    });

    await auditLogService.createLog({
      userId,
      action: 'USER_PROFILE_UPDATE',
      resource: 'auth',
      details: { fullName, courtName },
      ipAddress,
      userAgent,
      status: 'SUCCESS',
    });

    return user;
  }

  /**
   * Changes password verifying current password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.passwordHash) {
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        await auditLogService.createLog({
          userId,
          action: 'USER_PASSWORD_CHANGE_FAILED',
          resource: 'auth',
          details: { reason: 'Incorrect current password' },
          ipAddress,
          userAgent,
          status: 'FAILED',
        });
        throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
      }
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await auditLogService.createLog({
      userId,
      action: 'USER_PASSWORD_CHANGE',
      resource: 'auth',
      ipAddress,
      userAgent,
      status: 'SUCCESS',
    });

    return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
  }

  /**
   * Logs out user and writes audit log
   */
  async logout(userId: string, ipAddress?: string, userAgent?: string) {
    await auditLogService.createLog({
      userId,
      action: 'USER_LOGOUT',
      resource: 'auth',
      ipAddress,
      userAgent,
      status: 'SUCCESS',
    });
  }
}

export const authService = new AuthService();
