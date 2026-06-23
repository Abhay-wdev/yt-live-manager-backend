import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  filename: { type: String }, // For local
  path: { type: String, required: true }, // Local path or Google Drive link
  duration: { type: Number, default: 0 },
  size: { type: Number, default: 0 },
  sourceType: { type: String, enum: ['local', 'google-drive'], required: true },
  width: { type: Number },
  height: { type: Number },
  aspectRatio: { type: String },
  detectedFormat: { type: String, enum: ['Shorts', 'Full Video'], default: 'Full Video' }
}, { timestamps: true });

export const Video = mongoose.model('Video', videoSchema);
