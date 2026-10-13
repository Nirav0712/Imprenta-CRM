import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from '../../common/crypto/crypto.service';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger('AuthService');

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  async onModuleInit() {
    if (this.userModel?.db?.readyState !== 1) {
      this.userModel?.db?.once('connected', () => {
        this.seedDefaultAdmin().catch((err) => {
          this.logger.warn(`Could not seed default admin user on connect: ${err.message}`);
        });
      });
      return;
    }
    await this.seedDefaultAdmin();
  }

  /**
   * Cryptographically hash a password using PBKDF2 with SHA-512 and salt
   */
  hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
  }

  /**
   * Cryptographically verify a password against stored hash & salt using timing-safe comparison
   */
  verifyPassword(password: string, hash: string, salt: string): boolean {
    if (!password || !hash || !salt) return false;
    try {
      const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
      const hashBuf = Buffer.from(hash, 'hex');
      const verifyBuf = Buffer.from(verifyHash, 'hex');
      if (hashBuf.length !== verifyBuf.length) return false;
      return crypto.timingSafeEqual(hashBuf, verifyBuf);
    } catch {
      return false;
    }
  }

  /**
   * Automatically seed initial admin account if users collection is empty
   */
  private async seedDefaultAdmin() {
    try {
      if (this.userModel?.db?.readyState !== 1) return;
      const defaultOrg = (process.env.DEFAULT_ORGANIZATION_ID || 'imprenta').trim();

      const requiredAdmins = [
        {
          email: 'meetpatel125@gmail.com',
          name: 'Meet Patel',
          password: 'Alto@0819',
        },
        {
          email: 'nikhil@imprenta.in',
          name: 'Nikhil',
          password: 'Nikhil@1980',
        },
      ];

      for (const admin of requiredAdmins) {
        const { hash, salt } = this.hashPassword(admin.password);
        const existing = await this.userModel.findOne({ email: admin.email.toLowerCase() }).exec();
        if (!existing) {
          await this.userModel.create({
            email: admin.email.toLowerCase(),
            name: admin.name,
            passwordHash: hash,
            salt,
            organizationId: defaultOrg,
            role: 'admin',
            isActive: true,
          });
          this.logger.log(`Initialized administrative user (${admin.email}) for tenant: ${defaultOrg}`);
        } else {
          existing.name = admin.name;
          existing.passwordHash = hash;
          existing.salt = salt;
          existing.isActive = true;
          existing.role = 'admin';
          existing.organizationId = defaultOrg;
          await existing.save();
          this.logger.log(`Updated administrative user credentials for (${admin.email})`);
        }
      }

      // Deactivate legacy test accounts
      await this.userModel.updateMany(
        { email: { $in: ['admin@imprenta.in', 'admin@imprenta.com', 'thedigitalconnect712@gmail.com'] } },
        { $set: { isActive: false } },
      ).exec().catch(() => {});
    } catch (err: any) {
      this.logger.warn(`Could not seed default admin user: ${err.message}`);
    }
  }

  /**
   * Authenticate user with Email/Username + Password and issue verified JWT
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    if (!email || !email.trim()) {
      throw new BadRequestException('Email or Username is required');
    }
    if (!password || !password.trim()) {
      throw new BadRequestException('Password is required');
    }

    const normalizedIdentifier = email.trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || 'nikhil@imprenta.in').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Nikhil@1980';
    const defaultOrg = (process.env.DEFAULT_ORGANIZATION_ID || 'imprenta').trim();

    const validAdminCredentials: Record<string, string[]> = {
      'meetpatel125@gmail.com': ['Alto@0819'],
      'meetpatel125': ['Alto@0819'],
      'nikhil@imprenta.in': ['Nikhil@1980'],
      'nikhil': ['Nikhil@1980'],
    };

    if (adminEmail && adminPassword) {
      validAdminCredentials[adminEmail] = [adminPassword];
    }

    const validPasswords = validAdminCredentials[normalizedIdentifier] || [];
    const isAdminAttempt = validPasswords.length > 0;
    const isAdminPasswordMatch = isAdminAttempt && validPasswords.includes(password);

    const getAdminName = (id: string) => {
      if (id.includes('meet')) return 'Meet Patel';
      if (id.includes('nikhil')) return 'Nikhil';
      return 'Imprenta Administrator';
    };

    const getAdminEmail = (id: string) => {
      if (id.includes('@')) return id;
      if (id.includes('meet')) return 'meetpatel125@gmail.com';
      if (id.includes('nikhil')) return 'nikhil@imprenta.in';
      return adminEmail;
    };

    const readyState = this.userModel?.db?.readyState;

    // If DB is offline but admin provided correct credentials, allow immediate fallback login
    if (readyState !== 1) {
      if (isAdminPasswordMatch) {
        this.logger.warn(`Admin login authenticated via fallback credentials (database readyState=${readyState})`);
        const fallbackAdminPayload = {
          _id: 'admin-root',
          email: getAdminEmail(normalizedIdentifier),
          name: getAdminName(normalizedIdentifier),
          organizationId: defaultOrg,
          role: 'admin',
        };
        return this.generateAuthResponse(fallbackAdminPayload, defaultOrg);
      }
      this.logger.warn(`Login rejected: Database connection unavailable (readyState=${readyState})`);
      throw new ServiceUnavailableException('Database temporarily unavailable');
    }

    // 2. Search database for user by email or username
    let user: any;
    try {
      user = await this.userModel.findOne({
        $or: [
          { email: normalizedIdentifier },
          { name: new RegExp(`^${normalizedIdentifier}$`, 'i') },
        ],
      }).exec();
    } catch (dbErr: any) {
      this.logger.error(`Database query failed during login: ${dbErr.message}`);
      if (isAdminPasswordMatch) {
        const fallbackAdminPayload = {
          _id: 'admin-root',
          email: getAdminEmail(normalizedIdentifier),
          name: getAdminName(normalizedIdentifier),
          organizationId: defaultOrg,
          role: 'admin',
        };
        return this.generateAuthResponse(fallbackAdminPayload, defaultOrg);
      }
      throw new ServiceUnavailableException('Database temporarily unavailable');
    }

    // Fallback: If DB had no user yet or connecting initially, verify against configured admin env
    if (!user && isAdminPasswordMatch) {
      const { hash, salt } = this.hashPassword(password);
      try {
        user = await this.userModel.create({
          email: getAdminEmail(normalizedIdentifier),
          name: getAdminName(normalizedIdentifier),
          passwordHash: hash,
          salt,
          organizationId: defaultOrg,
          role: 'admin',
          isActive: true,
        });
      } catch {
        user = await this.userModel.findOne({
          $or: [{ email: normalizedIdentifier }, { name: normalizedIdentifier }],
        }).exec();
      }
    }

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Validate password
    let isMatch = this.verifyPassword(password, user.passwordHash, user.salt);
    if (isAdminPasswordMatch) {
      isMatch = true;
      user.isActive = true;
      const { hash, salt } = this.hashPassword(password);
      user.passwordHash = hash;
      user.salt = salt;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled. Please contact your system administrator.');
    }

    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 4. Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save().catch(() => {});

    // 5. Resolve verified organizationId strictly from database user record
    const verifiedOrgId = (user.organizationId || defaultOrg).trim();
    return this.generateAuthResponse(user, verifiedOrgId);
  }

  private generateAuthResponse(user: any, verifiedOrgId: string) {

    const jwtSecret =
      process.env.JWT_SECRET ||
      this.configService.get<string>('jwtSecret') ||
      process.env.API_KEY ||
      this.configService.get<string>('apiKey') ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const expiresInSec = 86400 * 7; // 7 days expiration

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      organizationId: verifiedOrgId,
      role: user.role || 'admin',
    };

    const token = this.cryptoService.signJwt(payload, jwtSecret, expiresInSec);

    return {
      success: true,
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: expiresInSec,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || 'User',
        organizationId: verifiedOrgId,
        role: user.role || 'admin',
      },
    };
  }

  async getMe(userContext: any) {
    if (!userContext || !userContext.userId) {
      throw new UnauthorizedException('Unauthenticated');
    }

    if (this.userModel?.db?.readyState === 1) {
      try {
        const user = await this.userModel.findById(userContext.userId).select('-passwordHash -salt').exec();
        if (user) {
          return {
            success: true,
            user: {
              id: user._id.toString(),
              email: user.email,
              name: user.name,
              organizationId: user.organizationId,
              role: user.role,
            },
          };
        }
      } catch (err: any) {
        this.logger.warn(`Could not fetch user profile from DB: ${err.message}`);
      }
    }

    return {
      success: true,
      user: {
        id: userContext.userId || userContext.sub || 'user',
        email: userContext.email || 'admin@imprenta.internal',
        name: userContext.name || 'Administrator',
        organizationId: userContext.organizationId || 'default-org',
        role: userContext.role || 'admin',
      },
    };
  }
}
