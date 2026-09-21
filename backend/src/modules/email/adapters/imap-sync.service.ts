import { Injectable, Logger } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface InboundEmailItem {
  messageId: string;
  uid: number;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  date: Date;
  flags: Set<string>;
}

@Injectable()
export class ImapSyncService {
  private readonly logger = new Logger(ImapSyncService.name);

  /**
   * Verifies IMAP connection credentials and mailbox accessibility
   */
  async verifyImapConnection(config: ImapConfig): Promise<{
    success: boolean;
    category?: 'connected' | 'disabled_by_provider' | 'invalid_credentials' | 'timeout' | 'invalid_config' | 'sync_failed';
    error?: string;
    mailboxCount?: number;
  }> {
    if (!config.host || !config.user || !config.pass) {
      return {
        success: false,
        category: 'invalid_config',
        error: 'IMAP host, username, or password is missing',
      };
    }

    const client = new ImapFlow({
      host: config.host,
      port: config.port || 993,
      secure: config.secure !== false,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      logger: false,
    });

    // Attach error listener immediately to prevent unhandled EventEmitter error crashes
    client.on('error', (err) => {
      this.logger.warn(`[ImapFlow Event] Connection error for ${config.user} on ${config.host}: ${err.message}`);
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      const count = client.mailbox ? client.mailbox.exists : 0;
      lock.release();
      await client.logout().catch(() => {});

      this.logger.log(`IMAP connection verified for ${config.user} on ${config.host}:${config.port} (INBOX messages: ${count})`);
      return { success: true, category: 'connected', mailboxCount: count };
    } catch (err: any) {
      const rawMsg = err.responseText || err.message || '';
      const errMsg = rawMsg.toLowerCase();
      let category: 'disabled_by_provider' | 'invalid_credentials' | 'timeout' | 'invalid_config' | 'sync_failed' = 'sync_failed';
      let safeError = 'Failed to authenticate with IMAP server';

      if (
        errMsg.includes('disabled') ||
        errMsg.includes('not enabled') ||
        errMsg.includes('yet to enable imap') ||
        errMsg.includes('contact your administrator')
      ) {
        category = 'disabled_by_provider';
        safeError = 'IMAP is disabled for this Zoho account. Enable IMAP in Zoho Mail settings or contact your administrator.';
      } else if (errMsg.includes('authentication') || errMsg.includes('login') || errMsg.includes('credential') || errMsg.includes('auth')) {
        category = 'invalid_credentials';
        safeError = 'Authentication failed: Invalid username or App Password for IMAP';
      } else if (errMsg.includes('timeout') || errMsg.includes('timed out')) {
        category = 'timeout';
        safeError = `Connection timeout connecting to IMAP ${config.host}:${config.port}`;
      } else if (errMsg.includes('getaddrinfo') || errMsg.includes('enotfound')) {
        category = 'invalid_config';
        safeError = `Invalid configuration: Host resolution failed for IMAP ${config.host}`;
      } else {
        category = 'sync_failed';
        safeError = `IMAP Error: ${err.responseText || err.code || err.message || 'UNKNOWN_ERROR'}`;
      }

      this.logger.error(`IMAP connection verification failed for ${config.user} on ${config.host} [${category}]: ${safeError}`);
      return { success: false, category, error: safeError };
    } finally {
      try {
        client.close();
      } catch {}
    }
  }

  async fetchRecentEmails(config: ImapConfig, limit: number = 30): Promise<InboundEmailItem[]> {
    if (!config.host || !config.user || !config.pass) {
      this.logger.warn(`IMAP not configured for ${config.user}`);
      return [];
    }

    const client = new ImapFlow({
      host: config.host,
      port: config.port || 993,
      secure: config.secure !== false,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      logger: false,
    });

    // Attach error listener immediately
    client.on('error', (err) => {
      this.logger.warn(`[ImapFlow Event] Sync error for ${config.user} on ${config.host}: ${err.message}`);
    });

    const items: InboundEmailItem[] = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const mailbox = client.mailbox;
        if (!mailbox || mailbox.exists === 0) {
          return [];
        }

        const fetchRange = `${Math.max(1, mailbox.exists - limit + 1)}:*`;

        for await (const message of client.fetch(fetchRange, { source: true, flags: true, envelope: true, uid: true })) {
          try {
            const parsed = await simpleParser(message.source);
            const fromAddr = (parsed.from?.value?.[0]?.address || config.user).toLowerCase().trim();
            const fromName = parsed.from?.value?.[0]?.name || fromAddr;
            const toAddr = parsed.to ? (Array.isArray(parsed.to) ? parsed.to[0]?.text : (parsed.to as any).text) : config.user;

            // Deterministic provider message ID
            const deterministicId = parsed.messageId
              ? parsed.messageId.trim()
              : `imap_uid_${config.host}_${message.uid}`;

            items.push({
              messageId: deterministicId,
              uid: message.uid,
              from: fromAddr,
              fromName,
              to: toAddr || config.user,
              subject: parsed.subject || '(No subject)',
              bodyHtml: (parsed.html as string) || (parsed.textAsHtml as string) || parsed.text || '',
              bodyText: parsed.text || '',
              date: parsed.date || new Date(),
              flags: message.flags,
            });
          } catch (parseErr) {
            this.logger.warn(`Failed to parse email source: ${(parseErr as Error).message}`);
          }
        }
      } finally {
        lock.release();
      }

      await client.logout().catch(() => {});
    } catch (err: any) {
      this.logger.error(`IMAP connection failed for ${config.user} on ${config.host}: ${err.message}`);
      throw new Error(`IMAP sync failed: ${err.message}`);
    } finally {
      try {
        client.close();
      } catch {}
    }

    return items;
  }
}
