import mongoose from 'mongoose';

const playlistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
}, { timestamps: true });

export const Playlist = mongoose.model('Playlist', playlistSchema);

const playlistItemSchema = new mongoose.Schema({
  playlistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Playlist', required: true },
  videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
  order: { type: Number, required: true },
});

export const PlaylistItem = mongoose.model('PlaylistItem', playlistItemSchema);
