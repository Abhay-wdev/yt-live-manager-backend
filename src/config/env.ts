import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb+srv://youtube:jHT5GyzarJZR7bvk@abhay-projects-db.nlkei61.mongodb.net/myFirstDatabase?retryWrites=true&w=majority',
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_change_me',
  defaultStreamKey: process.env.YOUTUBE_STREAM_KEY || '',
};
