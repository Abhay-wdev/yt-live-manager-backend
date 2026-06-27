import mongoose from 'mongoose';

const imageAssetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  path: { type: String, required: true },
  url: { type: String, required: true },
}, { timestamps: true });

export const ImageAsset = mongoose.model('ImageAsset', imageAssetSchema);
