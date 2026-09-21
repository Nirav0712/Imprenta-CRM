const mongoose = require('mongoose');
const fs = require('fs');

async function checkConvs() {
  const envContent = fs.readFileSync('.env', 'utf-8');
  let mongoUri = 'mongodb://localhost:27017/marketing_automation';
  envContent.split('\n').forEach(line => {
    if (line.startsWith('MONGODB_URI=')) {
      mongoUri = line.split('MONGODB_URI=')[1].trim();
    }
  });

  await mongoose.connect(mongoUri);
  const convs = await mongoose.connection.db.collection('whatsappconversations').find({}).toArray();
  console.log('=== CONVERSATIONS IN DB ===');
  convs.forEach(c => {
    console.log(JSON.stringify(c, null, 2));
  });
  await mongoose.disconnect();
}

checkConvs().catch(console.error);
