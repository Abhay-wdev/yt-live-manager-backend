import { Request, Response } from 'express';
import { ImageAsset } from '../models/ImageAsset';
import { YoutubeAccount } from '../models/YoutubeAccount';
import { imageStreamService } from '../services/ImageStreamService';
import fs from 'fs';
import path from 'path';

export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No image file uploaded' });
      return;
    }

    const { originalname, filename, path: filepath } = req.file;
    const url = `/uploads/images/${filename}`;

    const newImage = await ImageAsset.create({
      name: originalname,
      path: filepath,
      url: url
    });

    res.status(201).json(newImage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllImages = async (req: Request, res: Response): Promise<void> => {
  try {
    const images = await ImageAsset.find().sort({ createdAt: -1 });
    res.json(images);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const renameImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ message: 'New name is required' });
      return;
    }

    const updatedImage = await ImageAsset.findByIdAndUpdate(req.params.id, { name }, { new: true });
    if (!updatedImage) {
      res.status(404).json({ message: 'Image not found' });
      return;
    }

    res.json(updatedImage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const image = await ImageAsset.findById(req.params.id);
    if (!image) {
      res.status(404).json({ message: 'Image not found' });
      return;
    }

    // Attempt to delete physical file
    if (fs.existsSync(image.path)) {
      fs.unlinkSync(image.path);
    }

    await ImageAsset.findByIdAndDelete(req.params.id);
    res.json({ message: 'Image deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const startImageStream = async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageId, youtubeAccountId, resolution = '1080p', fps = '30' } = req.body;

    if (!imageId || !youtubeAccountId) {
      res.status(400).json({ message: 'imageId and youtubeAccountId are required' });
      return;
    }

    const image = await ImageAsset.findById(imageId);
    if (!image) {
      res.status(404).json({ message: 'Image not found' });
      return;
    }

    const account = await YoutubeAccount.findById(youtubeAccountId);
    if (!account || !account.streamKey) {
      res.status(404).json({ message: 'YouTube account not found or missing stream key' });
      return;
    }

    const streamId = `${youtubeAccountId}_${imageId}`;
    await imageStreamService.startStream(streamId, image._id.toString(), account._id.toString(), image.path, account.streamKey, resolution, fps);
    res.json({ message: 'Stream started', streamId });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const stopImageStream = async (req: Request, res: Response): Promise<void> => {
  try {
    const { streamId } = req.body;
    if (!streamId) {
      res.status(400).json({ message: 'streamId is required' });
      return;
    }
    await imageStreamService.stopStream(streamId);
    res.json({ message: 'Stream stopped' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getImageStreamStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const activeStreams = imageStreamService.getActiveStreams();
    res.json({ activeStreams });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
