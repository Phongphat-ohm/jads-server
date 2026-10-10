import { Request, Response, NextFunction } from 'express';
import { auditLogService } from '../services/auditLog.service';

export class AuditLogController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedPage = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const parsedLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const page = Math.max(1, isNaN(parsedPage) ? 1 : parsedPage);
      const limit = Math.min(100, Math.max(1, isNaN(parsedLimit) ? 20 : parsedLimit));

      const action = req.query.action && req.query.action !== 'ALL' ? String(req.query.action).substring(0, 50) : undefined;
      const status = req.query.status && req.query.status !== 'ALL' ? String(req.query.status).substring(0, 20) : undefined;
      const search = req.query.search ? String(req.query.search).substring(0, 100) : undefined;
      const sortBy = req.query.sortBy ? (String(req.query.sortBy) as any) : undefined;
      const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      // If user is not admin, they can ONLY view their own audit logs
      let userId: string | undefined = req.user?.id;
      if (req.user?.role === 'ADMIN' && req.query.userId) {
        userId = String(req.query.userId);
      } else if (req.user?.role === 'ADMIN' && !req.query.userId) {
        userId = undefined; // Admin can view all
      }

      const result = await auditLogService.listLogs({
        page,
        limit,
        userId,
        action,
        status,
        search,
        sortBy,
        sortOrder,
        startDate,
        endDate,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const auditLogController = new AuditLogController();
