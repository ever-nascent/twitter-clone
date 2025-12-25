import express from 'express';
import rateLimit from 'express-rate-limit';
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

// Rate limiter for auth endpoints (login, register, etc.)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: 'Too many attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter for token-based endpoints
 * SECURITY: Token brute-forcing prevention for verify-email and reset-password
 *
 * Tokens are typically 64 hex characters (32 bytes), providing 2^256 possibilities.
 * However, we still want to prevent automated brute force attempts.
 *
 * Limits: 10 attempts per hour per IP address
 * - More restrictive than auth endpoints
 * - Allows legitimate retries (typos, copy-paste errors)
 * - Prevents automated token guessing attacks
 */
const tokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts per hour
  message: 'Too many token verification attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes - protected with CSRF
router.post('/register', csrfProtection, authLimiter, register);
router.post('/login', csrfProtection, authLimiter, login);
router.post('/refresh', csrfProtection, refreshAccessToken);

// Email verification routes - protected with CSRF and rate limiting
router.post('/verify-email', csrfProtection, tokenLimiter, verifyEmail);
router.post('/resend-verification', csrfProtection, authLimiter, resendVerificationEmail);

// Password reset routes - protected with CSRF and rate limiting
router.post('/forgot-password', csrfProtection, authLimiter, forgotPassword);
router.post('/reset-password', csrfProtection, tokenLimiter, resetPassword);

// Protected routes - protected with CSRF
router.post('/logout', csrfProtection, authenticate, logout);
router.get('/me', authenticate, getCurrentUser);

export default router;
