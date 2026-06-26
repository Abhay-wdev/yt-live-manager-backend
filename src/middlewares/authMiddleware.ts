import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { config } from '../config/env';

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Authentication completely bypassed. Assigning a dummy admin user to all requests.
  (req as any).user = {
    _id: "bypass-auth-id",
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
    status: "approved"
  };
  next();
};

export const admin = (req: Request, res: Response, next: NextFunction): void => {
  // Everyone is admin now
  next();
};
