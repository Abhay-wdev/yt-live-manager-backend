import express from 'express';
import { createPlaylist, getPlaylists, getPlaylistItems, addPlaylistItem, removePlaylistItem, updateItemOrder, deletePlaylist } from '../controllers/playlistController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/', protect, createPlaylist);
router.get('/', protect, getPlaylists);
router.delete('/:id', protect, deletePlaylist);
router.get('/:id/items', protect, getPlaylistItems);
router.post('/:id/items', protect, addPlaylistItem);
router.delete('/:id/items/:itemId', protect, removePlaylistItem);
router.put('/:id/items/order', protect, updateItemOrder);

export default router;
