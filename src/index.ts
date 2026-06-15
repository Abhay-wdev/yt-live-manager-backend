import { app, httpServer, io } from './app';
import { config } from './config/env';
import { connectDB } from './config/db';
import './models/YoutubeAccount';
import './models/Playlist';
import './models/Stream';
import './services/ScheduleService'; // Initialize scheduler
import './services/HealthMonitorService'; // Initialize health monitor
import { ffmpegService } from './services/FFmpegService';

import localtunnel from 'localtunnel';

const startServer = async () => {
  await connectDB();

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(config.port, async () => {
    console.log(`Server running on port ${config.port}`);
    // Recover state if server crashed
    ffmpegService.resumeStateOnBoot();
    
    try {
      const tunnel = await localtunnel({ port: config.port, subdomain: 'yt-manager-abhay-2026' });
      console.log(`\n======================================================`);
      console.log(`\x1b[32mPERMANENT TUNNEL URL: ${tunnel.url}\x1b[0m`);
      console.log(`======================================================\n`);
      
      tunnel.on('close', () => {
        console.log('Tunnel was closed.');
      });
    } catch (err) {
      console.error('Failed to start localtunnel:', err);
    }
  });
};

startServer();
