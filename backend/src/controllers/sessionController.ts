import { Response } from 'express';
import { pool, query } from '../config/database';
import { AuthRequest } from '../types';
import {
  getUserSessions,
  deleteSessionById,
  deleteOtherSessions,
} from '../utils/session';
import { hashRefreshToken } from '../utils/auth';

/**
 * Session Management Controller
 *
 * Provides endpoints for users to view and manage their active sessions
 */

/**
 * Get all active sessions for the current user
 * GET /api/sessions
 *
 * Returns list of all active sessions with device info, location, and last activity
 */
export const getSessions = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Get current token hash to mark the current session
    const currentRefreshToken = req.cookies.refreshToken;
    const currentTokenHash = currentRefreshToken
      ? hashRefreshToken(currentRefreshToken)
      : undefined;

    const sessions = await getUserSessions(pool, req.user.userId, currentTokenHash);

    res.json({
      success: true,
      data: {
        sessions: sessions.map((session) => ({
          id: session.id,
          deviceInfo: session.deviceInfo,
          ipAddress: session.ipAddress,
          location: session.location,
          lastActiveAt: session.lastActiveAt,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          isCurrent: session.isCurrent,
        })),
      },
    });
  } catch (error) {
    logger.error('Get sessions error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions',
    });
  }
};

/**
 * Delete a specific session (remote logout)
 * DELETE /api/sessions/:id
 *
 * Allows user to logout from a specific device
 */
export const deleteSession = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const sessionId = parseInt(req.params.id);

    if (isNaN(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID',
      });
    }

    // First, get the session to find its token hash
    const sessionResult = await query(
      'SELECT refresh_token_hash FROM sessions WHERE id = $1 AND user_id = $2',
      [sessionId, req.user.userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    const tokenHash = sessionResult.rows[0].refresh_token_hash;

    // Delete the refresh token (which will also be cleaned up by session deletion)
    await query('DELETE FROM refresh_tokens WHERE token = $1', [tokenHash]);

    // Delete the session
    const deleted = await deleteSessionById(pool, req.user.userId, sessionId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or already deleted',
      });
    }

    res.json({
      success: true,
      message: 'Session deleted successfully',
    });
  } catch (error) {
    logger.error('Delete session error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to delete session',
    });
  }
};

/**
 * Delete all other sessions (logout from all other devices)
 * DELETE /api/sessions/others
 *
 * Logs out from all devices except the current one
 */
export const deleteOtherSessionsController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const currentRefreshToken = req.cookies.refreshToken;

    if (!currentRefreshToken) {
      return res.status(400).json({
        success: false,
        error: 'No active session found',
      });
    }

    const hashedCurrentToken = hashRefreshToken(currentRefreshToken);

    // Delete all refresh tokens except current one
    await query(
      'DELETE FROM refresh_tokens WHERE user_id = $1 AND token != $2',
      [req.user.userId, hashedCurrentToken]
    );

    // Delete all sessions except current one
    const deletedCount = await deleteOtherSessions(pool, req.user.userId, hashedCurrentToken);

    res.json({
      success: true,
      message: `Logged out from ${deletedCount} other device(s)`,
      deletedCount,
    });
  } catch (error) {
    logger.error('Delete other sessions error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to delete sessions',
    });
  }
};
