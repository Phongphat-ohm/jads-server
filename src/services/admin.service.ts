import { prisma } from '../config/db';
import { auditLogService } from './auditLog.service';
import bcrypt from 'bcryptjs';

export interface ListUsersParams {
  search?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export interface ListAllAuditLogsParams {
  search?: string;
  action?: string;
  status?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

export class AdminService {
  /**
   * System Overview Statistics
   */
  async getDashboardStats() {
    const [
      totalUsers,
      adminUsers,
      totalRecentFiles,
      totalJudgePairs,
      totalTemplates,
      totalFeedbacks,
      pendingFeedbacks,
      totalAuditLogs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.recentFile.count(),
      prisma.judgePair.count(),
      prisma.paragraphTemplate.count(),
      prisma.feedback.count(),
      prisma.feedback.count({ where: { status: 'PENDING' } }),
      prisma.auditLog.count(),
    ]);

    // Count document generations
    const docGenerations = await prisma.auditLog.count({
      where: {
        action: { in: ['GENERATE_DOCUMENT', 'DOCUMENT_GENERATED', 'FILL_TEMPLATE'] },
      },
    });

    // Recent 5 registered users
    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        courtName: true,
        role: true,
        createdAt: true,
      },
    });

    // Recent 10 audit logs
    const recentLogs = await prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    return {
      totalUsers,
      adminUsers,
      totalRecentFiles,
      totalJudgePairs,
      totalTemplates,
      totalFeedbacks,
      pendingFeedbacks,
      totalAuditLogs,
      docGenerations,
      recentUsers,
      recentLogs,
    };
  }

  /**
   * List users with pagination and search
   */
  async listUsers(params: ListUsersParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.role && params.role !== 'ALL') {
      where.role = params.role;
    }
    if (params.search) {
      where.OR = [
        { username: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { fullName: { contains: params.search, mode: 'insensitive' } },
        { courtName: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          isEmailVerified: true,
          fullName: true,
          courtName: true,
          role: true,
          isProfileComplete: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              recentFiles: true,
              judgePairs: true,
              paragraphTemplates: true,
              feedbacks: true,
              auditLogs: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      items,
    };
  }

  /**
   * Update user role (USER <-> ADMIN)
   */
  async updateUserRole(userId: string, newRole: 'USER' | 'ADMIN', currentAdminId: string) {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ');
    }

    if (userId === currentAdminId && newRole !== 'ADMIN') {
      // Prevent admin from demoting themselves if no other admin exists
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        throw new Error('ไม่สามารถลดสิทธิ์ตนเองได้เนื่องจากคุณเป็นผู้ดูแลระบบคนเดียวในระบบ');
      }
    }

    return await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        fullName: true,
        courtName: true,
      },
    });
  }

  /**
   * Reset user password (Admin override)
   */
  async resetUserPassword(userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    return await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string, currentAdminId: string) {
    if (userId === currentAdminId) {
      throw new Error('ไม่สามารถลบบัญชีผู้ใช้ของตนเองได้');
    }

    return await prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * System-wide Audit Logs
   */
  async listAllAuditLogs(params: ListAllAuditLogsParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 25));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.userId) where.userId = params.userId;
    if (params.action && params.action !== 'ALL') where.action = params.action;
    if (params.status && params.status !== 'ALL') where.status = params.status;
    if (params.search) {
      where.OR = [
        { action: { contains: params.search, mode: 'insensitive' } },
        { resource: { contains: params.search, mode: 'insensitive' } },
        { ipAddress: { contains: params.search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { username: { contains: params.search, mode: 'insensitive' } },
              { fullName: { contains: params.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              courtName: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      items,
    };
  }
}

export const adminService = new AdminService();
