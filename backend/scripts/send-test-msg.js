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

async function sendOutbound() {
  console.log('Sending message to +919925843531...');
  const res = await postJson('/api/whatsapp/send', {
    connectionId: '6aafd38dc1a68c0a6b1d23d2',
    recipientPhoneNumber: '+919925843531',
    customMessageBody: 'INBOUND_REPLY_ROUTING_TEST_001'
  });
  console.log('Result:', JSON.stringify(res, null, 2));
}

sendOutbound().catch(console.error);
