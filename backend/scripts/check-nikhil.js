const mongoose = require('mongoose');
const fs = require('fs');

async function checkNikhil() {
  const envContent = fs.readFileSync('.env', 'utf-8');
  let mongoUri = 'mongodb://localhost:27017/marketing_automation';
  envContent.split('\n').forEach(line => {
    if (line.startsWith('MONGODB_URI=')) {
      mongoUri = line.split('MONGODB_URI=')[1].trim();
    }
  });

  await mongoose.connect(mongoUri);

  console.log('=== CONTACTS MATCHING NIKHIL / NIRAV ===');
  const contacts = await mongoose.connection.db.collection('contacts').find({
    fullName: { $regex: /nikhil|nirav|prajapati/i }
  }).toArray();
  console.log(JSON.stringify(contacts, null, 2));

  console.log('\n=== ALL CONVERSATIONS IN DB ===');
  const convs = await mongoose.connection.db.collection('whatsapp_conversations').find({}).toArray();
  console.log(JSON.stringify(convs, null, 2));

  console.log('\n=== ALL MESSAGES IN DB (IF ANY) ===');
  const msgs = await mongoose.connection.db.collection('whatsapp_messages').find({}).toArray();
  console.log(`Found ${msgs.length} messages in DB`);
  msgs.slice(-10).forEach(m => {
    console.log(`- id=${m._id} dir=${m.direction} sender=${m.senderPhoneNumber} recipient=${m.recipientPhoneNumber} body="${m.messageBody}"`);
  });

  await mongoose.disconnect();
}

checkNikhil().catch(console.error);
