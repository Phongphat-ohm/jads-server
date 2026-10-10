import { prisma } from '../config/db';

export interface CreateAuditLogParams {
  userId?: string | null;
  action: string;
  resource?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status?: 'SUCCESS' | 'FAILED';
}

export interface ListAuditLogsParams {
  userId?: string;
  action?: string;
  status?: string;
  search?: string;
  sortBy?: 'createdAt' | 'action' | 'status' | 'ipAddress';
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class AuditLogService {
  /**
   * Records a new audit log entry
   */
  async createLog(params: CreateAuditLogParams) {
    try {
      return await prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          resource: params.resource,
          details: params.details ?? undefined,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          status: params.status || 'SUCCESS',
        },
      });
    } catch (error) {
      // Avoid failing the entire user request if audit log recording fails, but log error to console
      console.error('[AuditLogService] Failed to record audit log:', error);
      return null;
    }
  }

  /**
   * Retrieves audit logs with optional filters, search, sorting and pagination
   */
  async listLogs(params: ListAuditLogsParams = {}) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.userId) where.userId = params.userId;
    if (params.action && params.action !== 'ALL') {
      where.action = params.action;
    }
    if (params.status && params.status !== 'ALL') {
      where.status = params.status;
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        const end = new Date(params.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { action: { contains: q, mode: 'insensitive' } },
        { ipAddress: { contains: q, mode: 'insensitive' } },
        { resource: { contains: q, mode: 'insensitive' } },
      ];
    }

    const validSortFields = ['createdAt', 'action', 'status', 'ipAddress'];
    const sortBy = validSortFields.includes(params.sortBy || '') ? params.sortBy! : 'createdAt';
    const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      logs,
    };
  }
}

export const auditLogService = new AuditLogService();
