import { Request, Response } from 'express';
import path from 'path';
import { templateService } from '../services/template.service';
import { auditLogService } from '../services/auditLog.service';

const DEFAULT_MOCKUP_DATA = {
  case_black_no: 'ผบ121/2569',
  case_red_no: 'ผบ193/2569',
  court_name: 'ศาลจังหวัดระยอง',
  date: '5',
  month: 'ตุลาคม',
  year: '2569',
  case_type: 'แพ่ง',
  plaintiff_name: 'นาย ก',
  defendant_name: 'บริษัท ก จำกัด ที่ 1 กับพวกรวม 3 คน',
  hearing_time: '09.00',
  hearing_purpose: 'พิจารณา',
  attendees_summary: 'ทนายโจทก์ โจทก์ ทนายจำเลย และจำเลย',
  paragraphs: [
    'คู่ความทั้งสองฝ่ายสามารถตกลงกันได้ ขอให้ศาลมีคำพิพากษาตามยอมตามสัญญาประนีประนอมยอมความที่เสนอต่อศาลวันนี้',
    'ศาลพิเคราะห์สัญญาประนีประนอมยอมความระหว่างโจทก์กับจำเลยแล้ว เห็นว่าถูกต้องตามกฎหมายและสามารถตกลงกันได้ จึงพิพากษาให้คดีเสร็จเด็ดขาดตามสัญญาประนีประนอมยอมความและออกคำบังคับให้จำเลยทราบแล้วในวันนี้/อ่านแล้ว'
  ],
  judge_1_name: 'นาย สมศักดิ์ ยุติธรรม',
  judge_2_name: 'นางสาว ดวงใจ ซื่อตรง',
  judge_๑_name: 'นาย สมศักดิ์ ยุติธรรม',
  judge_๒_name: 'นางสาว ดวงใจ ซื่อตรง',
  signatories: [
    { position: 'ทนายโจทก์' },
    { position: 'โจทก์' },
    { position: 'ทนายจำเลย' },
    { position: 'จำเลย' }
  ]
};

export class TemplateController {
  getTemplates(req: Request, res: Response) {
    try {
      const templates = templateService.getAvailableTemplates();
      res.json({
        success: true,
        templates,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getCapabilities(req: Request, res: Response) {
    try {
      const canExportPdf = await templateService.checkPdfCapability();
      res.json({
        success: true,
        canExportPdf,
        availableFormats: canExportPdf ? ['docx', 'pdf'] : ['docx'],
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async generate(req: Request, res: Response) {
    try {
      const body = req.body || {};
      const format = String(req.query.format || body.format || 'docx').toLowerCase();
      const rawTemplate =
        (req.query.template as string) ||
        body.template ||
        templateService.getAvailableTemplates()[0] ||
        'รายงาน2356.docx';

      const templateName = path.basename(String(rawTemplate));
      const data = body.data && typeof body.data === 'object' ? body.data : body;
      const docxBuffer = templateService.generateDocument(templateName, data);

      let outputBuffer = docxBuffer;
      let contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document; charset=utf-8';
      let extension = 'docx';

      if (format === 'pdf') {
        outputBuffer = await templateService.convertDocxToPdf(docxBuffer);
        contentType = 'application/pdf';
        extension = 'pdf';
      }

      const cleanCaseNo = data.case_black_no
        ? String(data.case_black_no).replace(/[/\\?%*:|"<>]/g, '_')
        : '';
      const baseDocName = templateName.replace(/\.docx$/i, '');
      const thaiFilename = cleanCaseNo
        ? `รายงาน_${cleanCaseNo}.${extension}`
        : `รายงาน_${baseDocName}.${extension}`;
      const encodedFilename = encodeURIComponent(thaiFilename);

      // Record audit log
      await auditLogService.createLog({
        userId: req.user?.id || null,
        action: 'DOCUMENT_GENERATE',
        resource: 'template',
        details: {
          templateName,
          format: extension,
          caseBlackNo: data.case_black_no ? String(data.case_black_no).substring(0, 50) : undefined,
          caseRedNo: data.case_red_no ? String(data.case_red_no).substring(0, 50) : undefined,
        },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        status: 'SUCCESS',
      });

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
      );
      res.send(outputBuffer);
    } catch (error: any) {
      console.error('Document generation error:', error);

      // Record failure audit log
      await auditLogService.createLog({
        userId: req.user?.id || null,
        action: 'DOCUMENT_GENERATE_FAILED',
        resource: 'template',
        details: { error: error.message },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        status: 'FAILED',
      });

      res.status(500).json({
        success: false,
        message: 'Failed to generate document',
        error: error.message,
      });
    }
  }

  test(req: Request, res: Response) {
    try {
      const templateName =
        (req.query.template as string) ||
        templateService.getAvailableTemplates()[0] ||
        'รายงาน2356.docx';

      const buffer = templateService.generateDocument(templateName, DEFAULT_MOCKUP_DATA);
      const outputName = 'test_result.docx';

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${outputName}"`
      );
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const templateController = new TemplateController();
