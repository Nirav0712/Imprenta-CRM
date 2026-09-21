/**
 * Shared WhatsApp Phone & JID Normalization Utility
 * Handles E.164 canonicalization, JID parsing, LID resolution, and sender/receiver identity mapping.
 */

export interface ParsedWhatsAppJid {
  raw: string;
  user: string;
  server: string;
  isLid: boolean;
  isGroup: boolean;
  isStatusBroadcast: boolean;
}

export interface CanonicalPhoneResult {
  canonicalPhone: string;     // e.g. "+919925843531"
  nationalPhone: string;      // e.g. "9925843531" (last 10 digits)
  countryCode: string;        // e.g. "91"
  digitsOnly: string;         // e.g. "919925843531"
  isLid: boolean;
}

export interface ResolvedConversationIdentity {
  connectionId: string;
  externalParticipantPhone: string; // The customer's canonical phone (e.g. "+919925843531")
  senderPhoneNumber: string;        // Who actually sent the message
  recipientPhoneNumber: string;     // Who actually receives the message
  direction: 'inbound' | 'outbound';
  fromMe: boolean;
  remoteJid: string;
  participantJid?: string;
  isLid: boolean;
}

/**
 * Parses a raw WhatsApp JID into its components
 */
export function parseWhatsAppJid(jid?: string): ParsedWhatsAppJid {
  if (!jid) {
    return { raw: '', user: '', server: '', isLid: false, isGroup: false, isStatusBroadcast: false };
  }

  const clean = jid.trim();
  const [userWithDevice, serverPart = 's.whatsapp.net'] = clean.split('@');
  // Strip device suffixes like "917069754589:1" -> "917069754589"
  const user = (userWithDevice || '').split(':')[0].replace(/[^0-9a-zA-Z_-]/g, '');
  const server = serverPart.toLowerCase();

  const isLid = server === 'lid';
  const isGroup = server === 'g.us';
  const isStatusBroadcast = clean === 'status@broadcast' || server === 'broadcast';

  return {
    raw: clean,
    user,
    server,
    isLid,
    isGroup,
    isStatusBroadcast,
  };
}

/**
 * Canonicalizes any phone number, national format, or raw string into standard E.164 (+<country_code><number>)
 */
export function canonicalizePhoneNumber(
  input?: string,
  defaultCountryCode = '91',
): CanonicalPhoneResult {
  if (!input) {
    return {
      canonicalPhone: '',
      nationalPhone: '',
      countryCode: defaultCountryCode,
      digitsOnly: '',
      isLid: false,
    };
  }

  const raw = input.trim();
  const parsedJid = parseWhatsAppJid(raw);

  // If input contains a JID format, extract user
  let digits = (parsedJid.user || raw).replace(/[^0-9]/g, '');

  // Detect LID numbers: WhatsApp LIDs are typically 14-16 digits and do not represent a valid E.164 phone
  const isLid = parsedJid.isLid || (digits.length >= 14 && !digits.startsWith('91') && !digits.startsWith('1'));

  if (!digits || isLid) {
    return {
      canonicalPhone: '',
      nationalPhone: '',
      countryCode: defaultCountryCode,
      digitsOnly: digits,
      isLid,
    };
  }

  // Handle Indian phone number formats
  let canonicalPhone = '';
  let nationalPhone = '';
  let countryCode = defaultCountryCode;

  if (digits.length === 10) {
    // 10 digits e.g. "9925843531" -> "+919925843531"
    nationalPhone = digits;
    countryCode = defaultCountryCode;
    canonicalPhone = `+${countryCode}${nationalPhone}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    // 11 digits starting with 0 e.g. "09925843531" -> "+919925843531"
    nationalPhone = digits.slice(1);
    countryCode = defaultCountryCode;
    canonicalPhone = `+${countryCode}${nationalPhone}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    // 12 digits starting with 91 e.g. "919925843531" -> "+919925843531"
    nationalPhone = digits.slice(2);
    countryCode = '91';
    canonicalPhone = `+${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // North American numbers e.g. "14155552671" -> "+14155552671"
    nationalPhone = digits.slice(1);
    countryCode = '1';
    canonicalPhone = `+${digits}`;
  } else if (digits.length > 10) {
    // General international numbers
    nationalPhone = digits.slice(-10);
    countryCode = digits.slice(0, -10);
    canonicalPhone = `+${digits}`;
  } else {
    // Fallback for short test numbers
    nationalPhone = digits;
    canonicalPhone = `+${digits}`;
  }

  return {
    canonicalPhone,
    nationalPhone,
    countryCode,
    digitsOnly: digits,
    isLid: false,
  };
}

export interface WhatsAppWebChatIdentity {
  connectionId: string;
  remoteJid: string;
  participantJid?: string;
  isLid: boolean;
  isGroup: boolean;
  verifiedPhone: string;
  displayName: string;
  senderPhoneNumber: string;
  recipientPhoneNumber: string;
  direction: 'inbound' | 'outbound';
  fromMe: boolean;
}

/**
 * WhatsApp Web style Chat Identity Resolver:
 * Uses connectionId + remoteJid as the true chat identity without guessing fake numbers.
 */
export function resolveWhatsAppWebChatIdentity(params: {
  connectionId: string;
  remoteJid: string;
  participantJid?: string;
  fromMe: boolean;
  connectedPhoneNumber?: string;
  pushName?: string;
  lidToPhoneMap?: Map<string, string>;
}): WhatsAppWebChatIdentity {
  const {
    connectionId,
    remoteJid,
    participantJid,
    fromMe,
    connectedPhoneNumber = '',
    pushName,
    lidToPhoneMap,
  } = params;

  const parsedRemote = parseWhatsAppJid(remoteJid);
  const parsedParticipant = parseWhatsAppJid(participantJid);

  const isLid = parsedRemote.isLid || parsedParticipant.isLid;
  const isGroup = parsedRemote.isGroup;

  let verifiedPhone = '';
  let displayName = pushName?.trim() || '';

  if (parsedRemote.server === 's.whatsapp.net') {
    const digits = parsedRemote.user.replace(/[^0-9]/g, '');
    if (digits) {
      verifiedPhone = `+${digits}`;
      if (!displayName) displayName = verifiedPhone;
    }
  } else if (isLid) {
    // Check if LID is mapped to a verified phone
    let mappedPhone: string | undefined;
    if (lidToPhoneMap) {
      mappedPhone =
        lidToPhoneMap.get(parsedRemote.user) ||
        lidToPhoneMap.get(parsedRemote.raw) ||
        (parsedParticipant.user ? lidToPhoneMap.get(parsedParticipant.user) : undefined);
    }
    if (mappedPhone) {
      verifiedPhone = canonicalizePhoneNumber(mappedPhone).canonicalPhone || mappedPhone;
      if (!displayName) displayName = verifiedPhone;
    } else {
      // Unverified LID: DO NOT invent a fake phone number!
      verifiedPhone = '';
      if (!displayName) displayName = 'WhatsApp Contact';
    }
  } else if (isGroup) {
    verifiedPhone = '';
    if (!displayName) displayName = 'WhatsApp Group';
  }

  const canonConnected = canonicalizePhoneNumber(connectedPhoneNumber).canonicalPhone || connectedPhoneNumber;

  const senderPhoneNumber = fromMe ? (canonConnected || 'Connected Account') : (verifiedPhone || displayName || remoteJid);
  const recipientPhoneNumber = fromMe ? (verifiedPhone || displayName || remoteJid) : (canonConnected || 'Connected Account');

  return {
    connectionId,
    remoteJid,
    participantJid,
    isLid,
    isGroup,
    verifiedPhone,
    displayName: displayName || 'WhatsApp Contact',
    senderPhoneNumber,
    recipientPhoneNumber,
    direction: fromMe ? 'outbound' : 'inbound',
    fromMe,
  };
}

/**
 * Resolves complete sender and receiver semantics and conversation identity
 */
export function resolveConversationIdentity(params: {
  connectionId: string;
  remoteJid: string;
  participantJid?: string;
  fromMe: boolean;
  connectedPhoneNumber?: string;
  pushName?: string;
  lidToPhoneMap?: Map<string, string>;
}): ResolvedConversationIdentity {
  const resolved = resolveWhatsAppWebChatIdentity(params);

  return {
    connectionId: resolved.connectionId,
    externalParticipantPhone: resolved.verifiedPhone || resolved.displayName,
    senderPhoneNumber: resolved.senderPhoneNumber,
    recipientPhoneNumber: resolved.recipientPhoneNumber,
    direction: resolved.direction,
    fromMe: resolved.fromMe,
    remoteJid: resolved.remoteJid,
    participantJid: resolved.participantJid,
    isLid: resolved.isLid,
  };
}

/**
 * Checks if a JID represents the connected account's own phone number (self-chat)
 */
export function isSelfChatJid(jid?: string, connectedPhone?: string): boolean {
  if (!jid || !connectedPhone) return false;
  const parsed = parseWhatsAppJid(jid);
  const cleanPhone = canonicalizePhoneNumber(connectedPhone);
  const connDigits = cleanPhone.digitsOnly || connectedPhone.replace(/[^0-9]/g, '');
  if (!connDigits) return false;

  if (parsed.user === connDigits) return true;
  if (parsed.raw.includes(connDigits)) return true;
  return false;
}


