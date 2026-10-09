import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { z } from 'zod';

const judgePairSchema = z.object({
  judge1Name: z.string().min(1, 'กรุณาระบุชื่อผู้พิพากษาท่านที่ 1'),
  judge2Name: z.string().min(1, 'กรุณาระบุชื่อผู้พิพากษาท่านที่ 2'),
  courtName: z.string().optional(),
});

export const getJudgePairs = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const pairs = await prisma.judgePair.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ judgePairs: pairs });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createJudgePair = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const validated = judgePairSchema.parse(req.body);

    const pair = await prisma.judgePair.create({
      data: {
        userId,
        judge1Name: validated.judge1Name.trim(),
        judge2Name: validated.judge2Name.trim(),
        courtName: validated.courtName ? validated.courtName.trim() : null,
      },
    });

    res.status(201).json({ message: 'สร้างคู่ผู้พิพากษาสำเร็จ', judgePair: pair });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
    }
    res.status(500).json({ message: error.message });
  }
};

export const updateJudgePair = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const existing = await prisma.judgePair.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ message: 'ไม่พบคู่ผู้พิพากษานี้ หรือไม่มีสิทธิ์เข้าถึง' });
    }

    const validated = judgePairSchema.parse(req.body);

    const updated = await prisma.judgePair.update({
      where: { id },
      data: {
        judge1Name: validated.judge1Name.trim(),
        judge2Name: validated.judge2Name.trim(),
        courtName: validated.courtName ? validated.courtName.trim() : null,
      },
    });

    res.json({ message: 'อัปเดตคู่ผู้พิพากษาสำเร็จ', judgePair: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message || 'ข้อมูลไม่ถูกต้อง' });
    }
    res.status(500).json({ message: error.message });
  }
};

export const deleteJudgePair = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const existing = await prisma.judgePair.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ message: 'ไม่พบคู่ผู้พิพากษานี้ หรือไม่มีสิทธิ์เข้าถึง' });
    }

    await prisma.judgePair.delete({
      where: { id },
    });

    res.json({ message: 'ลบคู่ผู้พิพากษาสำเร็จ' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
