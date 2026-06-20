import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

import path from 'path';

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

// React Router fallback
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

export { app, httpServer, io };
