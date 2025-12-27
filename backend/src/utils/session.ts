import { Pool } from 'pg';

/**
 * Session Management Utilities
 *
 * Handles session tracking for security monitoring and remote logout
 */

export interface SessionInfo {
  id: number;
  userId: number;
  deviceInfo: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  location: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  expiresAt: Date;
  isCurrent?: boolean;
}

/**
 * Parse user agent string to extract device info
 * @param userAgent User-Agent header
 * @returns Human-readable device description
 */
export function parseDeviceInfo(userAgent: string | undefined): string {
  if (!userAgent) return 'Unknown Device';

  // Detect browser
  let browser = 'Unknown Browser';
  if (userAgent.includes('Firefox/')) {
    const version = userAgent.match(/Firefox\/(\d+)/)?.[1];
    browser = version ? `Firefox ${version}` : 'Firefox';
  } else if (userAgent.includes('Edg/')) {
    const version = userAgent.match(/Edg\/(\d+)/)?.[1];
    browser = version ? `Edge ${version}` : 'Edge';
  } else if (userAgent.includes('Chrome/')) {
    const version = userAgent.match(/Chrome\/(\d+)/)?.[1];
    browser = version ? `Chrome ${version}` : 'Chrome';
  } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
    const version = userAgent.match(/Version\/(\d+)/)?.[1];
    browser = version ? `Safari ${version}` : 'Safari';
  }

  // Detect OS
  let os = 'Unknown OS';
  if (userAgent.includes('Windows NT 10.0')) {
    os = 'Windows 10/11';
  } else if (userAgent.includes('Windows NT')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS X')) {
    const version = userAgent.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.');
    os = version ? `macOS ${version}` : 'macOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    const version = userAgent.match(/Android (\d+)/)?.[1];
    os = version ? `Android ${version}` : 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    const version = userAgent.match(/OS (\d+[._]\d+)/)?.[1]?.replace('_', '.');
    os = version ? `iOS ${version}` : 'iOS';
  }

  return `${browser} on ${os}`;
}

/**
 * Get approximate location from IP address
 * @param ipAddress IP address
 * @returns Location string (or null if unavailable)
 */
export function getLocationFromIP(ipAddress: string | undefined): string | null {
  // In production, this would use a GeoIP service (MaxMind, ipapi.co, etc.)
  // For now, we'll just return null for localhost and store the IP
  if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.')) {
    return 'Local Network';
  }

  // TODO: Integrate with GeoIP service for location tracking

  return null; // Placeholder - will be enhanced with GeoIP integration
}

/**
 * Create a new session record
 * @param pool Database pool
 * @param userId User ID
 * @param tokenHash Hashed refresh token
 * @param req Express request object
 * @param expiresAt Token expiration date
 */
export async function createSession(
  pool: Pool,
  userId: number,
  tokenHash: string,
  req: any,
  expiresAt: Date
): Promise<void> {
  const userAgent = req.headers['user-agent'];
  const ipAddress = req.ip || req.socket.remoteAddress;

  const deviceInfo = parseDeviceInfo(userAgent);
  const location = getLocationFromIP(ipAddress);

  await pool.query(
    `INSERT INTO sessions
     (user_id, refresh_token_hash, device_info, ip_address, user_agent, location, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, tokenHash, deviceInfo, ipAddress, userAgent, location, expiresAt]
  );
}

/**
 * Update session's last active timestamp
 * @param pool Database pool
 * @param tokenHash Hashed refresh token
 */
export async function updateSessionActivity(pool: Pool, tokenHash: string): Promise<void> {
  await pool.query(
    'UPDATE sessions SET last_active_at = CURRENT_TIMESTAMP WHERE refresh_token_hash = $1',
    [tokenHash]
  );
}

/**
 * Delete a session by token hash
 * @param pool Database pool
 * @param tokenHash Hashed refresh token
 */
export async function deleteSession(pool: Pool, tokenHash: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE refresh_token_hash = $1', [tokenHash]);
}

/**
 * Delete a specific session by ID (for remote logout)
 * @param pool Database pool
 * @param userId User ID (for authorization)
 * @param sessionId Session ID to delete
 * @returns True if session was deleted
 */
export async function deleteSessionById(
  pool: Pool,
  userId: number,
  sessionId: number
): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM sessions WHERE id = $1 AND user_id = $2',
    [sessionId, userId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Delete all sessions for a user except the current one
 * @param pool Database pool
 * @param userId User ID
 * @param currentTokenHash Current session's token hash (to keep)
 * @returns Number of sessions deleted
 */
export async function deleteOtherSessions(
  pool: Pool,
  userId: number,
  currentTokenHash: string
): Promise<number> {
  const result = await pool.query(
    'DELETE FROM sessions WHERE user_id = $1 AND refresh_token_hash != $2',
    [userId, currentTokenHash]
  );
  return result.rowCount || 0;
}

/**
 * Get all active sessions for a user
 * @param pool Database pool
 * @param userId User ID
 * @param currentTokenHash Current session's token hash (to mark as current)
 * @returns Array of session info
 */
export async function getUserSessions(
  pool: Pool,
  userId: number,
  currentTokenHash?: string
): Promise<SessionInfo[]> {
  const result = await pool.query(
    `SELECT
      id,
      user_id,
      device_info,
      ip_address,
      user_agent,
      location,
      last_active_at,
      created_at,
      expires_at,
      refresh_token_hash
     FROM sessions
     WHERE user_id = $1 AND expires_at > NOW()
     ORDER BY last_active_at DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    deviceInfo: row.device_info,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    location: row.location,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isCurrent: currentTokenHash ? row.refresh_token_hash === currentTokenHash : false,
  }));
}

/**
 * Clean up expired sessions (should be run periodically)
 * @param pool Database pool
 * @returns Number of sessions deleted
 */
export async function cleanupExpiredSessions(pool: Pool): Promise<number> {
  const result = await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
  return result.rowCount || 0;
}
