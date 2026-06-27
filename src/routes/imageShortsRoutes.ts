import express from 'express';
import { uploadImage, getAllImages, renameImage, deleteImage, startImageStream, stopImageStream, getImageStreamStatus } from '../controllers/imageShortsController';
import { imageUpload } from '../middlewares/imageUploadMiddleware';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/upload', protect, imageUpload.single('image'), uploadImage);
router.get('/', protect, getAllImages);
router.put('/:id', protect, renameImage);
router.delete('/:id', protect, deleteImage);

router.post('/stream/start', protect, startImageStream);
router.post('/stream/stop', protect, stopImageStream);
router.get('/stream/status', protect, getImageStreamStatus);

export default router;
