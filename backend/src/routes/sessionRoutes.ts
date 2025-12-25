import { Router } from 'express';
import {
  getSessions,
  deleteSession,
  deleteOtherSessionsController,
} from '../controllers/sessionController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * Session Management Routes
 *
 * All routes require authentication
 */

// Get all active sessions
router.get('/', authenticateToken, getSessions);

// Delete a specific session (remote logout)
router.delete('/:id', authenticateToken, deleteSession);

// Delete all other sessions (logout from all other devices)
router.delete('/others/all', authenticateToken, deleteOtherSessionsController);

export default router;
