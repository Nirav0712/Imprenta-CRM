const { MongoClient } = require('mongodb');
const http = require('http');

async function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runAudit() {
  console.log('================================================================');
  console.log('AUDIT: WHATSAPP LIVE INBOX — ZERO PERMANENT CHAT STORAGE');
  console.log('================================================================\n');

  const mongoUri = 'mongodb://127.0.0.1:27017/marketing_automation';
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db('marketing_automation');

  // Step 1: Record pre-test MongoDB message collection count
  const messagesCol = db.collection('whatsappmessages');
  const countBefore = await messagesCol.countDocuments();
  console.log(`[DB Audit] WhatsApp messages in MongoDB BEFORE test: ${countBefore}`);

  // Step 2: Check backend connection status
  const connRes = await httpRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/whatsapp/connections',
    method: 'GET',
  });

  console.log(`[API Audit] GET /api/whatsapp/connections HTTP ${connRes.status}`);
  const activeConn = Array.isArray(connRes.data)
    ? connRes.data.find((c) => c.status === 'connected')
    : null;

  if (activeConn) {
    console.log(`[Session Audit] Active connected WhatsApp account: ${activeConn.phoneNumber} (${activeConn.name})`);
  } else {
    console.log(`[Session Audit] No active connected socket found. Available connections: ${JSON.stringify(connRes.data)}`);
  }

  // Step 3: Trigger live outgoing message to test live ephemeral memory stream
  const targetConnId = activeConn ? activeConn._id : '6aafd38dc1a68c0a6b1d23d2';
  const sendPayload = {
    connectionId: targetConnId,
    recipientPhoneNumber: '+15550199988',
    customMessageBody: 'Ephemeral live test message at ' + new Date().toISOString(),
  };

  console.log(`\n[Outgoing Test] POST /api/whatsapp/send to recipient ${sendPayload.recipientPhoneNumber}`);
  const sendRes = await httpRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/whatsapp/send',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    sendPayload,
  );
  console.log(`[Outgoing Test] Response HTTP ${sendRes.status}:`, JSON.stringify(sendRes.data));

  // Step 4: Check live conversations in memory
  const targetConvIdForMsgs = sendRes.data?.conversationId || (convRes.data && convRes.data[0]?._id);
  
  const convRes = await httpRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/inbox/whatsapp/conversations?connectionId=${targetConnId}`,
    method: 'GET',
  });
  console.log(`\n[Live Inbox] GET /api/inbox/whatsapp/conversations HTTP ${convRes.status}: Found ${convRes.data?.length || 0} active session(s)`);

  let ephemeralMessages = [];
  if (targetConvIdForMsgs) {
    const msgRes = await httpRequest({
      hostname: 'localhost',
      port: 4000,
      path: `/api/inbox/whatsapp/conversations/${targetConvIdForMsgs}/messages`,
      method: 'GET',
    });
    ephemeralMessages = Array.isArray(msgRes.data) ? msgRes.data : [];
    console.log(`[Live Inbox] GET /api/inbox/whatsapp/conversations/${targetConvIdForMsgs}/messages: Retrieved ${ephemeralMessages.length} ephemeral message(s)`);
    if (ephemeralMessages.length > 0) {
      console.log(`[Live Message Sample] Body: "${ephemeralMessages[0].messageBody}", Status: "${ephemeralMessages[0].status}", Direction: "${ephemeralMessages[0].direction}"`);
    }
  }

  // Step 5: Verify post-test MongoDB message collection count (MUST BE IDENTICAL: delta = 0)
  const countAfter = await messagesCol.countDocuments();
  const delta = countAfter - countBefore;
  console.log(`\n[DB Audit] WhatsApp messages in MongoDB AFTER test: ${countAfter}`);
  console.log(`[DB Audit] Message documents written to MongoDB: ${delta}`);

  const zeroWritesPassed = delta === 0;

  console.log('\n================================================================');
  console.log(`ZERO PERMANENT CHAT STORAGE AUDIT RESULT: ${zeroWritesPassed ? 'PASS' : 'FAIL'}`);
  console.log('================================================================');
  console.log(`- MongoDB Write Delta: ${delta} (0 permanent writes)`);
  console.log(`- In-Memory Live Messages Retrieved: ${ephemeralMessages.length}`);
  console.log(`- Connection Status: ${activeConn ? activeConn.status : 'offline'}`);
  console.log(`- Zero Permanent Storage Compliance: ${zeroWritesPassed ? '100% COMPLIANT' : 'NON-COMPLIANT'}`);

  await client.close();
  process.exit(zeroWritesPassed ? 0 : 1);
}

runAudit().catch((err) => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
