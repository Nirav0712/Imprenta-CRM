import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import * as express from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Log sanitized database connection target without leaking credentials
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    const sanitized = mongoUri.replace(/\/\/.*@/, '//<auth>@');
    logger.log(`Target database URI configured: ${sanitized}`);
  } else if (process.env.NODE_ENV === 'production') {
    logger.warn('NOTICE: MONGODB_URI is not set. Please ensure MongoDB Atlas connection string is configured in environment variables.');
  }

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const configService = app.get(ConfigService);

  // Enable Production-safe CORS with exact origin allowlist
  const frontendUrl = process.env.FRONTEND_URL;
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const isProd = process.env.NODE_ENV === 'production';

  const allowedOrigins = new Set<string>();
  if (frontendUrl) {
    allowedOrigins.add(frontendUrl.replace(/\/$/, '').toLowerCase());
  }
  if (allowedOriginsEnv) {
    allowedOriginsEnv.split(',').forEach((url) => {
      const trimmed = url.trim().replace(/\/$/, '').toLowerCase();
      if (trimmed) allowedOrigins.add(trimmed);
    });
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, webhooks)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/$/, '').toLowerCase();

      // Check explicit allowlist
      if (allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }

      // Allow Vercel preview & production deployments
      if (/^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      // In development, allow localhost / loopback
      if (!isProd && (/^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin))) {
        return callback(null, true);
      }

      // In production or if origin is unapproved, reject by omitting CORS headers
      return callback(null, false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,x-organization-id,Accept,Origin,X-Requested-With',
    exposedHeaders: 'Content-Disposition',
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Set payload size limits
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : (configService.get<number>('port') || 4000);
  const host = '0.0.0.0';

  // Fast port binding for Hostinger and production environments (within 3-second startup SLA)
  await app.listen(port, host);
  logger.log(`Imprenta CRM Backend listening on http://${host}:${port} (PID: ${process.pid})`);
}

bootstrap();


