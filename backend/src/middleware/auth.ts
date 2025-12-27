import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import { verifyToken } from '../utils/auth';
import { query } from '../config/database';

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

/**
 * Admin authorization middleware
 * Requires user to be authenticated AND have admin privileges
 * Must be used after authenticate() middleware
 */
export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Ensure user is authenticated (should be set by authenticate middleware)
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Check if user has admin privileges
    const result = await query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];

    if (!user.is_admin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    // User is admin, proceed
    next();
  } catch (error) {
    logger.error('Admin authorization error', { error });
    return res.status(500).json({
      success: false,
      error: 'Authorization check failed',
    });
  }
};
