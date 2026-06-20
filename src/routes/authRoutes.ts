import express from 'express';
import { loginUser, getProfile, seedAdmin, registerUser, changePassword } from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/change-password', protect, changePassword);
router.get('/seed', seedAdmin);
router.get('/profile', protect, getProfile);

export default router;
