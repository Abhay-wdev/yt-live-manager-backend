import { Request, Response } from 'express';
import { Video } from '../models/Video';

export const uploadLocalVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const { title, description } = req.body;

    const video = await Video.create({
      title: title || req.file.originalname,
      description,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      sourceType: 'local',
    });

    res.status(201).json(video);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const addGoogleDriveVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, driveLink } = req.body;

    if (!driveLink) {
      res.status(400).json({ message: 'Drive link is required' });
      return;
    }

    // Basic extraction of file ID from a standard sharing link
    // Example: https://drive.google.com/file/d/1A2B3C4D5E6F/view?usp=sharing
    let fileId = '';
    const match = driveLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      fileId = match[1];
    } else {
      // It might be an id= format
      const url = new URL(driveLink);
      fileId = url.searchParams.get('id') || '';
    }

    if (!fileId) {
      res.status(400).json({ message: 'Invalid Google Drive link format' });
      return;
    }

    // The raw download URL for ffmpeg
    const directPath = `https://drive.google.com/uc?export=download&id=${fileId}`;

    const video = await Video.create({
      title: title || `Drive Video - ${fileId}`,
      description,
      path: directPath, // we'll use this direct path for ffmpeg later
      sourceType: 'google-drive',
    });

    res.status(201).json(video);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getVideos = async (req: Request, res: Response): Promise<void> => {
  try {
    const videos = await Video.find({}).sort({ createdAt: -1 });
    res.json(videos);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }

    // If local, optionally delete the file from fs here
    if (video.sourceType === 'local') {
      const fs = require('fs');
      if (fs.existsSync(video.path)) {
        fs.unlinkSync(video.path);
      }
    }

    await video.deleteOne();
    res.json({ message: 'Video removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
