import express from 'express';
import { 
  startStream, 
  stopStream, 
  getAllStreamStates, 
  getStreamInstances, 
  createStreamInstance, 
  updateStreamInstance, 
  deleteStreamInstance,
  getStreamLogs,
  duplicateStreamInstance,
  bulkStartStreams,
  bulkStopStreams,
  bulkDeleteStreams
} from '../controllers/streamController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/bulk/start', protect, bulkStartStreams);
router.post('/bulk/stop', protect, bulkStopStreams);
router.post('/bulk/delete', protect, bulkDeleteStreams);

router.route('/instances').get(protect, getStreamInstances).post(protect, createStreamInstance);
router.route('/instances/:id').get(protect, getStreamInstances).put(protect, updateStreamInstance).delete(protect, deleteStreamInstance);
router.route('/instances/:id/logs').get(protect, getStreamLogs);
router.route('/instances/:id/duplicate').post(protect, duplicateStreamInstance);

router.route('/states').get(protect, getAllStreamStates);

router.post('/:id/start', protect, startStream);
router.post('/:id/stop', protect, stopStream);

export default router;
