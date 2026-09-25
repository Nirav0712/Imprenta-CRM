const mongoose = require('mongoose');

const uri = 'mongodb+srv://thedigitalconnect712_db_user:sz2Zzgx7dapAnzf3@cluster0.mmzncze.mongodb.net/automarket?retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(uri);
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));
  for (const c of collections) {
    if (c.name.toLowerCase().includes('email') || c.name.toLowerCase().includes('account')) {
      const count = await mongoose.connection.collection(c.name).countDocuments();
      console.log(`Collection ${c.name}: ${count} documents`);
      const docs = await mongoose.connection.collection(c.name).find({}).toArray();
      console.log(`Docs in ${c.name}:`, docs.map(d => ({ id: d._id, email: d.emailAddress || d.email, name: d.name })));
    }
  }
  await mongoose.disconnect();
}

run().catch(console.error);
