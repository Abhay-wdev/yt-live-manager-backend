import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema({
  streamInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'StreamInstance', required: true },
  startTime: { type: Date },
  endTime: { type: Date },
  timezone: { type: String, default: 'UTC' },
  scheduleType: { type: String, enum: ['one-time', 'daily', 'weekly', 'monthly'], default: 'one-time' },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

export const Schedule = mongoose.model('Schedule', scheduleSchema);
