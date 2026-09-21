const http = require('http');

function postJson(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: 'GET'
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTest() {
  console.log('=== TEST 1: Sending WhatsApp Outbound Message via /api/whatsapp/send ===');
  const sendRes = await postJson('/api/whatsapp/send', {
    connectionId: '6aafd38dc1a68c0a6b1d23d2',
    recipientPhoneNumber: '+919925843531',
    customMessageBody: 'AutoMarket Acceptance Test - Verifying sender (+917069754589) & recipient (+919925843531) identity mapping at ' + new Date().toLocaleTimeString()
  });

  console.log('Send Status:', sendRes.status);
  console.log('Send Response Message Object:');
  console.log(' - Message ID:', sendRes.data?._id);
  console.log(' - Conversation ID:', sendRes.data?.conversationId);
  console.log(' - Direction:', sendRes.data?.direction);
  console.log(' - Sender Phone:', sendRes.data?.senderPhoneNumber);
  console.log(' - Recipient Phone:', sendRes.data?.recipientPhoneNumber);
  console.log(' - External Participant Phone:', sendRes.data?.externalParticipantPhone);
  console.log(' - Status:', sendRes.data?.status);
  console.log(' - Provider Message ID:', sendRes.data?.providerMessageId);

  const targetConvId = sendRes.data?.conversationId;

  console.log('\n=== TEST 2: Fetching Conversations List ===');
  const convRes = await getJson('/api/inbox/whatsapp/conversations?connectionId=6aafd38dc1a68c0a6b1d23d2');
  console.log('Conversations Count:', convRes.data.length);
  const targetConv = convRes.data.find(c => c._id === targetConvId || c.customerPhoneNumber === '+919925843531' || c.customerPhoneNumber.includes('9925843531'));
  console.log('Active Conversation in Inbox:');
  console.log(' - ID:', targetConv?._id);
  console.log(' - Customer Phone:', targetConv?.customerPhoneNumber);
  console.log(' - Customer Name:', targetConv?.customerName);
  console.log(' - Last Message:', targetConv?.lastMessageText);
  console.log(' - Unread Count:', targetConv?.unreadCount);

  if (targetConv) {
    console.log('\n=== TEST 3: Fetching Messages for Conversation ===');
    const msgRes = await getJson(`/api/inbox/whatsapp/conversations/${targetConv._id}/messages`);
    console.log(`Found ${msgRes.data.length} messages in conversation ${targetConv._id}:`);
    msgRes.data.forEach((m, idx) => {
      console.log(`[${idx + 1}] Dir=${m.direction} | Sender=${m.senderPhoneNumber} | Recipient=${m.recipientPhoneNumber} | ExtPhone=${m.externalParticipantPhone} | Body="${m.messageBody}"`);
    });

    console.log('\n=== TEST 4: Replying to Conversation via /api/inbox/whatsapp/conversations/:id/reply ===');
    const replyRes = await postJson(`/api/inbox/whatsapp/conversations/${targetConv._id}/reply`, {
      text: 'AutoMarket Inbox Direct Reply Test - sender (+917069754589) to recipient (+919925843531)'
    });
    console.log('Reply Status:', replyRes.status);
    console.log('Reply Response:');
    console.log(' - Message ID:', replyRes.data?._id);
    console.log(' - Conversation ID:', replyRes.data?.conversationId);
    console.log(' - Direction:', replyRes.data?.direction);
    console.log(' - Sender Phone:', replyRes.data?.senderPhoneNumber);
    console.log(' - Recipient Phone:', replyRes.data?.recipientPhoneNumber);
    console.log(' - External Participant Phone:', replyRes.data?.externalParticipantPhone);
  }
}

runTest().catch(console.error);
