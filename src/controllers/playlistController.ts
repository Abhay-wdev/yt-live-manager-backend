import { Request, Response } from 'express';
import { Playlist, PlaylistItem } from '../models/Playlist';

export const createPlaylist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    const playlist = await Playlist.create({ name, description });
    res.status(201).json(playlist);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getPlaylists = async (req: Request, res: Response): Promise<void> => {
  try {
    const playlists = await Playlist.find({}).sort({ createdAt: -1 });
    res.json(playlists);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getPlaylistItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await PlaylistItem.find({ playlistId: req.params.id })
      .populate('videoId')
      .sort({ order: 1 });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const addPlaylistItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.body;
    const playlistId = req.params.id as string;

    // Get max order
    const lastItem = await PlaylistItem.findOne({ playlistId }).sort({ order: -1 });
    const order = lastItem ? lastItem.order + 1 : 1;

    const item = await PlaylistItem.create({ playlistId, videoId, order });
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const removePlaylistItem = async (req: Request, res: Response): Promise<void> => {
  try {
    await PlaylistItem.findByIdAndDelete(req.params.itemId);
    res.json({ message: 'Item removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateItemOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body; // array of { id, order }
    
    for (const item of items) {
      await PlaylistItem.findByIdAndUpdate(item.id, { order: item.order });
    }
    
    res.json({ message: 'Order updated' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deletePlaylist = async (req: Request, res: Response): Promise<void> => {
  try {
    const playlistId = req.params.id;
    await Playlist.findByIdAndDelete(playlistId);
    await PlaylistItem.deleteMany({ playlistId });
    res.json({ message: 'Playlist deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
