import express from 'express';
import { createSchedule, getSchedules, updateSchedule, deleteSchedule } from '../controllers/scheduleController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/', protect, createSchedule);
router.get('/', protect, getSchedules);
router.put('/:id', protect, updateSchedule);
router.delete('/:id', protect, deleteSchedule);

export default router;
