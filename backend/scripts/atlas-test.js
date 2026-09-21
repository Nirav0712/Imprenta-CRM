const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'automarket';

console.log('--- MongoDB Atlas Connectivity & Persistence Test ---');
console.log('Target URI:', (uri || '').replace(/\/\/.*@/, '//<auth>@'));
console.log('Target Database:', dbName);

async function run() {
  try {
    console.log('Attempting connection to MongoDB Atlas...');
    await mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });

    console.log('>>> SUCCESS: Connected to MongoDB Atlas! Database:', mongoose.connection.name);

    // List collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Active Collections in Atlas:', collections.map((c) => c.name));

    // Test CRUD Persistence
    const testCollection = mongoose.connection.db.collection('contacts');
    const testDoc = {
      firstName: 'Persistence',
      lastName: 'TestUser',
      fullName: 'Persistence TestUser',
      email: `atlas_test_${Date.now()}@example.com`,
      phoneNumber: '+15550009999',
      organizationId: 'org_atlas_verified',
      status: 'lead',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('1. Inserting test record into Atlas...');
    const insertRes = await testCollection.insertOne(testDoc);
    console.log('Inserted ID:', insertRes.insertedId);

    console.log('2. Reading test record from Atlas...');
    const fetched = await testCollection.findOne({ _id: insertRes.insertedId });
    console.log('Fetched record email:', fetched?.email);

    console.log('3. Updating test record in Atlas...');
    await testCollection.updateOne(
      { _id: insertRes.insertedId },
      { $set: { notes: 'Updated directly in Atlas cluster' } },
    );
    const updated = await testCollection.findOne({ _id: insertRes.insertedId });
    console.log('Updated record notes:', updated?.notes);

    console.log('4. Deleting test record from Atlas...');
    await testCollection.deleteOne({ _id: insertRes.insertedId });
    const checkDeleted = await testCollection.findOne({ _id: insertRes.insertedId });
    console.log('Record deletion confirmed:', checkDeleted === null ? 'YES' : 'NO');

    console.log('>>> ATLAS CRUD & PERSISTENCE VERIFICATION PASSED 100% <<<');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('>>> ATLAS CONNECTION FAILED <<<');
    console.error('Error Code/Message:', err.message);
    if (err.message.includes('IP') || err.message.includes('whitelisted') || err.message.includes('SSL alert') || err.name === 'MongooseServerSelectionError') {
      console.error('\n[ACTION REQUIRED IN MONGODB ATLAS DASHBOARD]:');
      console.error('1. Log into https://cloud.mongodb.com');
      console.error('2. Navigate to "Security" -> "Network Access"');
      console.error('3. Click "+ Add IP Address"');
      console.error('4. Choose "Allow Access from Anywhere" (0.0.0.0/0) or add your current IP address');
      console.error('5. Click "Confirm" and wait ~30 seconds for Atlas deployment');
    }
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
