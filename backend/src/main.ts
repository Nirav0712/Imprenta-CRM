import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import * as express from 'express';
import * as net from 'net';

// Global reference to ensure MongoDB child process is not garbage collected
declare global {
  var __MONGOD_INSTANCE__: any;
}

async function isPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function ensureLocalDatabase() {
  const currentUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/automarket';

  // If running in production, use remote connection directly
  if (process.env.NODE_ENV === 'production') {
    const sanitized = currentUri.replace(/\/\/.*@/, '//<auth>@');
    Logger.log(`Using production MongoDB Atlas connection: ${sanitized}`, 'Bootstrap');
    return;
  }

  // If remote Atlas URI is provided in development, test if it is reachable (handles Atlas IP whitelist issues)
  if (currentUri.includes('mongodb+srv://') || (!currentUri.includes('127.0.0.1') && !currentUri.includes('localhost'))) {
    try {
      const mongoose = await import('mongoose');
      const testConn = await mongoose.default.createConnection(currentUri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
      }).asPromise();
      await testConn.close();
      const sanitized = currentUri.replace(/\/\/.*@/, '//<auth>@');
      Logger.log(`Using MongoDB Atlas connection: ${sanitized}`, 'Bootstrap');
      return;
    } catch (atlasErr: any) {
      Logger.warn(
        `Remote MongoDB Atlas unreachable (${atlasErr.message}). Automatically falling back to local database engine for development...`,
        'Bootstrap',
      );
    }
  }

  // Check if an external MongoDB daemon is already running on port 27017
  const isRunning = await isPortOpen(27017);
  if (isRunning) {
    Logger.log(`Found active local MongoDB service on port 27017`, 'Bootstrap');
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/automarket';
    return;
  }

  // Launch embedded MongoDB Server for local offline development only
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create({
      instance: {
        dbName: 'automarket',
      },
    });

    global.__MONGOD_INSTANCE__ = mongod;
    const activeUri = mongod.getUri() + 'automarket';
    process.env.MONGODB_URI = activeUri;

    Logger.log(`Local development MongoDB database engine started at: ${activeUri}`, 'Bootstrap');
  } catch (err: any) {
    Logger.error(`Failed to launch database runner: ${err.message}`, 'Bootstrap');
  }
}

async function bootstrap() {
  await ensureLocalDatabase();

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

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

      // Allow Vercel deployments (*.vercel.app)
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
  await app.listen(port, host);
  logger.log(`AutoMarket CRM Backend running on http://${host}:${port}`);
}

bootstrap();

