import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CryptoService } from '../crypto/crypto.service';
import * as crypto from 'crypto';

@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const path = request.path || request.url || '';

    // Always allow public health checks, root status, and Meta webhook verification
    if (
      path === '/' ||
      path.startsWith('/health') ||
      path.startsWith('/api/health') ||
      path.startsWith('/api/whatsapp/webhook')
    ) {
      return true;
    }

    const authHeader = request.headers['authorization'];
    const apiKeyHeader = request.headers['x-api-key'];

    if (!authHeader && !apiKeyHeader) {
      throw new UnauthorizedException('Authentication credentials required: missing Authorization header or API Key');
    }

    const jwtSecret =
      process.env.JWT_SECRET ||
      this.configService.get<string>('jwtSecret') ||
      process.env.API_KEY ||
      this.configService.get<string>('apiKey') ||
      this.configService.get<string>('encryptionKey') ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const apiKeySecret =
      process.env.API_KEY ||
      this.configService.get<string>('apiKey') ||
      process.env.JWT_SECRET;

    const rawToken = (apiKeyHeader || authHeader?.replace(/^Bearer\s+/i, '') || '').trim();
    if (!rawToken) {
      throw new UnauthorizedException('Invalid or empty authentication credentials');
    }

    // 1. Check if token is a JSON Web Token (3 dot-separated Base64Url segments)
    if (rawToken.split('.').length === 3) {
      let payload: Record<string, any>;
      try {
        payload = this.cryptoService.verifyJwt(rawToken, jwtSecret);
      } catch (err: any) {
        if (err.message === 'Token has expired') {
          throw new UnauthorizedException('Token has expired');
        }
        if (err.message === 'Token is not active yet') {
          throw new UnauthorizedException('Token is not active yet');
        }
        if (err.message === 'Invalid token signature') {
          throw new UnauthorizedException('Invalid token signature');
        }
        throw new UnauthorizedException(`Token verification failed: ${err.message}`);
      }

      // Extract and validate tenant organization claim from verified JWT
      const tokenOrgId = payload.organizationId || payload.orgId || payload.tenantId;
      if (!tokenOrgId || typeof tokenOrgId !== 'string' || !tokenOrgId.trim()) {
        throw new UnauthorizedException('Token is missing required organizationId claim');
      }

      const verifiedOrg = tokenOrgId.trim();
      const requestedOrg = request.headers['x-organization-id'] || request.query?.organizationId;

      // Validate that client cannot cross-access another tenant's data
      if (requestedOrg && requestedOrg !== verifiedOrg) {
        throw new ForbiddenException(
          `Cross-tenant access forbidden: authenticated organization '${verifiedOrg}' does not match requested organization '${requestedOrg}'`,
        );
      }

      // Bind trusted server-side identity to request
      request.user = {
        userId: payload.sub || payload.userId || payload.id || payload.email || 'user',
        organizationId: verifiedOrg,
        email: payload.email,
        role: payload.role || 'member',
        ...payload,
      };
      request.organizationId = verifiedOrg;
      return true;
    }

    // 2. Otherwise treat as Server-to-Server / Internal API Key
    if (!apiKeySecret) {
      throw new UnauthorizedException('Server API Key not configured');
    }

    const tokenBuf = Buffer.from(rawToken);
    const keyBuf = Buffer.from(apiKeySecret);

    if (tokenBuf.length !== keyBuf.length || !crypto.timingSafeEqual(tokenBuf, keyBuf)) {
      throw new UnauthorizedException('Invalid API Key credentials');
    }

    // For verified API Key, determine organization context
    const requestedOrg =
      request.headers['x-organization-id'] ||
      request.query?.organizationId ||
      process.env.DEFAULT_ORGANIZATION_ID ||
      'default-org';

    request.user = {
      userId: 'api_key_system',
      organizationId: requestedOrg,
      role: 'admin',
    };
    request.organizationId = requestedOrg;
    return true;
  }
}
