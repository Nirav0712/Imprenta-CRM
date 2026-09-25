import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import * as express from 'express';
import * as http from 'http';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const rawPort = process.env.PORT || '4000';
  const port = !isNaN(Number(rawPort)) ? parseInt(rawPort, 10) : rawPort;
  const host = '0.0.0.0';
  const isProd = process.env.NODE_ENV === 'production';
  const hasMongoUri = Boolean(process.env.MONGODB_URI);

  // Sanitized diagnostic startup logs (NO secrets or credentials exposed)
  logger.log(`[Startup Diagnostics] PORT: ${port}`);
  logger.log(`[Startup Diagnostics] HOST: ${host}`);
  logger.log(`[Startup Diagnostics] NODE_ENV is production: ${isProd}`);
  logger.log(`[Startup Diagnostics] MONGODB_URI configured: ${hasMongoUri}`);

  // 1. Create native Express instance
  const server = express();

  // Top-level CORS and OPTIONS preflight handler for Hostinger / LiteSpeed reverse proxy
  server.use((req, res, next) => {
    const origin = (req.headers.origin as string) || '';
    const allowed = [
      'https://crm.imprenta.in',
      'https://imprenta-crm-lake.vercel.app',
      'http://localhost:3000',
      'http://localhost:4000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:4000',
    ];

    const normalized = origin.replace(/\/$/, '').toLowerCase();
    if (origin && (allowed.includes(normalized) || /^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-organization-id,x-api-key,Accept,Origin,X-Requested-With');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  // 2. Immediate HTTP Server binding for Hostinger 3-second listen SLA
  logger.log(`[Startup] Initiating immediate HTTP socket bind on ${host}:${port}...`);
  const httpServer = http.createServer(server);

  await new Promise<void>((resolve, reject) => {
    const onListen = () => {
      logger.log(`[Startup] HTTP socket successfully bound to ${port} (PID: ${process.pid})`);
      resolve();
    };
    if (typeof port === 'number') {
      httpServer.listen(port, host, onListen);
    } else {
      httpServer.listen(port, onListen);
    }
    httpServer.once('error', (err) => {
      logger.error(`[Startup] Failed to bind HTTP socket: ${err.message}`);
      reject(err);
    });
  });

  // 3. Early health probe responder while NestJS initializes in parallel
  let isNestReady = false;
  server.get('/health', (req, res, next) => {
    if (!isNestReady) {
      return res.status(200).json({
        status: 'starting',
        service: 'imprenta-crm-backend',
        timestamp: new Date().toISOString(),
        database: { status: 'initializing', databaseName: 'automarket' },
      });
    }
    next();
  });
  server.get('/api/health', (req, res, next) => {
    if (!isNestReady) {
      return res.status(200).json({
        status: 'starting',
        service: 'imprenta-crm-backend',
        timestamp: new Date().toISOString(),
        database: { status: 'initializing', databaseName: 'automarket' },
      });
    }
    next();
  });

  // 4. Initialize NestJS application on top of the already-listening Express instance
  logger.log(`[Startup] Initializing NestJS application and modules...`);
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    rawBody: true,
  });

  const configService = app.get(ConfigService);

  // Enable Production-safe CORS with exact origin allowlist
  const frontendUrl = process.env.FRONTEND_URL;
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;

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

  // Initialize all NestJS routes, controllers, and modules
  await app.init();
  isNestReady = true;

  logger.log(`[Startup] NestJS application fully ready and serving traffic on http://${host}:${port}`);
}

bootstrap();



