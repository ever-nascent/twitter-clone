import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  generateCodes,
  getStatus,
  verifyCode,
  deleteCodes,
} from '../controllers/recoveryCodesController';

const router = express.Router();

// Most recovery code routes require authentication
router.post('/generate', authenticate, generateCodes);
router.get('/status', authenticate, getStatus);
router.delete('/', authenticate, deleteCodes);

// Verify route (used during account recovery - no auth required)
router.post('/verify', verifyCode);

export default router;
