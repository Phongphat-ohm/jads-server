import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { z } from 'zod';

const paragraphTemplateSchema = z.object({
  title: z.string().min(1, 'กรุณาระบุชื่อเทมเพลต'),
  content: z.string().min(1, 'กรุณาระบุเนื้อหาข้อความย่อหน้า'),
  category: z.string().optional(),
});

export const getParagraphTemplates = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const templates = await prisma.paragraphTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ paragraphTemplates: templates });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createParagraphTemplate = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const validated = paragraphTemplateSchema.parse(req.body);

    const template = await prisma.paragraphTemplate.create({
      data: {
        userId,
        title: validated.title.trim(),
        content: validated.content.trim(),
        category: validated.category ? validated.category.trim() : 'ทั่วไป',
      },
    });

    res.status(201).json({ message: 'บันทึกเทมเพลตย่อหน้าสำเร็จ', paragraphTemplate: template });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
    }
    res.status(500).json({ message: error.message });
  }
};

export const updateParagraphTemplate = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const existing = await prisma.paragraphTemplate.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ message: 'ไม่พบเทมเพลตนี้ หรือไม่มีสิทธิ์เข้าถึง' });
    }

    const validated = paragraphTemplateSchema.parse(req.body);

    const updated = await prisma.paragraphTemplate.update({
      where: { id },
      data: {
        title: validated.title.trim(),
        content: validated.content.trim(),
        category: validated.category ? validated.category.trim() : existing.category,
      },
    });

    res.json({ message: 'อัปเดตเทมเพลตย่อหน้าสำเร็จ', paragraphTemplate: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
    }
    res.status(500).json({ message: error.message });
  }
};

export const deleteParagraphTemplate = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const existing = await prisma.paragraphTemplate.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ message: 'ไม่พบเทมเพลตนี้ หรือไม่มีสิทธิ์เข้าถึง' });
    }

    await prisma.paragraphTemplate.delete({
      where: { id },
    });

    res.json({ message: 'ลบเทมเพลตย่อหน้าสำเร็จ' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
