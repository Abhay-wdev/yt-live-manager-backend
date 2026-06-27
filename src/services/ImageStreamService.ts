import { spawn, ChildProcess } from 'child_process';
import { io } from '../app';
import ImageStreamConfig from '../models/ImageStreamConfig';
import { YoutubeAccount } from '../models/YoutubeAccount';
import { ImageAsset } from '../models/ImageAsset';
import { whatsappService } from './WhatsAppService';

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
  private restartTimeouts: Map<string, NodeJS.Timeout> = new Map();

  async initialize() {
    console.log('Initializing ImageStreamService... marking all previously Live streams as Stopped.');
    // Any stream that was Live when the server died is now Stopped.
    await ImageStreamConfig.updateMany(
      { status: { $in: ['Live', 'Restarting'] } },
      { $set: { status: 'Stopped' } }
    );
  }

  async startStream(streamId: string, imageId: string, youtubeAccountId: string, imagePath: string, streamKey: string, resolution: string = '1080p', fps: string = '30') {
    if (this.activeStreams.has(streamId)) {
      throw new Error('This specific image stream is already running on this channel.');
    }

    // Ensure config exists or create it
    let config = await ImageStreamConfig.findOne({ streamId });
    if (!config) {
      config = await ImageStreamConfig.create({
        streamId,
        youtubeAccountId,
        imageId,
        resolution,
        fps,
        status: 'Live'
      });
    } else {
      config.status = 'Live';
      config.resolution = resolution;
      config.fps = Number(fps);
      await config.save();
    }

    const account = await YoutubeAccount.findById(youtubeAccountId);
    const image = await ImageAsset.findById(imageId);

    const rtmpUrl = 'rtmp://a.rtmp.youtube.com/live2';
    
    const scale = resolution === '720p' ? '720:1280' : '1080:1920';
    const maxrate = resolution === '720p' ? '2500k' : '4000k';
    const bufsize = resolution === '720p' ? '5000k' : '8000k';
    const gop = (parseInt(fps) * 2).toString();

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
    if (account && image) {
      whatsappService.sendStreamStartedAlert(account.name, image.name);
    }

    process.stderr?.on('data', (data) => {
      const msg = data.toString();
      io.emit('image-ffmpeg-log', { streamId, log: msg });
    });

    process.on('close', async (code) => {
      console.log(`Image stream ${streamId} exited with code ${code}`);
      
      const instance = this.activeStreams.get(streamId);
      const wasIntentional = instance?.isIntentionalStop || false;
      
      this.activeStreams.delete(streamId);
      
      // Auto restart if it crashed and wasn't intentionally stopped
      if (!wasIntentional && code !== 0 && code !== null) {
        console.log(`Image stream ${streamId} crashed. Restarting in 5 seconds...`);
        await ImageStreamConfig.findOneAndUpdate({ streamId }, { status: 'Restarting' });
        io.emit('image-stream-status', { streamId, status: 'Restarting' });
        
        if (account && image) {
          whatsappService.sendStreamCrashedAlert(account.name, image.name, code);
        }

        const timeoutId = setTimeout(async () => {
          this.restartTimeouts.delete(streamId);
          // Check DB to make sure user didn't click stop during the 5s window
          const currentConfig = await ImageStreamConfig.findOne({ streamId });
          if (!this.activeStreams.has(streamId) && currentConfig?.status === 'Restarting') {
            this.startStream(streamId, imageId, youtubeAccountId, imagePath, streamKey, resolution, fps).catch(e => console.error('Restart failed', e));
          }
        }, 5000);
        this.restartTimeouts.set(streamId, timeoutId);
      } else {
        await ImageStreamConfig.findOneAndUpdate({ streamId }, { status: 'Stopped' });
        io.emit('image-stream-status', { streamId, status: 'Offline' });
      }
    });
  }

  async stopStream(streamId: string) {
    const instance = this.activeStreams.get(streamId);
    
    // Clear any pending restart timeouts to prevent infinite loops
    const pendingTimeout = this.restartTimeouts.get(streamId);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      this.restartTimeouts.delete(streamId);
    }
    
    // Update DB even if process isn't running (it might be scheduled)
    await ImageStreamConfig.findOneAndUpdate({ streamId }, { status: 'Stopped', isScheduled: false });
    io.emit('image-stream-status', { streamId, status: 'Offline' });
    
    if (instance) {
      instance.isIntentionalStop = true;
      instance.process.kill('SIGKILL');
      this.activeStreams.delete(streamId);

      const account = await YoutubeAccount.findById(instance.youtubeAccountId);
      const image = await ImageAsset.findById(instance.imageId);
      if (account && image) {
        whatsappService.sendStreamStoppedAlert(account.name, image.name);
      }
    }
  }

  async getActiveStreams() {
    // Instead of active streams from memory, return all configs from DB
    // So the frontend can show history of stopped streams too.
    const configs = await ImageStreamConfig.find().lean();
    return configs.map(c => ({
      streamId: c.streamId,
      imageId: c.imageId,
      youtubeAccountId: c.youtubeAccountId,
      resolution: c.resolution,
      fps: c.fps,
      status: c.status,
      isScheduled: c.isScheduled,
      scheduleType: c.scheduleType,
      startTime: c.startTime,
      stopTime: c.stopTime,
      dailyStartTime: c.dailyStartTime,
      dailyStopTime: c.dailyStopTime
    }));
  }
}

export const imageStreamService = new ImageStreamService();
