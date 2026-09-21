const mongoose = require('mongoose');
const fs = require('fs');

async function cleanConversations() {
  const envContent = fs.readFileSync('.env', 'utf-8');
  let mongoUri = 'mongodb://localhost:27017/marketing_automation';
  envContent.split('\n').forEach(line => {
    if (line.startsWith('MONGODB_URI=')) {
      mongoUri = line.split('MONGODB_URI=')[1].trim();
    }
  });

  await mongoose.connect(mongoUri);
  const col = mongoose.connection.db.collection('whatsapp_conversations');

  // 1. Remove corrupt LID conversation (+62551954038810)
  const delLid = await col.deleteMany({ customerPhoneNumber: { $regex: /62551954038810/ } });
  console.log(`Deleted ${delLid.deletedCount} LID conversation(s) from MongoDB`);

  // 2. Remove corrupt un-prefixed number (+9925843531)
  const delCorrupt = await col.deleteMany({ customerPhoneNumber: '+9925843531' });
  console.log(`Deleted ${delCorrupt.deletedCount} corrupt +9925843531 conversation(s) from MongoDB`);

  // 3. Remove self-chat conversation (+917069754589)
  const delSelf = await col.deleteMany({ customerPhoneNumber: '+917069754589' });
  console.log(`Deleted ${delSelf.deletedCount} self-chat conversation(s) from MongoDB`);

  // 4. Ensure canonical +919925843531 conversation exists with name "Nirav"
  const canonicalConv = await col.findOne({ customerPhoneNumber: '+919925843531' });
  if (canonicalConv) {
    await col.updateOne(
      { _id: canonicalConv._id },
      { $set: { customerName: 'Nirav', unreadCount: 0 } }
    );
    console.log(`Updated canonical conversation ${canonicalConv._id} for +919925843531`);
  }

  const remaining = await col.find({}).toArray();
  console.log('\nRemaining conversations in MongoDB:');
  remaining.forEach(c => {
    console.log(`- ID=${c._id} Phone=${c.customerPhoneNumber} Name="${c.customerName}"`);
  });

  await mongoose.disconnect();
}

cleanConversations().catch(console.error);
