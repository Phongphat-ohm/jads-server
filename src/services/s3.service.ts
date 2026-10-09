import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export class S3Service {
  private s3Client: S3Client | null = null;
  private isS3Configured: boolean = false;
  private localDir: string;

  constructor() {
    this.localDir = env.LOCAL_STORAGE_DIR;
    if (!fs.existsSync(this.localDir)) {
      fs.mkdirSync(this.localDir, { recursive: true });
    }

    if (env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
      const s3Config: any = {
        region: env.S3_REGION,
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        },
      };

      if (env.S3_ENDPOINT) {
        s3Config.endpoint = env.S3_ENDPOINT;
        s3Config.forcePathStyle = true;
      }

      this.s3Client = new S3Client(s3Config);
      this.isS3Configured = true;
    }
  }

  /**
   * Uploads file buffer to S3 (or local object storage fallback)
   */
  async uploadFile(userId: string, fileName: string, buffer: Buffer, mimeType: string): Promise<{ s3Key: string; fileSize: number }> {
    const timestamp = Date.now();
    const cleanFileName = path.basename(fileName).replace(/[^a-zA-Z0-9._\-\u0E00-\u0E7F]/g, '_');
    const s3Key = `users/${userId}/xlsx/${timestamp}_${cleanFileName}`;

    if (this.isS3Configured && this.s3Client) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: s3Key,
          Body: buffer,
          ContentType: mimeType,
          Metadata: {
            userId,
            originalName: encodeURIComponent(fileName),
          },
        })
      );
    } else {
      // Local fallback
      const fullLocalPath = path.join(this.localDir, s3Key);
      const parentDir = path.dirname(fullLocalPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(fullLocalPath, buffer);
    }

    return {
      s3Key,
      fileSize: buffer.length,
    };
  }

  /**
   * Retrieves file as Buffer from S3 (or local fallback)
   */
  async getFileBuffer(userId: string, s3Key: string): Promise<Buffer> {
    // Security check: ensure s3Key belongs to this user
    if (!s3Key.startsWith(`users/${userId}/`)) {
      throw new Error('Unauthorized access to storage key');
    }

    if (this.isS3Configured && this.s3Client) {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: s3Key,
        })
      );

      if (!response.Body) {
        throw new Error('File body is empty');
      }

      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } else {
      const fullLocalPath = path.join(this.localDir, s3Key);
      if (!fs.existsSync(fullLocalPath)) {
        throw new Error('File not found in storage');
      }
      return fs.readFileSync(fullLocalPath);
    }
  }

  /**
   * Deletes a file from storage
   */
  async deleteFile(userId: string, s3Key: string): Promise<void> {
    if (!s3Key.startsWith(`users/${userId}/`)) {
      throw new Error('Unauthorized access to storage key');
    }

    if (this.isS3Configured && this.s3Client) {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: s3Key,
        })
      );
    } else {
      const fullLocalPath = path.join(this.localDir, s3Key);
      if (fs.existsSync(fullLocalPath)) {
        fs.unlinkSync(fullLocalPath);
      }
    }
  }
}

export const s3Service = new S3Service();
