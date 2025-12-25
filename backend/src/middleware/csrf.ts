import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';

/**
 * CSRF Protection Middleware
 *
 * Uses double-submit cookie pattern:
 * 1. Server sends CSRF token via cookie (httpOnly) and response
 * 2. Client stores token and sends it in request header
 * 3. Server validates that cookie token matches header token
 *
 * This protects against CSRF attacks even if sameSite cookie protection
 * is bypassed (e.g., older browsers, certain attack vectors)
 */

// Configure CSRF protection
const {
  generateToken, // Generates CSRF token
  doubleCsrfProtection, // Middleware to validate CSRF token
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'your-csrf-secret-change-in-production',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
  size: 64, // Token size in bytes
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'], // Methods that don't need CSRF protection
  getTokenFromRequest: (req) => {
    // Check multiple sources for CSRF token
    return (
      req.headers['x-csrf-token'] as string ||
      req.headers['x-xsrf-token'] as string ||
      req.body?._csrf ||
      req.query?._csrf as string
    );
  },
});

/**
 * Middleware to generate and send CSRF token to client
 * Use this on a GET endpoint that the frontend calls on app load
 */
export const generateCsrfToken = (req: Request, res: Response) => {
  const token = generateToken(req, res);
  res.json({
    success: true,
    csrfToken: token,
  });
};

/**
 * CSRF Protection middleware
 * Apply this to routes that perform state-changing operations
 */
export const csrfProtection = doubleCsrfProtection;

/**
 * Error handler for CSRF validation failures
 * Should be added after routes that use CSRF protection
 */
export const csrfErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err.code === 'EBADCSRFTOKEN' || err.message?.includes('csrf')) {
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token. Please refresh the page and try again.',
    });
  }
  next(err);
};
