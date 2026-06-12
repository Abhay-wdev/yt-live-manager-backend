import mongoose from 'mongoose';
import { config } from './env';

export const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('MongoDB Connected...');
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
};
