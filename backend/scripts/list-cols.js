const mongoose = require('mongoose');
const fs = require('fs');

async function listCollections() {
  const envContent = fs.readFileSync('.env', 'utf-8');
  let mongoUri = 'mongodb://localhost:27017/marketing_automation';
  envContent.split('\n').forEach(line => {
    if (line.startsWith('MONGODB_URI=')) {
      mongoUri = line.split('MONGODB_URI=')[1].trim();
    }
  });

  await mongoose.connect(mongoUri);
  const cols = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', cols.map(c => c.name));
  for (const c of cols) {
    if (c.name.includes('whatsapp') || c.name.includes('conversation')) {
      const count = await mongoose.connection.db.collection(c.name).countDocuments();
      console.log(`Collection "${c.name}" has ${count} docs`);
      const docs = await mongoose.connection.db.collection(c.name).find({}).limit(10).toArray();
      docs.forEach(d => console.log(`  - [${c.name}] id=${d._id} phone=${d.customerPhoneNumber} name=${d.customerName}`));
    }
  }
  await mongoose.disconnect();
}

listCollections().catch(console.error);
