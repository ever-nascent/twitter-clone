import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { verifyToken } from '../utils/auth';

/**
 * Authentication middleware
 * Verifies JWT token from cookies and attaches user info to request
 */
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from cookie
    const token = req.cookies.accessToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Verify token
    const payload = verifyToken(token);

    // Attach user info to request
    req.user = {
      userId: payload.userId,
      username: payload.username,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user info if token is valid, but doesn't require it
 */
export const optionalAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.accessToken;

    if (token) {
      const payload = verifyToken(token);
      req.user = {
        userId: payload.userId,
        username: payload.username,
      };
    }

    next();
  } catch (error) {
    // If token is invalid, just continue without user
    next();
  }
};
