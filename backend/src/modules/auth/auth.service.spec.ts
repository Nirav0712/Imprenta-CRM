import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { User } from '../../database/schemas/user.schema';

describe('AuthService Unit Tests', () => {
  let authService: AuthService;
  let mockUserModel: any;
  let mockConfigService: any;
  let mockCryptoService: any;

  beforeEach(async () => {
    mockUserModel = {
      db: {
        readyState: 1,
        once: jest.fn(),
      },
      findOne: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'jwtSecret') return 'test_jwt_secret_0123456789abcdef';
        return null;
      }),
    };

    mockCryptoService = {
      signJwt: jest.fn((payload, secret, exp) => `mock_jwt_token_${payload.sub}`),
      verifyJwt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CryptoService,
          useValue: mockCryptoService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('Password Hashing and Verification', () => {
    it('should hash a password and verify it correctly', () => {
      const password = 'SecurePassword123!';
      const { hash, salt } = authService.hashPassword(password);
      expect(hash).toBeDefined();
      expect(salt).toBeDefined();

      const isValid = authService.verifyPassword(password, hash, salt);
      expect(isValid).toBe(true);

      const isInvalid = authService.verifyPassword('WrongPassword', hash, salt);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Login - Database Availability Guard (Fast Fail)', () => {
    it('should immediately throw ServiceUnavailableException (503) when database is disconnected (readyState=0)', async () => {
      mockUserModel.db.readyState = 0; // Disconnected

      const startTime = Date.now();
      await expect(
        authService.login({ email: 'admin@imprenta.com', password: 'password123' })
      ).rejects.toThrow(ServiceUnavailableException);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Fails in < 100ms, NEVER buffers for 10,000ms
      expect(mockUserModel.findOne).not.toHaveBeenCalled(); // Query was not even attempted
    });

    it('should immediately throw ServiceUnavailableException (503) when database is connecting (readyState=2)', async () => {
      mockUserModel.db.readyState = 2; // Connecting

      await expect(
        authService.login({ email: 'admin@imprenta.com', password: 'password123' })
      ).rejects.toThrow(ServiceUnavailableException);

      expect(mockUserModel.findOne).not.toHaveBeenCalled();
    });

    it('should catch Mongoose query errors and convert them to ServiceUnavailableException (503)', async () => {
      mockUserModel.db.readyState = 1;
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Mongoose query failed')),
      });

      await expect(
        authService.login({ email: 'admin@imprenta.com', password: 'password123' })
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('Login - Input Validation & Authentication Flow', () => {
    it('should throw BadRequestException if email or password is missing', async () => {
      await expect(authService.login({ email: '', password: 'pwd' })).rejects.toThrow(BadRequestException);
      await expect(authService.login({ email: 'test@test.com', password: '' })).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if user not found in database or admin credentials', async () => {
      mockUserModel.db.readyState = 1;
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        authService.login({ email: 'unknown@test.com', password: 'randompassword' })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if account is disabled (isActive=false)', async () => {
      mockUserModel.db.readyState = 1;
      const { hash, salt } = authService.hashPassword('secret123');

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'user_1',
          email: 'disabled@test.com',
          name: 'Disabled User',
          passwordHash: hash,
          salt,
          isActive: false,
          organizationId: 'tenant_1',
        }),
      });

      await expect(
        authService.login({ email: 'disabled@test.com', password: 'secret123' })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should successfully log in and issue JWT with tenant isolation when database is connected', async () => {
      mockUserModel.db.readyState = 1;
      const { hash, salt } = authService.hashPassword('correctPassword');

      const mockUserDoc = {
        _id: 'user_123',
        email: 'user@imprenta.com',
        name: 'John Doe',
        passwordHash: hash,
        salt,
        isActive: true,
        organizationId: 'tenant_custom_456',
        role: 'manager',
        lastLoginAt: null,
        save: jest.fn().mockResolvedValue(true),
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserDoc),
      });

      const result = await authService.login({
        email: 'user@imprenta.com',
        password: 'correctPassword',
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('mock_jwt_token_user_123');
      expect(result.user.organizationId).toBe('tenant_custom_456');
      expect(result.user.email).toBe('user@imprenta.com');
      expect(mockUserDoc.save).toHaveBeenCalled();
    });
  });

  describe('getMe Profile', () => {
    it('should return database profile when database is connected', async () => {
      mockUserModel.db.readyState = 1;
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: 'user_123',
            email: 'user@imprenta.com',
            name: 'John Doe',
            organizationId: 'tenant_456',
            role: 'admin',
          }),
        }),
      });

      const res = await authService.getMe({ userId: 'user_123' });
      expect(res.success).toBe(true);
      expect(res.user.email).toBe('user@imprenta.com');
    });

    it('should safely fall back to JWT context when database is disconnected', async () => {
      mockUserModel.db.readyState = 0; // Disconnected

      const jwtContext = {
        userId: 'user_123',
        email: 'user@imprenta.com',
        name: 'John Doe',
        organizationId: 'tenant_456',
        role: 'admin',
      };

      const res = await authService.getMe(jwtContext);
      expect(res.success).toBe(true);
      expect(res.user.organizationId).toBe('tenant_456');
    });
  });
});
