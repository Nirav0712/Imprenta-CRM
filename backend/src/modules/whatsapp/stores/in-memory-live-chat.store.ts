import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { canonicalizePhoneNumber, parseWhatsAppJid } from '../utils/whatsapp-phone.util';

export interface EphemeralWhatsAppMessage {
  _id: string;
  conversationId: string;
  connectionId: string;
  remoteJid: string;
  contactId?: string;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  providerMessageId: string;
  messageBody: string;
  messageType?: string;
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
  quotedMessage?: any;
  reactionEmoji?: string;
  decryptionStatus?: 'decrypted' | 'decryption_pending' | 'media_pending' | 'failed';
  senderPhoneNumber?: string;
  recipientPhoneNumber?: string;
  externalParticipantPhone?: string;
  senderName?: string;
  errorMessage?: string;
  timestamp: Date;
}

export interface EphemeralWhatsAppConversation {
  _id: string;
  connectionId: any;
  remoteJid: string;
  contactId?: any;
  customerPhoneNumber: string;
  customerName?: string;
  lastMessageText?: string;
  lastMessageType?: string;
  unreadCount: number;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  lastActivityAt: Date;
}

@Injectable()
export class InMemoryLiveChatStore {
  private readonly logger = new Logger(InMemoryLiveChatStore.name);

  // Ephemeral messages store: convId -> array of messages (capped at 100 per conv)
  private readonly messagesByConv: Map<string, EphemeralWhatsAppMessage[]> = new Map();

  // Ephemeral conversations store: convId -> conversation object
  private readonly conversations: Map<string, EphemeralWhatsAppConversation> = new Map();

  // Multi-Key index: "connectionId:remoteJid" | "connectionId:verifiedPhone" -> convId
  private readonly convKeyIndex: Map<string, string> = new Map();

  // LID mapping cache: "connectionId:lid" -> verifiedPhone
  private readonly lidToPhoneMap: Map<string, string> = new Map();

  private readonly MAX_MESSAGES_PER_CONV = 100;

  /**
   * Register a verified LID-to-Phone mapping and merge any duplicate conversations
   */
  recordLidMapping(connectionId: string, lidUser: string, verifiedPhone: string): void {
    if (!connectionId || !lidUser || !verifiedPhone) return;
    const cleanLid = lidUser.split('@')[0].replace(/[^0-9]/g, '');
    const { canonicalPhone, digitsOnly } = canonicalizePhoneNumber(verifiedPhone);
    const targetPhone = canonicalPhone || verifiedPhone;
    const phoneDigits = digitsOnly || verifiedPhone.replace(/[^0-9]/g, '');

    if (!cleanLid || !phoneDigits) return;

    const key1 = `${connectionId}:${cleanLid}`;
    const key2 = `${connectionId}:${cleanLid}@lid`;
    this.lidToPhoneMap.set(key1, targetPhone);
    this.lidToPhoneMap.set(key2, targetPhone);

    const phoneKey = `${connectionId}:${phoneDigits}@s.whatsapp.net`;
    const targetPhoneKey = `${connectionId}:${targetPhone}`;

    // Find any existing conversation created under this LID
    const lidConvId = this.convKeyIndex.get(key2) || this.convKeyIndex.get(key1);
    const phoneConvId = this.convKeyIndex.get(phoneKey) || this.convKeyIndex.get(targetPhoneKey);

    if (lidConvId && phoneConvId && lidConvId !== phoneConvId) {
      // MERGE: Both LID chat and Phone chat exist -> Merge LID messages into phone conversation
      const lidConv = this.conversations.get(lidConvId);
      const phoneConv = this.conversations.get(phoneConvId);

      if (lidConv && phoneConv) {
        const lidMsgs = this.messagesByConv.get(lidConvId) || [];
        const phoneMsgs = this.messagesByConv.get(phoneConvId) || [];

        // Combine and deduplicate by providerMessageId
        const seenMsgIds = new Set<string>();
        const mergedMsgs: EphemeralWhatsAppMessage[] = [];

        for (const m of [...phoneMsgs, ...lidMsgs]) {
          if (m.providerMessageId && seenMsgIds.has(m.providerMessageId)) continue;
          if (m.providerMessageId) seenMsgIds.add(m.providerMessageId);
          m.conversationId = phoneConv._id;
          mergedMsgs.push(m);
        }

        mergedMsgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        this.messagesByConv.set(phoneConvId, mergedMsgs.slice(-this.MAX_MESSAGES_PER_CONV));

        // Point all LID index keys to the canonical phone conversation
        this.convKeyIndex.set(key1, phoneConvId);
        this.convKeyIndex.set(key2, phoneConvId);

        // Remove the temporary LID conversation
        this.conversations.delete(lidConvId);
        this.messagesByConv.delete(lidConvId);

        this.logger.log(
          `[InMemoryLiveChatStore] Merged duplicate LID conversation #${lidConvId} into canonical phone conversation #${phoneConvId} for ${targetPhone}`,
        );
      }
    } else if (lidConvId) {
      // Update the LID conversation to canonical phone identity
      const lidConv = this.conversations.get(lidConvId);
      if (lidConv) {
        lidConv.customerPhoneNumber = targetPhone;
        if (!lidConv.customerName || lidConv.customerName === 'WhatsApp Contact' || lidConv.customerName === cleanLid) {
          lidConv.customerName = targetPhone;
        }
        lidConv.remoteJid = `${phoneDigits}@s.whatsapp.net`;
        this.convKeyIndex.set(phoneKey, lidConvId);
        this.convKeyIndex.set(targetPhoneKey, lidConvId);
        this.logger.log(
          `[InMemoryLiveChatStore] Canonicalized LID conversation #${lidConvId} to phone ${targetPhone} (${lidConv.remoteJid})`,
        );
      }
    }
  }

  /**
   * Resolve an LID to verified phone if known
   */
  resolveLid(connectionId: string, lidUser: string): string | undefined {
    const cleanLid = lidUser.split('@')[0].replace(/[^0-9]/g, '');
    const key1 = `${connectionId}:${cleanLid}`;
    const key2 = `${connectionId}:${cleanLid}@lid`;
    return this.lidToPhoneMap.get(key1) || this.lidToPhoneMap.get(key2);
  }

  /**
   * Get or create a conversation using connectionId + canonical remoteJid (WhatsApp Web style)
   */
  getOrCreateConversation(
    connectionId: string,
    remoteJidOrPhone: string,
    verifiedPhone?: string,
    customerName?: string,
    contactId?: string,
  ): EphemeralWhatsAppConversation {
    let cleanJid = remoteJidOrPhone.trim();
    let effectivePhone = verifiedPhone || '';

    // Check if input is a raw phone number without @
    if (!cleanJid.includes('@')) {
      const digits = cleanJid.replace(/[^0-9]/g, '');
      cleanJid = `${digits}@s.whatsapp.net`;
      if (!effectivePhone) {
        effectivePhone = `+${digits}`;
      }
    }

    // If input is an LID, check if we have a mapped phone number
    if (cleanJid.endsWith('@lid')) {
      const mapped = this.resolveLid(connectionId, cleanJid);
      if (mapped) {
        effectivePhone = mapped;
      }
    }

    // Determine canonical JID
    let canonicalJid = cleanJid;
    if (effectivePhone && !cleanJid.endsWith('@g.us')) {
      const phoneDigits = effectivePhone.replace(/[^0-9]/g, '');
      if (phoneDigits) {
        canonicalJid = `${phoneDigits}@s.whatsapp.net`;
      }
    }

    const primaryKey = `${connectionId}:${canonicalJid}`;
    const rawKey = `${connectionId}:${cleanJid}`;
    const phoneKey = effectivePhone ? `${connectionId}:${effectivePhone}` : undefined;

    let convId = this.convKeyIndex.get(primaryKey) || this.convKeyIndex.get(rawKey);
    if (!convId && phoneKey) {
      convId = this.convKeyIndex.get(phoneKey);
    }

    if (convId && this.conversations.has(convId)) {
      const existing = this.conversations.get(convId)!;
      if (effectivePhone && !existing.customerPhoneNumber) {
        existing.customerPhoneNumber = effectivePhone;
      }
      if (customerName && (!existing.customerName || existing.customerName === 'WhatsApp Contact' || existing.customerName === cleanJid)) {
        existing.customerName = customerName;
      }
      if (contactId && !existing.contactId) {
        existing.contactId = contactId;
      }
      this.convKeyIndex.set(primaryKey, convId);
      this.convKeyIndex.set(rawKey, convId);
      if (phoneKey) this.convKeyIndex.set(phoneKey, convId);
      return existing;
    }

    // Determine initial display properties
    const isLid = cleanJid.endsWith('@lid');
    const isGroup = cleanJid.endsWith('@g.us');
    let displayPhone = effectivePhone;
    if (!displayPhone && cleanJid.endsWith('@s.whatsapp.net')) {
      const digits = cleanJid.split('@')[0].replace(/[^0-9]/g, '');
      if (digits) displayPhone = `+${digits}`;
    }

    let displayName = customerName || displayPhone;
    if (!displayName) {
      displayName = isGroup ? 'WhatsApp Group' : (isLid ? 'WhatsApp Contact' : displayPhone || 'WhatsApp Chat');
    }

    const newId = new Types.ObjectId().toHexString();
    const newConv: EphemeralWhatsAppConversation = {
      _id: newId,
      connectionId: connectionId,
      remoteJid: canonicalJid,
      contactId: contactId || undefined,
      customerPhoneNumber: displayPhone,
      customerName: displayName,
      lastMessageText: '',
      lastMessageType: 'text',
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      isArchived: false,
      lastActivityAt: new Date(),
    };

    this.conversations.set(newId, newConv);
    this.convKeyIndex.set(primaryKey, newId);
    this.convKeyIndex.set(rawKey, newId);
    if (phoneKey) {
      this.convKeyIndex.set(phoneKey, newId);
    }
    this.messagesByConv.set(newId, []);

    this.logger.log(
      `[InMemoryLiveChatStore] Created chat #${newId} for canonicalJid: ${canonicalJid} (raw: ${cleanJid}, display: ${displayName}, phone: ${displayPhone})`,
    );
    return newConv;
  }

  /**
   * Find conversation by ID
   */
  getConversationById(convId: string): EphemeralWhatsAppConversation | undefined {
    return this.conversations.get(convId);
  }

  /**
   * Find conversation by connectionId and remoteJid or Phone
   */
  getConversationByKey(connectionId: string, remoteJidOrPhone: string): EphemeralWhatsAppConversation | undefined {
    const clean = remoteJidOrPhone.trim();
    const primaryKey = `${connectionId}:${clean}`;
    let convId = this.convKeyIndex.get(primaryKey);

    if (!convId && !clean.includes('@')) {
      const digits = clean.replace(/[^0-9]/g, '');
      convId = this.convKeyIndex.get(`${connectionId}:${digits}@s.whatsapp.net`) ||
        this.convKeyIndex.get(`${connectionId}:+${digits}`) ||
        this.convKeyIndex.get(`${connectionId}:${digits}`);
    }

    return convId ? this.conversations.get(convId) : undefined;
  }

  /**
   * Get all active conversations in memory (guaranteed zero self-chats)
   */
  getAllConversations(
    connectionId?: string,
    search?: string,
    filterType?: 'all' | 'unread' | 'pinned' | 'archived',
    connectedPhoneNumber?: string,
  ): EphemeralWhatsAppConversation[] {
    let list = Array.from(this.conversations.values());

    if (connectionId && connectionId !== 'ALL') {
      list = list.filter((c) => String(c.connectionId) === String(connectionId));
    }

    // Filter out host self-chats
    if (connectedPhoneNumber) {
      const { digitsOnly } = canonicalizePhoneNumber(connectedPhoneNumber);
      const connDigits = digitsOnly || connectedPhoneNumber.replace(/[^0-9]/g, '');
      if (connDigits) {
        list = list.filter(
          (c) =>
            !c.remoteJid.includes(connDigits) &&
            c.customerPhoneNumber.replace(/[^0-9]/g, '') !== connDigits,
        );
      }
    }

    if (filterType === 'unread') {
      list = list.filter((c) => c.unreadCount > 0);
    } else if (filterType === 'pinned') {
      list = list.filter((c) => c.isPinned);
    } else if (filterType === 'archived') {
      list = list.filter((c) => c.isArchived);
    } else {
      list = list.filter((c) => !c.isArchived);
    }

    if (search) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.remoteJid.toLowerCase().includes(q) ||
          (c.customerPhoneNumber && c.customerPhoneNumber.toLowerCase().includes(q)) ||
          (c.customerName && c.customerName.toLowerCase().includes(q)) ||
          (c.lastMessageText && c.lastMessageText.toLowerCase().includes(q)),
      );
    }

    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
    });
  }

  /**
   * Add a live message to in-memory store
   */
  addMessage(msg: Omit<EphemeralWhatsAppMessage, '_id'>): EphemeralWhatsAppMessage {
    const convId = msg.conversationId;
    let conv = this.conversations.get(convId);
    if (!conv) {
      conv = this.getOrCreateConversation(
        msg.connectionId,
        msg.remoteJid || msg.recipientPhoneNumber || msg.senderPhoneNumber || 'unknown@s.whatsapp.net',
        msg.externalParticipantPhone,
        msg.senderName,
        msg.contactId,
      );
    }

    const newMsg: EphemeralWhatsAppMessage = {
      ...msg,
      _id: new Types.ObjectId().toHexString(),
      conversationId: conv._id,
      remoteJid: conv.remoteJid,
      timestamp: msg.timestamp || new Date(),
      status: msg.status || 'sent',
      decryptionStatus: msg.decryptionStatus || 'decrypted',
    };

    let list = this.messagesByConv.get(conv._id) || [];
    let resultMsg = newMsg;

    // Idempotency check by providerMessageId
    if (newMsg.providerMessageId) {
      const existingIdx = list.findIndex((m) => m.providerMessageId === newMsg.providerMessageId);
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...newMsg };
        resultMsg = list[existingIdx];
      } else {
        list.push(newMsg);
        if (list.length > this.MAX_MESSAGES_PER_CONV) {
          list = list.slice(list.length - this.MAX_MESSAGES_PER_CONV);
        }
      }
    } else {
      list.push(newMsg);
      if (list.length > this.MAX_MESSAGES_PER_CONV) {
        list = list.slice(list.length - this.MAX_MESSAGES_PER_CONV);
      }
    }
    this.messagesByConv.set(conv._id, list);

    // Update conversation metadata
    conv.lastMessageText = resultMsg.messageBody || (resultMsg.messageType ? `[${resultMsg.messageType.toUpperCase()}]` : '');
    conv.lastMessageType = resultMsg.messageType || 'text';
    conv.lastActivityAt = resultMsg.timestamp;
    if (resultMsg.direction === 'inbound') {
      conv.unreadCount = (conv.unreadCount || 0) + 1;
    }

    return resultMsg;
  }

  /**
   * Retrieve live messages for a conversation
   */
  getMessages(convId: string, limit = 50, before?: string): EphemeralWhatsAppMessage[] {
    const list = this.messagesByConv.get(convId) || [];
    let filtered = list;

    if (before) {
      const beforeTime = new Date(before).getTime();
      filtered = filtered.filter((m) => new Date(m.timestamp).getTime() < beforeTime);
    }

    if (limit && limit > 0) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  /**
   * Update live message delivery / read status in memory
   */
  updateMessageStatus(
    connectionId: string,
    providerMessageId: string,
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed',
  ): void {
    for (const [convId, list] of this.messagesByConv.entries()) {
      const msg = list.find((m) => m.providerMessageId === providerMessageId);
      if (msg) {
        msg.status = status;
        this.logger.log(`[InMemoryLiveChatStore] Updated message #${providerMessageId} status to '${status}'`);
        return;
      }
    }
  }

  /**
   * Update conversation state (pin, mute, archive, unreadCount)
   */
  updateConversation(convId: string, updates: Partial<EphemeralWhatsAppConversation>): EphemeralWhatsAppConversation | undefined {
    const conv = this.conversations.get(convId);
    if (!conv) return undefined;

    if (updates.isPinned !== undefined) conv.isPinned = updates.isPinned;
    if (updates.isMuted !== undefined) conv.isMuted = updates.isMuted;
    if (updates.isArchived !== undefined) conv.isArchived = updates.isArchived;
    if (updates.unreadCount !== undefined) conv.unreadCount = updates.unreadCount;

    return conv;
  }

  /**
   * Clear messages for conversation
   */
  clearMessages(convId: string): void {
    this.messagesByConv.set(convId, []);
    const conv = this.conversations.get(convId);
    if (conv) {
      conv.lastMessageText = '';
      conv.unreadCount = 0;
    }
  }

  /**
   * Clear messages by connectionId and remoteJid or Phone
   */
  clearMessagesByKey(connectionId: string, remoteJidOrPhone: string): void {
    const conv = this.getConversationByKey(connectionId, remoteJidOrPhone);
    if (conv) {
      this.clearMessages(conv._id);
    }
  }
}
