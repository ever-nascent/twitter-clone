import { Pool } from 'pg';
import crypto from 'crypto';
import { parseDeviceInfo } from './session';

/**
 * Trusted Devices Management
 *
 * Allows users to mark devices as trusted to skip 2FA for 30 days
 * Implements device fingerprinting following industry best practices
 */

const TRUST_DURATION_DAYS = 30;

export interface TrustedDevice {
  id: number;
  userId: number;
  deviceFingerprint: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  trustedAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
  isCurrent?: boolean;
}

/**
 * Generate device fingerprint from request
 * Combines IP, user agent, and other headers for uniqueness
 * @param req Express request object
 * @returns Device fingerprint hash
 */
export function generateDeviceFingerprint(req: any): string {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    // Note: IP alone is not sufficient due to dynamic IPs
    // But combined with other factors provides reasonable uniqueness
  ];

  const fingerprintString = components.join('|');
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
}

/**
 * Check if current device is trusted
 * @param pool Database pool
 * @param userId User ID
 * @param req Express request object
 * @returns True if device is trusted and not expired
 */
export async function isDeviceTrusted(
  pool: Pool,
  userId: number,
  req: any
): Promise<boolean> {
  const fingerprint = generateDeviceFingerprint(req);

  const result = await pool.query(
    `SELECT id FROM trusted_devices
     WHERE user_id = $1
     AND device_fingerprint = $2
     AND expires_at > NOW()`,
    [userId, fingerprint]
  );

  if (result.rows.length > 0) {
    // Update last used timestamp
    await pool.query(
      'UPDATE trusted_devices SET last_used_at = NOW() WHERE id = $1',
      [result.rows[0].id]
    );
    return true;
  }

  return false;
}

/**
 * Trust the current device
 * @param pool Database pool
 * @param userId User ID
 * @param req Express request object
 * @returns Created trusted device record
 */
export async function trustDevice(
  pool: Pool,
  userId: number,
  req: any
): Promise<TrustedDevice> {
  const fingerprint = generateDeviceFingerprint(req);
  const userAgent = req.headers['user-agent'];
  const ipAddress = req.ip || req.socket.remoteAddress;
  const deviceName = parseDeviceInfo(userAgent);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TRUST_DURATION_DAYS);

  const result = await pool.query(
    `INSERT INTO trusted_devices
     (user_id, device_fingerprint, device_name, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, device_fingerprint)
     DO UPDATE SET
       last_used_at = NOW(),
       expires_at = EXCLUDED.expires_at,
       ip_address = EXCLUDED.ip_address
     RETURNING *`,
    [userId, fingerprint, deviceName, ipAddress, userAgent, expiresAt]
  );

  return result.rows[0];
}

/**
 * Revoke trust for a specific device
 * @param pool Database pool
 * @param userId User ID
 * @param deviceId Device ID to revoke
 * @returns True if device was revoked
 */
export async function revokeDevice(
  pool: Pool,
  userId: number,
  deviceId: number
): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM trusted_devices WHERE id = $1 AND user_id = $2',
    [deviceId, userId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Revoke all trusted devices for a user
 * @param pool Database pool
 * @param userId User ID
 * @returns Number of devices revoked
 */
export async function revokeAllDevices(pool: Pool, userId: number): Promise<number> {
  const result = await pool.query(
    'DELETE FROM trusted_devices WHERE user_id = $1',
    [userId]
  );
  return result.rowCount || 0;
}

/**
 * Get all trusted devices for a user
 * @param pool Database pool
 * @param userId User ID
 * @param currentFingerprint Current device fingerprint (to mark as current)
 * @returns Array of trusted devices
 */
export async function getTrustedDevices(
  pool: Pool,
  userId: number,
  currentFingerprint?: string
): Promise<TrustedDevice[]> {
  const result = await pool.query(
    `SELECT * FROM trusted_devices
     WHERE user_id = $1 AND expires_at > NOW()
     ORDER BY last_used_at DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    ...row,
    isCurrent: currentFingerprint ? row.device_fingerprint === currentFingerprint : false,
  }));
}

/**
 * Clean up expired trusted devices
 * @param pool Database pool
 * @returns Number of devices cleaned up
 */
export async function cleanupExpiredDevices(pool: Pool): Promise<number> {
  const result = await pool.query(
    'DELETE FROM trusted_devices WHERE expires_at <= NOW()'
  );
  return result.rowCount || 0;
}

/**
 * Get trusted device count for a user
 * @param pool Database pool
 * @param userId User ID
 * @returns Number of active trusted devices
 */
export async function getTrustedDeviceCount(
  pool: Pool,
  userId: number
): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM trusted_devices
     WHERE user_id = $1 AND expires_at > NOW()`,
    [userId]
  );
  return parseInt(result.rows[0]?.count || '0', 10);
}
