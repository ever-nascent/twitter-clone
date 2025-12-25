import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  setup2FA,
  enable2FA,
  disable2FA,
  verify2FA,
  verifyBackupCodeLogin,
  regenerateBackupCodes,
  get2FAStatus,
} from '../controllers/twoFactorController';

const router = express.Router();

// All 2FA routes require authentication (except verify endpoints used during login)
// Setup and management routes
router.post('/setup', authenticate, setup2FA);
router.post('/enable', authenticate, enable2FA);
router.post('/disable', authenticate, disable2FA);
router.post('/regenerate-backup-codes', authenticate, regenerateBackupCodes);
router.get('/status', authenticate, get2FAStatus);

// Verification routes (used during login flow - no auth required)
router.post('/verify', verify2FA);
router.post('/verify-backup', verifyBackupCodeLogin);

export default router;
