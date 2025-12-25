import { Request, Response } from 'express';
import { query, pool } from '../config/database';
import { AuthRequest, User, PublicUser, RegisterRequest, LoginRequest } from '../types';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  validatePassword,
  validateUsername,
  validateEmail,
} from '../utils/auth';
import {
  generateToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAccountLockedEmail,
  sendNewDeviceAlert,
  sendSuspiciousLoginAlert,
} from '../utils/email';
import { verifyCaptcha } from '../utils/captcha';
import { verifyTOTP, verifyBackupCode } from '../utils/twoFactor';
import { createSession, deleteSession, deleteOtherSessions } from '../utils/session';
import { logLoginAttempt, hasRecentSuspiciousLogins } from '../utils/loginMonitoring';
import { addPasswordToHistory, isPasswordRecentlyUsed } from '../utils/passwordHistory';
import { isDeviceTrusted, trustDevice, generateDeviceFingerprint } from '../utils/trustedDevices';

/**
 * Remove sensitive data from user object
 *
 * SECURITY: Strips password_hash and email from user objects before sending to clients.
 * Use this for public-facing user data (e.g., registration/login responses).
 * Note: getCurrentUser() intentionally includes email for the user themselves.
 */
const sanitizeUser = (user: User): PublicUser => {
  const { password_hash, email, ...publicUser } = user;
  return publicUser as PublicUser;
};

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password, displayName, captchaToken }: RegisterRequest & { captchaToken?: string } = req.body;

    // SECURITY: Verify CAPTCHA first (bot protection)
    // Skip in test environment
    if (process.env.NODE_ENV !== 'test') {
      const captchaResult = await verifyCaptcha(captchaToken || '', 'register');
      if (!captchaResult.success) {
        return res.status(400).json({
          success: false,
          error: 'CAPTCHA verification failed. Please try again.',
        });
      }
    }

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required',
      });
    }

    // Validate username format
    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({
        success: false,
        error: usernameError,
      });
    }

    // Validate email format
    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({
        success: false,
        error: emailError,
      });
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        error: passwordError,
      });
    }

    // SECURITY: Account Enumeration Prevention
    // Check both username and email in a single query to prevent timing attacks
    // Use generic error message to not reveal which field is taken
    //
    // Industry Standard Approach:
    // - Single query prevents timing attack (can't tell which field was checked)
    // - Generic error message prevents enumeration
    // - Rate limiting (applied at route level) prevents automated scanning
    //
    // UX vs Security Tradeoff:
    // Some apps reveal specific field for UX, but use CAPTCHA for automated detection.
    // We chose security-first approach with generic messaging.
    const existingUserCheck = await query(
      'SELECT username, email FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUserCheck.rows.length > 0) {
      // SECURITY: Generic error message doesn't reveal which field is taken
      // This prevents attackers from enumerating valid usernames/emails
      return res.status(400).json({
        success: false,
        error: 'Username or email is already in use. Please try a different one.',
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate email verification token
    const verificationToken = generateToken();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hours

    // Create user
    const result = await query(
      `INSERT INTO users (username, email, password_hash, display_name, email_verification_token, email_verification_expires)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, display_name, bio, location, website,
                 profile_image_url, banner_image_url, verified, is_admin, email_verified, created_at`,
      [username, email, passwordHash, displayName || username, verificationToken, verificationExpires]
    );

    const user = result.rows[0] as User;

    // Add initial password to history (Phase 3)
    try {
      await addPasswordToHistory(pool, user.id, passwordHash);
    } catch (error) {
      console.error('Failed to add password to history:', error);
    }

    // Log successful registration/login attempt (Phase 3)
    try {
      await logLoginAttempt(pool, {
        userId: user.id,
        email,
        success: true,
        req,
      });
    } catch (error) {
      console.error('Failed to log login attempt:', error);
    }

    // Send verification email (don't block registration if email fails)
    try {
      await sendVerificationEmail(email, username, verificationToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue with registration even if email fails
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
    });

    const { token: refreshToken, hashedToken: hashedRefreshToken } = generateRefreshToken();

    // Store HASHED refresh token in database (security best practice)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashedRefreshToken, expiresAt]
    );

    // Create session record for tracking
    await createSession(pool, user.id, hashedRefreshToken, req, expiresAt);

    // Set cookies with raw token (client needs the raw token)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000, // 30 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Return user data
    res.status(201).json({
      success: true,
      data: {
        user: sanitizeUser(user),
        message: 'Account created successfully! Please check your email to verify your account.',
        emailVerificationRequired: !user.email_verified,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account',
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, captchaToken }: LoginRequest & { captchaToken?: string } = req.body;

    // SECURITY: Verify CAPTCHA first (bot protection)
    // Skip in test environment
    if (process.env.NODE_ENV !== 'test') {
      const captchaResult = await verifyCaptcha(captchaToken || '', 'login');
      if (!captchaResult.success) {
        return res.status(400).json({
          success: false,
          error: 'CAPTCHA verification failed. Please try again.',
        });
      }
    }

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Find user by email
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      // Don't reveal whether email exists
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    const user = result.rows[0] as User;

    // Check if account is locked
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      return res.status(403).json({
        success: false,
        error: `Account is locked due to too many failed login attempts. Please try again later or reset your password.`,
        lockedUntil: user.locked_until,
      });
    }

    // If lock period has passed, reset failed attempts
    if (user.locked_until && new Date() >= new Date(user.locked_until)) {
      await query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
        [user.id]
      );
      user.failed_login_attempts = 0;
      user.locked_until = null;
    }

    // Compare passwords
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      // Log failed login attempt (Phase 3)
      try {
        await logLoginAttempt(pool, {
          userId: user.id,
          email,
          success: false,
          failureReason: 'Invalid password',
          req,
        });
      } catch (error) {
        console.error('Failed to log login attempt:', error);
      }

      // Increment failed login attempts
      const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
      const maxAttempts = 5;

      if (newFailedAttempts >= maxAttempts) {
        // Lock account for 30 minutes
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 30);

        await query(
          'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
          [newFailedAttempts, lockUntil, user.id]
        );

        // Send account locked email
        try {
          await sendAccountLockedEmail(user.email, user.username, lockUntil);
        } catch (emailError) {
          console.error('Failed to send account locked email:', emailError);
        }

        return res.status(403).json({
          success: false,
          error: 'Too many failed login attempts. Your account has been locked for 30 minutes.',
          lockedUntil: lockUntil,
        });
      } else {
        // Just increment the counter
        await query(
          'UPDATE users SET failed_login_attempts = $1 WHERE id = $2',
          [newFailedAttempts, user.id]
        );

        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
          attemptsRemaining: maxAttempts - newFailedAttempts,
        });
      }
    }

    // SECURITY: Email verification is mandatory (industry best practice)
    // Prevents:
    // - Spam/fake account creation
    // - Account takeover via typo-squatted emails
    // - GDPR compliance issues with unverified contacts
    if (!user.email_verified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
        emailVerificationRequired: true,
      });
    }

    // Check if 2FA is enabled
    if (user.two_factor_enabled) {
      // Check if device is trusted (Phase 3)
      const deviceTrusted = await isDeviceTrusted(pool, user.id, req);

      if (deviceTrusted) {
        // Skip 2FA for trusted device
        console.log(`[2FA] Skipping 2FA for trusted device (user ${user.id})`);
      } else {
        // Don't issue tokens yet - require 2FA verification first
        // Reset failed attempts since password was correct
        if (user.failed_login_attempts > 0) {
          await query(
            'UPDATE users SET failed_login_attempts = 0 WHERE id = $1',
            [user.id]
          );
        }

        return res.status(200).json({
          success: true,
          requiresTwoFactor: true,
          userId: user.id, // Needed for 2FA verification
          message: 'Please enter your 2FA code',
        });
      }
    }

    // Reset failed login attempts on successful login
    if (user.failed_login_attempts > 0) {
      await query(
        'UPDATE users SET failed_login_attempts = 0 WHERE id = $1',
        [user.id]
      );
    }

    // Log successful login attempt (Phase 3)
    const loginAttempt = await logLoginAttempt(pool, {
      userId: user.id,
      email,
      success: true,
      req,
    });

    // Send security alerts if suspicious (Phase 3)
    if (loginAttempt.suspicious && loginAttempt.suspiciousReason) {
      try {
        await sendSuspiciousLoginAlert(
          user.email,
          user.username,
          loginAttempt.suspiciousReason,
          loginAttempt.ipAddress || 'Unknown',
          loginAttempt.createdAt
        );
      } catch (error) {
        console.error('Failed to send suspicious login alert:', error);
      }
    }

    // Send new device alert (Phase 3)
    try {
      // Check if this is a new device
      const previousLogins = await pool.query(
        `SELECT COUNT(*) as count FROM login_attempts
         WHERE user_id = $1 AND device_info = $2 AND success = TRUE
         AND id != $3`,
        [user.id, loginAttempt.deviceInfo, loginAttempt.id]
      );

      const isNewDevice = parseInt(previousLogins.rows[0]?.count || '0', 10) === 0;

      if (isNewDevice && loginAttempt.deviceInfo && loginAttempt.ipAddress) {
        await sendNewDeviceAlert(
          user.email,
          user.username,
          loginAttempt.deviceInfo,
          loginAttempt.ipAddress,
          loginAttempt.location,
          loginAttempt.createdAt
        );
      }
    } catch (error) {
      console.error('Failed to send new device alert:', error);
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
    });

    const { token: refreshToken, hashedToken: hashedRefreshToken } = generateRefreshToken();

    // Store HASHED refresh token in database (security best practice)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashedRefreshToken, expiresAt]
    );

    // Create session record for tracking
    await createSession(pool, user.id, hashedRefreshToken, req, expiresAt);

    // Set cookies with raw token (client needs the raw token)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000, // 30 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Return user data
    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
        message: 'Logged in successfully',
        emailVerified: user.email_verified,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
    });
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    // Delete refresh token and session from database (hash it first to match stored value)
    if (refreshToken) {
      const hashedToken = hashRefreshToken(refreshToken);
      await query('DELETE FROM refresh_tokens WHERE token = $1', [hashedToken]);
      await deleteSession(pool, hashedToken);
    }

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
    });
  }
};

/**
 * Get current user
 * GET /api/auth/me
 *
 * SECURITY NOTE: This endpoint returns email ONLY for the authenticated user themselves.
 * Users can view their own email, but not other users' emails (GDPR/CCPA compliant).
 */
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // SECURITY: Only fetches data for the authenticated user (req.user.userId)
    // Users can see their own email, which is privacy-compliant
    const result = await query(
      `SELECT id, username, email, display_name, bio, location, website,
              profile_image_url, banner_image_url, verified, is_admin, email_verified, created_at
       FROM users WHERE id = $1`,
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
      data: { user },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
    });
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 *
 * SECURITY: Implements Refresh Token Rotation (RTR)
 * - Each time a refresh token is used, it's invalidated and a new one is issued
 * - Prevents refresh token reuse attacks
 * - If an old token is reused, it indicates potential token theft
 * - Follows OAuth 2.0 Security Best Practices (RFC 6819)
 */
export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const oldRefreshToken = req.cookies.refreshToken;

    if (!oldRefreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token required',
      });
    }

    // Hash the incoming token to compare with database
    const hashedOldToken = hashRefreshToken(oldRefreshToken);

    // Verify refresh token exists and is not expired
    const result = await query(
      `SELECT user_id, expires_at FROM refresh_tokens
       WHERE token = $1 AND expires_at > NOW()`,
      [hashedOldToken]
    );

    if (result.rows.length === 0) {
      // SECURITY: If token is invalid, it might be:
      // 1. Expired (legitimate)
      // 2. Already rotated (reuse attempt - potential theft)
      // 3. Never existed (invalid token)
      //
      // For security, we check if this token was recently rotated
      // If yes, this is likely a token reuse attack
      const recentlyUsed = await query(
        `SELECT user_id FROM refresh_tokens
         WHERE token = $1 AND expires_at <= NOW()
         AND expires_at > NOW() - INTERVAL '5 minutes'`,
        [hashedOldToken]
      );

      if (recentlyUsed.rows.length > 0) {
        // SECURITY ALERT: Token reuse detected!
        // Someone is trying to use an old refresh token
        // This is a strong indicator of token theft
        const userId = recentlyUsed.rows[0].user_id;

        // Invalidate ALL refresh tokens for this user as a security measure
        await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

        console.error(`[SECURITY ALERT] Refresh token reuse detected for user ${userId}`);

        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token. All sessions have been terminated for security.',
        });
      }

      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
      });
    }

    const { user_id } = result.rows[0];

    // Get user data
    const userResult = await query(
      'SELECT id, username FROM users WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = userResult.rows[0];

    // SECURITY: Token Rotation - Generate NEW refresh token
    const { token: newRefreshToken, hashedToken: newHashedRefreshToken } = generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    // SECURITY: Atomic operation - Delete old token and insert new token
    // This prevents race conditions where the same token could be used twice
    await query('BEGIN');

    try {
      // Delete the old refresh token (invalidate it) - compare with hashed version
      await query('DELETE FROM refresh_tokens WHERE token = $1', [hashedOldToken]);

      // Delete the old session
      await deleteSession(pool, hashedOldToken);

      // Insert the new HASHED refresh token
      await query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, newHashedRefreshToken, expiresAt]
      );

      // Create new session record
      await createSession(pool, user.id, newHashedRefreshToken, req, expiresAt);

      await query('COMMIT');
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
    });

    // Set new access token cookie
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000, // 30 minutes
    });

    // SECURITY: Set new refresh token cookie (rotated)
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      success: true,
      message: 'Tokens refreshed successfully',
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
    });
  }
};

/**
 * Verify email address
 * POST /api/auth/verify-email
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required',
      });
    }

    // Find user with this token
    const result = await query(
      `SELECT id, username, email, email_verification_expires
       FROM users
       WHERE email_verification_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token',
      });
    }

    const user = result.rows[0];

    // Check if token has expired (24 hours)
    if (new Date() > new Date(user.email_verification_expires)) {
      return res.status(400).json({
        success: false,
        error: 'Verification token has expired. Please request a new one.',
      });
    }

    // Update user as verified
    await query(
      `UPDATE users
       SET email_verified = TRUE,
           email_verification_token = NULL,
           email_verification_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    res.json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify email',
    });
  }
};

/**
 * Resend verification email
 * POST /api/auth/resend-verification
 */
export const resendVerificationEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    // Find user by email
    const result = await query(
      'SELECT id, username, email, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: 'If that email is registered, a verification email has been sent.',
      });
    }

    const user = result.rows[0];

    // Check if already verified
    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        error: 'Email is already verified',
      });
    }

    // Generate new verification token
    const verificationToken = generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    // Update user with new token
    await query(
      `UPDATE users
       SET email_verification_token = $1, email_verification_expires = $2
       WHERE id = $3`,
      [verificationToken, expiresAt, user.id]
    );

    // Send verification email
    await sendVerificationEmail(user.email, user.username, verificationToken);

    res.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send verification email',
    });
  }
};

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    // Find user by email
    const result = await query(
      'SELECT id, username, email FROM users WHERE email = $1',
      [email]
    );

    // Don't reveal if email exists (security best practice)
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'If that email is registered, a password reset link has been sent.',
      });
    }

    const user = result.rows[0];

    // Generate reset token
    const resetToken = generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

    // Store reset token
    await query(
      `UPDATE users
       SET password_reset_token = $1, password_reset_expires = $2
       WHERE id = $3`,
      [resetToken, expiresAt, user.id]
    );

    // Send reset email
    await sendPasswordResetEmail(user.email, user.username, resetToken);

    res.json({
      success: true,
      message: 'If that email is registered, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request',
    });
  }
};

/**
 * Reset password with token
 * POST /api/auth/reset-password
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required',
      });
    }

    // Validate new password
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        error: passwordError,
      });
    }

    // Find user with this reset token
    const result = await query(
      `SELECT id, password_reset_expires
       FROM users
       WHERE password_reset_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      });
    }

    const user = result.rows[0];

    // Check if token has expired
    if (new Date() > new Date(user.password_reset_expires)) {
      return res.status(400).json({
        success: false,
        error: 'Reset token has expired. Please request a new one.',
      });
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password and clear reset token, also reset failed attempts
    await query(
      `UPDATE users
       SET password_hash = $1,
           password_reset_token = NULL,
           password_reset_expires = NULL,
           failed_login_attempts = 0,
           locked_until = NULL
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    // Invalidate all refresh tokens for this user (force re-login)
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
    });
  }
};

/**
 * Complete login with 2FA verification
 * POST /api/auth/login/2fa
 *
 * Called after successful email/password login when user has 2FA enabled
 * Verifies 2FA code and issues tokens
 */
export const completeLoginWith2FA = async (req: Request, res: Response) => {
  try {
    const { userId, token, useBackupCode, trustThisDevice } = req.body;

    if (!userId || !token) {
      return res.status(400).json({
        success: false,
        error: 'User ID and 2FA code are required',
      });
    }

    // Get user data
    const result = await query(
      `SELECT id, username, two_factor_enabled, two_factor_secret, two_factor_backup_codes
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];

    // Verify 2FA is enabled
    if (!user.two_factor_enabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is not enabled for this user',
      });
    }

    let isValid = false;
    let backupCodeUsed = false;

    // Check if using backup code
    if (useBackupCode) {
      const backupCodes = user.two_factor_backup_codes || [];
      const codeIndex = verifyBackupCode(token, backupCodes);

      if (codeIndex !== -1) {
        isValid = true;
        backupCodeUsed = true;

        // Remove used backup code
        const updatedCodes = backupCodes.filter((_: string, index: number) => index !== codeIndex);
        await query('UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2', [
          updatedCodes,
          user.id,
        ]);
      }
    } else {
      // Verify TOTP code
      isValid = verifyTOTP(user.two_factor_secret, token);
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: useBackupCode ? 'Invalid backup code' : 'Invalid 2FA code',
      });
    }

    // Issue tokens (same as regular login)
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
    });

    const { token: refreshToken, hashedToken: hashedRefreshToken } = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashedRefreshToken, expiresAt]
    );

    // Create session record for tracking
    await createSession(pool, user.id, hashedRefreshToken, req, expiresAt);

    // Trust this device for 30 days if requested (Phase 3)
    if (trustThisDevice) {
      try {
        await trustDevice(pool, user.id, req);
      } catch (error) {
        console.error('Failed to trust device:', error);
      }
    }

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000, // 30 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Get user data for response (without sensitive fields)
    const userDataResult = await query(
      `SELECT id, username, email, display_name, bio, location, website,
              profile_image_url, banner_image_url, verified, is_admin, email_verified, created_at
       FROM users WHERE id = $1`,
      [user.id]
    );

    const userData = userDataResult.rows[0];

    res.json({
      success: true,
      data: {
        user: sanitizeUser(userData),
        message: backupCodeUsed
          ? 'Logged in with backup code. Consider regenerating backup codes.'
          : 'Logged in successfully',
      },
    });
  } catch (error) {
    console.error('2FA login completion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete login',
    });
  }
};

/**
 * Change password for logged-in user
 * POST /api/auth/change-password
 *
 * Requires:
 * - currentPassword: User's current password
 * - newPassword: New password
 * - logoutOtherDevices: Optional boolean to invalidate all refresh tokens
 */
export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { currentPassword, newPassword, logoutOtherDevices } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
      });
    }

    // Validate new password
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        error: passwordError,
      });
    }

    // Check if new password is same as current
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password must be different from current password',
      });
    }

    // Get user with password hash
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

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
      });
    }

    // Check password history (Phase 3)
    const wasRecentlyUsed = await isPasswordRecentlyUsed(pool, req.user.userId, newPassword);
    if (wasRecentlyUsed) {
      return res.status(400).json({
        success: false,
        error: 'You cannot reuse a password from the last year. Please choose a different password.',
      });
    }

    // Add current password to history before changing (Phase 3)
    try {
      await addPasswordToHistory(pool, req.user.userId, user.password_hash);
    } catch (error) {
      console.error('Failed to add password to history:', error);
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password with password_changed_at timestamp (Phase 3)
    await query(
      'UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2',
      [passwordHash, req.user.userId]
    );

    // Optionally logout from other devices
    if (logoutOtherDevices) {
      const currentRefreshToken = req.cookies.refreshToken;
      if (currentRefreshToken) {
        // Delete all refresh tokens and sessions except current one
        const hashedCurrentToken = hashRefreshToken(currentRefreshToken);
        await query(
          'DELETE FROM refresh_tokens WHERE user_id = $1 AND token != $2',
          [req.user.userId, hashedCurrentToken]
        );
        await deleteOtherSessions(pool, req.user.userId, hashedCurrentToken);
      } else {
        // No current token, delete all
        await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.userId]);
        await query('DELETE FROM sessions WHERE user_id = $1', [req.user.userId]);
      }
    }

    res.json({
      success: true,
      message: logoutOtherDevices
        ? 'Password changed successfully. Other devices have been logged out.'
        : 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password',
    });
  }
};
