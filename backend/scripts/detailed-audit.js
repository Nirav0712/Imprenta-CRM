const mongoose = require('mongoose');
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

async function inspectAll() {
  require('dotenv').config();
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/automarket';
  await mongoose.connect(uri);

  console.log('====================================================');
  console.log('1. ALL MONGODB WHATSAPP CONVERSATIONS');
  console.log('====================================================');
  const dbConvs = await mongoose.connection.db.collection('whatsapp_conversations').find({}).toArray();
  for (const c of dbConvs) {
    console.log({
      _id: c._id.toString(),
      connectionId: c.connectionId?.toString(),
      remoteJid: c.remoteJid,
      customerPhoneNumber: c.customerPhoneNumber,
      customerName: c.customerName,
      lastMessageText: c.lastMessageText,
      contactId: c.contactId?.toString(),
      updatedAt: c.updatedAt,
    });
  }

  console.log('\n====================================================');
  console.log('2. ALL MONGODB CONTACTS MATCHING TEST NUMBERS');
  console.log('====================================================');
  const contacts = await mongoose.connection.db.collection('contacts').find({}).toArray();
  for (const ct of contacts) {
    if (ct.phone || ct.firstName || ct.lastName) {
      console.log({
        _id: ct._id.toString(),
        name: `${ct.firstName || ''} ${ct.lastName || ''}`.trim(),
        phone: ct.phone,
        company: ct.company,
      });
    }
  }

  console.log('\n====================================================');
  console.log('3. API GET /api/inbox/whatsapp/conversations');
  console.log('====================================================');
  const apiConvs = await apiGet('/api/inbox/whatsapp/conversations?connectionId=6aafd38dc1a68c0a6b1d23d2');
  console.log(JSON.stringify(apiConvs, null, 2));

  for (const ac of (Array.isArray(apiConvs) ? apiConvs : [])) {
    console.log(`\n--- Messages for Conv ${ac._id} (${ac.customerName} - ${ac.customerPhoneNumber}) ---`);
    const msgs = await apiGet(`/api/inbox/whatsapp/conversations/${ac._id}/messages`);
    console.log(JSON.stringify(msgs, null, 2));
  }

  await mongoose.disconnect();
}

inspectAll().catch(console.error);
