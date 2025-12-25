import { Request, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../types';
import { hashPassword } from '../utils/auth';

/**
 * Get all users with pagination and search
 * GET /api/admin/users
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params: any[] = [];

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

    res.json({
      success: true,
      data: {
        users: usersResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    });
  }
};

/**
 * Get user by ID
 * GET /api/admin/users/:id
 */
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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
    console.error('Get user by ID error:', error);
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
export const updateUser = async (req: Request, res: Response) => {
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
    const values: any[] = [];
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

    res.json({
      success: true,
      data: { user: result.rows[0] },
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Update user error:', error);
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
export const unlockUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await query(
      `UPDATE users
      SET failed_login_attempts = 0, locked_until = NULL
      WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: 'User account unlocked successfully',
    });
  } catch (error) {
    console.error('Unlock user error:', error);
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
export const verifyUserEmail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await query(
      `UPDATE users
      SET email_verified = TRUE,
          email_verification_token = NULL,
          email_verification_expires = NULL
      WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: 'User email verified successfully',
    });
  } catch (error) {
    console.error('Verify user email error:', error);
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
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
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
    console.error('Get stats error:', error);
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
export const resetUserPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      });
    }

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

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
    });
  }
};
