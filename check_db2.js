const mongoose = require('mongoose');

const uri = "mongodb://youtube:jHT5GyzarJZR7bvk@ac-lhqhnie-shard-00-00.nlkei61.mongodb.net:27017,ac-lhqhnie-shard-00-01.nlkei61.mongodb.net:27017,ac-lhqhnie-shard-00-02.nlkei61.mongodb.net:27017/yt-live-manager?ssl=true&replicaSet=atlas-7aru9n-shard-0&authSource=admin&retryWrites=true&w=majority";

async function check() {
  await mongoose.connect(uri);
  
  const StreamInstance = mongoose.model('StreamInstance', new mongoose.Schema({
    name: String,
    youtubeAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'YoutubeAccount' },
    playlistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Playlist' }
  }));

  const YoutubeAccount = mongoose.model('YoutubeAccount', new mongoose.Schema({
    name: String,
    streamKey: String
  }));

  const PlaylistItem = mongoose.model('PlaylistItem', new mongoose.Schema({
    playlistId: mongoose.Schema.Types.ObjectId,
    videoId: mongoose.Schema.Types.ObjectId
  }));

  const Video = mongoose.model('Video', new mongoose.Schema({
    title: String,
    sourceType: String,
    path: String
  }));

  const instances = await StreamInstance.find().populate('youtubeAccountId');
  console.log("--- STREAM INSTANCES ---");
  for (const inst of instances) {
    console.log(`\nInstance: ${inst.name} (ID: ${inst._id})`);
    if (inst.youtubeAccountId) {
      console.log(`YouTube Account: ${inst.youtubeAccountId.name} | StreamKey: ${inst.youtubeAccountId.streamKey ? 'SET' : 'MISSING'}`);
    } else {
      console.log(`YouTube Account: MISSING`);
    }

    const items = await PlaylistItem.find({ playlistId: inst.playlistId });
    console.log(`Playlist Items count: ${items.length}`);
    if (items.length > 0) {
       for (const item of items) {
           const vid = await Video.findById(item.videoId);
           console.log(` - Video: ${vid?.title} | Type: ${vid?.sourceType} | Path: ${vid?.path}`);
       }
    }
  }

  process.exit(0);
}

check().catch(console.error);
