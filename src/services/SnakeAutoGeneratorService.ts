import { createCanvas } from 'canvas';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import path from 'path';
import fs from 'fs';
import SnakeRecording from '../models/SnakeRecording';
import GeneratorJob from '../models/GeneratorJob';
import GeneratorSettings from '../models/GeneratorSettings';
import socketService from './socketService';
import si from 'systeminformation';

class SnakeAutoGeneratorService {
  private isGenerating = false;
  private isPaused = false;
  private currentJobProcess: { stop: () => void } | null = null;
  private ffmpegProgressStr: string = '';

  constructor() {
    this.startTelemetryLoop();
    this.checkQueueLoop();
  }

  private async getSettings() {
    let settings = await GeneratorSettings.findOne();
    if (!settings) {
      settings = await GeneratorSettings.create({});
    }
    return settings;
  }

  public async startJob(count: number) {
    await GeneratorJob.create({
      targetCount: count,
      isInfinite: count === -1,
      status: 'pending'
    });
  }

  public stopGenerator() {
    this.isGenerating = false;
    this.isPaused = false;
    if (this.currentJobProcess) {
      this.currentJobProcess.stop();
      this.currentJobProcess = null;
    }
  }

  public pauseGenerator() {
    this.isPaused = true;
  }

  public resumeGenerator() {
    this.isPaused = false;
  }

  private startTelemetryLoop() {
    setInterval(async () => {
      try {
        const cpu = await si.currentLoad();
        const mem = await si.mem();
        const activeJobs = await GeneratorJob.find({ status: { $in: ['running', 'pending', 'paused'] } });
        
        socketService.getIO().emit('system-stats', {
          cpu: cpu.currentLoad.toFixed(1),
          ram: ((mem.active / mem.total) * 100).toFixed(1)
        });

        socketService.getIO().emit('generator-status', {
          state: this.isGenerating ? (this.isPaused ? 'Paused' : 'Recording') : 'Idle',
          ffmpegProgress: this.ffmpegProgressStr,
          jobs: activeJobs
        });
      } catch (err) {}
    }, 1000);
  }

  private async checkQueueLoop() {
    setInterval(async () => {
      if (this.isGenerating || this.isPaused) return;

      const job = await GeneratorJob.findOne({ status: { $in: ['pending', 'running'] } }).sort({ createdAt: 1 });
      if (!job) return;

      if (job.status === 'pending') {
        job.status = 'running';
        await job.save();
      }

      if (job.isInfinite || job.completedCount < job.targetCount) {
        this.isGenerating = true;
        this.runRecordingTask(job);
      } else {
        job.status = 'completed';
        await job.save();
      }
    }, 2000);
  }

  private async runRecordingTask(job: any) {
    const settings = await this.getSettings();
    const [w, h] = settings.resolution.split('x').map(Number);
    const fps = settings.fps;
    const format = settings.outputFormat;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `snake_${timestamp}.${format}`;
    const filepath = path.join(process.cwd(), 'recordings', 'snake', filename);

    const recording = new SnakeRecording({
      filename,
      filepath,
      resolution: settings.resolution,
      fps,
      status: 'generating'
    });
    await recording.save();

    const passThroughStream = new PassThrough();

    const command = ffmpeg()
      .input(passThroughStream)
      .inputFormat('image2pipe')
      .inputOptions([
        '-vcodec', 'png',
        '-r', fps.toString()
      ])
      .output(filepath)
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-pix_fmt', 'yuv420p',
        '-b:v', settings.bitrate,
        '-r', fps.toString()
      ])
      .on('progress', (progress) => {
        this.ffmpegProgressStr = `Frames: ${progress.frames} | FPS: ${progress.currentFps}`;
      })
      .on('end', async () => {
        this.ffmpegProgressStr = 'Finished';
        const stats = fs.statSync(filepath);
        recording.status = 'completed';
        recording.fileSize = stats.size;
        await recording.save();

        job.completedCount++;
        await job.save();

        this.isGenerating = false; // Next loop will pick up
      })
      .on('error', async (err) => {
        console.error(err);
        recording.status = 'failed';
        await recording.save();
        
        job.failedCount++;
        await job.save();

        this.isGenerating = false;
      });

    command.run();

    let stopGame = this.runGameLoop(passThroughStream, recording, settings, w, h);
    
    this.currentJobProcess = {
      stop: stopGame
    };
  }

  private runGameLoop(stream: PassThrough, recordingDocument: any, settings: any, width: number, height: number) {
    const gridSize = 40;
    const fps = settings.fps;
    const snakeSpeed = settings.snakeSpeed;
    const cols = Math.floor(width / gridSize);
    const rows = Math.floor(height / gridSize);

    let snake = {
      cells: [{ x: Math.floor(cols/2), y: Math.floor(rows/2) }],
      dx: 1, dy: 0,
      maxCells: 4
    };

    let apple = this.spawnApple(cols, rows, snake.cells);
    let score = 0;
    let framesCounter = 0;
    const framesPerMove = Math.max(1, Math.round(fps / snakeSpeed));
    let isGameOver = false;

    // Send frame to Socket.io purely mathematically
    const emitFrame = () => {
      try {
        socketService.getIO().emit('snake-frame', {
          snake: snake.cells.map(c => ({ x: c.x * gridSize, y: c.y * gridSize })),
          apple: { x: apple.x * gridSize, y: apple.y * gridSize },
          score,
          size: gridSize,
          res: settings.resolution
        });
      } catch(e) {}
    };

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const interval = setInterval(async () => {
      if (this.isPaused) return;
      if (isGameOver) return;

      framesCounter++;

      if (framesCounter % framesPerMove === 0) {
        const nextMove = this.calculateNextMove(snake, apple, cols, rows, settings.difficulty);
        snake.dx = nextMove.dx;
        snake.dy = nextMove.dy;

        const newHead = { x: snake.cells[0].x + snake.dx, y: snake.cells[0].y + snake.dy };

        if (newHead.x < 0 || newHead.x >= cols || newHead.y < 0 || newHead.y >= rows) isGameOver = true;
        for (let cell of snake.cells) {
          if (newHead.x === cell.x && newHead.y === cell.y) isGameOver = true;
        }

        if (!isGameOver) {
          snake.cells.unshift(newHead);
          if (newHead.x === apple.x && newHead.y === apple.y) {
            snake.maxCells++;
            score += 10;
            apple = this.spawnApple(cols, rows, snake.cells);
          }
          if (snake.cells.length > snake.maxCells) snake.cells.pop();
        }
      }

      emitFrame();

      // Render to FFmpeg
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(apple.x * gridSize, apple.y * gridSize, gridSize, gridSize);
      ctx.fillStyle = '#10b981';
      for (let cell of snake.cells) {
        ctx.fillRect(cell.x * gridSize, cell.y * gridSize, gridSize, gridSize);
      }
      
      stream.write(canvas.toBuffer('image/png'));

      if (isGameOver) {
        clearInterval(interval);
        stream.end();
        recordingDocument.finalScore = score;
        recordingDocument.duration = (framesCounter / fps);
        await recordingDocument.save();
      }
    }, 1000 / fps);

    return () => {
      isGameOver = true;
      clearInterval(interval);
      stream.end();
    };
  }

  private spawnApple(cols: number, rows: number, snakeCells: any[]) {
    let x, y;
    let safe = false;
    while (!safe) {
      x = Math.floor(Math.random() * cols);
      y = Math.floor(Math.random() * rows);
      safe = !snakeCells.some(cell => cell.x === x && cell.y === y);
    }
    return { x, y };
  }

  private calculateNextMove(snake: any, apple: any, cols: number, rows: number, difficulty: string) {
    const head = snake.cells[0];
    const directions = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
    ];

    let bestMove = { dx: snake.dx, dy: snake.dy };
    
    // Easy mode: sometimes pick random valid direction
    if (difficulty === 'easy' && Math.random() < 0.2) {
      const valids = directions.filter(dir => {
        if (dir.dx === -snake.dx && dir.dy === -snake.dy) return false;
        return true;
      });
      return valids[Math.floor(Math.random() * valids.length)];
    }

    let shortestDist = Infinity;
    const validMoves = directions.filter(dir => {
      if (dir.dx === -snake.dx && dir.dy === -snake.dy && snake.cells.length > 1) return false;
      const nx = head.x + dir.dx;
      const ny = head.y + dir.dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) return false;
      if (snake.cells.some((c: any) => c.x === nx && c.y === ny)) return false;
      return true;
    });

    if (validMoves.length > 0) {
      for (const move of validMoves) {
        const nx = head.x + move.dx;
        const ny = head.y + move.dy;
        const dist = Math.abs(nx - apple.x) + Math.abs(ny - apple.y);
        if (dist < shortestDist) {
          shortestDist = dist;
          bestMove = move;
        }
      }
    }

    return bestMove;
  }
}

export default new SnakeAutoGeneratorService();
