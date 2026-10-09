# Docx Templater API Server

เซิร์ฟเวอร์ API สำหรับรับข้อมูล JSON แล้วนำไปกรอกลงในไฟล์ Word template (`.docx`) ในโฟลเดอร์ `/templates` โดยใช้ `docxtemplater` โดยคงรูปแบบ Font, ขนาดตัวอักษร, สไตล์, เส้นใต้ และการจัดหน้าไว้ทั้งหมด

## 🚀 วิธีเปิดใช้งานเซิร์ฟเวอร์

```bash
bun run start
# หรือโหมด hot-reload:
bun run dev
```

เซิร์ฟเวอร์จะรันที่พอร์ต `http://localhost:3000`

---

## 🌐 ทดสอบผ่านเว็บเบราว์เซอร์ (Web Tester)
เปิดเบราว์เซอร์ไปที่:
👉 **http://localhost:3000**
มีหน้าเว็บ UI ให้เลือก Template และใส่ข้อมูล JSON พร้อมกดดาวน์โหลดไฟล์ `.docx` ได้ทันที

---

## ⚡ API Endpoints

### 1. ทดสอบดาวน์โหลดทันทีด้วย Mockup Data
- **URL**: `GET /api/test`
- **คำอธิบาย**: ดึงไฟล์ docx ที่กรอกด้วยข้อมูลตัวอย่างทันทีเพื่อความรวดเร็วในการทดสอบ

### 2. ดูรายชื่อ Templates ทั้งหมด
- **URL**: `GET /api/templates`
- **Response**:
```json
{
  "success": true,
  "templates": ["รายงาน2356.docx"]
}
```

### 3. กรอกข้อมูลลง Template (POST Endpoint)
- **URL**: `POST /api/generate` (หรือ `POST /api/fill-template`)
- **Headers**: `Content-Type: application/json`
- **Response**: ไฟล์ Binary ของ `.docx` (Content-Disposition: attachment)

#### Request Body รูปแบบที่ 1 (ระบุ template และ data แยกกัน):
```json
{
  "template": "รายงาน2356.docx",
  "data": {
    "case_black_no": "123/2569",
    "case_red_no": "456/2569",
    "court_name": "ศาลจังหวัดนนทบุรี",
    "date": "8",
    "month": "ตุลาคม",
    "year": "2569",
    "case_type": "แพ่ง",
    "plaintiff_name": "นาย ก",
    "defendant_name": "นาย ข",
    "hearing_time": "09.00"
  }
}
```

#### Request Body รูปแบบที่ 2 (ส่งเฉพาะ data โดยตรง):
```json
{
  "case_black_no": "123/2569",
  "case_red_no": "456/2569",
  "court_name": "ศาลจังหวัดนนทบุรี",
  "date": "8",
  "month": "ตุลาคม",
  "year": "2569",
  "case_type": "แพ่ง",
  "plaintiff_name": "นาย ก",
  "defendant_name": "นาย ข",
  "hearing_time": "09.00"
}
```

---

## 💻 ตัวอย่างการเรียกด้วย cURL
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "template": "รายงาน2356.docx",
    "data": {
      "case_black_no": "123/2569",
      "case_red_no": "456/2569",
      "court_name": "ศาลจังหวัดนนทบุรี",
      "date": "8",
      "month": "ตุลาคม",
      "year": "2569",
      "case_type": "แพ่ง",
      "plaintiff_name": "นาย ก",
      "defendant_name": "นาย ข",
      "hearing_time": "09.00"
    }
  }' \
  --output result.docx
```
