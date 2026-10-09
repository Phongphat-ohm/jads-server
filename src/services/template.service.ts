import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { env } from '../config/env';

export class TemplateService {
  /**
   * Helper to get available docx template files
   */
  getAvailableTemplates(): string[] {
    if (!fs.existsSync(env.TEMPLATES_DIR)) {
      return [];
    }
    return fs
      .readdirSync(env.TEMPLATES_DIR)
      .filter((f) => f.endsWith('.docx') && !f.startsWith('~$'));
  }

  /**
   * Generate filled docx buffer using docxtemplater
   */
  generateDocument(templateFileName: string, data: Record<string, any>): Buffer {
    const sanitized = path.basename(templateFileName);
    const available = this.getAvailableTemplates();

    if (!sanitized.endsWith('.docx') || sanitized.startsWith('~$') || !available.includes(sanitized)) {
      throw new Error(`Invalid or unauthorized template: ${sanitized}`);
    }

    const templatePath = path.join(env.TEMPLATES_DIR, sanitized);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${sanitized}`);
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);

    // Normalize single-bracket loops and tags in document.xml to double-bracket tags
    // and enforce standard 72pt first-line indentation on paragraphs
    const docXmlFile = zip.file('word/document.xml');
    if (docXmlFile) {
      let xml = docXmlFile.asText();
      xml = xml
        .replace(/\{#signatories\}/g, '{{#signatories}}')
        .replace(/\{\/signatories\}/g, '{{/signatories}}')
        .replace(/\{position\}/g, '{{position}}');

      // Ensure that paragraph containing {{.}} has the exact first-line indent (w:firstLine="72pt") as the paragraph above
      const dotTag = '{{.}}';
      const dotIdx = xml.indexOf(dotTag);
      if (dotIdx !== -1) {
        const pStart = xml.lastIndexOf('<w:p ', dotIdx);
        const pPrStart = xml.indexOf('<w:pPr>', pStart);
        const pPrEnd = xml.indexOf('</w:pPr>', pPrStart);
        if (pPrStart !== -1 && pPrEnd !== -1 && pPrStart < dotIdx) {
          let pPr = xml.substring(pPrStart, pPrEnd + 8);
          if (!pPr.includes('firstLine')) {
            pPr = pPr.replace('<w:pPr>', '<w:pPr><w:ind w:firstLine="72pt"/>');
            xml = xml.substring(0, pPrStart) + pPr + xml.substring(pPrEnd + 8);
          }
        }
      }

      // Ensure that signatories loop paragraph has zero after spacing and single line spacing
      // so signature lines are directly adjacent (บรรทัดติดกัน) with no blank line
      const posIdx = xml.indexOf('{{position}}');
      if (posIdx !== -1) {
        const pStart = xml.lastIndexOf('<w:p ', posIdx);
        const pPrStart = xml.indexOf('<w:pPr>', pStart);
        const pPrEnd = xml.indexOf('</w:pPr>', pPrStart);
        if (pPrStart !== -1 && pPrEnd !== -1 && pPrStart < posIdx) {
          let pPr = xml.substring(pPrStart, pPrEnd + 8);
          if (pPr.includes('<w:spacing')) {
            pPr = pPr.replace(/<w:spacing[^>]*\/>/g, '<w:spacing w:before="0pt" w:after="0pt" w:line="240" w:lineRule="auto"/>');
          } else {
            pPr = pPr.replace('<w:pPr>', '<w:pPr><w:spacing w:before="0pt" w:after="0pt" w:line="240" w:lineRule="auto"/>');
          }
          xml = xml.substring(0, pPrStart) + pPr + xml.substring(pPrEnd + 8);
        }
      }

      zip.file('word/document.xml', xml);
    }

    // Format and sanitize input data
    const formattedData = { ...data };

    // Synchronize Thai and Arabic numeral judge names
    if (formattedData.judge_1_name && !formattedData.judge_๑_name) {
      formattedData.judge_๑_name = formattedData.judge_1_name;
    } else if (formattedData.judge_๑_name && !formattedData.judge_1_name) {
      formattedData.judge_1_name = formattedData.judge_๑_name;
    }

    if (formattedData.judge_2_name && !formattedData.judge_๒_name) {
      formattedData.judge_๒_name = formattedData.judge_2_name;
    } else if (formattedData.judge_๒_name && !formattedData.judge_2_name) {
      formattedData.judge_2_name = formattedData.judge_๒_name;
    }

    // Ensure paragraphs is an array, splitting multiline strings so every paragraph has its own indent
    if (typeof formattedData.paragraphs === 'string') {
      formattedData.paragraphs = formattedData.paragraphs
        .split(/\r?\n/)
        .map((p: string) => p.trim())
        .filter(Boolean);
    } else if (Array.isArray(formattedData.paragraphs)) {
      formattedData.paragraphs = formattedData.paragraphs
        .flatMap((p: any) => String(p).split(/\r?\n/))
        .map((p: string) => p.trim())
        .filter(Boolean);
    } else {
      formattedData.paragraphs = [];
    }

    // Handle unified attendees / signatories input
    // If user provided raw attendees array or string, or only one of attendees_summary / signatories
    const parseAttendeesList = (input: any): string[] => {
      if (Array.isArray(input)) {
        return input
          .map((item) => (typeof item === 'object' && item?.position ? item.position : String(item)))
          .map((s) => s.trim().replace(/^และ\s*/, '').trim())
          .filter(Boolean);
      }
      if (typeof input === 'string' && input.trim()) {
        const text = input.trim();
        const raw = (text.includes(',') || text.includes('\n')) ? text.split(/[,\n]+/) : text.split(/\s+/);
        return raw.map((s) => s.trim().replace(/^และ\s*/, '').trim()).filter(Boolean);
      }
      return [];
    };

    const formatSummary = (positions: string[]): string => {
      const cleaned = positions.map((p) => p.trim()).filter(Boolean);
      if (cleaned.length === 0) return '';
      if (cleaned.length === 1) return cleaned[0];
      return `${cleaned.slice(0, -1).join(' ')} และ${cleaned[cleaned.length - 1]}`;
    };

    // 1. If explicit 'attendees' or 'positions' field is provided
    if (formattedData.attendees || formattedData.positions) {
      const parsed = parseAttendeesList(formattedData.attendees || formattedData.positions);
      if (parsed.length > 0) {
        if (!formattedData.signatories || (Array.isArray(formattedData.signatories) && formattedData.signatories.length === 0)) {
          formattedData.signatories = parsed.map((position) => ({ position }));
        }
        if (!formattedData.attendees_summary) {
          formattedData.attendees_summary = formatSummary(parsed);
        }
      }
    }

    // 2. If signatories is provided but attendees_summary is missing
    if (Array.isArray(formattedData.signatories) && formattedData.signatories.length > 0) {
      formattedData.signatories = formattedData.signatories.map((s: any) =>
        typeof s === 'string' ? { position: s.trim() } : { position: String(s?.position || '').trim() }
      ).filter((s: any) => Boolean(s.position));

      if (!formattedData.attendees_summary && formattedData.signatories.length > 0) {
        formattedData.attendees_summary = formatSummary(
          formattedData.signatories.map((s: any) => s.position)
        );
      }
    } else if (formattedData.attendees_summary && (!formattedData.signatories || formattedData.signatories.length === 0)) {
      // 3. If attendees_summary is provided but signatories is missing: derive signatories from summary
      const extractedPositions = parseAttendeesList(formattedData.attendees_summary);
      formattedData.signatories = extractedPositions.map((position) => ({ position }));
    } else {
      formattedData.signatories = Array.isArray(formattedData.signatories)
        ? formattedData.signatories.map((s: any) =>
            typeof s === 'string' ? { position: s.trim() } : { position: String(s?.position || '').trim() }
          )
        : [];
    }

    const doc = new Docxtemplater(zip, {
      delimiters: { start: '{{', end: '}}' },
      paragraphLoop: true,
      linebreaks: true,
      parser: (tag: string) => {
        const trimmed = tag.trim();
        return {
          get(scope: any) {
            if (!trimmed) return '';
            if (trimmed === '.') {
              return scope !== undefined && scope !== null ? scope : '';
            }
            if (trimmed === 'judge_๑_name') {
              return scope?.judge_๑_name ?? scope?.judge_1_name ?? '';
            }
            if (trimmed === 'judge_1_name') {
              return scope?.judge_1_name ?? scope?.judge_๑_name ?? '';
            }
            if (trimmed === 'judge_๒_name') {
              return scope?.judge_๒_name ?? scope?.judge_2_name ?? '';
            }
            if (trimmed === 'judge_2_name') {
              return scope?.judge_2_name ?? scope?.judge_๒_name ?? '';
            }
            const val = scope ? scope[trimmed] : undefined;
            if (val === undefined || val === null) return '';
            return val;
          },
        };
      },
    });

    // Render the document with provided data
    doc.render(formattedData);

    // Generate output buffer
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    return buffer;
  }

  /**
   * Converts a filled DOCX buffer to a PDF buffer using Microsoft Word COM automation
   */
  async convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
    const tmpDir = os.tmpdir();
    const uniqueId = `jads_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tempDocxPath = path.join(tmpDir, `${uniqueId}.docx`);
    const tempPdfPath = path.join(tmpDir, `${uniqueId}.pdf`);

    try {
      fs.writeFileSync(tempDocxPath, docxBuffer);

      // Execute PowerShell script calling Word.Application COM object
      const psScript = `
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
  $doc = $word.Documents.Open('${tempDocxPath.replace(/'/g, "''")}')
  $doc.SaveAs([ref]'${tempPdfPath.replace(/'/g, "''")}', [ref]17)
  $doc.Close([ref]0)
} finally {
  $word.Quit([ref]0)
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
`;

      await new Promise<void>((resolve, reject) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
          windowsHide: true,
        });

        let stderr = '';
        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          if (code === 0 && fs.existsSync(tempPdfPath)) {
            resolve();
          } else {
            reject(new Error(`PDF conversion failed with code ${code}: ${stderr}`));
          }
        });

        child.on('error', (err) => {
          reject(err);
        });
      });

      const pdfBuffer = fs.readFileSync(tempPdfPath);
      return pdfBuffer;
    } finally {
      // Safely cleanup temporary files
      try {
        if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath);
      } catch {}
      try {
        if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
      } catch {}
    }
  }
}

export const templateService = new TemplateService();
