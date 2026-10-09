import express, { Request, Response } from 'express';
import cors from 'cors';
import { env } from './config/env';
import apiRoutes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { templateService } from './services/template.service';

import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './config/swagger';

export const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global UTF-8 charset middleware for all responses
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Swagger API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() });
});

// Root Tester UI
app.get('/', (req: Request, res: Response) => {
  const templates = templateService.getAvailableTemplates();
  const templateOptions = templates
    .map((t) => `<option value="${t}">${t}</option>`)
    .join('');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JADS Backend Server API</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f6f9; margin: 0; padding: 2rem; color: #333; }
    .card { background: white; max-width: 800px; margin: 0 auto 2rem; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
    h1 { color: #1a73e8; margin-top: 0; font-size: 1.6rem; }
    h2 { color: #333; font-size: 1.2rem; border-bottom: 2px solid #e8f0fe; padding-bottom: 6px; margin-top: 1.5rem; }
    label { display: block; margin: 10px 0 5px; font-weight: 600; font-size: 0.9rem; }
    input, select, textarea { width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 0.95rem; }
    textarea { font-family: monospace; height: 160px; }
    .btn { display: inline-block; background: #1a73e8; color: white; border: none; padding: 10px 18px; border-radius: 6px; font-size: 0.95rem; cursor: pointer; margin-top: 10px; text-decoration: none; text-align: center; }
    .btn:hover { background: #1557b0; }
    .btn-secondary { background: #34a853; margin-left: 10px; }
    .btn-secondary:hover { background: #2d8e47; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; background: #e8f0fe; color: #1a73e8; }
    .code-box { background: #272822; color: #f8f8f2; padding: 12px; border-radius: 6px; font-size: 0.85rem; overflow-x: auto; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h1 style="margin: 0;">🚀 JADS Backend API Server</h1>
      <a href="/api/docs" target="_blank" class="btn" style="margin: 0; background: #85ea2d; color: #111; font-weight: bold;">📖 Swagger API Docs</a>
    </div>
    <p style="margin-top: 10px;">ระบบ Backend รองรับ PostgreSQL, Prisma, ระบบ Audit Log, ระบบ เข้าสู่ระบบ (JWT) และระบบ Recent File (เข้ารหัสตำแหน่งไฟล์ในเครื่องผู้ใช้ด้วย AES-256-GCM)</p>

    <h2>📄 1. ระบบ Docx Templater (ต้องเข้าสู่ระบบ)</h2>
    <div style="background: #fff3cd; border-left: 4px solid #ffeeba; padding: 10px; margin-bottom: 12px; border-radius: 4px; font-size: 0.9rem;">
      ⚠️ <strong>ความปลอดภัย:</strong> ต้องระบุ JWT Token (เข้าสู่ระบบก่อน) จึงจะสามารถดึง Template หรือสร้างไฟล์ได้
    </div>

    <label for="jwtToken">JWT Token (Bearer):</label>
    <input type="text" id="jwtToken" placeholder="วาง JWT Token ที่นี่ (หรือ Login ผ่าน /api/auth/login)" />

    <form id="generateForm" style="margin-top: 15px;">
      <label for="template">เลือก Template:</label>
      <select name="template" id="template">
        ${templateOptions || '<option value="">ไม่มีไฟล์ใน /templates</option>'}
      </select>
      <label for="jsonData">ข้อมูล JSON ที่จะกรอก:</label>
      <textarea id="jsonData" style="height: 260px;">{
  "case_black_no": "ผบ121/2569",
  "case_red_no": "ผบ193/2569",
  "court_name": "ศาลจังหวัดระยอง",
  "date": "5",
  "month": "ตุลาคม",
  "year": "2569",
  "case_type": "แพ่ง",
  "plaintiff_name": "นาย ก",
  "defendant_name": "บริษัท ก จำกัด ที่ 1 กับพวกรวม 3 คน",
  "hearing_time": "09.00",
  "hearing_purpose": "พิจารณา",
  "attendees_summary": "ทนายโจทก์ โจทก์ ทนายจำเลย และจำเลย",
  "paragraphs": [
    "คู่ความทั้งสองฝ่ายสามารถตกลงกันได้ ขอให้ศาลมีคำพิพากษาตามยอมตามสัญญาประนีประนอมยอมความที่เสนอต่อศาลวันนี้",
    "ศาลพิเคราะห์สัญญาประนีประนอมยอมความระหว่างโจทก์กับจำเลยแล้ว เห็นว่าถูกต้องตามกฎหมายและสามารถตกลงกันได้ จึงพิพากษาให้คดีเสร็จเด็ดขาดตามสัญญาประนีประนอมยอมความและออกคำบังคับให้จำเลยทราบแล้วในวันนี้/อ่านแล้ว"
  ],
  "judge_1_name": "นาย สมศักดิ์ ยุติธรรม",
  "judge_2_name": "นางสาว ดวงใจ ซื่อตรง",
  "judge_๑_name": "นาย สมศักดิ์ ยุติธรรม",
  "judge_๒_name": "นางสาว ดวงใจ ซื่อตรง",
  "signatories": [
    { "position": "ทนายโจทก์" },
    { "position": "โจทก์" },
    { "position": "ทนายจำเลย" },
    { "position": "จำเลย" }
  ]
}</textarea>
      <div>
        <button type="button" class="btn" onclick="submitDocx()">🚀 กรอกข้อมูลและดาวน์โหลด DOCX</button>
      </div>
    </form>

    <h2>🔐 2. ระบบเข้าสู่ระบบ & API Endpoints</h2>
    <ul>
      <li><span class="badge">POST</span> <code>/api/auth/register</code> - ลงทะเบียนผู้ใช้ใหม่ (เฉพาะ role USER)</li>
      <li><span class="badge">POST</span> <code>/api/auth/login</code> - เข้าสู่ระบบ รับ JWT Token</li>
      <li><span class="badge">GET</span> <code>/api/auth/me</code> - ข้อมูลผู้ใช้ปัจจุบัน (Bearer Token)</li>
      <li><span class="badge">POST</span> <code>/api/auth/logout</code> - ออกจากระบบ</li>
    </ul>

    <h2>📁 3. ระบบ Recent Files (AES-256-GCM Encrypted Path)</h2>
    <ul>
      <li><span class="badge">GET</span> <code>/api/recent-files</code> - ดึงรายการไฟล์ล่าสุด (ถอดรหัส path เฉพาะเจ้าของ)</li>
      <li><span class="badge">POST</span> <code>/api/recent-files</code> - เพิ่มประวัติไฟล์ (เข้ารหัส path ก่อนบันทึกใน DB)</li>
      <li><span class="badge">DELETE</span> <code>/api/recent-files/:id</code> - ลบรายการไฟล์ล่าสุด</li>
    </ul>

    <h2>📋 4. ระบบ Audit Log</h2>
    <ul>
      <li><span class="badge">GET</span> <code>/api/audit-logs</code> - สืบค้นประวัติการใช้งาน พร้อมระบบกรองและ pagination</li>
    </ul>
  </div>

  <script>
    // Load stored token if present
    document.getElementById('jwtToken').value = localStorage.getItem('jads_token') || '';
    document.getElementById('jwtToken').addEventListener('input', (e) => {
      localStorage.setItem('jads_token', e.target.value.trim());
    });

    async function submitDocx() {
      const token = document.getElementById('jwtToken').value.trim();
      if (!token) {
        alert('กรุณากรอก JWT Token ก่อนทำรายการสร้างไฟล์ (เข้าสู่ระบบก่อน)');
        return;
      }

      const template = document.getElementById('template').value;
      const rawJson = document.getElementById('jsonData').value;
      let data = {};
      try {
        data = JSON.parse(rawJson);
      } catch (err) {
        alert('JSON รูปแบบไม่ถูกต้อง: ' + err.message);
        return;
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ template, data })
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: res.statusText }));
        alert('เกิดข้อผิดพลาด (' + res.status + '): ' + (error.message || JSON.stringify(error)));
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'filled_' + template;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  </script>
</body>
</html>
  `);
});

// Centralized error handling
app.use(errorHandler);
