import { spawn, ChildProcess } from 'child_process';
import { io } from '../app';

interface StreamInstance {
  process: ChildProcess;
  isIntentionalStop: boolean;
  imageId: string;
  youtubeAccountId: string;
  resolution: string;
  fps: string;
}

class ImageStreamService {
  private activeStreams: Map<string, StreamInstance> = new Map();

  async startStream(streamId: string, imageId: string, youtubeAccountId: string, imagePath: string, streamKey: string, resolution: string = '1080p', fps: string = '30') {
    if (this.activeStreams.has(streamId)) {
      throw new Error('This specific image stream is already running on this channel.');
    }

    const rtmpUrl = 'rtmp://a.rtmp.youtube.com/live2';
    
    const scale = resolution === '720p' ? '720:1280' : '1080:1920';
    const maxrate = resolution === '720p' ? '2500k' : '4000k';
    const bufsize = resolution === '720p' ? '5000k' : '8000k';
    const gop = (parseInt(fps) * 2).toString();

    // -loop 1 to loop the image endlessly
    // -re to read input at native frame rate (important for streaming static images)
    // -vf to scale and pad to vertical format
    const ffmpegArgs = [
      '-re',
      '-loop', '1',
      '-i', imagePath,
      '-f', 'lavfi',
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-r', fps,
      '-g', gop,
      '-keyint_min', fps,
      '-maxrate', maxrate,
      '-bufsize', bufsize,
      '-vf', `scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale}:(ow-iw)/2:(oh-ih)/2`,
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-f', 'flv',
      `${rtmpUrl}/${streamKey}`
    ];

    console.log(`Starting Image FFmpeg stream for ${imagePath} with ID ${streamId}`);
    const process = spawn('ffmpeg', ffmpegArgs);
    
    this.activeStreams.set(streamId, {
      process,
      isIntentionalStop: false,
      imageId,
      youtubeAccountId,
      resolution,
      fps
    });

    io.emit('image-stream-status', { streamId, status: 'Live' });

    process.stderr?.on('data', (data) => {
      const msg = data.toString();
      io.emit('image-ffmpeg-log', { streamId, log: msg });
    });

    process.on('close', (code) => {
      console.log(`Image stream ${streamId} exited with code ${code}`);
      
      const instance = this.activeStreams.get(streamId);
      const wasIntentional = instance?.isIntentionalStop || false;
      
      this.activeStreams.delete(streamId);
      io.emit('image-stream-status', { streamId, status: 'Offline' });
      
      // Auto restart if it crashed and wasn't intentionally stopped
      if (!wasIntentional && code !== 0 && code !== null) {
        console.log(`Image stream ${streamId} crashed. Restarting in 5 seconds...`);
        io.emit('image-stream-status', { streamId, status: 'Restarting' });
        setTimeout(() => {
          if (!this.activeStreams.has(streamId)) {
            this.startStream(streamId, imageId, youtubeAccountId, imagePath, streamKey, resolution, fps).catch(e => console.error('Restart failed', e));
          }
        }, 5000);
      }
    });
  }

  async stopStream(streamId: string) {
    const instance = this.activeStreams.get(streamId);
    if (instance) {
      instance.isIntentionalStop = true;
      instance.process.kill('SIGKILL');
      this.activeStreams.delete(streamId);
    }
    io.emit('image-stream-status', { streamId, status: 'Offline' });
  }

  getActiveStreams() {
    const streams: any[] = [];
    this.activeStreams.forEach((instance, streamId) => {
      streams.push({
        streamId,
        imageId: instance.imageId,
        youtubeAccountId: instance.youtubeAccountId,
        resolution: instance.resolution,
        fps: instance.fps,
        status: 'Live'
      });
    });
    return streams;
  }
}

export const imageStreamService = new ImageStreamService();
