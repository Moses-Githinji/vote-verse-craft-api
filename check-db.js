require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI found");
    process.exit(1);
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected correctly to server");
    const db = client.db('test'); // Wait, the string is cluster.mongodb.net/?appName... The DB is likely 'test' by default, or maybe 'shulepal'? Let's check which db is used.
    // The collection would be in the default DB if not specified in the URI. Usually mongoose uses the default db. Let's find collections.
    
    // Instead, let's just make an HTTP call to the API to trigger generation!
    
  } finally {
    await client.close();
  }
}
testDB();
