import mongoose from 'mongoose';

const youtubeAccountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  channelId: { type: String }, // Optional, for display
  streamKey: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Inactive', 'Error'], default: 'Active' },
}, { timestamps: true });

export const YoutubeAccount = mongoose.model('YoutubeAccount', youtubeAccountSchema);
