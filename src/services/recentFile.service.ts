import { prisma } from '../config/db';
import { encryptText, decryptText } from './crypto.service';
import { auditLogService } from './auditLog.service';

export interface AddRecentFileDTO {
  userId: string;
  fileName: string;
  localPath: string;
  fileType?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class RecentFileService {
  /**
   * Adds or updates a recent file record for a user.
   * Encrypts the localPath before storing it in the database.
   */
  async addOrUpdateRecentFile(data: AddRecentFileDTO) {
    if (!data.localPath || !data.localPath.trim()) {
      throw new Error('Local file path is required');
    }

    if (!data.fileName || !data.fileName.trim()) {
      throw new Error('File name is required');
    }

    const encryptedPath = encryptText(data.localPath.trim());

    // Check if the user already has this file path registered by checking recent files
    // Since paths are encrypted, we can query recent files for this user and match decrypted paths
    const userFiles = await prisma.recentFile.findMany({
      where: { userId: data.userId },
    });

    let existingFileId: string | null = null;
    for (const f of userFiles) {
      try {
        const decrypted = decryptText(f.encryptedPath);
        if (decrypted.toLowerCase() === data.localPath.trim().toLowerCase()) {
          existingFileId = f.id;
          break;
        }
      } catch {
        // Ignore decryption error for legacy/corrupt records
      }
    }

    let record;
    if (existingFileId) {
      record = await prisma.recentFile.update({
        where: { id: existingFileId },
        data: {
          fileName: data.fileName,
          encryptedPath, // Re-encrypt with fresh IV
          fileType: data.fileType,
          lastOpenedAt: new Date(),
        },
      });
    } else {
      record = await prisma.recentFile.create({
        data: {
          userId: data.userId,
          fileName: data.fileName,
          encryptedPath,
          fileType: data.fileType,
          lastOpenedAt: new Date(),
        },
      });
    }

    // Write audit log (Do NOT log the plain local path into audit logs to preserve confidentiality)
    await auditLogService.createLog({
      userId: data.userId,
      action: existingFileId ? 'RECENT_FILE_TOUCH' : 'RECENT_FILE_ADD',
      resource: 'recent_file',
      details: {
        recentFileId: record.id,
        fileName: data.fileName,
        fileType: data.fileType,
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: 'SUCCESS',
    });

    return {
      id: record.id,
      fileName: record.fileName,
      localPath: data.localPath.trim(),
      fileType: record.fileType,
      lastOpenedAt: record.lastOpenedAt,
      createdAt: record.createdAt,
    };
  }

  /**
   * Retrieves recent files for a user, decrypting each localPath
   */
  async listRecentFiles(userId: string, limit = 50) {
    const records = await prisma.recentFile.findMany({
      where: { userId },
      orderBy: { lastOpenedAt: 'desc' },
      take: limit,
    });

    return records.map((record) => {
      let localPath = '';
      try {
        localPath = decryptText(record.encryptedPath);
      } catch {
        localPath = '[Decryption Failed]';
      }

      return {
        id: record.id,
        fileName: record.fileName,
        localPath,
        fileType: record.fileType,
        lastOpenedAt: record.lastOpenedAt,
        createdAt: record.createdAt,
      };
    });
  }

  /**
   * Removes a recent file record
   */
  async deleteRecentFile(userId: string, fileId: string, ipAddress?: string, userAgent?: string) {
    const record = await prisma.recentFile.findFirst({
      where: { id: fileId, userId },
    });

    if (!record) {
      throw new Error('Recent file not found or unauthorized');
    }

    await prisma.recentFile.delete({
      where: { id: fileId },
    });

    await auditLogService.createLog({
      userId,
      action: 'RECENT_FILE_DELETE',
      resource: 'recent_file',
      details: {
        fileId,
        fileName: record.fileName,
      },
      ipAddress,
      userAgent,
      status: 'SUCCESS',
    });

    return { success: true };
  }
}

export const recentFileService = new RecentFileService();
