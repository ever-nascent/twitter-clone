import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  getLoginHistory,
  getSuspiciousLoginHistory,
  getLoginStats,
} from '../controllers/loginHistoryController';

const router = express.Router();

// All login history routes require authentication
router.get('/', authenticate, getLoginHistory);
router.get('/suspicious', authenticate, getSuspiciousLoginHistory);
router.get('/stats', authenticate, getLoginStats);

export default router;
