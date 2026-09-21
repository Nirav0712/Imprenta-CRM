import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let cryptoService: CryptoService;

  beforeEach(() => {
    const configService = new ConfigService({
      encryptionKey: 'test_secret_key_32_bytes_super_secure_key!',
    });
    cryptoService = new CryptoService(configService);
  });

  it('should encrypt and decrypt a plaintext string correctly', () => {
    const text = 'MetaAccessToken_EAABwz9823498sdfkjshdf89723';
    const encrypted = cryptoService.encrypt(text);
    expect(encrypted).not.toEqual(text);
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = cryptoService.decrypt(encrypted);
    expect(decrypted).toEqual(text);
  });

  it('should mask sensitive strings', () => {
    const secret = 'EAABwz9823498sdfkjshdf897231234';
    const masked = cryptoService.mask(secret);
    expect(masked).toContain('••••••••');
    expect(masked.startsWith('EAAB')).toBe(true);
    expect(masked.endsWith('1234')).toBe(true);
  });

  it('should correctly verify Meta HMAC SHA256 signatures', () => {
    const appSecret = 'my_app_secret_123';
    const rawBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const signatureHeader = `sha256=${hmac}`;

    const isValid = cryptoService.verifyMetaSignature(rawBody, signatureHeader, appSecret);
    expect(isValid).toBe(true);

    const isInvalid = cryptoService.verifyMetaSignature(rawBody, 'sha256=invalidhash', appSecret);
    expect(isInvalid).toBe(false);
  });
});
