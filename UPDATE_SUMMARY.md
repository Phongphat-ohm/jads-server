# สรุปภาพรวมการอัปเดตระบบ JADS (Court Automation System)

เอกสารสรุปการพัฒนาระบบและปรับปรุงความสามารถทั้งหมดตามข้อกำหนดล่าสุด

---

## 1. ระบบยืนยันตัวตนและ OAuth Provider (Authentication & Authorization)

### 1.1 Google Provider OAuth 2.0 (NextAuth)
- เชื่อมต่อระบบ OAuth 2.0 ร่วมกับ NextAuth (`client/app/api/auth/[...nextauth]/route.ts`)
- **ถอด Microsoft Entra ID / Azure AD ออกทั้งหมด** คงเหลือเฉพาะ **Google Login** เพื่อความกระชับและตรงตามวัตถุประสงค์
- เพิ่ม Safe Fallback และ Endpoint ตรวจสอบสถานะการตั้งค่าแบบเรียลไทม์ (`/api/auth/check-google`) ป้องกัน NextAuth Crash หากยังไม่ได้ระบุ `GOOGLE_CLIENT_ID`
- หน้า Login (`client/app/login/page.tsx`) มี Pop-up SweetAlert แจ้งเตือนชัดเจนหากยังไม่ได้ระบุ Client ID ในไฟล์ `.env`

### 1.2 Onboarding Flow สำหรับผู้ใช้ OAuth ใหม่
- ผู้ใช้งานที่ลงชื่อเข้าใช้ผ่าน Google ครั้งแรก จะถูกนำทางไปยังหน้า **`/onboarding`** อัตโนมัติ
- บังคับให้กรอกข้อมูลสำคัญ:
  - **ชื่อ - นามสกุล**
  - **ชื่อศาลที่ปฏิบัติงาน / สังกัด**
  - **ตั้งรหัสผ่านสำหรับใช้งานระบบ**
- เมื่อกรอกครบถ้วนและกดบันทึก ข้อมูลจะถูกบันทึกผ่าน `/api/auth/complete-profile` และนำทางไปยังหน้าภาพรวม (`/overview`) ทันที

### 1.3 สถาปัตยกรรมซิงค์บัญชีผู้ใช้ (OAuth Account Sync)
- ตาราง `Account` ในฐานข้อมูล PostgreSQL เชื่อมโยงบัญชี Provider เข้ากับบัญชี User ในระบบ JADS
- Express Backend ให้บริการ Endpoint `/api/auth/oauth/sync` ในการจับคู่หรือสร้างบัญชีอัตโนมัติ

---

## 2. ระบบอีเมลยืนยันตัวตน, OTP และกู้คืนรหัสผ่าน (Resend Email Service)

### 2.1 บริการ Resend Mail & OTP
- เชื่อมต่อ SDK `resend` อย่างปลอดภัยผ่าน `server/src/services/mail.service.ts`
- พัฒนาระบบ `server/src/services/otp.service.ts` จัดการรหัส OTP 6 หลัก พร้อมระบบความปลอดภัย:
  - รหัสมีอายุ 10 นาที (Expires in 10 minutes)
  - ป้องกัน Brute-force: ตรวจสอบความถูกต้องและจำกัดจำนวนครั้ง
  - ตาราง `EmailOtp` ใน Prisma Schema รองรับ Purpose หลากหลาย (`PASSWORD_RESET`, `EMAIL_VERIFICATION`)

### 2.2 ระบบกู้คืนรหัสผ่าน (Forgot Password Flow)
- พัฒนาหน้าเว็บ **`/forgot-password`** แยกเป็นสัดส่วน
- ขั้นตอนการทำงาน:
  1. ระบุอีเมลเพื่อขอรับรหัส OTP ทางอีเมล
  2. กรอกรหัส OTP 6 หลัก และตั้งรหัสผ่านใหม่
  3. ยืนยันและเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที

### 2.3 การแสดงผลอีเมลและระบบผูก/เปลี่ยนอีเมล
- ในขั้นตอนสมัครสมาชิกทั่วไป ไม่บังคับยืนยัน OTP เพื่อความรวดเร็วในการเริ่มใช้งาน
- หน้าตั้งค่า (`/settings`):
  - แสดงสถานะอีเมลพร้อมป้ายสถานะ **`✓ ยืนยันแล้ว`** สีเขียวสดใส
  - ระบบเปลี่ยน/ผูกอีเมลใหม่ผ่านหน้าต่าง Modal พร้อมส่ง OTP ไปยังอีเมลใหม่เพื่อตรวจสอบความเป็นเจ้าของจริงก่อนบันทึก

---

## 3. การปรับปรุง UI/UX และ Responsive Design ทุกหน้าจอ

### 3.1 Responsive Navigation & Layout
- เมนู Header และ Navbar รองรับหน้าจอคอมพิวเตอร์, แท็บเล็ต และมือถือ
- เพิ่ม Mobile Drawer Navigation พร้อมไอคอนและเอฟเฟกต์ Glassmorphism สวยงาม

### 3.2 ตารางเลือกคดี (`DataTablePreview.tsx`)
- ปรับขนาดและสไตล์ปุ่ม Action ในตารางให้มีความสมดุลและอ่านง่าย
- เปลี่ยนปุ่มจากข้อความยาว เป็นปุ่มสถานะสั้นกระชับ:
  - ก่อนเลือก: **`เลือกคดี`** (ปุ่มโทนม่วง)
  - หลังเลือก: **`✓ เลือกแล้ว`** (ปุ่มโทนเขียว พร้อมไอคอน Checkmark)

### 3.3 หน้าตรวจสอบข้อมูลคดี (`/review`)
- ปรับ Layout เป็น Responsive 2 คอลัมน์ (ข้อมูลคดีความ & ข้อมูลนัดพิจารณา)
- กล่องแสดงผลแบบการ์ด แยกหมวดหมู่ชัดเจน ตัวหนังสืออ่านง่าย ไม่แออัด

### 3.4 หน้าอื่นๆ ที่ได้รับการปรับให้เป็น Responsive
- **`/generator`**: หน้าอัปโหลดไฟล์ Excel และเลือกเอกสารคำร้อง
- **`/judges`**: หน้าจัดการองค์คณะผู้พิพากษา
- **`/paragraph-templates`**: หน้าจัดการข้อความย่อหน้าสำเร็จรูป
- **`/recent-files`**: หน้ารายการไฟล์เอกสารล่าสุด
- **`/audit-logs`**: หน้าประวัติการใช้งานระบบ
- **`/settings`**: หน้าการตั้งค่าบัญชีและข้อมูลสังกัดศาล

---

## 4. โครงสร้าง Environment และความปลอดภัย

- **ไม่การ Hardcode ค่าความลับ**:
  - ย้ายการเชื่อมต่อ Resend, S3, NextAuth, Database ทั้งหมดเข้าสู่ไฟล์ `.env`
- **จัดทำ `.env.example` สมบูรณ์**:
  - `server/.env.example`: อธิบายตัวแปรฝั่งเซิร์ฟเวอร์ครบถ้วน
  - `client/.env.example`: อธิบายตัวแปรฝั่งไคลเอนต์และ NextAuth ละเอียด
- **การแยกการทำงานของ Git**:
  - `client/` เชื่อมต่อไปยัง repository `Phongphat-ohm/jads.git` (branch `jads`)
  - `server/` เชื่อมต่อไปยัง repository `Phongphat-ohm/jads-server.git` (branch `jads-server`)
