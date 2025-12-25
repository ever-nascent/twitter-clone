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

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: 'Too many attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes - protected with CSRF
router.post('/register', csrfProtection, authLimiter, register);
router.post('/login', csrfProtection, authLimiter, login);
router.post('/refresh', csrfProtection, refreshAccessToken);

// Email verification routes - protected with CSRF
router.post('/verify-email', csrfProtection, verifyEmail);
router.post('/resend-verification', csrfProtection, authLimiter, resendVerificationEmail);

// Password reset routes - protected with CSRF
router.post('/forgot-password', csrfProtection, authLimiter, forgotPassword);
router.post('/reset-password', csrfProtection, resetPassword);

// Protected routes - protected with CSRF
router.post('/logout', csrfProtection, authenticate, logout);
router.get('/me', authenticate, getCurrentUser);

export default router;
