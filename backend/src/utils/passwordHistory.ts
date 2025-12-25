import { Pool } from 'pg';
import { comparePassword } from './auth';

/**
 * Password History Utilities
 *
 * Prevents password reuse within 1 year following industry best practices
 * Compliant with NIST SP 800-63B guidelines
 */

const PASSWORD_HISTORY_RETENTION_DAYS = 365; // 1 year

/**
 * Add current password to history before changing
 * @param pool Database pool
 * @param userId User ID
 * @param currentPasswordHash Current hashed password to store
 */
export async function addPasswordToHistory(
  pool: Pool,
  userId: number,
  currentPasswordHash: string
): Promise<void> {
  await pool.query(
    'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
    [userId, currentPasswordHash]
  );
}

/**
 * Check if password was used within the last year
 * @param pool Database pool
 * @param userId User ID
 * @param newPassword New password (plaintext) to check
 * @returns True if password was used recently
 */
export async function isPasswordRecentlyUsed(
  pool: Pool,
  userId: number,
  newPassword: string
): Promise<boolean> {
  // Get password history from last year
  const result = await pool.query(
    `SELECT password_hash FROM password_history
     WHERE user_id = $1
     AND created_at > NOW() - INTERVAL '${PASSWORD_HISTORY_RETENTION_DAYS} days'
     ORDER BY created_at DESC`,
    [userId]
  );

  // Check new password against each historical password
  for (const row of result.rows) {
    const isMatch = await comparePassword(newPassword, row.password_hash);
    if (isMatch) {
      return true;
    }
  }

  return false;
}

/**
 * Clean up old password history (older than 1 year)
 * Should be run periodically via cron job
 * @param pool Database pool
 * @returns Number of records deleted
 */
export async function cleanupOldPasswordHistory(pool: Pool): Promise<number> {
  const result = await pool.query(
    `DELETE FROM password_history
     WHERE created_at <= NOW() - INTERVAL '${PASSWORD_HISTORY_RETENTION_DAYS} days'`
  );
  return result.rowCount || 0;
}

/**
 * Get password history count for a user
 * @param pool Database pool
 * @param userId User ID
 * @returns Number of password changes in last year
 */
export async function getPasswordHistoryCount(
  pool: Pool,
  userId: number
): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM password_history
     WHERE user_id = $1
     AND created_at > NOW() - INTERVAL '${PASSWORD_HISTORY_RETENTION_DAYS} days'`,
    [userId]
  );
  return parseInt(result.rows[0]?.count || '0', 10);
}
