import { Request, Response } from 'express';
import fs from 'fs';
import { downloadService } from '../services/download.service';

export class DownloadController {
  /**
   * Helper to pipe file stream with download headers
   */
  private streamFile = (res: Response, filePath: string, fileName: string) => {
    const stat = fs.statSync(filePath);
    const encodedName = encodeURIComponent(fileName);

    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    res.setHeader('Content-Length', stat.size);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`
    );

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('Download stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Stream failed' });
      }
    });
    stream.pipe(res);
  };

  /**
   * GET /api/downloads/info
   * Returns metadata about available versions and files
   */
  getInfo = (req: Request, res: Response) => {
    try {
      const info = downloadService.getReleasesInfo();
      res.json({
        success: true,
        data: info,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve download releases info',
        error: error.message,
      });
    }
  };

  /**
   * GET /api/downloads/latest
   * Downloads the latest installer or portable executable
   */
  downloadLatest = (req: Request, res: Response) => {
    try {
      const type =
        String(req.query.type || 'installer').toLowerCase() === 'portable'
          ? 'portable'
          : 'installer';

      const fileInfo = downloadService.getLatestFile(type);
      if (!fileInfo) {
        return res.status(404).json({
          success: false,
          message: `No release executable found for type '${type}'`,
        });
      }

      this.streamFile(res, fileInfo.filePath, fileInfo.fileName);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to download latest release',
        error: error.message,
      });
    }
  };

  /**
   * GET /api/downloads/:version/:filename
   * Downloads a specific release file by version
   */
  downloadByVersion = (req: Request, res: Response) => {
    try {
      const { version, filename } = req.params;
      const fileInfo = downloadService.getVersionFile(version, filename);

      if (!fileInfo) {
        return res.status(404).json({
          success: false,
          message: `File '${filename}' not found for version '${version}'`,
        });
      }

      this.streamFile(res, fileInfo.filePath, fileInfo.fileName);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to download versioned release',
        error: error.message,
      });
    }
  };
}

export const downloadController = new DownloadController();
