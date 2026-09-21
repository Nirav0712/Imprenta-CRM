import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

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
      databaseName: this.connection?.name || 'automarket',
    };
  }

  @Get('health')
  getHealth() {
    const db = this.getDatabaseStatus();
    return {
      status: db.status === 'connected' ? 'ok' : 'degraded',
      service: 'marketing-automation-backend',
      timestamp: new Date().toISOString(),
      database: db,
    };
  }

  @Get('api/health')
  getApiHealth() {
    const db = this.getDatabaseStatus();
    return {
      status: db.status === 'connected' ? 'ok' : 'degraded',
      service: 'marketing-automation-backend',
      timestamp: new Date().toISOString(),
      database: db,
    };
  }

  @Get()
  getRoot() {
    return {
      name: 'AutoMarket CRM API',
      status: 'online',
      version: '1.0.0',
      database: this.getDatabaseStatus().status,
    };
  }
}

