import crypto from 'crypto';
import { prisma } from '../config/db';
import { mailService } from './mail.service';
import { auditLogService } from './auditLog.service';

export type OtpPurpose = 'RESET_PASSWORD' | 'CHANGE_EMAIL';

export class OtpService {
  /**
   * Generates a 6-digit secure numeric OTP
   */
  private generateNumericOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Creates a SHA-256 hash of the OTP for safe database storage
   */
  private hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Generates and sends OTP to the given email
   */
  async sendOtp(email: string, purpose: OtpPurpose, userId?: string, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = email.trim().toLowerCase();

    // Check rate limit: if an active OTP was created in the last 60 seconds, reject
    const recentOtp = await prisma.emailOtp.findFirst({
      where: {
        email: normalizedEmail,
        purpose,
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000), // within 1 minute
        },
      },
    });

    if (recentOtp) {
      throw new Error('กรุณารอ 60 วินาทีก่อนขอรหัส OTP ใหม่อีกครั้ง');
    }

    // Invalidate old un-used OTPs for this email and purpose
    await prisma.emailOtp.updateMany({
      where: {
        email: normalizedEmail,
        purpose,
        isUsed: false,
      },
      data: {
        isUsed: true,
      },
    });

    const otp = this.generateNumericOtp();
    const otpHash = this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    await prisma.emailOtp.create({
      data: {
        email: normalizedEmail,
        otpHash,
        purpose,
        userId: userId || null,
        expiresAt,
      },
    });

    // Send email via Resend
    const sent = await mailService.sendOtpEmail(normalizedEmail, otp, purpose);
    if (!sent) {
      console.warn(`[OtpService] Could not send email via Resend, verify config.`);
    }

    await auditLogService.createLog({
      userId: userId || null,
      action: `OTP_REQUEST_${purpose}`,
      resource: 'otp',
      details: { email: normalizedEmail, purpose },
      ipAddress,
      userAgent,
      status: 'SUCCESS',
    });

    return { success: true, message: 'ส่งรหัส OTP เรียบร้อยแล้ว' };
  }

  /**
   * Verifies the provided OTP
   */
  async verifyOtp(email: string, otp: string, purpose: OtpPurpose, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const providedOtpHash = this.hashOtp(otp.trim());

    const record = await prisma.emailOtp.findFirst({
      where: {
        email: normalizedEmail,
        purpose,
        isUsed: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!record) {
      throw new Error('ไม่พบคำขอ OTP หรือรหัสหมดอายุแล้ว โปรดขอรหัสใหม่');
    }

    if (new Date() > record.expiresAt) {
      await prisma.emailOtp.update({
        where: { id: record.id },
        data: { isUsed: true },
      });
      throw new Error('รหัส OTP หมดอายุแล้ว (เกิน 5 นาที) โปรดขอรหัสใหม่');
    }

    if (record.attempts >= 5) {
      await prisma.emailOtp.update({
        where: { id: record.id },
        data: { isUsed: true },
      });
      throw new Error('คุณกรอกรหัส OTP ไม่ถูกต้องเกินจำนวนครั้งที่กำหนด โปรดขอรหัสใหม่');
    }

    if (record.otpHash !== providedOtpHash) {
      await prisma.emailOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new Error('รหัส OTP ไม่ถูกต้อง');
    }

    // Mark as used
    await prisma.emailOtp.update({
      where: { id: record.id },
      data: { isUsed: true },
    });

    await auditLogService.createLog({
      userId: record.userId || null,
      action: `OTP_VERIFIED_${purpose}`,
      resource: 'otp',
      details: { email: normalizedEmail, purpose },
      ipAddress,
      userAgent,
      status: 'SUCCESS',
    });

    return { success: true, userId: record.userId };
  }
}

export const otpService = new OtpService();
