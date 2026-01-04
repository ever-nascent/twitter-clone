import express from 'express';
import { getSystemStatus } from '../controllers/statusController';

const router = express.Router();

/**
 * System Status Routes
 *
 * Public endpoints - no authentication required
 * Similar to Apple's System Status page
 */

// Get current system status
router.get('/', getSystemStatus);

export default router;
