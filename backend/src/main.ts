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

  // If MongoDB is an Atlas cluster (mongodb+srv://) or custom remote host, probe connectivity
  if (!currentUri.includes('127.0.0.1') && !currentUri.includes('localhost')) {
    const sanitized = currentUri.replace(/\/\/.*@/, '//<auth>@');
    Logger.log(`Probing MongoDB Atlas cluster: ${sanitized}...`, 'Bootstrap');
    try {
      const mongoose = await import('mongoose');
      const testConn = await mongoose.connect(currentUri, {
        serverSelectionTimeoutMS: 3500,
        connectTimeoutMS: 3500,
      });
      await testConn.disconnect();
      Logger.log(`Successfully reached MongoDB Atlas cluster! Connecting backend...`, 'Bootstrap');
      return;
    } catch (err: any) {
      Logger.warn(
        `MongoDB Atlas connection blocked by IP whitelist or network: ${err.message}. To connect directly to Atlas, add your IP (171.61.160.172) or 0.0.0.0/0 to Atlas Network Access. Initializing local database fallback for now.`,
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

  // Launch embedded high-performance MongoDB Server
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

    Logger.log(`Local MongoDB database engine started at: ${activeUri}`, 'Bootstrap');
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

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
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

  const port = configService.get<number>('port') || 4000;
  await app.listen(port);
  logger.log(`AutoMarket CRM Backend running on http://localhost:${port}`);
}

bootstrap();
