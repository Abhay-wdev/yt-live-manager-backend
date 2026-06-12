import si from 'systeminformation';
import { StreamState, StreamInstance } from '../models/Stream';
import { io } from '../app';
import { ffmpegService } from './FFmpegService';

class HealthMonitorService {
  private updateInterval: NodeJS.Timeout | null = null;
  // Ephemeral tracking data from FFmpeg stdout
  private streamMetrics: Map<string, { drops: number, speed: string, bufferWarn: boolean }> = new Map();

  constructor() {
    this.startMonitoring();
  }

  public reportFFmpegMetrics(streamId: string, drops: number, speed: string, bufferWarn: boolean) {
    this.streamMetrics.set(streamId, { drops, speed, bufferWarn });
  }

  private startMonitoring() {
    this.updateInterval = setInterval(async () => {
      try {
        await this.calculateAndEmitHealth();
      } catch (err) {
        console.error('Error in HealthMonitor:', err);
      }
    }, 5000); // 5 seconds
  }

  private async calculateAndEmitHealth() {
    const states = await StreamState.find({ status: { $in: ['Live', 'Starting', 'Restarting', 'Error'] } });
    if (states.length === 0) return;

    // Get System Resources
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    
    const cpuUsage = Math.round(cpu.currentLoad);
    const memUsage = Math.round((mem.active / mem.total) * 100);

    const cpuHealth = cpuUsage > 90 ? 'Above 90%' : cpuUsage > 70 ? '70–90%' : 'Below 70%';
    const memHealth = memUsage > 90 ? 'Above 90%' : memUsage > 70 ? '70–90%' : 'Below 70%';

    for (const state of states) {
      const streamId = state.streamInstanceId.toString();
      const metrics = this.streamMetrics.get(streamId) || { drops: 0, speed: '1x', bufferWarn: false };
      
      let score = 100;
      let ffmpegH = 'Healthy';
      let qualH = 'Stable';
      let buffH = 'Normal';
      let ytH = 'Connected';
      
      if (state.status === 'Error' || state.status === 'Restarting') {
        score = 0;
        ffmpegH = 'Failed';
        ytH = 'Disconnected';
      } else {
        if (state.restartAttemptCount > 0) {
          score -= 20;
          ffmpegH = 'Warning';
        }
        if (metrics.drops > 0) {
          score -= 15;
          qualH = 'Fluctuating';
        }
        if (metrics.bufferWarn) {
          score -= 15;
          buffH = 'High Usage';
        }
        if (cpuUsage > 90) score -= 10;
        if (memUsage > 90) score -= 10;
        if (parseFloat(metrics.speed) < 0.9) {
          score -= 10;
          ytH = 'Unstable';
        }
      }

      score = Math.max(0, Math.min(100, score));

      let masterStatus = 'Excellent';
      if (score < 25) masterStatus = 'Critical';
      else if (score < 50) masterStatus = 'Degraded';
      else if (score < 75) masterStatus = 'Warning';
      else if (score < 90) masterStatus = 'Healthy';

      if (score < 25 && state.status === 'Live') {
         // Trigger auto-recovery
         io.emit('stream-alert', { streamId, level: 'Critical', message: 'Health dropped below 25%. Auto-recovering...' });
         console.log(`[Health Monitor] Stream ${streamId} critical health. Forcing restart.`);
         ffmpegService.stopStream(streamId, false).then(() => {
           // Provide a slight delay before triggering recovery 
           // Usually stopping gracefully handles it, but we can explicitly restart
           // if ffmpegService doesn't loop it
         });
      }

      state.health = {
        masterScore: score,
        masterStatus,
        youtube: { status: ytH },
        ffmpeg: { status: ffmpegH },
        videoSource: { status: 'Available' }, // Assumed available if Live
        playlist: { status: 'Healthy' },
        quality: { status: qualH },
        buffer: { status: buffH },
        cpu: { status: cpuHealth, usage: cpuUsage },
        memory: { status: memHealth, usage: memUsage },
        network: { status: 'Healthy' }, // Placeholder for advanced net metrics
        drive: { status: 'Connected' }
      };

      await state.save();
      
      // Emit real time specific health state
      io.emit('health-update', { streamId, health: state.health });
      
      // Reset ephemeral drops so we only penalize active drops
      this.streamMetrics.set(streamId, { ...metrics, drops: 0, bufferWarn: false });
    }
  }
}

export const healthMonitorService = new HealthMonitorService();
