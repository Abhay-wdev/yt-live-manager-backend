import mongoose, { Document, Schema } from 'mongoose';

export interface IGeneratorSettings extends Document {
  resolution: string; // e.g. "1080x1920"
  fps: number; // e.g. 30
  bitrate: string; // e.g. "2500k"
  outputFormat: string; // e.g. "mp4"
  snakeSpeed: number; // e.g. 15
  difficulty: string; // "easy", "medium", "hard", "insane"
  smartPathfinding: boolean;
  autoRestartWhenEnds: boolean;
  autoRestartOnError: boolean;
}

const generatorSettingsSchema = new Schema<IGeneratorSettings>({
  resolution: { type: String, default: "1080x1920" },
  fps: { type: Number, default: 30 },
  bitrate: { type: String, default: "2500k" },
  outputFormat: { type: String, default: "mp4" },
  snakeSpeed: { type: Number, default: 15 },
  difficulty: { type: String, default: "medium" },
  smartPathfinding: { type: Boolean, default: true },
  autoRestartWhenEnds: { type: Boolean, default: true },
  autoRestartOnError: { type: Boolean, default: true }
});

export default mongoose.model<IGeneratorSettings>('GeneratorSettings', generatorSettingsSchema);
