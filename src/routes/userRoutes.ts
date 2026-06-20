import express from 'express';
import { getUsers, updateUserStatus, adminResetPassword, deleteUser } from '../controllers/userController';
import { protect, admin } from '../middlewares/authMiddleware';

const router = express.Router();

// All user routes are protected and restricted to admin
router.use(protect, admin);

router.route('/')
  .get(getUsers);

router.route('/:id/status')
  .put(updateUserStatus);

router.route('/:id/reset-password')
  .put(adminResetPassword);

router.route('/:id')
  .delete(deleteUser);

export default router;
