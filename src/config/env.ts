import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'default_jwt_secret_please_change_in_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'd7b5f92c10a34b8efc86210459a1e0b572c694a1d8f349be8470a25b169df301',
  TEMPLATES_DIR: path.resolve(process.cwd(), 'templates'),
  CORS_ORIGIN: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : ['http://localhost:3000', 'http://localhost:3001'],
  // S3 File Storage
  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  S3_BUCKET: process.env.S3_BUCKET || 'jads-court-storage',
  S3_REGION: process.env.S3_REGION || 'ap-southeast-1',
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || '',
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || '',
  S3_USE_SSL: process.env.S3_USE_SSL !== 'false',
  LOCAL_STORAGE_DIR: path.resolve(process.cwd(), 'storage'),
};
