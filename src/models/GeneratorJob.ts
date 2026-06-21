import mongoose, { Document, Schema } from 'mongoose';

export interface IGeneratorJob extends Document {
  targetCount: number;
  completedCount: number;
  failedCount: number;
  isInfinite: boolean;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled';
  scheduledFor: Date | null;
  createdAt: Date;
}

const generatorJobSchema = new Schema<IGeneratorJob>({
  targetCount: { type: Number, required: true },
  completedCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  isInfinite: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'running', 'paused', 'completed', 'cancelled'], default: 'pending' },
  scheduledFor: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IGeneratorJob>('GeneratorJob', generatorJobSchema);
