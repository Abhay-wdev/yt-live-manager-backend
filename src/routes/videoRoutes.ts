import express from 'express';
import { uploadLocalVideo, addGoogleDriveVideo, getVideos, deleteVideo, updateVideo, recordGame } from '../controllers/videoController';
import { protect } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/uploadMiddleware';
import fs from 'fs';

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const router = express.Router();

router.post('/record-game', protect, recordGame);
router.post('/local', protect, upload.single('video'), uploadLocalVideo);
router.post('/drive', protect, addGoogleDriveVideo);
router.get('/', protect, getVideos);
router.put('/:id', protect, updateVideo);
router.delete('/:id', protect, deleteVideo);

export default router;
