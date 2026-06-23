import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import socketService from './services/socketService';
import fs from 'fs';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import { startStudioRecording } from './services/GameRecorderService';

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

// --- RECORDING STUDIO API ---

// Ensure recordings dir exists
const recordingsDir = path.join(process.cwd(), 'recordings');
if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir);

// Serve recordings
app.use('/recordings', express.static(recordingsDir));

app.post('/api/recordings/generate', async (req, res) => {
  const loops = parseInt(req.body.loops || '1');
  // Start headless recording in the background
  startStudioRecording(loops).catch(err => console.error('Headless recording error:', err));
  res.json({ success: true, message: 'Server-side recording started in background' });
});

const upload = multer({ dest: 'temp_uploads/' });

app.post('/api/recordings/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video uploaded' });
  }

  const score = req.body.score || 0;
  const tempPath = req.file.path;
  const filename = `space_shooter_${Date.now()}_score${score}.mp4`;
  const finalPath = path.join(recordingsDir, filename);

  const fileExists = fs.existsSync(tempPath);
  console.log(`Input File Exists: ${fileExists ? 'YES' : 'NO'}`);
  
  if (!fileExists) {
    console.error('Recording file missing entirely.');
    return res.status(400).json({ error: 'Uploaded file missing' });
  }
  
  const stats = fs.statSync(tempPath);
  console.log(`Input File Size: ${(stats.size / 1024 / 1024).toFixed(4)} MB`);
  console.log(`Actual Mime Type: ${req.file.mimetype}`);
  console.log(`Saved Extension: ${path.extname(req.file.originalname)}`);

  if (stats.size === 0) {
    console.error('Recording file is empty. FFmpeg will not be called.');
    fs.unlinkSync(tempPath);
    return res.status(400).json({ error: 'Uploaded file is empty' });
  }

  console.log('FFmpeg Started');

  // Convert WebM to MP4 using FFmpeg
  ffmpeg(tempPath)
    .outputOptions([
      '-c:v libx264',
      '-preset fast',
      '-crf 23',
      '-pix_fmt yuv420p'
    ])
    .on('end', () => {
      console.log('FFmpeg Completed');
      fs.unlinkSync(tempPath); // Clean up temp file
      res.json({ success: true, file: filename });
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      res.status(500).json({ error: 'Conversion failed' });
    })
    .save(finalPath);
});

app.get('/api/recordings', (req, res) => {
  try {
    const files = fs.readdirSync(recordingsDir).filter(f => f.endsWith('.mp4')).sort().reverse();
    res.json(files);
  } catch (err) {
    res.json([]);
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
