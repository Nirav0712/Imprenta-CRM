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

  /**
   * Encodes a string or buffer into Base64URL (RFC 7515 / RFC 7519)
   */
  base64UrlEncode(input: Buffer | string): string {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
    return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  /**
   * Decodes a Base64URL string
   */
  base64UrlDecode(input: string): string {
    let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  /**
   * Signs a JWT using HS256 algorithm
   */
  signJwt(payload: Record<string, any>, secret: string, expiresInSec = 86400): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
      ...payload,
      iat: now,
      exp: now + expiresInSec,
    };

    const headerB64 = this.base64UrlEncode(JSON.stringify(header));
    const payloadB64 = this.base64UrlEncode(JSON.stringify(fullPayload));
    const signingInput = `${headerB64}.${payloadB64}`;

    const signature = crypto.createHmac('sha256', secret).update(signingInput).digest();
    const signatureB64 = this.base64UrlEncode(signature);

    return `${signingInput}.${signatureB64}`;
  }

  /**
   * Cryptographically verifies an HS256 JWT signature and validates expiration / nbf
   */
  verifyJwt(token: string, secret: string): Record<string, any> {
    if (!token || typeof token !== 'string') {
      throw new Error('Missing token');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed JWT token structure');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;

    const expectedSignature = crypto.createHmac('sha256', secret).update(signingInput).digest();
    const expectedSignatureB64 = this.base64UrlEncode(expectedSignature);

    // Timing-safe comparison of signature
    const sigA = Buffer.from(signatureB64);
    const sigB = Buffer.from(expectedSignatureB64);

    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      throw new Error('Invalid token signature');
    }

    let payload: Record<string, any>;
    try {
      payload = JSON.parse(this.base64UrlDecode(payloadB64));
    } catch {
      throw new Error('Invalid token payload encoding');
    }

    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && typeof payload.exp === 'number' && now > payload.exp) {
      throw new Error('Token has expired');
    }

    if (payload.nbf && typeof payload.nbf === 'number' && now < payload.nbf) {
      throw new Error('Token is not active yet');
    }

    return payload;
  }
}
