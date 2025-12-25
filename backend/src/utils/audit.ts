import { Request } from 'express';
import { query } from '../config/database';
import { logger } from './logger';

/**
 * Audit Logging Utility
 *
 * SECURITY & COMPLIANCE: Comprehensive audit trail for admin actions
 *
 * Why audit logging is critical:
 * - Security forensics: Track who did what, when, and from where
 * - Compliance: SOC 2, ISO 27001, GDPR Article 30, HIPAA, PCI-DSS
 * - Accountability: Prevent insider threats, detect unauthorized access
 * - Incident response: Investigation and root cause analysis
 *
 * What to log:
 * - Who: Admin user ID and username
 * - What: Action performed (user.delete, user.password_reset, etc.)
 * - When: Timestamp with timezone
 * - Where: IP address and user agent
 * - Target: What resource was affected
 * - Details: Additional context (changed fields, old/new values)
 *
 * References:
 * - OWASP Logging Cheat Sheet
 * - NIST SP 800-53: AU-2, AU-3, AU-6
 * - GDPR Article 30: Records of processing activities
 */

/**
 * Supported audit action types
 * Format: resource.action
 */
export enum AuditAction {
  // User management
  USER_CREATE = 'user.create',
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',
  USER_PASSWORD_RESET = 'user.password_reset',
  USER_UNLOCK = 'user.unlock',
  USER_EMAIL_VERIFY = 'user.email_verify',
  USER_ROLE_CHANGE = 'user.role_change',

  // Admin actions
  ADMIN_LOGIN = 'admin.login',
  ADMIN_LOGOUT = 'admin.logout',

  // System actions
  SYSTEM_CONFIG_CHANGE = 'system.config_change',
  SYSTEM_BACKUP = 'system.backup',
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  admin_user_id: number;
  admin_username: string;
  action: AuditAction | string;
  target_type: string;
  target_id?: number;
  target_identifier?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Extract IP address from request, handling proxies
 * Respects X-Forwarded-For header when behind proxy
 */
function getIpAddress(req: Request): string | undefined {
  // Check X-Forwarded-For header (when behind proxy/load balancer)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
    // We want the first one (original client)
    const ips = typeof forwardedFor === 'string'
      ? forwardedFor.split(',').map(ip => ip.trim())
      : [forwardedFor[0]];
    return ips[0];
  }

  // Fall back to direct connection IP
  return req.ip || req.socket?.remoteAddress;
}

/**
 * Extract user agent from request
 */
function getUserAgent(req: Request): string | undefined {
  return req.headers['user-agent'];
}

/**
 * Log an audit event to the database
 *
 * @param entry - Audit log entry details
 * @param req - Optional Express request object (to auto-extract IP and user agent)
 * @returns Promise that resolves when audit log is saved
 *
 * @example
 * await logAudit({
 *   admin_user_id: 1,
 *   admin_username: 'admin',
 *   action: AuditAction.USER_DELETE,
 *   target_type: 'user',
 *   target_id: 42,
 *   target_identifier: 'john_doe',
 *   details: { reason: 'Terms violation' }
 * }, req);
 */
export async function logAudit(
  entry: AuditLogEntry,
  req?: Request
): Promise<void> {
  try {
    // Extract IP and user agent from request if provided
    const ip_address = entry.ip_address || (req ? getIpAddress(req) : undefined);
    const user_agent = entry.user_agent || (req ? getUserAgent(req) : undefined);

    // Insert audit log
    await query(
      `INSERT INTO audit_logs (
        admin_user_id,
        admin_username,
        action,
        target_type,
        target_id,
        target_identifier,
        details,
        ip_address,
        user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.admin_user_id,
        entry.admin_username,
        entry.action,
        entry.target_type,
        entry.target_id || null,
        entry.target_identifier || null,
        entry.details ? JSON.stringify(entry.details) : null,
        ip_address || null,
        user_agent || null,
      ]
    );

    // Also log to application logger for real-time monitoring
    logger.info('Audit log recorded', {
      admin_user_id: entry.admin_user_id,
      admin_username: entry.admin_username,
      action: entry.action,
      target_type: entry.target_type,
      target_id: entry.target_id,
      target_identifier: entry.target_identifier,
      ip_address,
    });
  } catch (error) {
    // CRITICAL: Audit logging failures should be logged but not block operations
    // However, we should alert on audit log failures
    logger.error('[CRITICAL] Failed to write audit log', {
      error: error instanceof Error ? error.message : 'Unknown error',
      entry,
      severity: 'CRITICAL',
      alert: 'AUDIT_LOG_FAILURE',
    });

    // Don't throw - we don't want audit logging failures to break admin operations
    // But we've logged it as CRITICAL for immediate attention
  }
}

/**
 * Get recent audit logs with pagination
 * Useful for admin dashboard showing recent activity
 *
 * @param limit - Number of records to return
 * @param offset - Number of records to skip
 * @returns Array of audit log entries
 */
export async function getRecentAuditLogs(
  limit = 100,
  offset = 0
): Promise<unknown[]> {
  try {
    const result = await query(
      `SELECT
        id,
        admin_user_id,
        admin_username,
        action,
        target_type,
        target_id,
        target_identifier,
        details,
        ip_address,
        created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2`,
      [Math.min(limit, 1000), offset] // Cap at 1000 for safety
    );

    return result.rows;
  } catch (error) {
    logger.error('Failed to fetch audit logs', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get audit logs for a specific admin user
 * Useful for tracking what a specific admin has done
 *
 * @param adminUserId - Admin user ID
 * @param limit - Number of records to return
 * @returns Array of audit log entries
 */
export async function getAuditLogsByAdmin(
  adminUserId: number,
  limit = 100
): Promise<unknown[]> {
  try {
    const result = await query(
      `SELECT
        id,
        admin_user_id,
        admin_username,
        action,
        target_type,
        target_id,
        target_identifier,
        details,
        ip_address,
        created_at
      FROM audit_logs
      WHERE admin_user_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
      [adminUserId, Math.min(limit, 1000)]
    );

    return result.rows;
  } catch (error) {
    logger.error('Failed to fetch audit logs by admin', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminUserId,
    });
    throw error;
  }
}

/**
 * Get audit logs for a specific target resource
 * Useful for seeing complete history of what happened to a user/resource
 *
 * @param targetType - Type of target (e.g., 'user')
 * @param targetId - ID of target resource
 * @param limit - Number of records to return
 * @returns Array of audit log entries
 */
export async function getAuditLogsByTarget(
  targetType: string,
  targetId: number,
  limit = 100
): Promise<unknown[]> {
  try {
    const result = await query(
      `SELECT
        id,
        admin_user_id,
        admin_username,
        action,
        target_type,
        target_id,
        target_identifier,
        details,
        ip_address,
        created_at
      FROM audit_logs
      WHERE target_type = $1 AND target_id = $2
      ORDER BY created_at DESC
      LIMIT $3`,
      [targetType, targetId, Math.min(limit, 1000)]
    );

    return result.rows;
  } catch (error) {
    logger.error('Failed to fetch audit logs by target', {
      error: error instanceof Error ? error.message : 'Unknown error',
      targetType,
      targetId,
    });
    throw error;
  }
}
