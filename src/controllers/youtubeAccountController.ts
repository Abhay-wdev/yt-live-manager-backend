import { Request, Response } from 'express';
import { YoutubeAccount } from '../models/Stream'; // Assuming it's exported there, wait I created it in YoutubeAccount.ts

export const getAccounts = async (req: Request, res: Response) => {
  try {
    const { YoutubeAccount } = await import('../models/YoutubeAccount');
    const accounts = await YoutubeAccount.find();
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createAccount = async (req: Request, res: Response) => {
  try {
    const { YoutubeAccount } = await import('../models/YoutubeAccount');
    const account = await YoutubeAccount.create(req.body);
    res.status(201).json(account);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const { YoutubeAccount } = await import('../models/YoutubeAccount');
    await YoutubeAccount.findByIdAndDelete(req.params.id);
    res.json({ message: 'Account deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
