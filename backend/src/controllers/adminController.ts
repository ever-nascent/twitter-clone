import { Request, Response } from 'express';
import { pool, query } from '../config/database';
import { AuthRequest, User } from '../types';
import { hashPassword, maskEmail } from '../utils/auth';
import { logAudit, AuditAction } from '../utils/audit';
import { getRecoveryCodeStatus } from '../utils/recoveryCodes';
import { getTrustedDeviceCount } from '../utils/trustedDevices';
import { getUserLoginHistory } from '../utils/loginMonitoring';

/**
 * Get all users with pagination and search
 * GET /api/admin/users
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    // SECURITY: Cap maximum limit to prevent DoS via excessive data requests
    // Max 100 items per page (OWASP recommendation for pagination)
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = (req.query.search as string) || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params: unknown[] = [];

    if (search) {
      whereClause = 'WHERE username ILIKE $1 OR email ILIKE $1 OR display_name ILIKE $1';
      params = [`%${search}%`];
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get users
    const usersResult = await query(
      `SELECT
        id, username, email, display_name, bio, location, website,
        profile_image_url, banner_image_url, verified, email_verified,
        failed_login_attempts, locked_until, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    // SECURITY: Mask emails in list view for GDPR/CCPA compliance
    // Admins don't need to see full emails in list view - only in detail view
    const maskedUsers = usersResult.rows.map((user: User) => ({
      ...user,
      email: maskEmail(user.email),
    }));

    res.json({
      success: true,
      data: {
        users: maskedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Get all users error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    });
  }
};

/**
 * Get user by ID
 * GET /api/admin/users/:id
 *
 * SECURITY NOTE: Full email is shown in detail view for legitimate admin need
 * (account verification, support, security investigations).
 * Email is masked in list views for privacy compliance.
 */
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // SECURITY: Full email exposed here for legitimate admin need-to-know
    // This is a detail view for specific user management actions
    const result = await query(
      `SELECT
        id, username, email, display_name, bio, location, website,
        profile_image_url, banner_image_url, verified, email_verified,
        email_verification_token, email_verification_expires,
        password_reset_token, password_reset_expires,
        failed_login_attempts, locked_until, created_at, updated_at
      FROM users
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: { user: result.rows[0] },
    });
  } catch (error) {
    logger.error('Get user by ID error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
    });
  }
};

/**
 * Update user
 * PUT /api/admin/users/:id
 */
export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      username,
      email,
      display_name,
      bio,
      location,
      website,
      verified,
      email_verified,
    } = req.body;

    // Check if user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Check if username/email already taken by another user
    if (username) {
      const usernameCheck = await query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, id]
      );
      if (usernameCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Username already taken',
        });
      }
    }

    if (email) {
      const emailCheck = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Email already registered',
        });
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (username !== undefined) {
      updates.push(`username = $${paramCount++}`);
      values.push(username);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (display_name !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(display_name);
    }
    if (bio !== undefined) {
      updates.push(`bio = $${paramCount++}`);
      values.push(bio);
    }
    if (location !== undefined) {
      updates.push(`location = $${paramCount++}`);
      values.push(location);
    }
    if (website !== undefined) {
      updates.push(`website = $${paramCount++}`);
      values.push(website);
    }
    if (verified !== undefined) {
      updates.push(`verified = $${paramCount++}`);
      values.push(verified);
    }
    if (email_verified !== undefined) {
      updates.push(`email_verified = $${paramCount++}`);
      values.push(email_verified);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
    }

    values.push(id);

    const result = await query(
      `UPDATE users
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, username, email, display_name, bio, location, website,
                verified, email_verified, created_at, updated_at`,
      values
    );

    const updatedUser = result.rows[0];

    // AUDIT LOG: Record user update
    await logAudit(
      {
        admin_user_id: req.user!.userId,
        admin_username: req.user!.username,
        action: AuditAction.USER_UPDATE,
        target_type: 'user',
        target_id: parseInt(id),
        target_identifier: updatedUser.username,
        details: {
          updated_fields: Object.keys(req.body),
          changes: req.body,
        },
      },
      req
    );

    res.json({
      success: true,
      data: { user: updatedUser },
      message: 'User updated successfully',
    });
  } catch (error) {
    logger.error('Update user error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
    });
  }
};

/**
 * Unlock user account
 * POST /api/admin/users/:id/unlock
 */
export const unlockUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get user info before unlock for audit log
    const userResult = await query('SELECT username FROM users WHERE id = $1', [id]);
    const targetUsername = userResult.rows[0]?.username || 'unknown';

    await query(
      `UPDATE users
      SET failed_login_attempts = 0, locked_until = NULL
      WHERE id = $1`,
      [id]
    );

    // AUDIT LOG: Record account unlock
    await logAudit(
      {
        admin_user_id: req.user!.userId,
        admin_username: req.user!.username,
        action: AuditAction.USER_UNLOCK,
        target_type: 'user',
        target_id: parseInt(id),
        target_identifier: targetUsername,
      },
      req
    );

    res.json({
      success: true,
      message: 'User account unlocked successfully',
    });
  } catch (error) {
    logger.error('Unlock user error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to unlock user',
    });
  }
};

/**
 * Verify user email manually
 * POST /api/admin/users/:id/verify-email
 */
export const verifyUserEmail = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get user info before verification for audit log
    const userResult = await query('SELECT username, email FROM users WHERE id = $1', [id]);
    const targetUser = userResult.rows[0];

    await query(
      `UPDATE users
      SET email_verified = TRUE,
          email_verification_token = NULL,
          email_verification_expires = NULL
      WHERE id = $1`,
      [id]
    );

    // AUDIT LOG: Record email verification
    await logAudit(
      {
        admin_user_id: req.user!.userId,
        admin_username: req.user!.username,
        action: AuditAction.USER_EMAIL_VERIFY,
        target_type: 'user',
        target_id: parseInt(id),
        target_identifier: targetUser?.username || 'unknown',
        details: {
          email: targetUser?.email,
        },
      },
      req
    );

    res.json({
      success: true,
      message: 'User email verified successfully',
    });
  } catch (error) {
    logger.error('Verify user email error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to verify email',
    });
  }
};

/**
 * Delete user
 * DELETE /api/admin/users/:id
 */
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get user info before deletion for audit log
    const userResult = await query('SELECT username, email FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }
    const deletedUser = userResult.rows[0];

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    // AUDIT LOG: Record user deletion (CRITICAL - must be logged)
    await logAudit(
      {
        admin_user_id: req.user!.userId,
        admin_username: req.user!.username,
        action: AuditAction.USER_DELETE,
        target_type: 'user',
        target_id: parseInt(id),
        target_identifier: deletedUser.username,
        details: {
          deleted_email: deletedUser.email,
          deleted_username: deletedUser.username,
        },
      },
      req
    );

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    logger.error('Delete user error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
    });
  }
};

/**
 * Get user statistics
 * GET /api/admin/stats
 */
export const getStats = async (req: Request, res: Response) => {
  try {
    const statsResult = await query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE email_verified = true) as verified_users,
        COUNT(*) FILTER (WHERE email_verified = false) as unverified_users,
        COUNT(*) FILTER (WHERE locked_until IS NOT NULL AND locked_until > NOW()) as locked_users,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_users_7d
      FROM users
    `);

    res.json({
      success: true,
      data: { stats: statsResult.rows[0] },
    });
  } catch (error) {
    logger.error('Get stats error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
};

/**
 * Reset user password (admin)
 * POST /api/admin/users/:id/reset-password
 */
export const resetUserPassword = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      });
    }

    // Get user info before password reset for audit log
    const userResult = await query('SELECT username FROM users WHERE id = $1', [id]);
    const targetUsername = userResult.rows[0]?.username || 'unknown';

    const passwordHash = await hashPassword(newPassword);

    await query(
      `UPDATE users
      SET password_hash = $1,
          password_reset_token = NULL,
          password_reset_expires = NULL,
          failed_login_attempts = 0,
          locked_until = NULL
      WHERE id = $2`,
      [passwordHash, id]
    );

    // Invalidate all refresh tokens
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);

    // AUDIT LOG: Record password reset (CRITICAL - security-sensitive action)
    await logAudit(
      {
        admin_user_id: req.user!.userId,
        admin_username: req.user!.username,
        action: AuditAction.USER_PASSWORD_RESET,
        target_type: 'user',
        target_id: parseInt(id),
        target_identifier: targetUsername,
        details: {
          sessions_invalidated: true,
          account_unlocked: true,
        },
      },
      req
    );

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    logger.error('Reset user password error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
    });
  }
};

/**
 * Force user to reset password on next login
 * POST /api/admin/users/:id/force-password-reset
 *
 * Sets force_password_reset flag, requiring user to change password
 */
export const forcePasswordReset = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get user info for audit log
    const userResult = await query('SELECT username FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }
    const targetUsername = userResult.rows[0].username;

    // Set force password reset flag
    await query(
      'UPDATE users SET force_password_reset = TRUE WHERE id = $1',
      [id]
    );

    // AUDIT LOG: Record forced password reset (CRITICAL - security action)
    await logAudit(
      {
        admin_user_id: req.user!.userId,
        admin_username: req.user!.username,
        action: AuditAction.USER_PASSWORD_RESET,
        target_type: 'user',
        target_id: parseInt(id),
        target_identifier: targetUsername,
        details: {
          forced: true,
          reason: 'Admin forced password reset',
        },
      },
      req
    );

    res.json({
      success: true,
      message: 'User will be required to reset password on next login',
    });
  } catch (error) {
    logger.error('Force password reset error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to force password reset',
    });
  }
};

/**
 * Get security status for a user
 * GET /api/admin/users/:id/security-status
 *
 * Returns comprehensive security information:
 * - 2FA status (TOTP, SMS, Email)
 * - Recovery codes status
 * - Trusted devices count
 * - Recent login history
 * - Password last changed
 * - Account flags (force_password_reset, etc.)
 */
export const getUserSecurityStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    // Get user security settings
    const userResult = await query(
      `SELECT
         two_factor_enabled,
         sms_2fa_enabled,
         email_2fa_enabled,
         force_password_reset,
         password_changed_at,
         locked_until,
         failed_login_attempts,
         created_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = userResult.rows[0];

    // Get recovery codes status
    const recoveryStatus = await getRecoveryCodeStatus(pool, userId);

    // Get trusted devices count
    const trustedDevicesCount = await getTrustedDeviceCount(pool, userId);

    // Get recent login history (last 10 attempts)
    const recentLogins = await getUserLoginHistory(pool, userId, 10);

    // Get suspicious login count
    const suspiciousResult = await pool.query(
      `SELECT COUNT(*) as count FROM login_attempts
       WHERE user_id = $1 AND suspicious = TRUE
       AND created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    );
    const recentSuspiciousLogins = parseInt(suspiciousResult.rows[0]?.count || '0', 10);

    res.json({
      success: true,
      data: {
        twoFactor: {
          totp: user.two_factor_enabled,
          sms: user.sms_2fa_enabled,
          email: user.email_2fa_enabled,
        },
        recoveryCodes: {
          total: recoveryStatus.total,
          remaining: recoveryStatus.remaining,
          hasExpired: recoveryStatus.hasExpired,
        },
        trustedDevices: {
          count: trustedDevicesCount,
        },
        account: {
          forcePasswordReset: user.force_password_reset,
          passwordChangedAt: user.password_changed_at,
          isLocked: user.locked_until && new Date(user.locked_until) > new Date(),
          failedLoginAttempts: user.failed_login_attempts,
          accountAge: Math.floor(
            (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
          ),
        },
        recentActivity: {
          suspiciousLogins30d: recentSuspiciousLogins,
          recentLogins: recentLogins.slice(0, 5).map((login) => ({
            success: login.success,
            suspicious: login.suspicious,
            ipAddress: login.ipAddress,
            deviceInfo: login.deviceInfo,
            location: login.location,
            createdAt: login.createdAt,
          })),
        },
      },
    });
  } catch (error) {
    logger.error('Get user security status error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get security status',
    });
  }
};

/**
 * Get all suspicious logins across all users
 * GET /api/admin/security/suspicious-logins
 *
 * Query parameters:
 * - limit: Maximum number of records (default: 50, max: 200)
 * - days: Number of days to look back (default: 7, max: 90)
 *
 * Returns suspicious login attempts with user information
 */
export const getAllSuspiciousLogins = async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const limitParam = req.query.limit;
    const daysParam = req.query.days;

    let limit = 50; // Default
    let days = 7; // Default

    if (limitParam) {
      const parsedLimit = parseInt(limitParam as string, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 200) {
        limit = parsedLimit;
      }
    }

    if (daysParam) {
      const parsedDays = parseInt(daysParam as string, 10);
      if (!isNaN(parsedDays) && parsedDays > 0 && parsedDays <= 90) {
        days = parsedDays;
      }
    }

    // Get suspicious logins with user information
    const result = await pool.query(
      `SELECT
         la.id,
         la.user_id,
         la.email,
         la.success,
         la.ip_address,
         la.device_info,
         la.location,
         la.suspicious_reason,
         la.created_at,
         u.username,
         u.display_name
       FROM login_attempts la
       LEFT JOIN users u ON la.user_id = u.id
       WHERE la.suspicious = TRUE
       AND la.created_at > NOW() - INTERVAL '${days} days'
       ORDER BY la.created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      success: true,
      data: {
        suspiciousLogins: result.rows.map((login) => ({
          id: login.id,
          userId: login.user_id,
          username: login.username,
          displayName: login.display_name,
          email: maskEmail(login.email), // Mask email for privacy
          success: login.success,
          ipAddress: login.ip_address,
          deviceInfo: login.device_info,
          location: login.location,
          suspiciousReason: login.suspicious_reason,
          createdAt: login.created_at,
        })),
        count: result.rows.length,
        filters: {
          days,
          limit,
        },
      },
    });
  } catch (error) {
    logger.error('Get all suspicious logins error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get suspicious logins',
    });
  }
};
