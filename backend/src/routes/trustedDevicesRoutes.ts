import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  getDevices,
  revokeDeviceById,
  revokeAllDevicesForUser,
  getDeviceCount,
} from '../controllers/trustedDevicesController';

const router = express.Router();

// All trusted device routes require authentication
router.get('/', authenticate, getDevices);
router.get('/count', authenticate, getDeviceCount);
router.delete('/all', authenticate, revokeAllDevicesForUser);
router.delete('/:id', authenticate, revokeDeviceById);

export default router;
