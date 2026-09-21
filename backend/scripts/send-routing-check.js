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

async function sendTest2() {
  console.log('Sending ROUTING_CHECK_002 to +919925843531...');
  const res = await postJson('/api/whatsapp/send', {
    connectionId: '6aafd38dc1a68c0a6b1d23d2',
    recipientPhoneNumber: '+919925843531',
    customMessageBody: 'ROUTING_CHECK_002'
  });
  console.log('Send Status:', res.status);
  console.log('Send Response:', JSON.stringify(res.data, null, 2));
}

sendTest2().catch(console.error);
