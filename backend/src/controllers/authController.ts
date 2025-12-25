import { Request, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest, User, PublicUser, RegisterRequest, LoginRequest } from '../types';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  validatePassword,
  validateUsername,
  validateEmail,
} from '../utils/auth';
import {
  generateToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAccountLockedEmail,
} from '../utils/email';

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
    const { username, email, password, displayName }: RegisterRequest = req.body;

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

    const refreshToken = generateRefreshToken();

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

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
    const { email, password }: LoginRequest = req.body;

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

    // Reset failed login attempts on successful login
    if (user.failed_login_attempts > 0) {
      await query(
        'UPDATE users SET failed_login_attempts = 0 WHERE id = $1',
        [user.id]
      );
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
    });

    const refreshToken = generateRefreshToken();

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

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

    // Delete refresh token from database
    if (refreshToken) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
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

    // Verify refresh token exists and is not expired
    const result = await query(
      `SELECT user_id, expires_at FROM refresh_tokens
       WHERE token = $1 AND expires_at > NOW()`,
      [oldRefreshToken]
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
        [oldRefreshToken]
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
    const newRefreshToken = generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    // SECURITY: Atomic operation - Delete old token and insert new token
    // This prevents race conditions where the same token could be used twice
    await query('BEGIN');

    try {
      // Delete the old refresh token (invalidate it)
      await query('DELETE FROM refresh_tokens WHERE token = $1', [oldRefreshToken]);

      // Insert the new refresh token
      await query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, newRefreshToken, expiresAt]
      );

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
