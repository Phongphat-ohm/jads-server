import crypto from 'crypto';
import { env } from '../config/env';

/**
 * Derives a 32-byte key from the environment encryption key
 */
function getEncryptionKey(): Buffer {
  const rawKey = env.ENCRYPTION_KEY || 'default_secure_encryption_key_jads_2026';
  // Use SHA-256 to ensure exact 32 bytes key length
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts a plain text string using AES-256-GCM.
 * Output format: `ivHex:authTagHex:ciphertextHex`
 */
export function encryptText(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Recommended 12 bytes (96 bits) IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a ciphertext formatted as `ivHex:authTagHex:ciphertextHex` using AES-256-GCM.
 */
export function decryptText(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivHex, authTagHex, cipherTextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const cipherText = Buffer.from(cipherTextHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(cipherText),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
