import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';
import pino from 'pino';

export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'reaction'
  | 'interactive'
  | 'unsupported';

export interface QuotedMessageContext {
  providerMessageId: string;
  senderPhoneNumber: string;
  senderName?: string;
  messageBody: string;
  messageType?: WhatsAppMessageType;
}

export interface RegularWhatsAppSessionState {
  connectionId: string;
  status: 'connecting' | 'qr_ready' | 'connected' | 'disconnected' | 'expired' | 'error';
  qrCodeDataUrl?: string;
  phoneNumber?: string;
  connectedAt?: Date;
  lastQrTimestamp?: Date;
  errorMessage?: string;
}

import {
  parseWhatsAppJid,
  canonicalizePhoneNumber,
  resolveWhatsAppWebChatIdentity,
  resolveConversationIdentity,
} from '../../utils/whatsapp-phone.util';

export interface NormalizedWhatsAppMessage {
  connectionId: string;
  providerMessageId: string;
  remoteJid: string;
  participantJid?: string;
  senderPhoneNumber: string;
  recipientPhoneNumber: string;
  externalParticipantPhone: string;
  senderName?: string;
  messageBody: string;
  messageType: WhatsAppMessageType;
  mediaUrl?: string;
  mediaBase64?: string;
  mimetype?: string;
  filename?: string;
  fileSize?: number;
  thumbnail?: string;
  duration?: number;
  latitude?: number;
  longitude?: number;
  vcard?: string;
  quotedMessage?: QuotedMessageContext;
  reactionEmoji?: string;
  decryptionStatus?: 'decrypted' | 'decryption_pending' | 'media_pending' | 'failed';
  direction: 'inbound' | 'outbound';
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'pending' | 'failed';
  fromMe: boolean;
}

export interface SendWhatsAppMediaOptions {
  text?: string;
  messageType?: WhatsAppMessageType;
  mediaBase64?: string;
  mediaBuffer?: Buffer;
  mimetype?: string;
  filename?: string;
  caption?: string;
  ptt?: boolean;
  duration?: number;
  latitude?: number;
  longitude?: number;
  contactData?: { displayName: string; vcard: string };
  quotedMessageId?: string;
  reactionEmoji?: string;
  reactionKey?: { remoteJid?: string; id?: string; fromMe?: boolean };
}

export type SessionUpdateCallback = (session: RegularWhatsAppSessionState) => void | Promise<void>;
export type MessageReceivedCallback = (message: NormalizedWhatsAppMessage) => void | Promise<void>;
export type StatusUpdateCallback = (connectionId: string, providerMessageId: string, status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed') => void | Promise<void>;
export type HistorySyncCallback = (connectionId: string, stats: { contactsCount: number; chatsCount: number; messagesCount: number; isLatest?: boolean }) => void | Promise<void>;
export type LidMappingCallback = (connectionId: string, cleanLid: string, verifiedPhone: string) => void | Promise<void>;

@Injectable()
export class RegularWhatsAppAdapter implements OnModuleDestroy {
  private readonly logger = new Logger(RegularWhatsAppAdapter.name);
  private readonly sessions: Map<string, RegularWhatsAppSessionState> = new Map();
  private readonly activeSockets: Map<string, any> = new Map();
  private readonly updateCallbacks: Map<string, SessionUpdateCallback> = new Map();
  private readonly messageCallbacks: Map<string, MessageReceivedCallback> = new Map();
  private readonly statusCallbacks: Map<string, StatusUpdateCallback> = new Map();
  private readonly historyCallbacks: Map<string, HistorySyncCallback> = new Map();
  private readonly lidCallbacks: Map<string, LidMappingCallback> = new Map();
  private readonly baseSessionPath: string;

  // In-memory message retry cache to fix "Waiting for this message" Signal protocol retry flows
  private readonly msgRetryCache: Map<string, any> = new Map();
  private readonly MAX_RETRY_CACHE_SIZE = 1000;
  private readonly lidToPhoneMap: Map<string, string> = new Map();

  constructor() {
    this.baseSessionPath = path.join(process.cwd(), 'data', 'wa_sessions');
    if (!fs.existsSync(this.baseSessionPath)) {
      fs.mkdirSync(this.baseSessionPath, { recursive: true });
    }
  }

  loadLidMap(connectionId: string): void {
    try {
      const filePath = path.join(this.baseSessionPath, connectionId, 'lid_map.json');
      if (fs.existsSync(filePath)) {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const lidCb = this.lidCallbacks.get(connectionId);
        for (const [lid, phone] of Object.entries(raw)) {
          if (lid && phone) {
            this.lidToPhoneMap.set(String(lid), String(phone));
            if (lidCb) {
              lidCb(connectionId, String(lid), String(phone));
            }
          }
        }
        this.logger.log(`[RegularWhatsAppAdapter] Loaded ${Object.keys(raw).length} LID mappings for connection ${connectionId}`);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to load lid_map.json for connection ${connectionId}: ${err.message}`);
    }
  }

  saveLidMapping(connectionId: string, rawLid: string, rawPhone: string): void {
    if (!connectionId || !rawLid || !rawPhone) return;
    const cleanLid = rawLid.split('@')[0].replace(/[^0-9]/g, '');
    const { canonicalPhone } = canonicalizePhoneNumber(rawPhone);
    const targetPhone = canonicalPhone || rawPhone;

    if (!cleanLid || !targetPhone) return;

    this.lidToPhoneMap.set(cleanLid, targetPhone);
    this.lidToPhoneMap.set(`${cleanLid}@lid`, targetPhone);

    const lidCb = this.lidCallbacks.get(connectionId);
    if (lidCb) {
      lidCb(connectionId, cleanLid, targetPhone);
    }

    try {
      const filePath = path.join(this.baseSessionPath, connectionId, 'lid_map.json');
      let currentMap: Record<string, string> = {};
      if (fs.existsSync(filePath)) {
        try {
          currentMap = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) {}
      }
      currentMap[cleanLid] = targetPhone;
      currentMap[`${cleanLid}@lid`] = targetPhone;
      fs.writeFileSync(filePath, JSON.stringify(currentMap, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.warn(`Failed to save lid_map.json for connection ${connectionId}: ${err.message}`);
    }
  }

  hasSavedSession(connectionId: string): boolean {
    const credsPath = path.join(this.baseSessionPath, connectionId, 'creds.json');
    return fs.existsSync(credsPath);
  }

  isSocketActive(connectionId: string): boolean {
    return this.activeSockets.has(connectionId);
  }

  async onModuleDestroy() {
    for (const [, sock] of this.activeSockets.entries()) {
      try {
        sock.ev?.removeAllListeners('connection.update');
        sock.ev?.removeAllListeners('creds.update');
        sock.ev?.removeAllListeners('messages.upsert');
        sock.ev?.removeAllListeners('messages.update');
        sock.ev?.removeAllListeners('messaging-history.set');
        sock.end(undefined);
      } catch (err) {
        // ignore
      }
    }
    this.activeSockets.clear();
  }

  private async getBaileys() {
    try {
      const baileys = require('@whiskeysockets/baileys');
      return baileys;
    } catch (err) {
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      return dynamicImport('@whiskeysockets/baileys');
    }
  }

  /**
   * Recursively unwraps Baileys message containers (viewOnce, ephemeral, documentWithCaption, template, interactive)
   */
  private unwrapBaileysMessage(rawMsg: any): { unwrapped: any; type: WhatsAppMessageType; rawContainer: any } {
    if (!rawMsg || !rawMsg.message) {
      if (rawMsg?.messageStubType) {
        return { unwrapped: null, type: 'unsupported', rawContainer: null };
      }
      return { unwrapped: null, type: 'unsupported', rawContainer: null };
    }

    let m = rawMsg.message;
    const rawContainer = m;

    while (m) {
      if (m.ephemeralMessage?.message) {
        m = m.ephemeralMessage.message;
        continue;
      }
      if (m.viewOnceMessage?.message) {
        m = m.viewOnceMessage.message;
        continue;
      }
      if (m.viewOnceMessageV2?.message) {
        m = m.viewOnceMessageV2.message;
        continue;
      }
      if (m.documentWithCaptionMessage?.message) {
        m = m.documentWithCaptionMessage.message;
        continue;
      }
      if (m.templateMessage?.hydratedTemplate) {
        m = m.templateMessage.hydratedTemplate;
        continue;
      }
      break;
    }

    if (m.conversation || m.extendedTextMessage) {
      return { unwrapped: m, type: 'text', rawContainer };
    }
    if (m.imageMessage) {
      return { unwrapped: m.imageMessage, type: 'image', rawContainer };
    }
    if (m.videoMessage) {
      return { unwrapped: m.videoMessage, type: 'video', rawContainer };
    }
    if (m.audioMessage) {
      return { unwrapped: m.audioMessage, type: m.audioMessage.ptt ? 'voice' : 'audio', rawContainer };
    }
    if (m.documentMessage) {
      return { unwrapped: m.documentMessage, type: 'document', rawContainer };
    }
    if (m.stickerMessage) {
      return { unwrapped: m.stickerMessage, type: 'sticker', rawContainer };
    }
    if (m.locationMessage || m.liveLocationMessage) {
      return { unwrapped: m.locationMessage || m.liveLocationMessage, type: 'location', rawContainer };
    }
    if (m.contactMessage || m.contactsArrayMessage) {
      return { unwrapped: m.contactMessage || m.contactsArrayMessage, type: 'contact', rawContainer };
    }
    if (m.reactionMessage) {
      return { unwrapped: m.reactionMessage, type: 'reaction', rawContainer };
    }
    if (m.buttonsResponseMessage || m.listResponseMessage || m.templateButtonReplyMessage) {
      return { unwrapped: m, type: 'interactive', rawContainer };
    }

    return { unwrapped: m, type: 'unsupported', rawContainer };
  }

  /**
   * Helper to extract human-readable text and metadata from Baileys message object
   */
  private extractNormalizedPayload(rawMsg: any): {
    messageBody: string;
    messageType: WhatsAppMessageType;
    mediaBase64?: string;
    mimetype?: string;
    filename?: string;
    fileSize?: number;
    thumbnail?: string;
    duration?: number;
    latitude?: number;
    longitude?: number;
    vcard?: string;
    quotedMessage?: QuotedMessageContext;
    reactionEmoji?: string;
    decryptionStatus?: 'decrypted' | 'decryption_pending' | 'media_pending' | 'failed';
  } {
    const { unwrapped, type } = this.unwrapBaileysMessage(rawMsg);

    // Check for "Waiting for this message" stub state
    if (!unwrapped) {
      if (rawMsg?.messageStubType === 2 || rawMsg?.messageStubType === 'CIPHERTEXT') {
        return {
          messageBody: 'Waiting for this message. This may take a while.',
          messageType: 'unsupported',
          decryptionStatus: 'decryption_pending',
        };
      }
      return {
        messageBody: '[Unsupported or unavailable message]',
        messageType: 'unsupported',
        decryptionStatus: 'failed',
      };
    }

    // Extract Context / Quoted Message if present
    let quotedMessage: QuotedMessageContext | undefined = undefined;
    const contextInfo =
      unwrapped?.contextInfo ||
      rawMsg.message?.extendedTextMessage?.contextInfo ||
      rawMsg.message?.imageMessage?.contextInfo ||
      rawMsg.message?.videoMessage?.contextInfo ||
      rawMsg.message?.documentMessage?.contextInfo;

    if (contextInfo?.quotedMessage && contextInfo?.stanzaId) {
      const q = contextInfo.quotedMessage;
      let qText = q.conversation || q.extendedTextMessage?.text || '';
      let qType: WhatsAppMessageType = 'text';

      if (q.imageMessage) {
        qText = q.imageMessage.caption || '[Image]';
        qType = 'image';
      } else if (q.videoMessage) {
        qText = q.videoMessage.caption || '[Video]';
        qType = 'video';
      } else if (q.documentMessage) {
        qText = q.documentMessage.fileName || '[Document]';
        qType = 'document';
      } else if (q.audioMessage) {
        qText = '[Audio / Voice Note]';
        qType = 'audio';
      }

      const qSenderDigits = (contextInfo.participant || '').split('@')[0].replace(/[^0-9]/g, '');
      quotedMessage = {
        providerMessageId: contextInfo.stanzaId,
        senderPhoneNumber: qSenderDigits ? `+${qSenderDigits}` : '',
        messageBody: qText || '[Quoted Message]',
        messageType: qType,
      };
    }

    if (type === 'text') {
      const text =
        unwrapped.conversation ||
        unwrapped.extendedTextMessage?.text ||
        unwrapped.text ||
        '';
      return {
        messageBody: text || '[Empty message]',
        messageType: 'text',
        quotedMessage,
        decryptionStatus: 'decrypted',
      };
    }

    if (type === 'image') {
      const caption = unwrapped.caption || '';
      return {
        messageBody: caption || '[Image]',
        messageType: 'image',
        mimetype: unwrapped.mimetype || 'image/jpeg',
        fileSize: unwrapped.fileLength ? Number(unwrapped.fileLength) : undefined,
        thumbnail: unwrapped.jpegThumbnail ? Buffer.from(unwrapped.jpegThumbnail).toString('base64') : undefined,
        quotedMessage,
        decryptionStatus: 'decrypted',
      };
    }

    if (type === 'video') {
      const caption = unwrapped.caption || '';
      return {
        messageBody: caption || '[Video]',
        messageType: 'video',
        mimetype: unwrapped.mimetype || 'video/mp4',
        fileSize: unwrapped.fileLength ? Number(unwrapped.fileLength) : undefined,
        duration: unwrapped.seconds ? Number(unwrapped.seconds) : undefined,
        quotedMessage,
        decryptionStatus: 'decrypted',
      };
    }

    if (type === 'audio' || type === 'voice') {
      return {
        messageBody: type === 'voice' ? '[Voice Note]' : '[Audio]',
        messageType: type,
        mimetype: unwrapped.mimetype || 'audio/ogg; codecs=opus',
        fileSize: unwrapped.fileLength ? Number(unwrapped.fileLength) : undefined,
        duration: unwrapped.seconds ? Number(unwrapped.seconds) : undefined,
        quotedMessage,
        decryptionStatus: 'decrypted',
      };
    }

    if (type === 'document') {
      const filename = unwrapped.fileName || 'document.pdf';
      const caption = unwrapped.caption || '';
      return {
        messageBody: caption ? `${caption} (${filename})` : `[Document: ${filename}]`,
        messageType: 'document',
        filename,
        mimetype: unwrapped.mimetype || 'application/pdf',
        fileSize: unwrapped.fileLength ? Number(unwrapped.fileLength) : undefined,
        quotedMessage,
        decryptionStatus: 'decrypted',
      };
    }

    if (type === 'sticker') {
      return {
        messageBody: '[Sticker]',
        messageType: 'sticker',
        mimetype: unwrapped.mimetype || 'image/webp',
        fileSize: unwrapped.fileLength ? Number(unwrapped.fileLength) : undefined,
        quotedMessage,
        decryptionStatus: 'decrypted',
      };
    }

    if (type === 'location') {
      const lat = unwrapped.degreesLatitude;
      const lng = unwrapped.degreesLongitude;
      const locName = unwrapped.name || unwrapped.address || 'Location';
      return {
        messageBody: `📍 ${locName} (${lat}, ${lng})`,
        messageType: 'location',
        latitude: lat,
        longitude: lng,
        quotedMessage,
        decryptionStatus: 'decrypted',
      };
    }

    if (type === 'contact') {
      const displayName = unwrapped.displayName || 'Contact Card';
      const vcard = unwrapped.vcard || '';
      return {
        messageBody: `👤 ${displayName}`,
        messageType: 'contact',
        filename: displayName,
        vcard,
        quotedMessage,
        decryptionStatus: 'decrypted',
      };
    }

    if (type === 'reaction') {
      const reactionEmoji = unwrapped.text || '';
      return {
        messageBody: reactionEmoji || '👍',
        messageType: 'reaction',
        reactionEmoji,
        quotedMessage: unwrapped.key?.id
          ? {
              providerMessageId: unwrapped.key.id,
              senderPhoneNumber: '',
              messageBody: '',
            }
          : undefined,
        decryptionStatus: 'decrypted',
      };
    }

    if (type === 'interactive') {
      const title =
        unwrapped.buttonsResponseMessage?.selectedDisplayText ||
        unwrapped.listResponseMessage?.title ||
        unwrapped.templateButtonReplyMessage?.selectedDisplayText ||
        '[Interactive Response]';
      return {
        messageBody: title,
        messageType: 'interactive',
        quotedMessage,
        decryptionStatus: 'decrypted',
      };
    }

    return {
      messageBody: '[Message]',
      messageType: 'unsupported',
      decryptionStatus: 'decrypted',
    };
  }

  /**
   * Initializes a real Baileys WhatsApp QR session with full message decryption retry support
   */
  async initializeSession(
    connectionId: string,
    onUpdate?: SessionUpdateCallback,
    onMessage?: MessageReceivedCallback,
    onStatus?: StatusUpdateCallback,
    onHistory?: HistorySyncCallback,
    onLidMapping?: LidMappingCallback,
    waitForQr = true,
  ): Promise<RegularWhatsAppSessionState> {
    if (onUpdate) {
      this.updateCallbacks.set(connectionId, onUpdate);
    }
    if (onMessage) {
      this.messageCallbacks.set(connectionId, onMessage);
    }
    if (onStatus) {
      this.statusCallbacks.set(connectionId, onStatus);
    }
    if (onHistory) {
      this.historyCallbacks.set(connectionId, onHistory);
    }
    if (onLidMapping) {
      this.lidCallbacks.set(connectionId, onLidMapping);
    }

    // 1. Prevent duplicate active sockets for the same connection
    const existingSock = this.activeSockets.get(connectionId);
    if (existingSock) {
      this.logger.log(`[Baileys Event] connectionId=${connectionId}, event='cleanup_existing_socket', timestamp=${new Date().toISOString()}`);
      try {
        existingSock.ev?.removeAllListeners('connection.update');
        existingSock.ev?.removeAllListeners('creds.update');
        existingSock.ev?.removeAllListeners('messages.upsert');
        existingSock.ev?.removeAllListeners('messages.update');
        existingSock.ev?.removeAllListeners('messaging-history.set');
        existingSock.end(undefined);
      } catch (err) {
        // ignore
      }
      this.activeSockets.delete(connectionId);
    }

    const sessionState: RegularWhatsAppSessionState = {
      connectionId,
      status: 'connecting',
    };
    this.sessions.set(connectionId, sessionState);

    const sessionDir = path.join(this.baseSessionPath, connectionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    try {
      const baileys = await this.getBaileys();
      const makeWASocket = baileys.default || baileys.makeWASocket;
      const { useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason } = baileys;

      const pinoLogger = pino({ level: 'silent' });
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307] as [number, number, number],
      }));

      // Setup getMessage retry store to resolve "Waiting for this message" decryption requests
      const sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pinoLogger),
        },
        getMessage: async (key: any) => {
          if (key?.id && this.msgRetryCache.has(key.id)) {
            return this.msgRetryCache.get(key.id);
          }
          return undefined;
        },
        printQRInTerminal: false,
        logger: pinoLogger,
        browser: ['AutoMarket Automation OS', 'Chrome', '120.0.0.0'],
        syncFullHistory: true,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      this.activeSockets.set(connectionId, sock);

      // Load persistent LID mapping for this session
      this.loadLidMap(connectionId);

      // Save credentials on update
      sock.ev.on('creds.update', saveCreds);

      // Listen for contact and chat updates to map LIDs to Phone Numbers automatically
      sock.ev.on('contacts.upsert', (contacts: any[]) => {
        if (!Array.isArray(contacts)) return;
        for (const c of contacts) {
          if (c.lid && c.id) {
            this.saveLidMapping(connectionId, c.lid, c.id);
          }
        }
      });

      sock.ev.on('contacts.update', (updates: any[]) => {
        if (!Array.isArray(updates)) return;
        for (const u of updates) {
          if (u.lid && u.id) {
            this.saveLidMapping(connectionId, u.lid, u.id);
          }
        }
      });

      sock.ev.on('chats.upsert', (chats: any[]) => {
        if (!Array.isArray(chats)) return;
        for (const ch of chats) {
          if (ch.lid && ch.id) {
            this.saveLidMapping(connectionId, ch.lid, ch.id);
          }
        }
      });

      // Setup QR promise to wait for first QR if requested
      let qrResolve: (() => void) | null = null;
      const qrPromise = waitForQr
        ? new Promise<void>((resolve) => {
            qrResolve = resolve;
            setTimeout(() => {
              if (qrResolve) {
                qrResolve();
                qrResolve = null;
              }
            }, 6000);
          })
        : null;

      // Message ID to JID tracker for automatic cross-protocol LID correlation
      const seenMsgJids: Map<string, string> = new Map();

      // 1. Listen for incoming and outgoing messages in real time
      sock.ev.on('messages.upsert', async (upsert: any) => {
        const { messages: rawMessages, type } = upsert;
        if (!rawMessages || !Array.isArray(rawMessages)) return;

        for (const rawMsg of rawMessages) {
          try {
            const key = rawMsg.key;
            if (!key || !key.remoteJid || key.remoteJid === 'status@broadcast') continue;

            // Cache raw message proto in retry store for Signal decryption retries
            if (key.id && rawMsg.message) {
              if (this.msgRetryCache.size >= this.MAX_RETRY_CACHE_SIZE) {
                const oldestKey = this.msgRetryCache.keys().next().value;
                if (oldestKey) this.msgRetryCache.delete(oldestKey);
              }
              this.msgRetryCache.set(key.id, rawMsg.message);
            }

            const fromMe = Boolean(key.fromMe);
            const currentSession = this.sessions.get(connectionId);
            const connectedPhone = currentSession?.phoneNumber ||
              (sock.user?.id ? canonicalizePhoneNumber(sock.user.id).canonicalPhone : '');
            const { digitsOnly: connDigits } = canonicalizePhoneNumber(connectedPhone);

            // 1. Filter out host self-chat multi-device sync stanzas
            if (
              (connDigits && key.remoteJid.includes(connDigits)) ||
              (sock.user?.lid && key.remoteJid === sock.user.lid) ||
              (sock.user?.id && key.remoteJid === sock.user.id)
            ) {
              this.logger.log(`[Baileys Inbound] Ignored host self-chat / sync stanza from ${key.remoteJid}`);
              continue;
            }

            // 2. Auto-learn LID <-> Phone mappings from participant stanzas
            const participant = key.participant || rawMsg.participant;
            if (key.remoteJid.endsWith('@lid') && participant && participant.endsWith('@s.whatsapp.net')) {
              this.saveLidMapping(connectionId, key.remoteJid, participant);
            } else if (key.remoteJid.endsWith('@s.whatsapp.net') && participant && participant.endsWith('@lid')) {
              this.saveLidMapping(connectionId, participant, key.remoteJid);
            }

            // 3. Auto-learn LID <-> Phone mappings from duplicate message ID delivery across JIDs
            if (key.id) {
              const previousJid = seenMsgJids.get(key.id);
              if (previousJid && previousJid !== key.remoteJid) {
                if (previousJid.endsWith('@lid') && key.remoteJid.endsWith('@s.whatsapp.net')) {
                  this.saveLidMapping(connectionId, previousJid, key.remoteJid);
                } else if (previousJid.endsWith('@s.whatsapp.net') && key.remoteJid.endsWith('@lid')) {
                  this.saveLidMapping(connectionId, key.remoteJid, previousJid);
                }
              }
              seenMsgJids.set(key.id, key.remoteJid);
              if (seenMsgJids.size > 500) {
                const oldest = seenMsgJids.keys().next().value;
                if (oldest) seenMsgJids.delete(oldest);
              }
            }

            const resolved = resolveWhatsAppWebChatIdentity({
              connectionId,
              remoteJid: key.remoteJid,
              participantJid: participant,
              fromMe,
              connectedPhoneNumber: connectedPhone,
              pushName: rawMsg.pushName,
              lidToPhoneMap: this.lidToPhoneMap,
            });

            const payload = this.extractNormalizedPayload(rawMsg);
            if (!payload.messageBody && !rawMsg.message && !rawMsg.messageStubType) continue;

            const providerMessageId = key.id || `baileys_${Date.now()}`;
            const timestamp = rawMsg.messageTimestamp
              ? new Date(Number(rawMsg.messageTimestamp) * 1000)
              : new Date();

            const normalized: NormalizedWhatsAppMessage = {
              connectionId,
              providerMessageId,
              remoteJid: resolved.remoteJid,
              participantJid: resolved.participantJid,
              senderPhoneNumber: resolved.senderPhoneNumber,
              recipientPhoneNumber: resolved.recipientPhoneNumber,
              externalParticipantPhone: resolved.verifiedPhone,
              senderName: resolved.displayName,
              messageBody: payload.messageBody,
              messageType: payload.messageType,
              mediaUrl: payload.mediaBase64 ? `data:${payload.mimetype || 'image/jpeg'};base64,${payload.mediaBase64}` : undefined,
              mediaBase64: payload.mediaBase64,
              mimetype: payload.mimetype,
              filename: payload.filename,
              fileSize: payload.fileSize,
              thumbnail: payload.thumbnail,
              duration: payload.duration,
              latitude: payload.latitude,
              longitude: payload.longitude,
              vcard: payload.vcard,
              quotedMessage: payload.quotedMessage,
              reactionEmoji: payload.reactionEmoji,
              decryptionStatus: payload.decryptionStatus || 'decrypted',
              direction: resolved.direction,
              timestamp,
              status: fromMe ? 'sent' : 'delivered',
              fromMe,
            };

            this.logger.log(
              `[Baileys Inbound Trace] conn=${connectionId}, fromMe=${fromMe}, remoteJid=${key.remoteJid}, sender=${resolved.senderPhoneNumber}, recipient=${resolved.recipientPhoneNumber}, verifiedPhone=${resolved.verifiedPhone}, displayName=${resolved.displayName}, msgId=${providerMessageId}`,
            );

            const msgCb = this.messageCallbacks.get(connectionId);
            if (msgCb) {
              await msgCb(normalized);
            }
          } catch (msgErr: any) {
            this.logger.error(`Error processing Baileys message upsert: ${msgErr.message}`);
          }
        }
      });

      // 2. Listen for delivery and read receipts
      sock.ev.on('messages.update', async (updates: any[]) => {
        if (!updates || !Array.isArray(updates)) return;
        for (const u of updates) {
          try {
            const key = u.key;
            if (!key || !key.id) continue;
            const statusVal = u.update?.status;
            if (statusVal === undefined) continue;

            let mappedStatus: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | null = null;
            if (statusVal === 3 || statusVal === 4 || statusVal === 'READ' || statusVal === 'PLAYED') {
              mappedStatus = 'read';
            } else if (statusVal === 2 || statusVal === 'DELIVERY_ACK') {
              mappedStatus = 'delivered';
            } else if (statusVal === 1 || statusVal === 'SERVER_ACK') {
              mappedStatus = 'sent';
            } else if (statusVal === 0 || statusVal === 'PENDING') {
              mappedStatus = 'pending';
            }

            if (mappedStatus) {
              this.logger.log(`[Baileys Status Update] connectionId=${connectionId}, msgId=${key.id}, status=${mappedStatus}`);
              const statusCb = this.statusCallbacks.get(connectionId);
              if (statusCb) {
                await statusCb(connectionId, key.id, mappedStatus);
              }
            }
          } catch (err: any) {
            this.logger.error(`Error processing Baileys messages.update: ${err.message}`);
          }
        }
      });

      // 3. Historical sync event
      sock.ev.on('messaging-history.set', async (history: any) => {
        const { messages: rawMessages, chats, contacts, isLatest } = history;
        const msgCount = rawMessages && Array.isArray(rawMessages) ? rawMessages.length : 0;
        const chatCount = chats && Array.isArray(chats) ? chats.length : 0;
        const contactCount = contacts && Array.isArray(contacts) ? contacts.length : 0;

        this.logger.log(`[Baileys History Sync] connectionId=${connectionId}, messages=${msgCount}, chats=${chatCount}, contacts=${contactCount}, isLatest=${isLatest}`);

        if (contacts && Array.isArray(contacts)) {
          for (const c of contacts) {
            if (c.lid && c.id) {
              this.saveLidMapping(connectionId, c.lid, c.id);
            }
          }
        }
        if (chats && Array.isArray(chats)) {
          for (const ch of chats) {
            if (ch.lid && ch.id) {
              this.saveLidMapping(connectionId, ch.lid, ch.id);
            }
          }
        }

        const histCb = this.historyCallbacks.get(connectionId);
        if (histCb) {
          await histCb(connectionId, {
            contactsCount: contactCount,
            chatsCount: chatCount,
            messagesCount: msgCount,
            isLatest: Boolean(isLatest),
          });
        }
      });

      // 4. Connection updates
      sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrCodeDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 6,
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });

            const current = this.sessions.get(connectionId) || { connectionId, status: 'qr_ready' };
            current.status = 'qr_ready';
            current.qrCodeDataUrl = qrCodeDataUrl;
            current.lastQrTimestamp = new Date();
            current.errorMessage = undefined;
            this.sessions.set(connectionId, current);

            const cb = this.updateCallbacks.get(connectionId);
            if (cb) {
              await cb(current);
            }

            if (qrResolve) {
              qrResolve();
              qrResolve = null;
            }
          } catch (qrErr: any) {
            this.logger.error(`[Baileys Event] QR encode error: ${qrErr.message}`);
          }
        }

        if (connection === 'open') {
          const rawId = sock.user?.id || '';
          const phoneClean = (rawId.split(':')[0] || rawId.split('@')[0] || '').replace(/[^0-9]/g, '');
          const formattedPhone = phoneClean ? `+${phoneClean}` : '';

          this.logger.log(`[Baileys Event] connectionId=${connectionId}, event='connection.open', authenticated=${formattedPhone}`);

          const current = this.sessions.get(connectionId) || { connectionId, status: 'connected' };
          current.status = 'connected';
          current.phoneNumber = formattedPhone;
          current.connectedAt = new Date();
          current.qrCodeDataUrl = undefined;
          current.errorMessage = undefined;
          this.sessions.set(connectionId, current);

          const cb = this.updateCallbacks.get(connectionId);
          if (cb) {
            await cb(current);
          }

          if (qrResolve) {
            qrResolve();
            qrResolve = null;
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason?.loggedOut || statusCode === 401;

          this.logger.log(
            `[Baileys Event] connectionId=${connectionId}, event='connection.close', statusCode=${statusCode || 'unknown'}, isLoggedOut=${isLoggedOut}`,
          );

          const current = this.sessions.get(connectionId) || { connectionId, status: 'disconnected' };

          if (isLoggedOut) {
            current.status = 'disconnected';
            current.qrCodeDataUrl = undefined;
            current.errorMessage = 'WhatsApp session logged out from mobile device';
            this.activeSockets.delete(connectionId);

            try {
              if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
              }
            } catch (err) {
              // ignore
            }
          } else if (statusCode === DisconnectReason?.restartRequired || statusCode === 515) {
            this.logger.log(`[Baileys Event] connectionId=${connectionId}, restart_required, reconnecting...`);
            setTimeout(() => {
              this.initializeSession(
                connectionId,
                this.updateCallbacks.get(connectionId),
                this.messageCallbacks.get(connectionId),
                this.statusCallbacks.get(connectionId),
                this.historyCallbacks.get(connectionId),
                this.lidCallbacks.get(connectionId),
                false,
              ).catch(() => {});
            }, 1000);
            return;
          } else if (statusCode === DisconnectReason?.connectionLost || statusCode === DisconnectReason?.timedOut) {
            current.status = 'disconnected';
            current.errorMessage = 'Connection timed out or lost. Reconnecting...';
          } else {
            current.status = 'disconnected';
          }

          this.sessions.set(connectionId, current);
          const cb = this.updateCallbacks.get(connectionId);
          if (cb) {
            await cb(current);
          }
        }
      });

      if (qrPromise) {
        await qrPromise;
      }

      return this.sessions.get(connectionId) || sessionState;
    } catch (err: any) {
      this.logger.error(`[Baileys Event] Init error: ${err.message}`);
      sessionState.status = 'error';
      sessionState.errorMessage = err.message || 'Failed to initialize WhatsApp socket';
      this.sessions.set(connectionId, sessionState);
      return sessionState;
    }
  }

  getSession(connectionId: string): RegularWhatsAppSessionState | undefined {
    return this.sessions.get(connectionId);
  }

  async disconnect(connectionId: string): Promise<void> {
    this.logger.log(`[Baileys Event] connectionId=${connectionId}, event='disconnect_requested'`);
    const sock = this.activeSockets.get(connectionId);
    if (sock) {
      try {
        sock.ev?.removeAllListeners('connection.update');
        sock.ev?.removeAllListeners('creds.update');
        await sock.logout();
      } catch (err) {
        try {
          sock.end(undefined);
        } catch (e) {
          // ignore
        }
      }
      this.activeSockets.delete(connectionId);
    }

    const session = this.sessions.get(connectionId);
    if (session) {
      session.status = 'disconnected';
      session.qrCodeDataUrl = undefined;
      this.sessions.set(connectionId, session);
    }

    const sessionDir = path.join(this.baseSessionPath, connectionId);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (err) {
      // ignore
    }
  }

  /**
   * Sends outgoing message (Text, Image, Video, Audio, Voice, Document, Location, Contact, Reaction)
   */
  async sendMessage(
    connectionId: string,
    toPhone: string,
    options: string | SendWhatsAppMediaOptions,
  ): Promise<{ providerMessageId: string; status: 'sent' | 'failed'; errorMessage?: string }> {
    const sock = this.activeSockets.get(connectionId);
    const session = this.sessions.get(connectionId);

    if (!sock || !session || session.status !== 'connected') {
      return {
        providerMessageId: '',
        status: 'failed',
        errorMessage: 'Regular WhatsApp session is not active or connected',
      };
    }

    try {
      const cleanDigits = toPhone.replace(/[^0-9]/g, '');
      const jid = toPhone.includes('@') ? toPhone : `${cleanDigits}@s.whatsapp.net`;

      const opts: SendWhatsAppMediaOptions =
        typeof options === 'string' ? { text: options, messageType: 'text' } : options;

      let messagePayload: any = null;
      let sendOptions: any = {};

      // Handle Reactions
      if (opts.reactionEmoji && opts.reactionKey) {
        const reactionKey = {
          remoteJid: opts.reactionKey.remoteJid || jid,
          id: opts.reactionKey.id,
          fromMe: opts.reactionKey.fromMe || false,
        };
        const result = await sock.sendMessage(jid, {
          react: {
            text: opts.reactionEmoji,
            key: reactionKey,
          },
        });
        return {
          providerMessageId: result?.key?.id || `REACT_${Date.now()}`,
          status: 'sent',
        };
      }

      // Handle Quoted Context if provided
      if (opts.quotedMessageId) {
        sendOptions.quoted = {
          key: {
            remoteJid: jid,
            id: opts.quotedMessageId,
            fromMe: false,
          },
          message: { conversation: '' },
        };
      }

      // 1. Image
      if (opts.messageType === 'image' && (opts.mediaBuffer || opts.mediaBase64)) {
        const buffer = opts.mediaBuffer || Buffer.from(opts.mediaBase64!, 'base64');
        messagePayload = {
          image: buffer,
          caption: opts.caption || opts.text || '',
          mimetype: opts.mimetype || 'image/jpeg',
        };
      }
      // 2. Video
      else if (opts.messageType === 'video' && (opts.mediaBuffer || opts.mediaBase64)) {
        const buffer = opts.mediaBuffer || Buffer.from(opts.mediaBase64!, 'base64');
        messagePayload = {
          video: buffer,
          caption: opts.caption || opts.text || '',
          mimetype: opts.mimetype || 'video/mp4',
        };
      }
      // 3. Audio / Voice Note
      else if ((opts.messageType === 'audio' || opts.messageType === 'voice') && (opts.mediaBuffer || opts.mediaBase64)) {
        const buffer = opts.mediaBuffer || Buffer.from(opts.mediaBase64!, 'base64');
        messagePayload = {
          audio: buffer,
          mimetype: opts.mimetype || 'audio/ogg; codecs=opus',
          ptt: opts.messageType === 'voice' || opts.ptt === true,
        };
      }
      // 4. Document
      else if (opts.messageType === 'document' && (opts.mediaBuffer || opts.mediaBase64)) {
        const buffer = opts.mediaBuffer || Buffer.from(opts.mediaBase64!, 'base64');
        messagePayload = {
          document: buffer,
          fileName: opts.filename || 'document.pdf',
          mimetype: opts.mimetype || 'application/pdf',
          caption: opts.caption || opts.text || '',
        };
      }
      // 5. Location
      else if (opts.messageType === 'location' && opts.latitude && opts.longitude) {
        messagePayload = {
          location: {
            degreesLatitude: opts.latitude,
            degreesLongitude: opts.longitude,
          },
        };
      }
      // 6. Contact Card
      else if (opts.messageType === 'contact' && opts.contactData) {
        messagePayload = {
          contacts: {
            displayName: opts.contactData.displayName,
            contacts: [{ vcard: opts.contactData.vcard }],
          },
        };
      }
      // 7. Plain Text Default
      else {
        messagePayload = { text: opts.text || opts.caption || '' };
      }

      const result = await sock.sendMessage(jid, messagePayload, sendOptions);
      const providerMessageId = result?.key?.id || `REG_${Date.now()}`;

      // Cache outbound message in retry store
      if (result?.message) {
        this.msgRetryCache.set(providerMessageId, result.message);
      }

      return {
        providerMessageId,
        status: 'sent',
      };
    } catch (err: any) {
      return {
        providerMessageId: '',
        status: 'failed',
        errorMessage: err.message || 'Failed to send WhatsApp message',
      };
    }
  }
}
