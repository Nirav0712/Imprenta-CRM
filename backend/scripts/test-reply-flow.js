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

async function testReplies() {
  console.log('--- 1. Replying to Nirav (ID: 6aaff1db65de0e6409e43460, Phone: +919925843531) ---');
  const replyA = await postApi('/api/inbox/whatsapp/conversations/6aaff1db65de0e6409e43460/reply', {
    messageBody: 'MULTI_NUMBER_TEST_A_001',
    messageType: 'text',
  });
  console.log('Reply A Result:', JSON.stringify(replyA, null, 2));

  console.log('\n--- 2. Replying to Nikhil (ID: 6ab030d134b065f41a814b51, Phone: +919574478188) ---');
  const replyB = await postApi('/api/inbox/whatsapp/conversations/6ab030d134b065f41a814b51/reply', {
    messageBody: 'MULTI_NUMBER_TEST_B_001',
    messageType: 'text',
  });
  console.log('Reply B Result:', JSON.stringify(replyB, null, 2));

  // Wait 3 seconds for Baileys events and status receipt
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n--- 3. Checking Conversations After Replies ---');
  const convs = await getApi('/api/inbox/whatsapp/conversations?connectionId=6aafd38dc1a68c0a6b1d23d2');
  console.log('Conversations:', JSON.stringify(convs.data, null, 2));

  for (const c of convs.data) {
    console.log(`\nMessages for Conversation ${c._id} (${c.customerName} - ${c.customerPhoneNumber}):`);
    const msgs = await getApi(`/api/inbox/whatsapp/conversations/${c._id}/messages`);
    console.log(JSON.stringify(msgs.data, null, 2));
  }
}

testReplies().catch(console.error);
