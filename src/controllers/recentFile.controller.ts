import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { recentFileService } from '../services/recentFile.service';

export const addRecentFileSchema = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1, 'File name is required')
      .max(255, 'File name cannot exceed 255 characters'),
    localPath: z
      .string()
      .trim()
      .min(1, 'Local path is required')
      .max(2048, 'Local path cannot exceed 2048 characters'),
    fileType: z
      .string()
      .trim()
      .max(30, 'File type cannot exceed 30 characters')
      .regex(/^[a-zA-Z0-9_.-]*$/, 'Invalid file type format')
      .optional(),
  })
  .strict();

export class RecentFileController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const parsedLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const limit = Math.min(100, Math.max(1, isNaN(parsedLimit) ? 50 : parsedLimit));
      const files = await recentFileService.listRecentFiles(req.user.id, limit);

      res.json({
        success: true,
        data: files,
      });
    } catch (error) {
      next(error);
    }
  }

  async add(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { fileName, localPath, fileType } = req.body;
      const result = await recentFileService.addOrUpdateRecentFile({
        userId: req.user.id,
        fileName,
        localPath,
        fileType,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        message: 'Recent file registered securely',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to save recent file',
      });
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const fileId = req.params.id;
      if (!fileId) {
        return res.status(400).json({ success: false, message: 'File ID is required' });
      }

      await recentFileService.deleteRecentFile(
        req.user.id,
        fileId,
        req.ip || req.socket.remoteAddress,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        message: 'Recent file removed successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete recent file',
      });
    }
  }
}

export const recentFileController = new RecentFileController();
