const assert = require('assert');
const {
  canonicalizePhoneNumber,
  parseWhatsAppJid,
  resolveConversationIdentity
} = require('../dist/modules/whatsapp/utils/whatsapp-phone.util');

console.log('=== RUNNING COMPREHENSIVE PHONE / JID / IDENTITY TESTS ===\n');

// Test 1: Canonicalization
console.log('1. Testing canonicalizePhoneNumber...');
assert.strictEqual(canonicalizePhoneNumber('9925843531').canonicalPhone, '+919925843531');
assert.strictEqual(canonicalizePhoneNumber('+919925843531').canonicalPhone, '+919925843531');
assert.strictEqual(canonicalizePhoneNumber('919925843531').canonicalPhone, '+919925843531');
assert.strictEqual(canonicalizePhoneNumber('09925843531').canonicalPhone, '+919925843531');
assert.strictEqual(canonicalizePhoneNumber('9925843531@s.whatsapp.net').canonicalPhone, '+919925843531');
assert.strictEqual(canonicalizePhoneNumber('919925843531:1@s.whatsapp.net').canonicalPhone, '+919925843531');
console.log('✓ Canonicalization passed for all Indian and JID variants.');

// Test 2: Inbound Resolution
console.log('\n2. Testing Inbound resolveConversationIdentity...');
const inboundRes = resolveConversationIdentity({
  connectionId: '6aafd38dc1a68c0a6b1d23d2',
  remoteJid: '919925843531@s.whatsapp.net',
  fromMe: false,
  connectedPhoneNumber: '+917069754589'
});

assert.strictEqual(inboundRes.direction, 'inbound');
assert.strictEqual(inboundRes.senderPhoneNumber, '+919925843531');
assert.strictEqual(inboundRes.recipientPhoneNumber, '+917069754589');
assert.strictEqual(inboundRes.externalParticipantPhone, '+919925843531');
assert.strictEqual(inboundRes.fromMe, false);
console.log('✓ Inbound resolution verified:', inboundRes);

// Test 3: Outbound Resolution
console.log('\n3. Testing Outbound resolveConversationIdentity...');
const outboundRes = resolveConversationIdentity({
  connectionId: '6aafd38dc1a68c0a6b1d23d2',
  remoteJid: '919925843531@s.whatsapp.net',
  fromMe: true,
  connectedPhoneNumber: '+917069754589'
});

assert.strictEqual(outboundRes.direction, 'outbound');
assert.strictEqual(outboundRes.senderPhoneNumber, '+917069754589');
assert.strictEqual(outboundRes.recipientPhoneNumber, '+919925843531');
assert.strictEqual(outboundRes.externalParticipantPhone, '+919925843531');
assert.strictEqual(outboundRes.fromMe, true);
console.log('✓ Outbound resolution verified:', outboundRes);

// Test 4: LID Mapping Resolution
console.log('\n4. Testing LID Mapping resolveConversationIdentity...');
const lidMap = new Map();
lidMap.set('62551954038810', '+919925843531');

const lidInboundRes = resolveConversationIdentity({
  connectionId: '6aafd38dc1a68c0a6b1d23d2',
  remoteJid: '62551954038810@lid',
  fromMe: false,
  connectedPhoneNumber: '+917069754589',
  lidToPhoneMap: lidMap
});

assert.strictEqual(lidInboundRes.direction, 'inbound');
assert.strictEqual(lidInboundRes.senderPhoneNumber, '+919925843531');
assert.strictEqual(lidInboundRes.recipientPhoneNumber, '+917069754589');
assert.strictEqual(lidInboundRes.externalParticipantPhone, '+919925843531');
console.log('✓ LID resolution verified:', lidInboundRes);

console.log('\n ALL TESTS PASSED SUCCESSFULLY!');
