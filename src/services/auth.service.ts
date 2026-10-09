import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { auditLogService } from './auditLog.service';
import { AuthUser } from '../types';

export interface RegisterDTO {
  username: string;
  password: string;
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

export class AuthService {
  /**
   * Registers a new user (always assigned USER role)
   */
  async register(data: RegisterDTO) {
    const existing = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existing) {
      throw new Error('Username already exists');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        fullName: data.fullName,
        courtName: data.courtName ? data.courtName.trim() : null,
        role: 'USER',
      },
      select: {
        id: true,
        username: true,
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
      details: { username: user.username, courtName: user.courtName },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: 'SUCCESS',
    });

    const token = this.generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
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
   * Generates a signed JWT token
   */
  generateToken(user: AuthUser): string {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
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
