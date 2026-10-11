import { Request, Response } from 'express';
import { z } from 'zod';
import { adminService } from '../services/admin.service';
import { auditLogService } from '../services/auditLog.service';

export const updateRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร'),
});

export class AdminController {
  /**
   * System Dashboard Statistics
   */
  async getDashboardStats(req: Request, res: Response) {
    try {
      const stats = await adminService.getDashboardStats();
      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * List users
   */
  async listUsers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const role = req.query.role as string;
      const search = req.query.search as string;

      const result = await adminService.listUsers({
        search,
        role,
        page,
        limit,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Update user role
   */
  async updateUserRole(req: Request, res: Response) {
    try {
      const userId = req.params.id;
      const validated = updateRoleSchema.parse(req.body);
      const currentAdminId = (req as any).user.id;

      const updatedUser = await adminService.updateUserRole(
        userId,
        validated.role,
        currentAdminId
      );

      await auditLogService.createLog({
        userId: currentAdminId,
        action: 'ADMIN_USER_ROLE_UPDATED',
        resource: 'user',
        details: { targetUserId: userId, newRole: validated.role },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'SUCCESS',
      });

      res.json({
        success: true,
        message: `ปรับปรุงสิทธิ์ผู้ใช้เป็น ${validated.role} เรียบร้อยแล้ว`,
        user: updatedUser,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, errors: error.errors });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Reset user password
   */
  async resetUserPassword(req: Request, res: Response) {
    try {
      const userId = req.params.id;
      const validated = resetPasswordSchema.parse(req.body);
      const currentAdminId = (req as any).user.id;

      await adminService.resetUserPassword(userId, validated.newPassword);

      await auditLogService.createLog({
        userId: currentAdminId,
        action: 'ADMIN_USER_PASSWORD_RESET',
        resource: 'user',
        details: { targetUserId: userId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'SUCCESS',
      });

      res.json({
        success: true,
        message: 'รีเซ็ตรหัสผ่านของผู้ใช้เรียบร้อยแล้ว',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, errors: error.errors });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Delete user
   */
  async deleteUser(req: Request, res: Response) {
    try {
      const userId = req.params.id;
      const currentAdminId = (req as any).user.id;

      await adminService.deleteUser(userId, currentAdminId);

      await auditLogService.createLog({
        userId: currentAdminId,
        action: 'ADMIN_USER_DELETED',
        resource: 'user',
        details: { targetUserId: userId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'SUCCESS',
      });

      res.json({
        success: true,
        message: 'ลบผู้ใช้เรียบร้อยแล้ว',
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * List all audit logs across system
   */
  async listAllAuditLogs(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      const action = req.query.action as string;
      const status = req.query.status as string;
      const search = req.query.search as string;
      const userId = req.query.userId as string;

      const result = await adminService.listAllAuditLogs({
        page,
        limit,
        action,
        status,
        search,
        userId,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export const adminController = new AdminController();
