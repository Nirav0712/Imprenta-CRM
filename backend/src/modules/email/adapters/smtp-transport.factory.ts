import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

@Injectable()
export class SmtpTransportFactory {
  private readonly logger = new Logger(SmtpTransportFactory.name);

  createTransporter(config: SmtpConfig) {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure || config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      connectionTimeout: 10000,
      tls: {
        rejectUnauthorized: false, // Prevents self-signed cert blocks on custom enterprise SMTP
      },
    });
  }

  async verifyConnection(config: SmtpConfig): Promise<{ success: boolean; message: string; category?: string }> {
    try {
      if (!config.host || !config.user || !config.pass) {
        return {
          success: false,
          category: 'Invalid configuration',
          message: 'Invalid configuration: Host, username, or password is missing',
        };
      }

      const transporter = this.createTransporter(config);
      await transporter.verify();
      return {
        success: true,
        category: 'Connected',
        message: `Connected successfully to ${config.host}:${config.port} (TLS/SSL verified)`,
      };
    } catch (err: any) {
      const errMsg = (err.message || '').toLowerCase();
      const errCode = (err.code || '').toUpperCase();
      let category = 'Provider rejected connection';
      let safeMessage = 'Provider rejected connection';

      if (errCode === 'EAUTH' || errMsg.includes('535') || errMsg.includes('authentication') || errMsg.includes('credentials') || errMsg.includes('auth')) {
        category = 'Authentication failed';
        safeMessage = 'Authentication failed: Invalid username or App Password';
      } else if (errCode === 'ETIMEDOUT' || errCode === 'ESOCKETTIMEDOUT' || errMsg.includes('timeout') || errMsg.includes('timed out')) {
        category = 'Connection timeout';
        safeMessage = `Connection timeout connecting to ${config.host}:${config.port}`;
      } else if (errCode === 'ENOTFOUND' || errMsg.includes('getaddrinfo') || errMsg.includes('enotfound')) {
        category = 'Invalid configuration';
        safeMessage = `Invalid configuration: Host resolution failed for ${config.host}`;
      } else if (errCode === 'ECONNREFUSED' || errMsg.includes('refused')) {
        category = 'Provider rejected connection';
        safeMessage = `Provider rejected connection on port ${config.port}`;
      } else {
        category = 'Provider rejected connection';
        safeMessage = `Connection error: ${err.code || 'UNKNOWN_ERROR'}`;
      }

      this.logger.error(`SMTP verification failed for ${config.user} on ${config.host} [${category}]: ${safeMessage}`);
      return {
        success: false,
        category,
        message: safeMessage,
      };
    }
  }
}
