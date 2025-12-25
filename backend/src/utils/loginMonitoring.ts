import { Pool } from 'pg';
import { parseDeviceInfo, getLocationFromIP } from './session';

/**
 * Login Monitoring & Suspicious Activity Detection
 *
 * Tracks all login attempts and detects anomalies following industry best practices
 * Implements fraud detection patterns used by major platforms
 */

export interface LoginAttempt {
  id: number;
  userId: number | null;
  email: string;
  success: boolean;
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: string | null;
  location: string | null;
  suspicious: boolean;
  suspiciousReason: string | null;
  createdAt: Date;
}

/**
 * Log a login attempt (success or failure)
 * @param pool Database pool
 * @param params Login attempt parameters
 * @returns Created login attempt record
 */
export async function logLoginAttempt(
  pool: Pool,
  params: {
    userId: number | null;
    email: string;
    success: boolean;
    failureReason?: string;
    req: any;
  }
): Promise<LoginAttempt> {
  const { userId, email, success, failureReason, req } = params;

  const userAgent = req.headers['user-agent'];
  const ipAddress = req.ip || req.socket.remoteAddress;
  const deviceInfo = parseDeviceInfo(userAgent);
  const location = getLocationFromIP(ipAddress);

  // Detect suspicious activity
  const { suspicious, suspiciousReason } = await detectSuspiciousActivity(pool, {
    userId,
    email,
    ipAddress,
    deviceInfo,
    location,
  });

  const result = await pool.query(
    `INSERT INTO login_attempts
     (user_id, email, success, failure_reason, ip_address, user_agent, device_info, location, suspicious, suspicious_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      userId,
      email,
      success,
      failureReason || null,
      ipAddress,
      userAgent,
      deviceInfo,
      location,
      suspicious,
      suspiciousReason,
    ]
  );

  return result.rows[0];
}

/**
 * Detect suspicious login activity
 * @param pool Database pool
 * @param params Login context
 * @returns Suspicion result with reason
 */
async function detectSuspiciousActivity(
  pool: Pool,
  params: {
    userId: number | null;
    email: string;
    ipAddress: string | null;
    deviceInfo: string | null;
    location: string | null;
  }
): Promise<{ suspicious: boolean; suspiciousReason: string | null }> {
  const { userId, email, ipAddress, deviceInfo, location } = params;

  if (!userId) {
    // Can't detect anomalies for failed login attempts without user ID
    return { suspicious: false, suspiciousReason: null };
  }

  const reasons: string[] = [];

  // Check 1: New IP address
  const ipResult = await pool.query(
    `SELECT COUNT(*) as count FROM login_attempts
     WHERE user_id = $1 AND ip_address = $2 AND success = TRUE`,
    [userId, ipAddress]
  );
  const isNewIP = parseInt(ipResult.rows[0]?.count || '0', 10) === 0;
  if (isNewIP) {
    reasons.push('New IP address');
  }

  // Check 2: New device
  const deviceResult = await pool.query(
    `SELECT COUNT(*) as count FROM login_attempts
     WHERE user_id = $1 AND device_info = $2 AND success = TRUE`,
    [userId, deviceInfo]
  );
  const isNewDevice = parseInt(deviceResult.rows[0]?.count || '0', 10) === 0;
  if (isNewDevice) {
    reasons.push('New device');
  }

  // Check 3: New location
  if (location && location !== 'Local Network') {
    const locationResult = await pool.query(
      `SELECT COUNT(*) as count FROM login_attempts
       WHERE user_id = $1 AND location = $2 AND success = TRUE`,
      [userId, location]
    );
    const isNewLocation = parseInt(locationResult.rows[0]?.count || '0', 10) === 0;
    if (isNewLocation) {
      reasons.push('New location');
    }
  }

  // Check 4: Multiple failed attempts recently
  const failedResult = await pool.query(
    `SELECT COUNT(*) as count FROM login_attempts
     WHERE email = $1 AND success = FALSE
     AND created_at > NOW() - INTERVAL '1 hour'`,
    [email]
  );
  const recentFailures = parseInt(failedResult.rows[0]?.count || '0', 10);
  if (recentFailures >= 3) {
    reasons.push(`${recentFailures} failed attempts in last hour`);
  }

  // Check 5: Unusual time (3am-6am local time)
  // This would require timezone detection - placeholder for future enhancement
  // const hour = new Date().getHours();
  // if (hour >= 3 && hour < 6) {
  //   reasons.push('Unusual time (3-6 AM)');
  // }

  const suspicious = reasons.length >= 2; // Flag if 2+ anomalies
  const suspiciousReason = reasons.length > 0 ? reasons.join(', ') : null;

  return { suspicious, suspiciousReason };
}

/**
 * Get login history for a user
 * @param pool Database pool
 * @param userId User ID
 * @param limit Maximum number of records
 * @returns Array of login attempts
 */
export async function getUserLoginHistory(
  pool: Pool,
  userId: number,
  limit: number = 50
): Promise<LoginAttempt[]> {
  const result = await pool.query(
    `SELECT * FROM login_attempts
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

/**
 * Get failed login attempts for an IP address
 * @param pool Database pool
 * @param ipAddress IP address
 * @param timeWindowMinutes Time window in minutes
 * @returns Number of failed attempts
 */
export async function getFailedAttemptsForIP(
  pool: Pool,
  ipAddress: string,
  timeWindowMinutes: number = 60
): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM login_attempts
     WHERE ip_address = $1
     AND success = FALSE
     AND created_at > NOW() - INTERVAL '${timeWindowMinutes} minutes'`,
    [ipAddress]
  );
  return parseInt(result.rows[0]?.count || '0', 10);
}

/**
 * Get suspicious login attempts for a user
 * @param pool Database pool
 * @param userId User ID
 * @param limit Maximum number of records
 * @returns Array of suspicious login attempts
 */
export async function getSuspiciousLogins(
  pool: Pool,
  userId: number,
  limit: number = 10
): Promise<LoginAttempt[]> {
  const result = await pool.query(
    `SELECT * FROM login_attempts
     WHERE user_id = $1 AND suspicious = TRUE
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

/**
 * Check if there are unacknowledged suspicious logins
 * @param pool Database pool
 * @param userId User ID
 * @returns True if there are suspicious logins in last 7 days
 */
export async function hasRecentSuspiciousLogins(
  pool: Pool,
  userId: number
): Promise<boolean> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM login_attempts
     WHERE user_id = $1
     AND suspicious = TRUE
     AND created_at > NOW() - INTERVAL '7 days'`,
    [userId]
  );
  return parseInt(result.rows[0]?.count || '0', 10) > 0;
}

/**
 * Clean up old login attempts (older than 90 days)
 * @param pool Database pool
 * @returns Number of records deleted
 */
export async function cleanupOldLoginAttempts(pool: Pool): Promise<number> {
  const result = await pool.query(
    `DELETE FROM login_attempts
     WHERE created_at <= NOW() - INTERVAL '90 days'`
  );
  return result.rowCount || 0;
}
