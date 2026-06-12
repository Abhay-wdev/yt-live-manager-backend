import { app, httpServer, io } from './app';
import { config } from './config/env';
import { connectDB } from './config/db';
import './services/ScheduleService'; // Initialize scheduler
import './services/HealthMonitorService'; // Initialize health monitor
import { ffmpegService } from './services/FFmpegService';

const startServer = async () => {
  await connectDB();

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    // Recover state if server crashed
    ffmpegService.resumeStateOnBoot();
  });
};

startServer();
