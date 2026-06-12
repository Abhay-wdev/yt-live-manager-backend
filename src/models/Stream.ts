import mongoose from 'mongoose';

const streamInstanceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  youtubeAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'YoutubeAccount', required: true },
  playlistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Playlist', required: true },
  
  // Encoding settings
  qualityProfile: { type: String, default: '1080p' },
  
  // Loop Settings
  videoLoopCount: { type: Number, default: 1 }, // -1 for infinite
  playlistLoopCount: { type: Number, default: 1 }, // -1 for infinite
  
  // Auto Restart Settings
  autoRestart: { type: Boolean, default: true },
  maxRestartAttempts: { type: Number, default: 5 }, // -1 for infinite
  restartDelaySeconds: { type: Number, default: 10 },
  resumeMode: { type: String, enum: ['restart-video', 'skip-video', 'resume-timestamp'], default: 'restart-video' },
  
  customSettings: {
    resolution: { type: String },
    fps: { type: Number },
    videoBitrate: { type: String },
    audioBitrate: { type: String },
    encoderPreset: { type: String },
    bufferSize: { type: String }
  }
}, { timestamps: true });

export const StreamInstance = mongoose.model('StreamInstance', streamInstanceSchema);

const streamStateSchema = new mongoose.Schema({
  streamInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'StreamInstance', required: true, unique: true },
  status: { type: String, enum: ['Starting', 'Live', 'Stopping', 'Offline', 'Error', 'Restarting'], default: 'Offline' },
  currentVideoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
  pid: { type: Number },
  startTime: { type: Date },
  
  // Tracking
  playlistIndex: { type: Number, default: 0 },
  currentVideoLoopCount: { type: Number, default: 0 },
  currentPlaylistLoopCount: { type: Number, default: 0 },
  restartAttemptCount: { type: Number, default: 0 },
  lastKnownTimestamp: { type: String, default: '00:00:00' },

  // Health
  health: {
    masterScore: { type: Number, default: 100 },
    masterStatus: { type: String, default: 'Healthy' },
    youtube: { status: { type: String, default: 'Connected' } },
    ffmpeg: { status: { type: String, default: 'Healthy' } },
    videoSource: { status: { type: String, default: 'Available' } },
    playlist: { status: { type: String, default: 'Healthy' } },
    quality: { status: { type: String, default: 'Stable' } },
    buffer: { status: { type: String, default: 'Normal' } },
    cpu: { status: { type: String, default: 'Below 70%' }, usage: { type: Number, default: 0 } },
    memory: { status: { type: String, default: 'Below 70%' }, usage: { type: Number, default: 0 } },
    network: { status: { type: String, default: 'Healthy' } },
    drive: { status: { type: String, default: 'Connected' } }
  }
}, { timestamps: true });

export const StreamState = mongoose.model('StreamState', streamStateSchema);

const streamLogSchema = new mongoose.Schema({
  streamInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'StreamInstance' },
  type: { type: String, enum: ['info', 'error', 'ffmpeg'] },
  message: { type: String },
  timestamp: { type: Date, default: Date.now }
});

export const StreamLog = mongoose.model('StreamLog', streamLogSchema);
