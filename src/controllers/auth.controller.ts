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
      const { username, password, fullName, courtName } = req.body;
      const result = await authService.register({
        username,
        password,
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
