import { Resend } from 'resend';
import { env } from '../config/env';

export class MailService {
  private resend: Resend | null = null;

  constructor() {
    if (env.RESEND_API_KEY) {
      this.resend = new Resend(env.RESEND_API_KEY);
    }
  }

  /**
   * Sends an OTP verification email using judicial-themed styling
   */
  async sendOtpEmail(to: string, otp: string, purpose: 'RESET_PASSWORD' | 'CHANGE_EMAIL'): Promise<boolean> {
    const isReset = purpose === 'RESET_PASSWORD';
    const subject = isReset
      ? '[JADS Court] รหัส OTP สำหรับรีเซ็ตรหัสผ่านของคุณ'
      : '[JADS Court] รหัส OTP สำหรับยืนยันอีเมลของคุณ';

    const title = isReset ? 'รีเซ็ตรหัสผ่าน (Reset Password)' : 'ยืนยันที่อยู่อีเมล (Verify Email)';
    const description = isReset
      ? 'คุณได้ส่งคำขอเพื่อรีเซ็ตรหัสผ่านสำหรับเข้าใช้งานระบบ JADS Court โปรดนำรหัส OTP ด้านล่างนี้ไปกรอกเพื่อดำเนินการต่อ'
      : 'คุณได้ทำการผูกหรือเปลี่ยนที่อยู่อีเมลในระบบ JADS Court โปรดนำรหัส OTP ด้านล่างนี้ไปยืนยัน';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: 'Kanit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #1E293B; }
    .container { max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #6B21A8 0%, #3B0764 100%); padding: 32px 24px; text-align: center; color: #FFFFFF; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #E9D5FF; }
    .content { padding: 32px 28px; }
    .title { font-size: 17px; font-weight: 600; color: #0F172A; margin-top: 0; margin-bottom: 12px; }
    .desc { font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px; }
    .otp-box { background: #FAF5FF; border: 2px dashed #9333EA; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #6B21A8; font-family: monospace; }
    .otp-expiry { font-size: 12px; color: #7E22CE; margin-top: 8px; font-weight: 500; }
    .note { font-size: 12px; color: #94A3B8; line-height: 1.5; border-top: 1px solid #F1F5F9; padding-top: 18px; margin-top: 24px; }
    .footer { text-align: center; font-size: 11px; color: #94A3B8; padding: 16px; background: #F8FAFC; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>JADS COURT AUTOMATION</h1>
      <p>ระบบสร้างเอกสารคดีความศาลยุติธรรม</p>
    </div>
    <div class="content">
      <h2 class="title">${title}</h2>
      <p class="desc">${description}</p>
      
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="otp-expiry">รหัส OTP มีอายุ 5 นาที และใช้ได้เพียงครั้งเดียว</div>
      </div>

      <p class="desc" style="font-size: 13px;">หากคุณไม่ได้เป็นผู้ทำรายการนี้ โปรดเพิกเฉยต่ออีเมลฉบับนี้ รหัสผ่านและบัญชีของคุณจะยังคงปลอดภัย</p>

      <div class="note">
        <strong>ข้อควรระวังด้านความปลอดภัย:</strong> เจ้าหน้าที่ศาลหรือผู้ดูแลระบบจะไม่มีการขอรหัส OTP นี้จากคุณไม่ว่ากรณีใดๆ
      </div>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} JADS Court Document Automation System. All rights reserved.
    </div>
  </div>
</body>
</html>
    `;

    if (!this.resend) {
      console.warn(`[MailService] RESEND_API_KEY is not configured. Emulating email sending to ${to}`);
      console.log(`[MailService OTP Emulation] To: ${to} | Purpose: ${purpose} | OTP: ${otp}`);
      return true;
    }

    try {
      const response = await this.resend.emails.send({
        from: env.EMAIL_FROM,
        to: [to],
        subject,
        html: htmlContent,
      });

      if (response.error) {
        console.error('[MailService Error]:', response.error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[MailService Send Exception]:', err);
      return false;
    }
  }
}

export const mailService = new MailService();
