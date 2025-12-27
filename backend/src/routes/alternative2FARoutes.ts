import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  setupSMS2FA,
  sendSMS2FA,
  verifySMS2FA,
  disableSMS2FA,
  setupEmail2FA,
  sendEmail2FA,
  verifyEmail2FA,
  disableEmail2FA,
  get2FAMethods,
} from '../controllers/alternative2FAController';

const router = express.Router();

// All alternative 2FA routes require authentication
// SMS 2FA routes
router.post('/sms/setup', authenticate, setupSMS2FA);
router.post('/sms/send', authenticate, sendSMS2FA);
router.post('/sms/verify', authenticate, verifySMS2FA);
router.post('/sms/disable', authenticate, disableSMS2FA);

// Email 2FA routes
router.post('/email/setup', authenticate, setupEmail2FA);
router.post('/email/send', authenticate, sendEmail2FA);
router.post('/email/verify', authenticate, verifyEmail2FA);
router.post('/email/disable', authenticate, disableEmail2FA);

// Get all enabled 2FA methods
router.get('/methods', authenticate, get2FAMethods);

export default router;
