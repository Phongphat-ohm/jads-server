import fs from 'fs';
import path from 'path';

export interface ReleaseFile {
  name: string;
  type: 'installer' | 'portable' | 'other';
  size: number;
  sizeFormatted: string;
  url: string;
  modifiedAt: string;
}

export interface ReleaseVersion {
  version: string;
  folder: string;
  releaseDate: string;
  files: ReleaseFile[];
}

export interface ReleasesInfo {
  latestVersion: string | null;
  versions: ReleaseVersion[];
}

export class DownloadService {
  private downloadsDir: string;

  constructor() {
    // downloads directory in server root
    this.downloadsDir = path.resolve(process.cwd(), 'downloads');
    if (!fs.existsSync(this.downloadsDir)) {
      try {
        fs.mkdirSync(this.downloadsDir, { recursive: true });
      } catch (e) {
        console.error('Failed to create downloads directory:', e);
      }
    }
  }

  /**
   * Helper to format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Compare two version strings (e.g., 'v1.0.0' vs 'v1.1.0') descending
   */
  private compareVersions(a: string, b: string): number {
    const parse = (v: string) =>
      v
        .replace(/^v/i, '')
        .split('.')
        .map((n) => parseInt(n, 10) || 0);

    const [a1, a2, a3] = parse(a);
    const [b1, b2, b3] = parse(b);

    if (a1 !== b1) return b1 - a1;
    if (a2 !== b2) return b2 - a2;
    return b3 - a3;
  }

  /**
   * Retrieve all release versions and their files
   */
  getReleasesInfo(): ReleasesInfo {
    if (!fs.existsSync(this.downloadsDir)) {
      return { latestVersion: null, versions: [] };
    }

    const entries = fs.readdirSync(this.downloadsDir, { withFileTypes: true });
    const versionFolders = entries
      .filter((e) => e.isDirectory() && /^v?\d+\.\d+\.\d+/i.test(e.name))
      .map((e) => e.name)
      .sort((a, b) => this.compareVersions(a, b));

    const versions: ReleaseVersion[] = [];

    for (const folder of versionFolders) {
      const folderPath = path.join(this.downloadsDir, folder);
      const cleanVersion = folder.replace(/^v/i, '');
      const files = fs
        .readdirSync(folderPath, { withFileTypes: true })
        .filter((f) => f.isFile() && f.name.endsWith('.exe'))
        .map((f) => {
          const filePath = path.join(folderPath, f.name);
          const stat = fs.statSync(filePath);
          const isSetup = /setup/i.test(f.name);
          const isPortable = /portable/i.test(f.name);

          const type: 'installer' | 'portable' | 'other' = isSetup
            ? 'installer'
            : isPortable
            ? 'portable'
            : 'other';

          return {
            name: f.name,
            type,
            size: stat.size,
            sizeFormatted: this.formatBytes(stat.size),
            url: `/api/downloads/${folder}/${encodeURIComponent(f.name)}`,
            modifiedAt: stat.mtime.toISOString(),
          };
        });

      if (files.length > 0) {
        const stats = fs.statSync(folderPath);
        versions.push({
          version: cleanVersion,
          folder,
          releaseDate: stats.mtime.toISOString(),
          files,
        });
      }
    }

    const latestVersion = versions.length > 0 ? versions[0].version : null;

    return {
      latestVersion,
      versions,
    };
  }

  /**
   * Get file path of the latest release by type
   */
  getLatestFile(type: 'installer' | 'portable' = 'installer'): {
    filePath: string;
    fileName: string;
    version: string;
  } | null {
    const info = this.getReleasesInfo();
    if (!info.versions || info.versions.length === 0) {
      return null;
    }

    const latest = info.versions[0];
    let matched = latest.files.find((f) => f.type === type);
    if (!matched && latest.files.length > 0) {
      matched = latest.files[0];
    }

    if (!matched) return null;

    const filePath = path.join(this.downloadsDir, latest.folder, matched.name);
    if (!fs.existsSync(filePath)) return null;

    return {
      filePath,
      fileName: matched.name,
      version: latest.version,
    };
  }

  /**
   * Get file path for a specific version and filename with path traversal protection
   */
  getVersionFile(
    versionParam: string,
    filenameParam: string
  ): { filePath: string; fileName: string } | null {
    // Sanitize parameters strictly
    const sanitizedFolder = path.basename(versionParam.trim());
    const sanitizedFilename = path.basename(filenameParam.trim());

    // Security check: only allow safe semantic folder names and .exe files
    if (!/^v?\d+(\.\d+)*$/i.test(sanitizedFolder) || !sanitizedFilename.endsWith('.exe')) {
      return null;
    }

    const targetPath = path.resolve(this.downloadsDir, sanitizedFolder, sanitizedFilename);

    // Verify target path stays strictly inside downloads directory
    if (!targetPath.startsWith(this.downloadsDir)) {
      return null;
    }

    if (!fs.existsSync(targetPath)) {
      return null;
    }

    return {
      filePath: targetPath,
      fileName: sanitizedFilename,
    };
  }
}

export const downloadService = new DownloadService();
