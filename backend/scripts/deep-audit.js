const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
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

async function audit() {
  const envContent = fs.readFileSync('.env', 'utf-8');
  let mongoUri = 'mongodb://localhost:27017/marketing_automation';
  envContent.split('\n').forEach(line => {
    if (line.startsWith('MONGODB_URI=')) {
      mongoUri = line.split('MONGODB_URI=')[1].trim();
    }
  });

  await mongoose.connect(mongoUri);

  console.log('=== 1. CONTACTS IN DB ===');
  const contacts = await mongoose.connection.db.collection('contacts').find({
    $or: [
      { fullName: { $regex: /nikhil|nirav/i } },
      { phoneNumber: { $regex: /9925843531|7069754589/ } }
    ]
  }).toArray();
  console.log(JSON.stringify(contacts, null, 2));

  console.log('\n=== 2. WHATSAPP CONVERSATIONS IN DB ===');
  const convs = await mongoose.connection.db.collection('whatsapp_conversations').find({}).toArray();
  console.log(JSON.stringify(convs, null, 2));

  console.log('\n=== 3. LIVE CONVERSATIONS IN INBOX API ===');
  const apiConvs = await getJson('/api/inbox/whatsapp/conversations?connectionId=6aafd38dc1a68c0a6b1d23d2');
  console.log(JSON.stringify(apiConvs.data, null, 2));

  if (apiConvs.data && Array.isArray(apiConvs.data)) {
    for (const c of apiConvs.data) {
      console.log(`\n=== 4. MESSAGES FOR CONVERSATION ${c._id} (${c.customerName || c.customerPhoneNumber}) ===`);
      const msgs = await getJson(`/api/inbox/whatsapp/conversations/${c._id}/messages`);
      if (msgs.data && Array.isArray(msgs.data)) {
        msgs.data.forEach(m => {
          console.log(`  - [Msg ${m._id}] dir=${m.direction} status=${m.status} sender=${m.senderPhoneNumber} recipient=${m.recipientPhoneNumber} ext=${m.externalParticipantPhone} body="${m.messageBody}" decryptStatus=${m.decryptionStatus} providerId=${m.providerMessageId}`);
        });
      }
    }
  }

  console.log('\n=== 5. LID MAP FILE ===');
  const lidMapPath = path.join(process.cwd(), 'data', 'wa_sessions', '6aafd38dc1a68c0a6b1d23d2', 'lid_map.json');
  if (fs.existsSync(lidMapPath)) {
    console.log(fs.readFileSync(lidMapPath, 'utf-8'));
  } else {
    console.log('No lid_map.json found');
  }

  await mongoose.disconnect();
}

audit().catch(console.error);
