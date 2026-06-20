require('dotenv').config();
const mongoose = require('mongoose');
// no user require
// I should just use the native bcryptjs to compare the hash against what's in DB.
const bcrypt = require('bcryptjs');

const uri = 'mongodb://youtube:jHT5GyzarJZR7bvk@ac-lhqhnie-shard-00-00.nlkei61.mongodb.net:27017,ac-lhqhnie-shard-00-01.nlkei61.mongodb.net:27017,ac-lhqhnie-shard-00-02.nlkei61.mongodb.net:27017/yt-live-manager?ssl=true&replicaSet=atlas-7aru9n-shard-0&authSource=admin&retryWrites=true&w=majority';

async function testLogin() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to DB');
    
    const db = mongoose.connection.db;
    const user = await db.collection('users').findOne({ email: 'admin@example.com' });
    
    if (!user) {
      console.log('User not found!');
    } else {
      console.log('User found:', user.email);
      const isMatch = await bcrypt.compare('password123', user.password);
      console.log('Password match with password123:', isMatch);
    }

    // Try finding all users to see if there are duplicates or weird emails
    const allUsers = await db.collection('users').find({}).toArray();
    console.log('All users in DB:', allUsers.map(u => u.email));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
testLogin();
