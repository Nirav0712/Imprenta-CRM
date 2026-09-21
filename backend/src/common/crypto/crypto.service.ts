import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.get<string>('encryptionKey') || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    // Ensure key is exactly 32 bytes (256 bits)
    this.key = crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts plaintext using AES-256-GCM with IV and authentication tag
   * Output format: iv:authTag:encryptedData (hex encoded)
   */
  encrypt(plainText: string): string {
    if (!plainText) return '';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts ciphertext in iv:authTag:encryptedData format
   */
  decrypt(cipherText: string): string {
    if (!cipherText) return '';
    try {
      const parts = cipherText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted string format');
      }
      const [ivHex, authTagHex, encryptedDataHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedDataHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      throw new Error(`Decryption failed: ${(err as Error).message}`);
    }
  }

  /**
   * Masks sensitive credentials for safe display (e.g. sk_live_...1234)
   */
  mask(secret: string): string {
    if (!secret) return '';
    if (secret.length <= 8) return '••••••••';
    const prefix = secret.slice(0, 4);
    const suffix = secret.slice(-4);
    return `${prefix}••••••••${suffix}`;
  }

  /**
   * Verify Meta HMAC SHA-256 Webhook signature
   */
  verifyMetaSignature(rawBody: Buffer | string, signatureHeader: string, appSecret: string): boolean {
    if (!signatureHeader || !appSecret) return false;
    const signatureParts = signatureHeader.split('=');
    if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') return false;
    const expectedSignature = signatureParts[1];

    const hmac = crypto.createHmac('sha256', appSecret);
    hmac.update(rawBody);
    const calculatedSignature = hmac.digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(calculatedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch {
      return false;
    }
  }
}
