import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireAdmin } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import {
  getAllUsers,
  getUserById,
  updateUser,
  unlockUser,
  verifyUserEmail,
  deleteUser,
  getStats,
  resetUserPassword,
  forcePasswordReset,
  getUserSecurityStatus,
  getAllSuspiciousLogins,
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
router.put('/users/:id', csrfProtection, authenticate, requireAdmin, updateUser);
router.delete('/users/:id', csrfProtection, authenticate, requireAdmin, deleteUser);

// User actions - protected with CSRF
router.post('/users/:id/unlock', csrfProtection, authenticate, requireAdmin, unlockUser);
router.post('/users/:id/verify-email', csrfProtection, authenticate, requireAdmin, verifyUserEmail);
router.post('/users/:id/reset-password', csrfProtection, authenticate, requireAdmin, resetUserPassword);
router.post('/users/:id/force-password-reset', csrfProtection, authenticate, requireAdmin, forcePasswordReset);

// Security status
router.get('/users/:id/security-status', authenticate, requireAdmin, getUserSecurityStatus);

// Security monitoring
router.get('/security/suspicious-logins', authenticate, requireAdmin, getAllSuspiciousLogins);

// Statistics
router.get('/stats', authenticate, requireAdmin, getStats);

export default router;
