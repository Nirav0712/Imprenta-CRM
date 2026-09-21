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

@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
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

    // Always allow public health checks and webhooks
    if (
      path === '/health' ||
      path === '/api/health' ||
      path === '/' ||
      path.startsWith('/api/whatsapp/webhook')
    ) {
      return true;
    }

    const authHeader = request.headers['authorization'];
    const apiKeyHeader = request.headers['x-api-key'];
    const requestedOrg =
      request.headers['x-organization-id'] ||
      request.query?.organizationId ||
      'default-org';

    const configuredSecret =
      process.env.API_KEY ||
      this.configService.get<string>('apiKey') ||
      process.env.JWT_SECRET;
    const isStrictMode =
      process.env.ENFORCE_TENANT_AUTH === 'true' ||
      process.env.STRICT_AUTH === 'true';

    // If caller provided token or API key, validate it
    if (authHeader || apiKeyHeader) {
      const token = apiKeyHeader || authHeader?.replace(/^Bearer\s+/i, '');
      if (configuredSecret && token !== configuredSecret) {
        throw new UnauthorizedException('Invalid authentication credentials');
      }
    } else if (isStrictMode) {
      throw new UnauthorizedException('Authentication credentials required');
    }

    // Cross-tenant access validation: if user object has specific organizationId
    if (request.user?.organizationId && request.user.organizationId !== requestedOrg) {
      throw new ForbiddenException('Cross-tenant access forbidden');
    }

    request.organizationId = requestedOrg;
    return true;
  }
}
