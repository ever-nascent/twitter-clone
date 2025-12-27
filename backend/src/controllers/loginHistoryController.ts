import { Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../types';
import {
  getUserLoginHistory,
  getSuspiciousLogins,
} from '../utils/loginMonitoring';

/**
 * Get login history for authenticated user
 * GET /api/auth/login-history
 *
 * Query parameters:
 * - limit: Maximum number of records (default: 50, max: 100)
 *
 * Returns timeline of all login attempts with:
 * - Success/failure status
 * - IP address, device, location
 * - Timestamp
 * - Suspicious flag and reason
 */
export const getLoginHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Parse limit from query params
    const limitParam = req.query.limit;
    let limit = 50; // Default

    if (limitParam) {
      const parsedLimit = parseInt(limitParam as string, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
        limit = parsedLimit;
      }
    }

    // Get login history
    const history = await getUserLoginHistory(pool, req.user.userId, limit);

    res.json({
      success: true,
      data: {
        history: history.map((attempt) => ({
          id: attempt.id,
          success: attempt.success,
          failureReason: attempt.failureReason,
          ipAddress: attempt.ipAddress,
          deviceInfo: attempt.deviceInfo,
          location: attempt.location,
          suspicious: attempt.suspicious,
          suspiciousReason: attempt.suspiciousReason,
          createdAt: attempt.createdAt,
        })),
        count: history.length,
      },
    });
  } catch (error) {
    console.error('Get login history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get login history',
    });
  }
};

/**
 * Get suspicious login attempts
 * GET /api/auth/login-history/suspicious
 *
 * Query parameters:
 * - limit: Maximum number of records (default: 10, max: 50)
 *
 * Returns only login attempts flagged as suspicious
 */
export const getSuspiciousLoginHistory = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Parse limit from query params
    const limitParam = req.query.limit;
    let limit = 10; // Default

    if (limitParam) {
      const parsedLimit = parseInt(limitParam as string, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 50) {
        limit = parsedLimit;
      }
    }

    // Get suspicious logins
    const suspicious = await getSuspiciousLogins(pool, req.user.userId, limit);

    res.json({
      success: true,
      data: {
        suspicious: suspicious.map((attempt) => ({
          id: attempt.id,
          success: attempt.success,
          failureReason: attempt.failureReason,
          ipAddress: attempt.ipAddress,
          deviceInfo: attempt.deviceInfo,
          location: attempt.location,
          suspiciousReason: attempt.suspiciousReason,
          createdAt: attempt.createdAt,
        })),
        count: suspicious.length,
      },
    });
  } catch (error) {
    console.error('Get suspicious login history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suspicious login history',
    });
  }
};

/**
 * Get login statistics
 * GET /api/auth/login-history/stats
 *
 * Returns aggregated statistics about login history:
 * - Total login attempts
 * - Successful logins
 * - Failed logins
 * - Suspicious logins
 * - Unique IPs
 * - Unique devices
 */
export const getLoginStats = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    // Get statistics from login_attempts table
    const statsResult = await pool.query(
      `SELECT
         COUNT(*) as total_attempts,
         SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as successful_logins,
         SUM(CASE WHEN success = FALSE THEN 1 ELSE 0 END) as failed_logins,
         SUM(CASE WHEN suspicious = TRUE THEN 1 ELSE 0 END) as suspicious_logins,
         COUNT(DISTINCT ip_address) as unique_ips,
         COUNT(DISTINCT device_info) as unique_devices
       FROM login_attempts
       WHERE user_id = $1`,
      [req.user.userId]
    );

    const stats = statsResult.rows[0];

    // Get recent activity (last 30 days)
    const recentResult = await pool.query(
      `SELECT
         COUNT(*) as recent_attempts,
         SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) as recent_successful,
         SUM(CASE WHEN suspicious = TRUE THEN 1 ELSE 0 END) as recent_suspicious
       FROM login_attempts
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [req.user.userId]
    );

    const recentStats = recentResult.rows[0];

    // Get most recent login
    const lastLoginResult = await pool.query(
      `SELECT created_at, ip_address, device_info, location
       FROM login_attempts
       WHERE user_id = $1 AND success = TRUE
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.userId]
    );

    const lastLogin = lastLoginResult.rows[0] || null;

    res.json({
      success: true,
      data: {
        allTime: {
          totalAttempts: parseInt(stats.total_attempts || '0', 10),
          successfulLogins: parseInt(stats.successful_logins || '0', 10),
          failedLogins: parseInt(stats.failed_logins || '0', 10),
          suspiciousLogins: parseInt(stats.suspicious_logins || '0', 10),
          uniqueIPs: parseInt(stats.unique_ips || '0', 10),
          uniqueDevices: parseInt(stats.unique_devices || '0', 10),
        },
        last30Days: {
          totalAttempts: parseInt(recentStats.recent_attempts || '0', 10),
          successfulLogins: parseInt(recentStats.recent_successful || '0', 10),
          suspiciousLogins: parseInt(recentStats.recent_suspicious || '0', 10),
        },
        lastLogin: lastLogin
          ? {
              timestamp: lastLogin.created_at,
              ipAddress: lastLogin.ip_address,
              deviceInfo: lastLogin.device_info,
              location: lastLogin.location,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Get login stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get login statistics',
    });
  }
};
