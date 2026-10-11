import { Request, Response } from 'express';
import { z } from 'zod';
import { feedbackService } from '../services/feedback.service';
import { auditLogService } from '../services/auditLog.service';
import { s3Service } from '../services/s3.service';

export const createFeedbackSchema = z.object({
  type: z.enum(['BUG', 'FEATURE_REQUEST', 'GENERAL_FEEDBACK', 'TEMPLATE_ISSUE']).default('GENERAL_FEEDBACK'),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  title: z.string().trim().min(2, 'กรุณาระบุหัวข้อความคิดเห็น').max(200, 'หัวข้อยาวเกินไป'),
  description: z.string().trim().min(5, 'กรุณาระบุรายละเอียดอย่างน้อย 5 ตัวอักษร'),
  screenshot: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
  attachmentName: z.string().optional().nullable(),
  pageUrl: z.string().optional().nullable(),
  appVersion: z.string().optional().nullable(),
  contactInfo: z.string().trim().max(150, 'ข้อมูลติดต่อยาวเกินไป').optional().nullable(),
});

export const updateFeedbackStatusSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']).optional(),
  adminNote: z.string().optional().nullable(),
});

export class FeedbackController {
  /**
   * Submit new feedback (Public or Authenticated)
   */
  async createFeedback(req: Request, res: Response) {
    try {
      const validated = createFeedbackSchema.parse(req.body);
      const userId = (req as any).user?.id || null;

      const feedback = await feedbackService.createFeedback({
        userId,
        type: validated.type,
        rating: validated.rating,
        title: validated.title,
        description: validated.description,
        screenshot: validated.screenshot,
        attachmentUrl: validated.attachmentUrl,
        attachmentName: validated.attachmentName,
        pageUrl: validated.pageUrl,
        appVersion: validated.appVersion,
        contactInfo: validated.contactInfo,
      });

      if (userId) {
        await auditLogService.createLog({
          userId,
          action: 'FEEDBACK_SUBMITTED',
          resource: 'feedback',
          details: { feedbackId: feedback.id, type: feedback.type, title: feedback.title },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          status: 'SUCCESS',
        });
      }

      res.status(201).json({
        success: true,
        message: 'ส่งความคิดเห็นเรียบร้อยแล้ว ขอบคุณสำหรับข้อเสนอแนะ',
        feedback,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, errors: error.errors });
        return;
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get current user's submitted feedbacks
   */
  async getMyFeedbacks(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await feedbackService.listFeedbacks({
        userId,
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
   * Admin: List all feedbacks with search and filters
   */
  async listAllFeedbacks(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string;
      const status = req.query.status as string;
      const search = req.query.search as string;

      const result = await feedbackService.listFeedbacks({
        type,
        status,
        search,
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
   * Admin: Update status and admin note
   */
  async updateFeedbackStatus(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const validated = updateFeedbackStatusSchema.parse(req.body);

      const feedback = await feedbackService.updateFeedbackStatus(
        id,
        validated.status,
        validated.adminNote ?? undefined
      );

      const adminId = (req as any).user?.id;
      await auditLogService.createLog({
        userId: adminId,
        action: 'FEEDBACK_STATUS_UPDATED',
        resource: 'feedback',
        details: { feedbackId: id, newStatus: validated.status, adminNote: validated.adminNote },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'SUCCESS',
      });

      res.json({
        success: true,
        message: 'อัปเดตสถานะความคิดเห็นเรียบร้อยแล้ว',
        feedback,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, errors: error.errors });
        return;
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Upload attachment for feedback (screenshots, PDFs, logs)
   */
  async uploadAttachment(req: Request, res: Response) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, message: 'กรุณาแนบไฟล์' });
      }

      // Max size: 10MB
      if (file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: 'ไฟล์มีขนาดเกิน 10MB' });
      }

      const userId = (req as any).user?.id || null;
      // Fix Multer UTF-8 filename encoding issue (Latin-1 mojibake)
      let originalName = file.originalname;
      try {
        originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      } catch {
        originalName = file.originalname;
      }

      const { s3Key, fileSize } = await s3Service.uploadFeedbackAttachment(
        originalName,
        file.buffer,
        file.mimetype || 'application/octet-stream',
        userId
      );

      res.status(201).json({
        success: true,
        message: 'อัปโหลดไฟล์แนบเรียบร้อยแล้ว',
        file: {
          originalName,
          s3Key,
          fileSize,
          mimeType: file.mimetype,
          // download URL endpoint
          url: `/api/feedbacks/attachments/${encodeURIComponent(s3Key)}`,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Download attachment
   */
  async downloadAttachment(req: Request, res: Response) {
    try {
      const key = decodeURIComponent(req.params.key);
      const buffer = await s3Service.getFeedbackAttachmentBuffer(key);
      const fileName = key.split('/').pop()?.replace(/^\d+_/, '') || 'attachment';
      const safeAsciiName = fileName.replace(/[^\x20-\x7E]/g, '_');
      const encodedUtf8Name = encodeURIComponent(fileName);

      res.setHeader(
        'Content-Disposition',
        `inline; filename="${safeAsciiName}"; filename*=UTF-8''${encodedUtf8Name}`
      );
      // Infer basic mime type
      if (fileName.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
        const ext = fileName.split('.').pop()?.toLowerCase();
        res.setHeader('Content-Type', `image/${ext === 'jpg' ? 'jpeg' : ext}`);
      } else if (fileName.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
      }

      res.send(buffer);
    } catch (error: any) {
      res.status(404).json({ success: false, message: 'ไม่พบไฟล์แนบที่ระบุ' });
    }
  }

  /**
   * Admin: Delete feedback
   */
  async deleteFeedback(req: Request, res: Response) {
    try {
      const id = req.params.id;
      await feedbackService.deleteFeedback(id);

      const adminId = (req as any).user?.id;
      await auditLogService.createLog({
        userId: adminId,
        action: 'FEEDBACK_DELETED',
        resource: 'feedback',
        details: { feedbackId: id },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'SUCCESS',
      });

      res.json({
        success: true,
        message: 'ลบความคิดเห็นเรียบร้อยแล้ว',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Admin: Get statistics
   */
  async getStats(req: Request, res: Response) {
    try {
      const stats = await feedbackService.getFeedbackStats();
      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export const feedbackController = new FeedbackController();
