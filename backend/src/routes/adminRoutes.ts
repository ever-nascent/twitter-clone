import express from 'express';
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
} from '../controllers/adminController';

const router = express.Router();

// All admin routes require authentication AND admin privileges
// authenticate() verifies the JWT token
// requireAdmin() checks that user has is_admin = true in database

// User management
router.get('/users', authenticate, requireAdmin, getAllUsers);
router.get('/users/:id', authenticate, requireAdmin, getUserById);
router.put('/users/:id', csrfProtection, authenticate, requireAdmin, updateUser);
router.delete('/users/:id', csrfProtection, authenticate, requireAdmin, deleteUser);

// User actions - protected with CSRF
router.post('/users/:id/unlock', csrfProtection, authenticate, requireAdmin, unlockUser);
router.post('/users/:id/verify-email', csrfProtection, authenticate, requireAdmin, verifyUserEmail);
router.post('/users/:id/reset-password', csrfProtection, authenticate, requireAdmin, resetUserPassword);

// Statistics
router.get('/stats', authenticate, requireAdmin, getStats);

export default router;
