import { Request, Response } from 'express';
import { Schedule } from '../models/Schedule';

export const createSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const schedule = await Schedule.create(req.body);
    res.status(201).json(schedule);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getSchedules = async (req: Request, res: Response): Promise<void> => {
  try {
    const schedules = await Schedule.find({}).populate('playlistId').sort({ createdAt: -1 });
    res.json(schedules);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const schedule = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(schedule);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    await Schedule.findByIdAndDelete(req.params.id);
    res.json({ message: 'Schedule deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
