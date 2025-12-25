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

const router = express.Router();

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: 'Too many attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refreshAccessToken);

// Email verification routes
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', authLimiter, resendVerificationEmail);

// Password reset routes
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getCurrentUser);

export default router;
