import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  getAllUsers,
  getUserById,
  updateUser,
  unlockUser,
  verifyUserEmail,
  deleteUser,
  getStats,
  resetUserPassword,
} from '../controllers/adminController';

const router = express.Router();

/**
 * Admin Rate Limiting Strategy:
 * - More permissive than public endpoints (100 requests per 15 minutes)
 * - Admin routes are already protected by authentication + admin privilege checks
 * - Prevents accidental DoS from automated admin scripts
 * - Allows legitimate admin operations without friction
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes (NIST upper bound)
  message: 'Too many admin requests. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  // Admin endpoints are already behind authentication, so this is defense in depth
});

// All admin routes require authentication AND admin privileges
// authenticate() verifies the JWT token
// requireAdmin() checks that user has is_admin = true in database

// Apply admin rate limiter to all routes
router.use(adminLimiter);

// User management
router.get('/users', authenticate, requireAdmin, getAllUsers);
router.get('/users/:id', authenticate, requireAdmin, getUserById);
router.put('/users/:id', authenticate, requireAdmin, updateUser);
router.delete('/users/:id', authenticate, requireAdmin, deleteUser);

// User actions
router.post('/users/:id/unlock', authenticate, requireAdmin, unlockUser);
router.post('/users/:id/verify-email', authenticate, requireAdmin, verifyUserEmail);
router.post('/users/:id/reset-password', authenticate, requireAdmin, resetUserPassword);

// Statistics
router.get('/stats', authenticate, requireAdmin, getStats);

export default router;
