const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const uri = 'mongodb://youtube:jHT5GyzarJZR7bvk@ac-lhqhnie-shard-00-00.nlkei61.mongodb.net:27017,ac-lhqhnie-shard-00-01.nlkei61.mongodb.net:27017,ac-lhqhnie-shard-00-02.nlkei61.mongodb.net:27017/yt-live-manager?ssl=true&replicaSet=atlas-7aru9n-shard-0&authSource=admin&retryWrites=true&w=majority';

async function resetPassword() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB Atlas...');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    const admin = await usersCollection.findOne({ email: 'admin@example.com' });
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    if (!admin) {
      console.log('Admin user does not exist. Creating one...');
      await usersCollection.insertOne({
        name: 'Admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Admin user created successfully!');
    } else {
      console.log('Admin user found. Resetting password...');
      await usersCollection.updateOne(
        { email: 'admin@example.com' },
        { $set: { password: hashedPassword, updatedAt: new Date() } }
      );
      console.log('Password reset to: password123');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

resetPassword();
