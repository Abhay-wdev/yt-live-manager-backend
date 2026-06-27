import cron from 'node-cron';
import ImageStreamConfig from '../models/ImageStreamConfig';
import { imageStreamService } from './ImageStreamService';
import { YoutubeAccount } from '../models/YoutubeAccount';
import { ImageAsset } from '../models/ImageAsset';

class StreamScheduler {
  constructor() {
    // Run every minute
    cron.schedule('* * * * *', () => {
      this.checkSchedules();
    });
  }

  private async checkSchedules() {
    try {
      const now = new Date();
      const currentHour = now.getHours().toString().padStart(2, '0');
      const currentMinute = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${currentHour}:${currentMinute}`; // e.g. "14:30"

      const scheduledStreams = await ImageStreamConfig.find({ isScheduled: true }).populate('youtubeAccountId');

      for (const stream of scheduledStreams) {
        if (!stream.youtubeAccountId) continue;

        if (stream.scheduleType === 'One-Time') {
          await this.handleOneTimeSchedule(stream, now);
        } else if (stream.scheduleType === 'Recurring') {
          await this.handleRecurringSchedule(stream, currentTimeStr);
        }
      }
    } catch (error) {
      console.error('Error in StreamScheduler:', error);
    }
  }

  private async handleOneTimeSchedule(stream: any, now: Date) {
    if (stream.startTime && stream.stopTime) {
      if (now >= stream.startTime && now < stream.stopTime && stream.status !== 'Live' && stream.status !== 'Restarting') {
        await this.startStreamHelper(stream);
      } else if (now >= stream.stopTime && stream.status !== 'Stopped') {
        await this.stopStreamHelper(stream);
        // Turn off schedule after completion
        stream.isScheduled = false;
        await stream.save();
      }
    }
  }

  private async handleRecurringSchedule(stream: any, currentTimeStr: string) {
    if (stream.dailyStartTime && stream.dailyStopTime) {
      // Handle overnight schedules (e.g. 22:00 to 02:00)
      let isWithinTimeRange = false;
      if (stream.dailyStartTime < stream.dailyStopTime) {
        isWithinTimeRange = currentTimeStr >= stream.dailyStartTime && currentTimeStr < stream.dailyStopTime;
      } else {
        // e.g. 23:00 to 02:00. It's within range if it's >= 23:00 OR < 02:00
        isWithinTimeRange = currentTimeStr >= stream.dailyStartTime || currentTimeStr < stream.dailyStopTime;
      }

      if (isWithinTimeRange && stream.status !== 'Live' && stream.status !== 'Restarting') {
        await this.startStreamHelper(stream);
      } else if (!isWithinTimeRange && stream.status !== 'Stopped') {
        await this.stopStreamHelper(stream);
      }
    }
  }

  private async startStreamHelper(stream: any) {
    try {
      const account = stream.youtubeAccountId as any;
      // We need imagePath. We don't store it in config, but ImageAsset has it.
      // Need to populate imageAsset or fetch it here.
      const imageAsset = await ImageAsset.findById(stream.imageId);
      if (!imageAsset) return;

      const imagePath = imageAsset.path;
      
      await imageStreamService.startStream(
        stream.streamId,
        stream.imageId.toString(),
        account._id.toString(),
        imagePath,
        account.streamKey,
        stream.resolution,
        stream.fps.toString()
      );
      console.log(`Scheduler started stream ${stream.streamId}`);
    } catch (error) {
      console.error(`Scheduler failed to start stream ${stream.streamId}:`, error);
    }
  }

  private async stopStreamHelper(stream: any) {
    try {
      await imageStreamService.stopStream(stream.streamId);
      console.log(`Scheduler stopped stream ${stream.streamId}`);
    } catch (error) {
      console.error(`Scheduler failed to stop stream ${stream.streamId}:`, error);
    }
  }
}

export const streamScheduler = new StreamScheduler();
