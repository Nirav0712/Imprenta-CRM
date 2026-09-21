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

  describe('JWT Cryptographic Verification', () => {
    const secret = 'super_secret_jwt_key_for_testing_12345';

    it('should sign and verify valid JWT token correctly', () => {
      const payload = { userId: 'user_1', organizationId: 'org_alpha', role: 'admin' };
      const token = cryptoService.signJwt(payload, secret, 3600);
      expect(token.split('.')).toHaveLength(3);

      const verified = cryptoService.verifyJwt(token, secret);
      expect(verified.userId).toBe('user_1');
      expect(verified.organizationId).toBe('org_alpha');
      expect(verified.role).toBe('admin');
    });

    it('should reject token with invalid signature / wrong secret', () => {
      const payload = { userId: 'user_1', organizationId: 'org_alpha' };
      const token = cryptoService.signJwt(payload, secret, 3600);
      expect(() => cryptoService.verifyJwt(token, 'wrong_secret')).toThrow('Invalid token signature');
    });

    it('should reject expired tokens', () => {
      const payload = { userId: 'user_1', organizationId: 'org_alpha' };
      // Expired 10 seconds ago
      const token = cryptoService.signJwt(payload, secret, -10);
      expect(() => cryptoService.verifyJwt(token, secret)).toThrow('Token has expired');
    });

    it('should reject tampered payload', () => {
      const payload = { userId: 'user_1', organizationId: 'org_alpha' };
      const token = cryptoService.signJwt(payload, secret, 3600);
      const [header, , sig] = token.split('.');
      const tamperedPayloadB64 = cryptoService.base64UrlEncode(
        JSON.stringify({ userId: 'hacker', organizationId: 'org_beta', exp: Math.floor(Date.now() / 1000) + 3600 }),
      );
      const tamperedToken = `${header}.${tamperedPayloadB64}.${sig}`;
      expect(() => cryptoService.verifyJwt(tamperedToken, secret)).toThrow('Invalid token signature');
    });
  });
});

