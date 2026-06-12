import { Request, Response } from 'express';
import { ffmpegService } from '../services/FFmpegService';
import { StreamInstance, StreamState } from '../models/Stream';

export const getStreamInstances = async (req: Request, res: Response): Promise<void> => {
  try {
    const instances = await StreamInstance.find().populate('youtubeAccountId').populate('playlistId');
    res.json(instances);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createStreamInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const instance = await StreamInstance.create(req.body);
    res.status(201).json(instance);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateStreamInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const instance = await StreamInstance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(instance);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteStreamInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    await StreamInstance.findByIdAndDelete(req.params.id);
    await StreamState.findOneAndDelete({ streamInstanceId: req.params.id });
    res.json({ message: 'Stream instance deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const startStream = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await ffmpegService.startStream(id);
    res.json({ message: 'Stream started' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const stopStream = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await ffmpegService.stopStream(id);
    res.json({ message: 'Stream stopped' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllStreamStates = async (req: Request, res: Response): Promise<void> => {
  try {
    const states = await StreamState.find()
      .populate('streamInstanceId')
      .populate('currentVideoId');
    res.json(states);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getStreamLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { StreamLog } = await import('../models/Stream');
    const logs = await StreamLog.find({ streamInstanceId: req.params.id })
                                .sort({ timestamp: -1 })
                                .limit(100);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const duplicateStreamInstance = async (req: Request, res: Response): Promise<void> => {
  try {
    const parent = await StreamInstance.findById(req.params.id);
    if (!parent) { res.status(404).json({ message: 'Parent not found' }); return; }
    
    const { name, youtubeAccountId } = req.body;
    
    const clone = await StreamInstance.create({
      name: name || `${parent.name} (Copy)`,
      youtubeAccountId: youtubeAccountId || parent.youtubeAccountId,
      playlistId: parent.playlistId,
      qualityProfile: parent.qualityProfile,
      videoLoopCount: parent.videoLoopCount,
      playlistLoopCount: parent.playlistLoopCount,
      autoRestart: parent.autoRestart,
      maxRestartAttempts: parent.maxRestartAttempts,
      restartDelaySeconds: parent.restartDelaySeconds,
      resumeMode: parent.resumeMode,
      customSettings: parent.customSettings
    });
    
    res.status(201).json(clone);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const bulkStartStreams = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) { res.status(400).json({ message: 'Ids must be an array' }); return; }
    
    for (const id of ids) {
      await ffmpegService.startStream(id).catch(e => console.error(`Bulk start error for ${id}:`, e));
    }
    res.json({ message: 'Bulk start initiated' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const bulkStopStreams = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) { res.status(400).json({ message: 'Ids must be an array' }); return; }
    
    for (const id of ids) {
      await ffmpegService.stopStream(id, true).catch(e => console.error(`Bulk stop error for ${id}:`, e));
    }
    res.json({ message: 'Bulk stop initiated' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const bulkDeleteStreams = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) { res.status(400).json({ message: 'Ids must be an array' }); return; }
    
    for (const id of ids) {
      await ffmpegService.stopStream(id, true).catch(() => {});
      await StreamInstance.findByIdAndDelete(id);
      await StreamState.findOneAndDelete({ streamInstanceId: id });
    }
    res.json({ message: 'Bulk delete initiated' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
