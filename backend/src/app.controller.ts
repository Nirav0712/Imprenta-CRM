import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  private getDatabaseStatus() {
    const stateMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    const state = this.connection?.readyState ?? 0;
    return {
      status: stateMap[state] || 'unknown',
      readyState: state,
      databaseName: this.connection?.name || 'automarket',
    };
  }

  @Get('health/live')
  getLive() {
    return {
      status: 'ok',
      service: 'imprenta-crm-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/ready')
  getReady(@Res() res: Response) {
    const db = this.getDatabaseStatus();
    if (db.status === 'connected') {
      return res.status(HttpStatus.OK).json({
        status: 'ok',
        service: 'imprenta-crm-backend',
        database: db.status,
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      status: 'unavailable',
      service: 'imprenta-crm-backend',
      database: db.status,
      timestamp: new Date().toISOString(),
    });
  }

  @Get('health')
  getHealth() {
    const db = this.getDatabaseStatus();
    return {
      status: db.status === 'connected' ? 'ok' : 'degraded',
      service: 'imprenta-crm-backend',
      timestamp: new Date().toISOString(),
      database: {
        status: db.status,
        databaseName: db.databaseName,
      },
    };
  }

  @Get('api/health')
  getApiHealth() {
    return this.getHealth();
  }

  @Get()
  getRoot() {
    return {
      name: 'Imprenta CRM API',
      status: 'online',
      version: '1.0.0',
      database: this.getDatabaseStatus().status,
    };
  }
}

