const http = require('http');

function postApi(path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getApi(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:4000${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    }).on('error', reject);
  });
}

async function runSimpleChatTest() {
  console.log('===============================================================');
  console.log('WHATSAPP WEB ARCHITECTURE — SIMPLE CHAT IDENTITY ACCEPTANCE TEST');
  console.log('===============================================================');

  // Step 1: Send to Number A (+919925843531 - Nirav) using exact remoteJid
  console.log('\n--- 1. SENDING SIMPLE_CHAT_TEST_A to Nirav (+919925843531) ---');
  const resA = await postApi('/api/whatsapp/send', {
    connectionId: '6aafd38dc1a68c0a6b1d23d2',
    recipientPhoneNumber: '+919925843531',
    remoteJid: '919925843531@s.whatsapp.net',
    customMessageBody: 'SIMPLE_CHAT_TEST_A',
    messageType: 'text',
  });
  console.log('Response A:', JSON.stringify(resA, null, 2));

  // Step 2: Send to Number B (+919574478188 - Nikhil) using mapped LID remoteJid
  console.log('\n--- 2. SENDING SIMPLE_CHAT_TEST_B to Nikhil (+919574478188) ---');
  const resB = await postApi('/api/whatsapp/send', {
    connectionId: '6aafd38dc1a68c0a6b1d23d2',
    recipientPhoneNumber: '+919574478188',
    remoteJid: '181492634374172@lid',
    customMessageBody: 'SIMPLE_CHAT_TEST_B',
    messageType: 'text',
  });
  console.log('Response B:', JSON.stringify(resB, null, 2));

  // Wait 3 seconds for Baileys server ACKs and receipts
  await new Promise(r => setTimeout(r, 3000));

  // Step 3: Fetch Conversations
  console.log('\n--- 3. LIVE CONVERSATIONS LIST ---');
  const convs = await getApi('/api/inbox/whatsapp/conversations?connectionId=6aafd38dc1a68c0a6b1d23d2');
  console.log('Conversations:', JSON.stringify(convs.data, null, 2));

  // Step 4: Reply to Conversation A using the Inbox Reply API
  if (convs.data && convs.data.length > 0) {
    const convA = convs.data.find(c => (c.remoteJid && c.remoteJid.includes('9925843531')) || (c.customerPhoneNumber && c.customerPhoneNumber.includes('9925843531')));
    const convB = convs.data.find(c => (c.remoteJid && c.remoteJid.includes('181492634374172')) || (c.customerPhoneNumber && c.customerPhoneNumber.includes('9574478188')));

    if (convA) {
      console.log(`\n--- 4. REPLYING TO CONVERSATION A (${convA._id}) ---`);
      const replyA = await postApi(`/api/inbox/whatsapp/conversations/${convA._id}/reply`, {
        messageBody: 'AutoMarket Reply to Nirav: SIMPLE_CHAT_TEST_A confirmed on exact remoteJid thread.',
        messageType: 'text',
      });
      console.log('Reply A Output:', JSON.stringify(replyA, null, 2));
    }

    if (convB) {
      console.log(`\n--- 5. REPLYING TO CONVERSATION B (${convB._id}) ---`);
      const replyB = await postApi(`/api/inbox/whatsapp/conversations/${convB._id}/reply`, {
        messageBody: 'AutoMarket Reply to Nikhil: SIMPLE_CHAT_TEST_B confirmed on exact remoteJid thread.',
        messageType: 'text',
      });
      console.log('Reply B Output:', JSON.stringify(replyB, null, 2));
    }

    await new Promise(r => setTimeout(r, 3000));

    console.log('\n--- 6. VERIFYING MESSAGES IN EACH CHAT ---');
    for (const c of convs.data) {
      console.log(`\nChat: ${c.customerName} | Phone: ${c.customerPhoneNumber} | remoteJid: ${c.remoteJid} | ID: ${c._id}`);
      const msgs = await getApi(`/api/inbox/whatsapp/conversations/${c._id}/messages`);
      console.log(JSON.stringify(msgs.data, null, 2));
    }
  }
}

runSimpleChatTest().catch(console.error);
