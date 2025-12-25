import { Router } from 'express';
import {
  getSessions,
  deleteSession,
  deleteOtherSessionsController,
} from '../controllers/sessionController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * Session Management Routes
 *
 * All routes require authentication
 */

// Get all active sessions
router.get('/', authenticate, getSessions);

// Delete a specific session (remote logout)
router.delete('/:id', authenticate, deleteSession);

// Delete all other sessions (logout from all other devices)
router.delete('/others/all', authenticate, deleteOtherSessionsController);

export default router;
