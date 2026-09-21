const mongoose = require('mongoose');

async function auditDB() {
  await mongoose.connect('mongodb://127.0.0.1:27017/marketing_automation');

  console.log('--- CONTACTS ---');
  const contacts = await mongoose.connection.db.collection('contacts').find({}).toArray();
  for (const c of contacts) {
    console.log({
      id: c._id.toString(),
      firstName: c.firstName,
      lastName: c.lastName,
      fullName: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
      phone: c.phone,
      source: c.source,
      tags: c.tags,
    });
  }

  console.log('\n--- WHATSAPP CONVERSATIONS (DB) ---');
  const convs = await mongoose.connection.db.collection('whatsapp_conversations').find({}).toArray();
  for (const cv of convs) {
    console.log({
      id: cv._id.toString(),
      connectionId: cv.connectionId?.toString(),
      contactId: cv.contactId?.toString(),
      customerPhoneNumber: cv.customerPhoneNumber,
      customerName: cv.customerName,
      lastMessageText: cv.lastMessageText,
    });
  }

  await mongoose.disconnect();
}

auditDB().catch(console.error);
