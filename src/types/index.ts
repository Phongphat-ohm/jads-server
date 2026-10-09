import { Request } from 'express';

export interface AuthUser {
  id: string;
  username: string;
  role: 'USER' | 'ADMIN';
  fullName?: string | null;
  courtName?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
