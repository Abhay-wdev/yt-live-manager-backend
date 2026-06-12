import express from 'express';
import { getAccounts, createAccount, deleteAccount } from '../controllers/youtubeAccountController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.route('/').get(protect, getAccounts).post(protect, createAccount);
router.route('/:id').delete(protect, deleteAccount);

export default router;
