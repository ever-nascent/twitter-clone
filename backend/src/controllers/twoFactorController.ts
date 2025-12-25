import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../types';
import { comparePassword } from '../utils/auth';
import {
  generateTOTPSecret,
  verifyTOTP,
  generateBackupCodes,
  formatBackupCodes,
  verifyBackupCode,
} from '../utils/twoFactor';

/**
 * Setup 2FA - Generate secret and QR code
 * POST /api/auth/2fa/setup
 *
 * Returns TOTP secret and QR code for user to scan with authenticator app
 * Does NOT enable 2FA yet - user must verify with /2fa/enable endpoint
 */
export const setup2FA = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Get user info
    const result = await query(
      'SELECT username, email, two_factor_enabled FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];

    // Check if 2FA is already enabled
    if (user.two_factor_enabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is already enabled. Disable it first before setting up again.',
      });
    }

    // Generate TOTP secret
    const { secret, qrCodeUrl, otpauthUrl } = await generateTOTPSecret(
      user.username,
      user.email
    );

    // Store secret temporarily (not enabled yet)
    await query('UPDATE users SET two_factor_secret = $1 WHERE id = $2', [
      secret,
      req.user.userId,
    ]);

    res.json({
      success: true,
      data: {
        secret, // For manual entry
        qrCodeUrl, // For scanning
        otpauthUrl, // For advanced users
      },
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup 2FA',
    });
  }
};

/**
 * Enable 2FA - Verify code and activate
 * POST /api/auth/2fa/enable
 *
 * Requires:
 * - token: 6-digit code from authenticator app (to verify setup)
 * - password: User's password (for security)
 */
export const enable2FA = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required',
      });
    }

    // Get user with password hash
    const result = await query(
      'SELECT password_hash, two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
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

    // Check if already enabled
    if (user.two_factor_enabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is already enabled',
      });
    }

    // Check if secret exists
    if (!user.two_factor_secret) {
      return res.status(400).json({
        success: false,
        error: 'Please setup 2FA first using /api/auth/2fa/setup',
      });
    }

    // Verify TOTP token
    const isValid = verifyTOTP(user.two_factor_secret, token);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid 2FA code. Please try again.',
      });
    }

    // Generate backup codes
    const { codes, hashedCodes } = generateBackupCodes(10);

    // Enable 2FA and store backup codes
    await query(
      'UPDATE users SET two_factor_enabled = TRUE, two_factor_backup_codes = $1 WHERE id = $2',
      [hashedCodes, req.user.userId]
    );

    // Return backup codes (ONLY TIME they are shown!)
    res.json({
      success: true,
      data: {
        message: '2FA enabled successfully',
        backupCodes: formatBackupCodes(codes),
        warning: 'Save these backup codes! They will not be shown again.',
      },
    });
  } catch (error) {
    console.error('Enable 2FA error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable 2FA',
    });
  }
};

/**
 * Disable 2FA
 * POST /api/auth/2fa/disable
 *
 * Requires:
 * - password: User's password
 * - token: Current 2FA code OR backup code
 */
export const disable2FA = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { password, token } = req.body;

    if (!password || !token) {
      return res.status(400).json({
        success: false,
        error: 'Password and 2FA code are required',
      });
    }

    // Get user data
    const result = await query(
      'SELECT password_hash, two_factor_secret, two_factor_enabled, two_factor_backup_codes FROM users WHERE id = $1',
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

    // Check if 2FA is enabled
    if (!user.two_factor_enabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is not enabled',
      });
    }

    // Verify 2FA token or backup code
    const isTOTPValid = verifyTOTP(user.two_factor_secret, token);
    const backupCodeIndex = verifyBackupCode(token, user.two_factor_backup_codes || []);

    if (!isTOTPValid && backupCodeIndex === -1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid 2FA code or backup code',
      });
    }

    // Disable 2FA and clear secrets
    await query(
      'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL, two_factor_backup_codes = NULL WHERE id = $1',
      [req.user.userId]
    );

    res.json({
      success: true,
      message: '2FA disabled successfully',
    });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable 2FA',
    });
  }
};

/**
 * Verify 2FA code (during login)
 * POST /api/auth/2fa/verify
 *
 * This endpoint is called AFTER successful email/password login
 * if the user has 2FA enabled
 */
export const verify2FA = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({
        success: false,
        error: 'User ID and token are required',
      });
    }

    // Get user's 2FA secret
    const result = await query(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];

    if (!user.two_factor_enabled || !user.two_factor_secret) {
      return res.status(400).json({
        success: false,
        error: '2FA is not enabled for this user',
      });
    }

    // Verify TOTP token
    const isValid = verifyTOTP(user.two_factor_secret, token);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid 2FA code',
      });
    }

    res.json({
      success: true,
      message: '2FA verification successful',
    });
  } catch (error) {
    console.error('Verify 2FA error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify 2FA code',
    });
  }
};

/**
 * Verify backup code (during login)
 * POST /api/auth/2fa/verify-backup
 *
 * Backup codes can be used instead of TOTP when user loses access to authenticator
 * Each backup code can only be used once
 */
export const verifyBackupCodeLogin = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        error: 'User ID and backup code are required',
      });
    }

    // Get user's backup codes
    const result = await query(
      'SELECT two_factor_enabled, two_factor_backup_codes FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];

    if (!user.two_factor_enabled || !user.two_factor_backup_codes) {
      return res.status(400).json({
        success: false,
        error: '2FA is not enabled for this user',
      });
    }

    // Verify backup code
    const backupCodes = user.two_factor_backup_codes;
    const codeIndex = verifyBackupCode(code, backupCodes);

    if (codeIndex === -1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid backup code',
      });
    }

    // Remove used backup code (one-time use)
    const updatedCodes = backupCodes.filter((_: string, index: number) => index !== codeIndex);

    await query('UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2', [
      updatedCodes,
      userId,
    ]);

    // Warn if running low on backup codes
    const remainingCodes = updatedCodes.length;
    let warning = undefined;
    if (remainingCodes <= 3) {
      warning = `Warning: Only ${remainingCodes} backup code(s) remaining. Consider generating new ones.`;
    }

    res.json({
      success: true,
      message: 'Backup code verified successfully',
      data: {
        remainingCodes,
        warning,
      },
    });
  } catch (error) {
    console.error('Verify backup code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify backup code',
    });
  }
};

/**
 * Regenerate backup codes
 * POST /api/auth/2fa/regenerate-backup-codes
 *
 * Requires password + current 2FA code for security
 */
export const regenerateBackupCodes = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { password, token } = req.body;

    if (!password || !token) {
      return res.status(400).json({
        success: false,
        error: 'Password and 2FA code are required',
      });
    }

    // Get user data
    const result = await query(
      'SELECT password_hash, two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
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

    // Check if 2FA is enabled
    if (!user.two_factor_enabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is not enabled',
      });
    }

    // Verify 2FA token
    const isValid = verifyTOTP(user.two_factor_secret, token);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid 2FA code',
      });
    }

    // Generate new backup codes
    const { codes, hashedCodes } = generateBackupCodes(10);

    // Update backup codes
    await query('UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2', [
      hashedCodes,
      req.user.userId,
    ]);

    res.json({
      success: true,
      data: {
        backupCodes: formatBackupCodes(codes),
        warning: 'Save these backup codes! They replace your old codes.',
      },
    });
  } catch (error) {
    console.error('Regenerate backup codes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate backup codes',
    });
  }
};

/**
 * Get 2FA status
 * GET /api/auth/2fa/status
 */
export const get2FAStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const result = await query(
      'SELECT two_factor_enabled, two_factor_backup_codes FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        enabled: user.two_factor_enabled,
        backupCodesCount: user.two_factor_backup_codes?.length || 0,
      },
    });
  } catch (error) {
    console.error('Get 2FA status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get 2FA status',
    });
  }
};
