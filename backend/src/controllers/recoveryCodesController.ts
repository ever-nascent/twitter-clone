import { Response } from 'express';
import { pool, query } from '../config/database';
import { AuthRequest } from '../types';
import { comparePassword } from '../utils/auth';
import {
  generateRecoveryCodes,
  verifyRecoveryCode,
  getRecoveryCodeStatus,
  hasValidRecoveryCodes,
  deleteAllRecoveryCodes,
} from '../utils/recoveryCodes';
import { logger } from '../utils/logger';

/**
 * Generate new recovery codes
 * POST /api/auth/recovery-codes/generate
 *
 * Requires:
 * - password: User's password for security
 *
 * Returns 8 recovery codes (XXXX-XXXX-XXXX format)
 * WARNING: Codes are shown only once!
 */
export const generateCodes = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required',
      });
    }

    // Get user data
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password',
      });
    }

    // Generate recovery codes
    const codes = await generateRecoveryCodes(pool, req.user.userId);

    res.json({
      success: true,
      data: {
        codes,
        count: codes.length,
        warning:
          'Save these recovery codes in a safe place! They will not be shown again.',
      },
    });
  } catch (error) {
    logger.error('Generate recovery codes error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate recovery codes',
    });
  }
};

/**
 * Get recovery code status
 * GET /api/auth/recovery-codes/status
 *
 * Returns:
 * - total: Total number of codes ever generated
 * - used: Number of codes already used
 * - remaining: Number of valid unused codes
 * - hasExpired: Whether any codes have expired
 */
export const getStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const status = await getRecoveryCodeStatus(pool, req.user.userId);

    // Add warning if running low
    let warning;
    if (status.remaining === 0) {
      warning = 'No recovery codes remaining. Generate new codes immediately.';
    } else if (status.remaining <= 2) {
      warning = `Only ${status.remaining} recovery code(s) remaining. Consider generating new codes.`;
    }

    if (status.hasExpired) {
      warning = warning
        ? `${warning} Some codes have expired.`
        : 'Some recovery codes have expired. Consider generating new codes.';
    }

    res.json({
      success: true,
      data: {
        ...status,
        warning,
      },
    });
  } catch (error) {
    logger.error('Get recovery code status error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get recovery code status',
    });
  }
};

/**
 * Verify recovery code for account access
 * POST /api/auth/recovery-codes/verify
 *
 * This is used during login when user can't access their account
 * Requires:
 * - userId: User ID (from login attempt)
 * - code: Recovery code (XXXX-XXXX-XXXX format)
 *
 * NOTE: This endpoint does NOT require authentication (it's for account recovery)
 */
export const verifyCode = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        error: 'User ID and recovery code are required',
      });
    }

    // Verify recovery code
    const isValid = await verifyRecoveryCode(pool, userId, code);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired recovery code',
      });
    }

    // Check remaining codes
    const status = await getRecoveryCodeStatus(pool, userId);

    let warning;
    if (status.remaining === 0) {
      warning =
        'This was your last recovery code. Generate new codes immediately after login.';
    } else if (status.remaining <= 2) {
      warning = `Only ${status.remaining} recovery code(s) remaining. Generate new codes soon.`;
    }

    res.json({
      success: true,
      message: 'Recovery code verified successfully',
      data: {
        remaining: status.remaining,
        warning,
      },
    });
  } catch (error) {
    logger.error('Verify recovery code error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to verify recovery code',
    });
  }
};

/**
 * Delete all recovery codes
 * DELETE /api/auth/recovery-codes
 *
 * Requires:
 * - password: User's password for security
 *
 * WARNING: This will delete ALL recovery codes for the user
 */
export const deleteCodes = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required',
      });
    }

    // Get user data
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password',
      });
    }

    // Delete all recovery codes
    const deletedCount = await deleteAllRecoveryCodes(pool, req.user.userId);

    res.json({
      success: true,
      message: 'All recovery codes deleted successfully',
      data: {
        deletedCount,
      },
    });
  } catch (error) {
    logger.error('Delete recovery codes error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to delete recovery codes',
    });
  }
};
