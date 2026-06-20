import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
  const { status } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Optional: Prevent changing status of main admin
    if (user.role === 'admin' && user.email === 'admin@example.com') {
      res.status(400).json({ message: 'Cannot modify primary admin status' });
      return;
    }

    (user as any).status = status;
    await user.save();

    res.json({ message: 'User status updated', user: { _id: user._id, name: user.name, status: (user as any).status } });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const adminResetPassword = async (req: Request, res: Response): Promise<void> => {
  const { newPassword } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'User password reset successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.role === 'admin' && user.email === 'admin@example.com') {
      res.status(400).json({ message: 'Cannot delete the primary admin account' });
      return;
    }

    await User.deleteOne({ _id: user._id });
    res.json({ message: 'User removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
