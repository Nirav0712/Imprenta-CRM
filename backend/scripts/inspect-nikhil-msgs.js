const http = require('http');

function getJson(urlPath) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
      path: urlPath,
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
    req.on('error', (e) => resolve({ error: e.message }));
    req.end();
  });
}

async function inspectNikhil() {
  const convs = await getJson('/api/inbox/whatsapp/conversations?connectionId=6aafd38dc1a68c0a6b1d23d2');
  console.log('All Conversations in Inbox:');
  for (const c of convs.data) {
    console.log(`- Conv ${c._id}: Name="${c.customerName}" Phone="${c.customerPhoneNumber}" LastMsg="${c.lastMessageText}"`);
    const msgs = await getJson(`/api/inbox/whatsapp/conversations/${c._id}/messages`);
    if (msgs.data && Array.isArray(msgs.data)) {
      msgs.data.forEach(m => {
        console.log(`   * Msg id=${m._id} dir=${m.direction} body="${m.messageBody}" decryptStatus=${m.decryptionStatus} providerId=${m.providerMessageId} sender=${m.senderPhoneNumber}`);
      });
    }
  }
}

inspectNikhil().catch(console.error);
