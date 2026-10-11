import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { s3Service } from '../services/s3.service';

export const getCloudFiles = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const files = await prisma.cloudFile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ cloudFiles: files });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const uploadCloudFile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'กรุณาแนบไฟล์ Excel (.xlsx / .xls)' });
    }

    if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
      return res.status(400).json({ message: 'อนุญาตเฉพาะไฟล์ Excel (.xlsx หรือ .xls) เท่านั้น' });
    }

    // Fix Multer UTF-8 filename encoding issue (Latin-1 mojibake)
    let fileName = file.originalname;
    try {
      fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch {
      fileName = file.originalname;
    }

    const { s3Key, fileSize } = await s3Service.uploadFile(
      userId,
      fileName,
      file.buffer,
      file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const cloudFile = await prisma.cloudFile.create({
      data: {
        userId,
        fileName,
        s3Key,
        fileSize,
        mimeType: file.mimetype,
      },
    });

    res.status(201).json({
      message: 'อัปโหลดไฟล์ขึ้น Cloud สำเร็จ',
      cloudFile,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const downloadCloudFile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const cloudFile = await prisma.cloudFile.findFirst({
      where: { id, userId },
    });
    if (!cloudFile) {
      return res.status(404).json({ message: 'ไม่พบไฟล์นี้ หรือไม่มีสิทธิ์เข้าถึง' });
    }

    const buffer = await s3Service.getFileBuffer(userId, cloudFile.s3Key);

    const safeAsciiName = cloudFile.fileName.replace(/[^\x20-\x7E]/g, '_');
    const encodedFileName = encodeURIComponent(cloudFile.fileName);
    res.setHeader('Content-Type', cloudFile.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodedFileName}`
    );
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCloudFile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const cloudFile = await prisma.cloudFile.findFirst({
      where: { id, userId },
    });
    if (!cloudFile) {
      return res.status(404).json({ message: 'ไม่พบไฟล์นี้ หรือไม่มีสิทธิ์เข้าถึง' });
    }

    await s3Service.deleteFile(userId, cloudFile.s3Key);
    await prisma.cloudFile.delete({
      where: { id },
    });

    res.json({ message: 'ลบไฟล์จาก Cloud สำเร็จ' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
