import { spawn } from 'child_process';
import { GameEngine } from '../game/GameEngine';
import { GameRenderer } from '../game/GameRenderer';
import { createCanvas } from 'canvas';
import path from 'path';
import fs from 'fs';
import socketService from './socketService';
import { AudioMixer } from './AudioMixer';

let activeInterval: NodeJS.Timeout | null = null;
let activeFFmpegProcess: any = null;
export let isRecordingActive = false;

export const stopNativeRecording = () => {
  if (activeInterval) clearInterval(activeInterval);
  if (activeFFmpegProcess) {
    try { activeFFmpegProcess.stdio[0].end(); } catch (e) {}
    try { activeFFmpegProcess.stdio[3].end(); } catch (e) {}
  }
  isRecordingActive = false;
  socketService.getIO().emit('studio_command', { action: 'PROCESSING_COMPLETE', filename: null, score: 0 });
};

export const startNativeRecording = async (loops: number) => {
  if (isRecordingActive) return;
  isRecordingActive = true;
  console.log(`Starting Native Node.js Recording for ${loops} loops`);
  await GameRenderer.loadAssets();

  const width = 540;
  const height = 960;
  const fps = 60;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  const game = new GameEngine(true);
  const renderer = new GameRenderer(ctx as any, width, height);
  const audioMixer = new AudioMixer();

  const score = 0; // Starts at 0
  const filename = `space_shooter_${Date.now()}_native.mp4`;
  const recordingsDir = path.join(process.cwd(), 'recordings');
  if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir);
  const finalPath = path.join(recordingsDir, filename);

  const ffmpegArgs = [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', `${fps}`,
    '-i', 'pipe:0',
    '-f', 's16le',
    '-ar', '44100',
    '-ac', '1',
    '-i', 'pipe:3',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    finalPath
  ];

  const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
    stdio: ['pipe', 'pipe', 'pipe', 'pipe']
  });

  ffmpegProcess.stderr.on('data', (data) => {
    // console.log(`ffmpeg: ${data}`); // Un-comment for debugging
  });

  return new Promise((resolve, reject) => {
    let currentLoop = 0;
    let prevBullets = 0;
    let prevParticles = 0;
    
    socketService.getIO().emit('studio_command', { action: 'PROCESSING_START' });

    const interval = setInterval(() => {
      // 1. Update Logic
      game.update();
      
      // Sound logic
      if (game.state.bullets.length > prevBullets) audioMixer.playSound('shoot');
      if (game.state.particles.length > prevParticles) audioMixer.playSound('explosion');
      prevBullets = game.state.bullets.length;
      prevParticles = game.state.particles.length;
      
      // 2. Render to Canvas
      renderer.render(game.state);
      
      // 3. Broadcast to all listening frontends (Dashboard)
      socketService.getIO().emit('studio_broadcast_frame', game.state);

      // 4. Pipe Video to FFmpeg
      const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
      (ffmpegProcess.stdio[0] as any).write(buffer);

      // 5. Pipe Audio to FFmpeg
      const audioBuf = audioMixer.getFrameBuffer();
      (ffmpegProcess.stdio[3] as any).write(audioBuf);

      // 6. Check loop condition
      if (game.state.isGameOver) {
        currentLoop++;
        if (loops !== -1 && currentLoop >= loops) {
          clearInterval(interval);
          try { (ffmpegProcess.stdio[0] as any).end(); } catch (e) {}
          try { (ffmpegProcess.stdio[3] as any).end(); } catch (e) {}
        } else {
          // Reset game state for next loop, keeping score
          const currentScore = game.state.score;
          game.reset();
          game.state.score = currentScore;
        }
      }
    }, 1000 / fps);

    activeInterval = interval;
    activeFFmpegProcess = ffmpegProcess;

    ffmpegProcess.on('close', (code) => {
      isRecordingActive = false;
      console.log(`FFmpeg finished with code ${code}. Saved to ${finalPath}`);
      socketService.getIO().emit('studio_command', { 
        action: 'PROCESSING_COMPLETE', 
        filename,
        score: game.state.score
      });
      resolve(finalPath);
    });

    ffmpegProcess.on('error', (err) => {
      console.error('FFmpeg Error:', err);
      isRecordingActive = false;
      clearInterval(interval);
      reject(err);
    });
  });
};
