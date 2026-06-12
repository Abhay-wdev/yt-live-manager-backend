import express from 'express';
import { loginUser, getProfile, seedAdmin } from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/login', loginUser);
router.get('/seed', seedAdmin);
router.get('/profile', protect, getProfile);

export default router;
