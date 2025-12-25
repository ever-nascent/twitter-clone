import express from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import {
  register,
  login,
  logout,
  getCurrentUser,
  refreshAccessToken,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';

const router = express.Router();

/**
 * Rate Limiting Strategy (aligned with industry standards):
 * - Login/Register: 10 attempts per 15 minutes (matches Apple's 10-attempt standard)
 * - Progressive delays: Slows down requests after 5 attempts (UX improvement over hard limits)
 * - OWASP recommends 3-10 attempts; NIST allows up to 100
 * - Apple uses 10 attempts with escalating delays
 *
 * Security considerations:
 * - trustProxy must be configured in production (see server.ts)
 * - Rate limits apply per IP address
 * - Stricter than our previous 5/15min, but more UX-friendly with progressive delays
 * - CSRF protection added to all state-changing endpoints
 */

// Progressive delay middleware - starts slowing down after 5 attempts
// Adds increasing delays: 500ms, 1000ms, 1500ms, etc. (max 10 seconds)
const authSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 5, // Allow 5 fast requests, then start slowing down
  delayMs: (hits) => (hits - 5) * 500, // Add 500ms per request after the 5th
  maxDelayMs: 10000, // Maximum delay of 10 seconds
});

// Hard rate limiter - blocks after 10 attempts
// This is our second line of defense after progressive delays
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes (matches Apple's device login standard)
  message: 'Too many login attempts. Please try again in 15 minutes.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip successful requests - only count failed attempts
  // Note: This requires custom logic in the controller to decrement on success
  skipSuccessfulRequests: false, // Set to true in production with Redis store
});

// Rate limiter for token refresh endpoint
// More permissive than login (users refresh tokens frequently)
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 refreshes per 15 minutes
  message: 'Too many token refresh requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

<<<<<<< HEAD
<<<<<<< HEAD
// Public routes - protected with CSRF
router.post('/register', csrfProtection, authLimiter, register);
router.post('/login', csrfProtection, authLimiter, login);
router.post('/refresh', csrfProtection, refreshAccessToken);
=======
=======
>>>>>>> origin/claude/fix-auth-rate-limiting-41okR
// Rate limiter for password reset requests
// Stricter to prevent abuse and email spam
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 password reset emails per hour
  message: 'Too many password reset requests. Please try again in an hour.',
  standardHeaders: true,
  legacyHeaders: false,
});

<<<<<<< HEAD
// Public routes - combine progressive delays with hard limits
router.post('/register', authSlowDown, authLimiter, register);
router.post('/login', authSlowDown, authLimiter, login);
router.post('/refresh', refreshLimiter, refreshAccessToken); // Now protected!
>>>>>>> origin/claude/fix-auth-rate-limiting-41okR
=======
// Public routes - combine CSRF protection, progressive delays, and hard limits
router.post('/register', csrfProtection, authSlowDown, authLimiter, register);
router.post('/login', csrfProtection, authSlowDown, authLimiter, login);
router.post('/refresh', csrfProtection, refreshLimiter, refreshAccessToken); // Now protected!
>>>>>>> origin/claude/fix-auth-rate-limiting-41okR

// Email verification routes - protected with CSRF
router.post('/verify-email', csrfProtection, verifyEmail);
router.post('/resend-verification', csrfProtection, authLimiter, resendVerificationEmail);

<<<<<<< HEAD
<<<<<<< HEAD
// Password reset routes - protected with CSRF
router.post('/forgot-password', csrfProtection, authLimiter, forgotPassword);
router.post('/reset-password', csrfProtection, resetPassword);
=======
// Password reset routes - use stricter limits to prevent abuse
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
>>>>>>> origin/claude/fix-auth-rate-limiting-41okR
=======
// Password reset routes - use stricter limits to prevent abuse
router.post('/forgot-password', csrfProtection, passwordResetLimiter, forgotPassword);
router.post('/reset-password', csrfProtection, authLimiter, resetPassword);
>>>>>>> origin/claude/fix-auth-rate-limiting-41okR

// Protected routes - protected with CSRF
router.post('/logout', csrfProtection, authenticate, logout);
router.get('/me', authenticate, getCurrentUser);

export default router;
