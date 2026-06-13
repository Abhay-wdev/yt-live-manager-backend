const mongoose = require('mongoose');

const uri = "mongodb://youtube:jHT5GyzarJZR7bvk@ac-lhqhnie-shard-00-00.nlkei61.mongodb.net:27017,ac-lhqhnie-shard-00-01.nlkei61.mongodb.net:27017,ac-lhqhnie-shard-00-02.nlkei61.mongodb.net:27017/yt-live-manager?ssl=true&replicaSet=atlas-7aru9n-shard-0&authSource=admin&retryWrites=true&w=majority";

async function check() {
  await mongoose.connect(uri);
  
  const StreamLog = mongoose.model('StreamLog', new mongoose.Schema({
    streamInstanceId: mongoose.Schema.Types.ObjectId,
    type: String,
    message: String,
    timestamp: Date
  }));

  const logs = await StreamLog.find().sort({ timestamp: -1 }).limit(10);
  console.log("LAST 10 LOGS:");
  logs.forEach(l => console.log(`[${l.type}] ${l.message}`));

  process.exit(0);
}

check().catch(console.error);
