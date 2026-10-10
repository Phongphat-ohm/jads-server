import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username cannot exceed 50 characters')
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, hyphens, and underscores'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password cannot exceed 128 characters'),
    email: z
      .string()
      .trim()
      .email('รูปแบบอีเมลไม่ถูกต้อง')
      .optional()
      .or(z.literal('')),
    fullName: z
      .string()
      .trim()
      .max(100, 'Full name cannot exceed 100 characters')
      .optional(),
    courtName: z
      .string()
      .trim()
      .max(100, 'Court name cannot exceed 100 characters')
      .optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    username: z.string().trim().min(1, 'Username is required').max(50),
    password: z.string().min(1, 'Password is required').max(128),
  })
  .strict();

export const oauthSyncSchema = z
  .object({
    provider: z.string().min(1),
    providerAccountId: z.string().min(1),
    email: z.string().email().optional().or(z.literal('')),
    fullName: z.string().optional(),
    avatarUrl: z.string().optional(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
  })
  .strict();

export const completeProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, 'กรุณากรอกชื่อ-นามสกุล'),
    courtName: z.string().trim().min(2, 'กรุณาระบุชื่อศาลหรือสังกัด'),
    password: z.string().min(8, 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร'),
  })
  .strict();

export const requestBindEmailSchema = z
  .object({
    newEmail: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง'),
  })
  .strict();

export const confirmBindEmailSchema = z
  .object({
    newEmail: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง'),
    otp: z.string().trim().length(6, 'รหัส OTP ต้องมี 6 หลัก'),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง'),
  })
  .strict();

export const resetPasswordWithOtpSchema = z
  .object({
    email: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง'),
    otp: z.string().trim().length(6, 'รหัส OTP ต้องมี 6 หลัก'),
    newPassword: z.string().min(8, 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร').max(128),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().max(100, 'ชื่อ-นามสกุลยาวเกินไป').optional(),
    courtName: z.string().trim().max(100, 'ชื่อศาลยาวเกินไป').optional(),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'กรุณาระบุรหัสผ่านปัจจุบัน'),
    newPassword: z.string().min(8, 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร').max(128),
  })
  .strict();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password, email, fullName, courtName } = req.body;
      const result = await authService.register({
        username,
        password,
        email: email || undefined,
        fullName,
        courtName,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Registration failed',
      });
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;
      const result = await authService.login({
        username,
        password,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || 'Login failed',
      });
    }
  }

  async oauthSync(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.oauthSync({
        ...req.body,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: 'OAuth synchronization successful',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'OAuth synchronization failed',
      });
    }
  }

  async completeProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { fullName, courtName, password } = req.body;
      const result = await authService.completeProfile({
        userId: req.user.id,
        fullName,
        courtName,
        password,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: 'Profile completed successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Complete profile failed',
      });
    }
  }

  async requestBindEmail(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { newEmail } = req.body;
      const result = await authService.requestBindEmail(
        req.user.id,
        newEmail,
        req.ip || req.socket.remoteAddress,
        req.headers['user-agent']
      );

      res.json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Request OTP failed',
      });
    }
  }

  async confirmBindEmail(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { newEmail, otp } = req.body;
      const result = await authService.confirmBindEmail(
        req.user.id,
        newEmail,
        otp,
        req.ip || req.socket.remoteAddress,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        message: 'ยืนยันและบันทึกอีเมลเรียบร้อยแล้ว',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Confirm OTP failed',
      });
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(
        email,
        req.ip || req.socket.remoteAddress,
        req.headers['user-agent']
      );

      res.json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Forgot password request failed',
      });
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp, newPassword } = req.body;
      const result = await authService.resetPasswordWithOtp(
        email,
        otp,
        newPassword,
        req.ip || req.socket.remoteAddress,
        req.headers['user-agent']
      );

      res.json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Reset password failed',
      });
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const profile = await authService.getProfile(req.user.id);
      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { fullName, courtName } = req.body;
      const updatedUser = await authService.updateProfile(
        req.user.id,
        fullName,
        courtName,
        req.ip || req.socket.remoteAddress,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        message: 'อัปเดตข้อมูลส่วนตัวสำเร็จ',
        data: updatedUser,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update profile',
      });
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(
        req.user.id,
        currentPassword,
        newPassword,
        req.ip || req.socket.remoteAddress,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to change password',
      });
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user) {
        await authService.logout(
          req.user.id,
          req.ip || req.socket.remoteAddress,
          req.headers['user-agent']
        );
      }
      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const authController = new AuthController();
