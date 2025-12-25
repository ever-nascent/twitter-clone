import express from 'express';
import { authenticate } from '../middleware/auth';
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

// For now, all admin routes require authentication
// In the future, you can add a specific admin role check middleware

// User management
router.get('/users', authenticate, getAllUsers);
router.get('/users/:id', authenticate, getUserById);
router.put('/users/:id', authenticate, updateUser);
router.delete('/users/:id', authenticate, deleteUser);

// User actions
router.post('/users/:id/unlock', authenticate, unlockUser);
router.post('/users/:id/verify-email', authenticate, verifyUserEmail);
router.post('/users/:id/reset-password', authenticate, resetUserPassword);

// Statistics
router.get('/stats', authenticate, getStats);

export default router;
