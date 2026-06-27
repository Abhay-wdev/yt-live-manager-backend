import mongoose, { Document, Schema } from 'mongoose';

export interface IImageStreamConfig extends Document {
  streamId: string;
  youtubeAccountId: mongoose.Types.ObjectId;
  imageId: mongoose.Types.ObjectId;
  resolution: string;
  fps: number;
  status: 'Live' | 'Stopped' | 'Restarting' | 'Failed';
  
  // Scheduling
  isScheduled: boolean;
  scheduleType?: 'One-Time' | 'Recurring';
  
  // One-Time schedule
  startTime?: Date;
  stopTime?: Date;
  
  // Recurring schedule (Daily time HH:MM)
  dailyStartTime?: string;
  dailyStopTime?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const ImageStreamConfigSchema: Schema = new Schema(
  {
    streamId: { type: String, required: true, unique: true },
    youtubeAccountId: { type: Schema.Types.ObjectId, ref: 'YoutubeAccount', required: true },
    imageId: { type: Schema.Types.ObjectId, ref: 'ImageAsset', required: true },
    resolution: { type: String, required: true, default: '1080p' },
    fps: { type: Number, required: true, default: 30 },
    status: { type: String, required: true, enum: ['Live', 'Stopped', 'Restarting', 'Failed'], default: 'Stopped' },
    
    isScheduled: { type: Boolean, default: false },
    scheduleType: { type: String, enum: ['One-Time', 'Recurring'] },
    
    startTime: { type: Date },
    stopTime: { type: Date },
    
    dailyStartTime: { type: String }, // e.g. "14:30"
    dailyStopTime: { type: String },  // e.g. "18:00"
  },
  { timestamps: true }
);

// Create compound index for streamId which is youtubeAccountId_imageId
ImageStreamConfigSchema.index({ youtubeAccountId: 1, imageId: 1 }, { unique: true });

export default mongoose.model<IImageStreamConfig>('ImageStreamConfig', ImageStreamConfigSchema);
