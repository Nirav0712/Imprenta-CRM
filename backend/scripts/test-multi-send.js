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

async function runMultiNumberTest() {
  console.log('=====================================================');
  console.log('MULTI-NUMBER OUTBOUND & CONVERSATION TEST');
  console.log('=====================================================');

  // Test A: Outbound to Nirav (+919925843531)
  console.log('\n--- 1. SENDING TEST A: +919925843531 (Nirav) ---');
  const resA = await postApi('/api/whatsapp/send', {
    connectionId: '6aafd38dc1a68c0a6b1d23d2',
    recipientPhoneNumber: '+919925843531',
    customMessageBody: 'MULTI_NUMBER_TEST_A_001',
    messageType: 'text',
  });
  console.log('Outbound A Response:', JSON.stringify(resA, null, 2));

  // Test B: Outbound to Nikhil (+919574478188)
  console.log('\n--- 2. SENDING TEST B: +919574478188 (Nikhil) ---');
  const resB = await postApi('/api/whatsapp/send', {
    connectionId: '6aafd38dc1a68c0a6b1d23d2',
    recipientPhoneNumber: '+919574478188',
    customMessageBody: 'MULTI_NUMBER_TEST_B_001',
    messageType: 'text',
  });
  console.log('Outbound B Response:', JSON.stringify(resB, null, 2));

  // Wait 3 seconds for event loops and message acknowledgements
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n--- 3. CHECKING LIVE CONVERSATIONS ---');
  const convs = await getApi('/api/inbox/whatsapp/conversations?connectionId=6aafd38dc1a68c0a6b1d23d2');
  console.log('Conversations:', JSON.stringify(convs.data, null, 2));

  for (const c of convs.data) {
    console.log(`\nMessages for Conversation ${c._id} (${c.customerName} - ${c.customerPhoneNumber}):`);
    const msgs = await getApi(`/api/inbox/whatsapp/conversations/${c._id}/messages`);
    console.log(JSON.stringify(msgs.data, null, 2));
  }
}

runMultiNumberTest().catch(console.error);
