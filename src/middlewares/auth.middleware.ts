import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';

/**
 * Middleware to require a valid JWT token
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Bearer token missing.',
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: error.message,
    });
  }
}

/**
 * Optional JWT authentication (attaches user if valid token present, otherwise continues)
 */
export function optionalJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = authService.verifyToken(token);
      req.user = decoded;
    } catch {
      // Ignore invalid token for optional auth
    }
  }

  next();
}

/**
 * Middleware to require ADMIN role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Administrator privileges required.',
    });
  }
  next();
}
