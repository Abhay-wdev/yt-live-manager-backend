import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import SnakeAutoGeneratorService from './services/SnakeAutoGeneratorService';
import SnakeRecording from './models/SnakeRecording';
import socketService from './services/socketService';
import fs from 'fs';

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Bypass-Tunnel-Reminder']
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
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

// Serve recordings
app.use('/recordings', express.static(path.join(process.cwd(), 'recordings')));

// --- SNAKE GENERATOR API ---
app.post('/api/snake-generator/start', async (req, res) => {
  await SnakeAutoGeneratorService.startJob(req.body.count || 1);
  res.json({ success: true });
});

app.post('/api/snake-generator/stop', (req, res) => {
  SnakeAutoGeneratorService.stopGenerator();
  res.json({ success: true });
});

app.post('/api/snake-generator/pause', (req, res) => {
  SnakeAutoGeneratorService.pauseGenerator();
  res.json({ success: true });
});

app.post('/api/snake-generator/resume', (req, res) => {
  SnakeAutoGeneratorService.resumeGenerator();
  res.json({ success: true });
});

app.post('/api/snake-generator/settings', async (req, res) => {
  const GeneratorSettings = require('./models/GeneratorSettings').default;
  let settings = await GeneratorSettings.findOne();
  if (!settings) settings = new GeneratorSettings();
  Object.assign(settings, req.body);
  await settings.save();
  res.json({ success: true });
});

app.get('/api/snake-recordings', async (req, res) => {
  try {
    const recordings = await SnakeRecording.find().sort({ createdAt: -1 });
    res.json(recordings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

app.delete('/api/snake-recordings/:id', async (req, res) => {
  try {
    const recording = await SnakeRecording.findById(req.params.id);
    if (!recording) return res.status(404).json({ error: 'Not found' });
    
    if (fs.existsSync(recording.filepath)) {
      fs.unlinkSync(recording.filepath);
    }
    await recording.deleteOne();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete' });
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
