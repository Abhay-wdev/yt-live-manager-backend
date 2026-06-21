import mongoose, { Document, Schema } from 'mongoose';

export interface ISnakeRecording extends Document {
  filename: string;
  filepath: string;
  resolution: string;
  fps: number;
  duration: number; // in seconds
  fileSize: number; // in bytes
  finalScore: number;
  status: 'generating' | 'completed' | 'failed';
  createdAt: Date;
}

const snakeRecordingSchema = new Schema<ISnakeRecording>({
  filename: { type: String, required: true },
  filepath: { type: String, required: true },
  resolution: { type: String, required: true },
  fps: { type: Number, required: true },
  duration: { type: Number, default: 0 },
  fileSize: { type: Number, default: 0 },
  finalScore: { type: Number, default: 0 },
  status: { type: String, enum: ['generating', 'completed', 'failed'], default: 'generating' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<ISnakeRecording>('SnakeRecording', snakeRecordingSchema);
