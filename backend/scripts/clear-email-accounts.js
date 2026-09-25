const mongoose = require('mongoose');

const uri = 'mongodb+srv://thedigitalconnect712_db_user:sz2Zzgx7dapAnzf3@cluster0.mmzncze.mongodb.net/automarket?retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(uri);
  const accRes = await mongoose.connection.collection('email_accounts').deleteMany({});
  console.log(`Deleted ${accRes.deletedCount} email accounts.`);
  
  const convRes = await mongoose.connection.collection('email_conversations').deleteMany({});
  console.log(`Deleted ${convRes.deletedCount} email conversations.`);

  const msgRes = await mongoose.connection.collection('email_messages').deleteMany({});
  console.log(`Deleted ${msgRes.deletedCount} email messages.`);

  await mongoose.disconnect();
}

run().catch(console.error);
