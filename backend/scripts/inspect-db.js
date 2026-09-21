const mongoose = require('mongoose');

async function checkDb() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketing_automation';
  // Read from .env if available
  const fs = require('fs');
  const envContent = fs.readFileSync('.env', 'utf-8');
  let mongoUri = 'mongodb://localhost:27017/marketing_automation';
  envContent.split('\n').forEach(line => {
    if (line.startsWith('MONGODB_URI=')) {
      mongoUri = line.split('MONGODB_URI=')[1].trim();
    }
  });

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const convs = await mongoose.connection.db.collection('whatsappconversations').find({}).toArray();
  console.log('Found', convs.length, 'conversations in DB:');
  convs.forEach(c => {
    console.log(`- ID=${c._id} Phone=${c.customerPhoneNumber} Name="${c.customerName}" LastMsg="${c.lastMessageText}"`);
  });

  const contacts = await mongoose.connection.db.collection('contacts').find({}).toArray();
  console.log('\nFound', contacts.length, 'contacts in DB:');
  contacts.forEach(c => {
    console.log(`- ID=${c._id} Phone=${c.phoneNumber} Name="${c.fullName}"`);
  });

  await mongoose.disconnect();
}

checkDb().catch(console.error);
