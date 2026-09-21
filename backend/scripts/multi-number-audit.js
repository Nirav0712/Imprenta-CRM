const http = require('http');

function apiGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:4000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('=== 1. WHATSAPP CONVERSATIONS LIST ===');
  const convs = await apiGet('/api/inbox/whatsapp/conversations?connectionId=6aafd38dc1a68c0a6b1d23d2');
  console.log(JSON.stringify(convs, null, 2));

  console.log('=== 2. CONTACTS AUDIT ===');
  const contacts = await apiGet('/api/inbox/whatsapp/contacts?search=');
  console.log(JSON.stringify(contacts, null, 2));
}

run().catch(console.error);
