import express from 'express';
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

// All admin routes require authentication AND admin privileges
// authenticate() verifies the JWT token
// requireAdmin() checks that user has is_admin = true in database

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
