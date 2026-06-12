import cron from 'node-cron';
import { Schedule } from '../models/Schedule';
import { ffmpegService } from './FFmpegService';
import { StreamInstance } from '../models/Stream';

export class ScheduleService {
  constructor() {
    this.init();
  }

  private init() {
    cron.schedule('* * * * *', async () => {
      console.log('Checking schedules...');
      await this.checkSchedules();
    });
  }

  private async checkSchedules() {
    const now = new Date();
    
    try {
      const schedules = await Schedule.find({ enabled: true });
      for (const schedule of schedules) {
        if (schedule.scheduleType === 'one-time' && schedule.startTime) {
          if (now >= schedule.startTime && now <= new Date(schedule.startTime.getTime() + 60000)) {
            const instance = await StreamInstance.findById(schedule.streamInstanceId);
            if (instance) {
              console.log(`Starting scheduled stream for instance ${instance.name}`);
              try {
                await ffmpegService.startStream(instance._id.toString());
                schedule.enabled = false;
                await schedule.save();
              } catch (e: any) {
                console.error(`Failed to start scheduled stream: ${e.message}`);
              }
            }
          }
        }
        
        if (schedule.endTime) {
          if (now >= schedule.endTime && now <= new Date(schedule.endTime.getTime() + 60000)) {
            console.log(`Stopping scheduled stream for instance ${schedule.streamInstanceId}`);
            await ffmpegService.stopStream(schedule.streamInstanceId.toString());
          }
        }
      }
    } catch (e) {
      console.error('Error in schedule checker', e);
    }
  }
}

export const scheduleService = new ScheduleService();
