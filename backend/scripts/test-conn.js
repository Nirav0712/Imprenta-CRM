const http = require('http');

function postApi(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    req.end();
  });
}

async function testConn() {
  const res = await postApi('/api/whatsapp/connections/6aafd38dc1a68c0a6b1d23d2/test');
  console.log('Connection Test Response:', JSON.stringify(res, null, 2));
}

testConn().catch(console.error);
