import { app, httpServer, io } from './app';
import { config } from './config/env';
import { connectDB } from './config/db';
import './models/YoutubeAccount';
import './models/Playlist';
import './models/Stream';
import './services/ScheduleService'; // Initialize scheduler
import './services/HealthMonitorService'; // Initialize health monitor
import './services/StreamScheduler'; // Initialize stream scheduler
import { ffmpegService } from './services/FFmpegService';
import { isRecordingActive, stopNativeRecording } from './services/FFmpegRecorderService';
import { imageStreamService } from './services/ImageStreamService';

import ngrok from '@ngrok/ngrok';

const startServer = async () => {
  await connectDB();

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    if (isRecordingActive) {
      socket.emit('studio_command', { action: 'PROCESSING_START' });
    }
    
    socket.on('studio_frame', (frame) => {
      // Broadcast the frame to all other connected clients
      socket.broadcast.emit('studio_broadcast_frame', frame);
    });

    socket.on('studio_command', (cmd) => {
      if (cmd.action === 'STOP_RECORDING') {
        stopNativeRecording();
      }
      socket.broadcast.emit('studio_command_broadcast', cmd);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(config.port, async () => {
    console.log(`Server running on port ${config.port}`);
    // Recover state if server crashed
    ffmpegService.resumeStateOnBoot();
    await imageStreamService.initialize();
    
    try {
      const authtoken = process.env.NGROK_AUTHTOKEN;
      if (!authtoken) {
        console.error('ERROR: NGROK_AUTHTOKEN is missing in your .env file!');
        return;
      }

      const listener = await ngrok.forward({ 
        addr: Number(config.port), 
        authtoken: authtoken 
      });
      
      console.log(`\n======================================================`);
      console.log(`\x1b[32mPERMANENT TUNNEL URL: ${listener.url()}\x1b[0m`);
      console.log(`======================================================\n`);

      // Cleanly close tunnel on exit
      const shutdown = async () => {
        console.log('\nClosing ngrok tunnel and shutting down...');
        await ngrok.disconnect();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      process.on('SIGUSR2', shutdown); // For nodemon restarts

    } catch (err) {
      console.error('Failed to start ngrok:', err);
    }
  });
};

startServer();
