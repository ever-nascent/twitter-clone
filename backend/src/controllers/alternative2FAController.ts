import { Response } from 'express';
import { query } from '../config/database';
import { redisClient } from '../config/redis';
import { AuthRequest } from '../types';
import { comparePassword } from '../utils/auth';
import {
  generateOTPCode,
  storeOTPCode,
  verifyOTPCode,
  isOTPRateLimited,
  incrementOTPRateLimit,
  sendSMSOTP,
  sendEmailOTP,
  formatPhoneNumber,
  isValidPhoneNumber,
} from '../utils/alternative2FA';
import { logger } from '../utils/logger';

/**
 * Set up SMS 2FA
 * POST /api/auth/2fa/sms/setup
 *
 * Requires:
 * - phone: Phone number (will be formatted to E.164)
 * - password: User's password for security
 */
export const setupSMS2FA = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and password are required',
      });
    }

    // Validate phone number
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format',
      });
    }

    // Get user data
    const result = await query(
      'SELECT password_hash, sms_2fa_enabled FROM users WHERE id = $1',
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

    // Update phone number
    await query(
      'UPDATE users SET sms_2fa_phone = $1, sms_2fa_enabled = TRUE WHERE id = $2',
      [formattedPhone, req.user.userId]
    );

    res.json({
      success: true,
      message: 'SMS 2FA enabled successfully',
      data: {
        phone: formattedPhone,
      },
    });
  } catch (error) {
    logger.error('SMS 2FA setup error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to set up SMS 2FA',
    });
  }
};

/**
 * Send SMS OTP code
 * POST /api/auth/2fa/sms/send
 *
 * Sends a 6-digit OTP code to user's registered phone number
 * Rate limited to 3 requests per 10 minutes
 */
export const sendSMS2FA = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Check rate limit
    const isRateLimited = await isOTPRateLimited(
      redisClient,
      req.user.userId,
      'sms'
    );

    if (isRateLimited) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait before requesting another code.',
      });
    }

    // Get user's phone number
    const result = await query(
      'SELECT sms_2fa_enabled, sms_2fa_phone FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];

    if (!user.sms_2fa_enabled || !user.sms_2fa_phone) {
      return res.status(400).json({
        success: false,
        error: 'SMS 2FA is not enabled',
      });
    }

    // Generate OTP code
    const code = generateOTPCode();

    // Store in Redis
    await storeOTPCode(redisClient, req.user.userId, code, 'sms', 10);

    // Increment rate limit counter
    await incrementOTPRateLimit(redisClient, req.user.userId, 'sms');

    // Send SMS
    const sent = await sendSMSOTP(user.sms_2fa_phone, code);

    if (!sent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to send SMS. Please try again.',
      });
    }

    res.json({
      success: true,
      message: 'OTP code sent to your phone',
      data: {
        expiresIn: 600, // 10 minutes in seconds
      },
    });
  } catch (error) {
    logger.error('Send SMS 2FA error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to send SMS code',
    });
  }
};

/**
 * Verify SMS OTP code
 * POST /api/auth/2fa/sms/verify
 *
 * Requires:
 * - code: 6-digit OTP code received via SMS
 */
export const verifySMS2FA = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Verification code is required',
      });
    }

    // Verify OTP code
    const isValid = await verifyOTPCode(
      redisClient,
      req.user.userId,
      code,
      'sms'
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired code',
      });
    }

    res.json({
      success: true,
      message: 'SMS code verified successfully',
    });
  } catch (error) {
    logger.error('Verify SMS 2FA error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to verify SMS code',
    });
  }
};

/**
 * Disable SMS 2FA
 * POST /api/auth/2fa/sms/disable
 *
 * Requires:
 * - password: User's password for security
 */
export const disableSMS2FA = async (req: AuthRequest, res: Response) => {
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
      'SELECT password_hash, sms_2fa_enabled FROM users WHERE id = $1',
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

    // Disable SMS 2FA
    await query(
      'UPDATE users SET sms_2fa_enabled = FALSE, sms_2fa_phone = NULL WHERE id = $1',
      [req.user.userId]
    );

    res.json({
      success: true,
      message: 'SMS 2FA disabled successfully',
    });
  } catch (error) {
    logger.error('Disable SMS 2FA error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to disable SMS 2FA',
    });
  }
};

/**
 * Set up Email 2FA
 * POST /api/auth/2fa/email/setup
 *
 * Requires:
 * - password: User's password for security
 */
export const setupEmail2FA = async (req: AuthRequest, res: Response) => {
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
      'SELECT password_hash, email FROM users WHERE id = $1',
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

    // Enable Email 2FA
    await query('UPDATE users SET email_2fa_enabled = TRUE WHERE id = $1', [
      req.user.userId,
    ]);

    res.json({
      success: true,
      message: 'Email 2FA enabled successfully',
      data: {
        email: user.email,
      },
    });
  } catch (error) {
    logger.error('Email 2FA setup error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to set up Email 2FA',
    });
  }
};

/**
 * Send Email OTP code
 * POST /api/auth/2fa/email/send
 *
 * Sends a 6-digit OTP code to user's registered email
 * Rate limited to 3 requests per 10 minutes
 */
export const sendEmail2FA = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Check rate limit
    const isRateLimited = await isOTPRateLimited(
      redisClient,
      req.user.userId,
      'email'
    );

    if (isRateLimited) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait before requesting another code.',
      });
    }

    // Get user's email
    const result = await query(
      'SELECT email_2fa_enabled, email, username FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];

    if (!user.email_2fa_enabled) {
      return res.status(400).json({
        success: false,
        error: 'Email 2FA is not enabled',
      });
    }

    // Generate OTP code
    const code = generateOTPCode();

    // Store in Redis
    await storeOTPCode(redisClient, req.user.userId, code, 'email', 10);

    // Increment rate limit counter
    await incrementOTPRateLimit(redisClient, req.user.userId, 'email');

    // Send Email
    const sent = await sendEmailOTP(user.email, user.username, code);

    if (!sent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to send email. Please try again.',
      });
    }

    res.json({
      success: true,
      message: 'OTP code sent to your email',
      data: {
        expiresIn: 600, // 10 minutes in seconds
      },
    });
  } catch (error) {
    logger.error('Send Email 2FA error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to send email code',
    });
  }
};

/**
 * Verify Email OTP code
 * POST /api/auth/2fa/email/verify
 *
 * Requires:
 * - code: 6-digit OTP code received via email
 */
export const verifyEmail2FA = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Verification code is required',
      });
    }

    // Verify OTP code
    const isValid = await verifyOTPCode(
      redisClient,
      req.user.userId,
      code,
      'email'
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired code',
      });
    }

    res.json({
      success: true,
      message: 'Email code verified successfully',
    });
  } catch (error) {
    logger.error('Verify Email 2FA error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to verify email code',
    });
  }
};

/**
 * Disable Email 2FA
 * POST /api/auth/2fa/email/disable
 *
 * Requires:
 * - password: User's password for security
 */
export const disableEmail2FA = async (req: AuthRequest, res: Response) => {
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
      'SELECT password_hash, email_2fa_enabled FROM users WHERE id = $1',
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

    // Disable Email 2FA
    await query('UPDATE users SET email_2fa_enabled = FALSE WHERE id = $1', [
      req.user.userId,
    ]);

    res.json({
      success: true,
      message: 'Email 2FA disabled successfully',
    });
  } catch (error) {
    logger.error('Disable Email 2FA error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to disable Email 2FA',
    });
  }
};

/**
 * Get all enabled 2FA methods
 * GET /api/auth/2fa/methods
 *
 * Returns which 2FA methods are currently enabled
 */
export const get2FAMethods = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const result = await query(
      'SELECT two_factor_enabled, sms_2fa_enabled, email_2fa_enabled, sms_2fa_phone FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];

    // Mask phone number for privacy
    let maskedPhone = null;
    if (user.sms_2fa_phone) {
      const phone = user.sms_2fa_phone;
      maskedPhone = phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
    }

    res.json({
      success: true,
      data: {
        totp: user.two_factor_enabled,
        sms: user.sms_2fa_enabled,
        email: user.email_2fa_enabled,
        smsPhone: maskedPhone,
      },
    });
  } catch (error) {
    logger.error('Get 2FA methods error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get 2FA methods',
    });
  }
};
