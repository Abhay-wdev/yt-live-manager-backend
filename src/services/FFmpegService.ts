import { spawn, ChildProcess } from 'child_process';
import { StreamInstance, StreamState, StreamLog } from '../models/Stream';
import { YoutubeAccount } from '../models/YoutubeAccount';
import { PlaylistItem } from '../models/Playlist';
import { io } from '../app';
import axios from 'axios';

export class FFmpegService {
  private processes: Map<string, ChildProcess> = new Map();
  private intentionalStops: Map<string, boolean> = new Map();
  private lastDbSaveTime: Map<string, number> = new Map();

  async startStream(streamInstanceId: string, isResume: boolean = false) {
    if (this.processes.has(streamInstanceId) && !isResume) {
      throw new Error('Stream is already running');
    }

    this.intentionalStops.set(streamInstanceId, false);
    this.lastDbSaveTime.set(streamInstanceId, 0);

    const instance = await StreamInstance.findById(streamInstanceId).populate('youtubeAccountId');
    if (!instance) throw new Error('Stream instance not found');

    const youtubeAccount: any = instance.youtubeAccountId;
    if (!youtubeAccount || !youtubeAccount.streamKey) throw new Error('YouTube account or stream key missing');

    const items = await PlaylistItem.find({ playlistId: instance.playlistId }).populate('videoId').sort({ order: 1 });
    if (!items || items.length === 0) {
      throw new Error('Playlist is empty');
    }

    let activeStream = await StreamState.findOne({ streamInstanceId });
    
    if (!isResume || !activeStream) {
      activeStream = await StreamState.findOneAndUpdate({ streamInstanceId }, {
        status: 'Starting',
        startTime: new Date(),
        playlistIndex: 0,
        currentVideoLoopCount: 0,
        currentPlaylistLoopCount: 0,
        restartAttemptCount: 0,
        lastKnownTimestamp: '00:00:00'
      }, { upsert: true, new: true });
    } else if (isResume && activeStream) {
      activeStream.status = 'Starting';
      await activeStream.save();
    }

    this.processPlaylist(items, activeStream, instance, youtubeAccount.streamKey);
  }

  private async processPlaylist(items: any[], activeStream: any, instance: any, streamKey: string) {
    const streamId = instance._id.toString();
    if (this.intentionalStops.get(streamId)) return;

    if (instance.playlistLoopCount !== -1 && activeStream.currentPlaylistLoopCount >= instance.playlistLoopCount) {
      await this.stopStream(streamId, true);
      await StreamLog.create({ streamInstanceId: streamId, type: 'info', message: 'Playlist completed all loops. Stream ended cleanly.' });
      return;
    }

    if (activeStream.playlistIndex >= items.length) {
      activeStream.playlistIndex = 0;
      activeStream.currentPlaylistLoopCount++;
      await activeStream.save();
      return this.processPlaylist(items, activeStream, instance, streamKey);
    }

    const currentItem = items[activeStream.playlistIndex];
    const video = currentItem.videoId;

    if (instance.videoLoopCount !== -1 && activeStream.currentVideoLoopCount >= instance.videoLoopCount) {
      activeStream.playlistIndex++;
      activeStream.currentVideoLoopCount = 0;
      activeStream.lastKnownTimestamp = '00:00:00';
      await activeStream.save();
      return this.processPlaylist(items, activeStream, instance, streamKey);
    }

    activeStream.currentVideoId = video._id;
    activeStream.status = 'Live';
    await activeStream.save();
    
    io.emit('stream-status', { streamId, status: 'Live' });

    await this.streamVideoProcess(video, activeStream, instance, streamKey, items);
  }

  private async resolveGoogleDriveLink(fileId: string): Promise<{ url: string, cookie?: string }> {
    const initialUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    try {
        const response = await axios.get(initialUrl, { responseType: 'text', withCredentials: true, maxRedirects: 5 });
        const html = response.data;
        
        const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/i);
        if (uuidMatch) {
            const uuid = uuidMatch[1];
            let cookie = '';
            if (response.headers['set-cookie']) {
                cookie = response.headers['set-cookie'].map((c: string) => c.split(';')[0]).join('; ');
            }
            return { url: `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&uuid=${uuid}`, cookie: cookie };
        }

        const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
        if (confirmMatch) {
            const confirmToken = confirmMatch[1];
            let cookie = '';
            if (response.headers['set-cookie']) {
                cookie = response.headers['set-cookie'].map((c: string) => c.split(';')[0]).join('; ');
            }
            return { url: `${initialUrl}&confirm=${confirmToken}`, cookie: cookie };
        }
        return { url: response.request?.res?.responseUrl || initialUrl };
    } catch (err) {
        console.error("[Google Drive Resolve Error]", err);
        return { url: initialUrl };
    }
  }

  private async streamVideoProcess(video: any, activeStream: any, instance: any, streamKey: string, items: any[]) {
    const streamId = instance._id.toString();
    let inputPath = video.path;
    let inputCookie = '';

    if (video.sourceType === 'google-drive') {
       const match = inputPath.match(/id=([a-zA-Z0-9_-]+)/);
       if (match && match[1]) {
          const resolved = await this.resolveGoogleDriveLink(match[1]);
          inputPath = resolved.url;
          if (resolved.cookie) inputCookie = resolved.cookie;
       }
    }

    const rtmpUrl = 'rtmp://a.rtmp.youtube.com/live2';
    const ffmpegArgs = ['-re'];

    if (instance.resumeMode === 'resume-timestamp' && activeStream.lastKnownTimestamp !== '00:00:00') {
      ffmpegArgs.push('-ss', activeStream.lastKnownTimestamp);
    }

    if (inputCookie) {
      ffmpegArgs.push('-headers', `Cookie: ${inputCookie}\r\n`);
    }

    ffmpegArgs.push(
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-r', '30',
      '-g', '60',
      '-keyint_min', '30',
      '-maxrate', '1000k',
      '-bufsize', '2000k',
      '-vf', 'scale=-2:480',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-f', 'flv',
      `${rtmpUrl}/${streamKey}`
    );

    const process = spawn('ffmpeg', ffmpegArgs);
    this.processes.set(streamId, process);

    if (process.pid) {
      activeStream.pid = process.pid;
      await activeStream.save();
    }

    process.stderr?.on('data', async (data) => {
      const msg = data.toString();
      
      // Filter out harmless FLV live stream warnings
      if (!msg.includes('Failed to update header with correct duration') && 
          !msg.includes('Failed to update header with correct filesize') &&
          !msg.includes('muxing overhead:')) {
        io.emit('ffmpeg-log', { streamId, log: msg });
      }

      // Parse Health Metrics
      // Example: frame=  100 fps= 30 q=28.0 size= 2048kB time=00:00:03.33 bitrate=5032.5kbits/s drop= 5 speed= 1x
      let drops = 0;
      let speed = '1x';
      let bufferWarn = false;

      const dropMatch = msg.match(/drop=\s*(\d+)/);
      if (dropMatch) drops = parseInt(dropMatch[1], 10);
      
      const speedMatch = msg.match(/speed=\s*([\d.]+)x/);
      if (speedMatch) speed = speedMatch[1];
      
      if (msg.toLowerCase().includes('buffer underflow') || msg.toLowerCase().includes('past duration')) {
        bufferWarn = true;
      }
      
      if (drops > 0 || bufferWarn || parseFloat(speed) < 0.9) {
         const { healthMonitorService } = require('./HealthMonitorService');
         healthMonitorService.reportFFmpegMetrics(streamId, drops, speed, bufferWarn);
      }

      if (instance.resumeMode === 'resume-timestamp' && msg.includes('time=')) {
        const match = msg.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
        if (match && match[1]) {
          const now = Date.now();
          const lastSave = this.lastDbSaveTime.get(streamId) || 0;
          if (now - lastSave > 5000) { 
            this.lastDbSaveTime.set(streamId, now);
            StreamState.findOneAndUpdate({ streamInstanceId: streamId }, { lastKnownTimestamp: match[1] }).exec();
          }
        }
      }
    });

    process.on('close', async (code) => {
      this.processes.delete(streamId);
      if (this.intentionalStops.get(streamId)) return;

      const currentActive = await StreamState.findOne({ streamInstanceId: streamId });
      if (!currentActive) return;

      if (code !== 0 && code !== null) {
        await StreamLog.create({ streamInstanceId: streamId, type: 'error', message: `FFmpeg crashed with code ${code}` });
        
        if (instance.autoRestart) {
          if (instance.maxRestartAttempts === -1 || currentActive.restartAttemptCount < instance.maxRestartAttempts) {
            currentActive.status = 'Restarting';
            currentActive.restartAttemptCount++;
            await currentActive.save();
            io.emit('stream-status', { streamId, status: 'Restarting' });
            
            setTimeout(() => {
              if (instance.resumeMode === 'skip-video') {
                currentActive.playlistIndex++;
                currentActive.currentVideoLoopCount = 0;
                currentActive.lastKnownTimestamp = '00:00:00';
              } else if (instance.resumeMode === 'restart-video') {
                currentActive.lastKnownTimestamp = '00:00:00';
              }
              currentActive.save().then(() => {
                this.processPlaylist(items, currentActive, instance, streamKey);
              });
            }, instance.restartDelaySeconds * 1000);
            return;
          }
        }
        await this.stopStream(streamId, true);
        return;
      }

      currentActive.currentVideoLoopCount++;
      currentActive.lastKnownTimestamp = '00:00:00';
      currentActive.restartAttemptCount = 0; 
      await currentActive.save();
      
      this.processPlaylist(items, currentActive, instance, streamKey);
    });
  }

  async stopStream(streamInstanceId: string, isCleanFinish = false) {
    this.intentionalStops.set(streamInstanceId, true);
    const process = this.processes.get(streamInstanceId);
    
    if (process) {
      process.kill('SIGKILL');
      this.processes.delete(streamInstanceId);
    }
    
    await StreamState.findOneAndUpdate({ streamInstanceId }, { 
      status: 'Offline', 
      pid: null,
      playlistIndex: 0,
      currentVideoLoopCount: 0,
      currentPlaylistLoopCount: 0,
      restartAttemptCount: 0,
      lastKnownTimestamp: '00:00:00'
    });
    
    io.emit('stream-status', { streamId: streamInstanceId, status: 'Offline' });
  }

  async resumeStateOnBoot() {
    try {
      const activeStreams = await StreamState.find({ status: { $in: ['Live', 'Restarting', 'Error', 'Starting'] } });
      
      for (const active of activeStreams) {
        const instance = await StreamInstance.findById(active.streamInstanceId);
        if (instance) {
          console.log(`[Recovery] Resuming active stream ${instance.name}...`);
          await StreamLog.create({ streamInstanceId: instance._id, type: 'info', message: 'Node server rebooted. Recovering stream state.' });
          
          if (instance.resumeMode === 'restart-video') active.lastKnownTimestamp = '00:00:00';
          else if (instance.resumeMode === 'skip-video') {
             active.playlistIndex++;
             active.currentVideoLoopCount = 0;
             active.lastKnownTimestamp = '00:00:00';
          }
          await active.save();
          
          this.startStream(active.streamInstanceId.toString(), true).catch(err => console.error(err));
        }
      }
    } catch (err) {
      console.error('[Recovery Error]', err);
    }
  }
}

export const ffmpegService = new FFmpegService();
