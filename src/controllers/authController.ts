import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { config } from '../config/env';

const generateToken = (id: string) => {
  return jwt.sign({ id }, config.jwtSecret, { expiresIn: '30d' });
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await (user as any).matchPassword(password))) {
      if ((user as any).status === 'pending') {
        res.status(403).json({ message: 'Your account is pending admin approval.' });
        return;
      }
      if ((user as any).status === 'rejected') {
        res.status(403).json({ message: 'Your account has been rejected.' });
        return;
      }
      
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: (user as any).status,
        token: generateToken(user._id.toString()),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'user',
      status: 'pending' // Force pending status for new registrations
    });

    res.status(201).json({
      message: 'Registration successful! Your account is pending admin approval.',
      _id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  const { oldPassword, newPassword } = req.body;
  const userId = (req as any).user._id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (!(await (user as any).matchPassword(oldPassword))) {
      res.status(401).json({ message: 'Incorrect old password' });
      return;
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById((req as any).user._id).select('-password');
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Seed default admin user if none exists
export const seedAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      res.status(400).json({ message: 'Admin already exists' });
      return;
    }

    const admin = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
      status: 'approved',
    });

    res.status(201).json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      token: generateToken(admin._id.toString()),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
