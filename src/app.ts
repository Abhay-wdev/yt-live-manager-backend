import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import socketService from './services/socketService';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { startNativeRecording } from './services/FFmpegRecorderService';

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Bypass-Tunnel-Reminder']
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/assets', express.static(path.join(process.cwd(), 'src/assets')));
app.use(express.static(path.join(process.cwd(), 'public')));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Bypass-Tunnel-Reminder']
  }
});

socketService.init(io);

// Pass io to request object for use in controllers
app.use((req, res, next) => {
  (req as any).io = io;
  next();
});

import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import videoRoutes from './routes/videoRoutes';
import playlistRoutes from './routes/playlistRoutes';
import streamRoutes from './routes/streamRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import youtubeAccountRoutes from './routes/youtubeAccountRoutes';

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/youtube-accounts', youtubeAccountRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// --- RECORDING STUDIO API ---

// Ensure recordings dir exists
const recordingsDir = path.join(process.cwd(), 'recordings');
if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir);

// Serve recordings
app.use('/recordings', express.static(recordingsDir));

app.post('/api/recordings/generate', async (req, res) => {
  const loops = parseInt(req.body.loops || '1');
  startNativeRecording(loops).catch(err => console.error('Native recording error:', err));
  res.json({ success: true, message: 'Server-side native recording started in background' });
});

app.get('/api/recordings', (req, res) => {
  try {
    const files = fs.readdirSync(recordingsDir).filter(f => f.endsWith('.mp4')).sort().reverse();
    res.json(files);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/recordings/bulk-delete', (req, res) => {
  try {
    const filenames = req.body.filenames;
    if (!Array.isArray(filenames)) {
      return res.status(400).json({ error: 'filenames must be an array' });
    }
    let deletedCount = 0;
    for (const filename of filenames) {
      const filePath = path.join(recordingsDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }
    res.json({ success: true, deletedCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to bulk delete files' });
  }
});

app.delete('/api/recordings/:filename', (req, res) => {
  try {
    const filePath = path.join(recordingsDir, req.params.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

app.put('/api/recordings/:filename', (req, res) => {
  try {
    const oldPath = path.join(recordingsDir, req.params.filename);
    let newFilename = req.body.newFilename;
    
    if (!newFilename.endsWith('.mp4')) newFilename += '.mp4';
    
    const newPath = path.join(recordingsDir, newFilename);

    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      res.json({ success: true, newFilename });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

app.get('/g-records', (req, res) => {
  const htmlPath = path.join(process.cwd(), 'src', 'views', 'g-records.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send('Dashboard UI not found');
  }
});

// React Router fallback
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

export { app, httpServer, io };
