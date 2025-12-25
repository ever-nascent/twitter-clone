import { Pool } from 'pg';
import crypto from 'crypto';

/**
 * Recovery Codes for Account Access
 *
 * Emergency access codes separate from 2FA backup codes
 * Used for account recovery when locked out
 * Valid for 1 year, single-use
 */

const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_LENGTH = 12;
const RECOVERY_CODE_EXPIRY_DAYS = 365; // 1 year

export interface RecoveryCode {
  id: number;
  userId: number;
  codeHash: string;
  used: boolean;
  usedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Generate a single recovery code
 * Format: XXXX-XXXX-XXXX (12 characters, 3 groups)
 * @returns Recovery code string
 */
function generateRecoveryCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars (0,O,1,I)
  let code = '';

  for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];

    // Add dashes for readability
    if ((i + 1) % 4 === 0 && i < RECOVERY_CODE_LENGTH - 1) {
      code += '-';
    }
  }

  return code;
}

/**
 * Hash a recovery code for secure storage
 * @param code Plaintext recovery code
 * @returns SHA-256 hash
 */
function hashRecoveryCode(code: string): string {
  // Remove dashes and convert to uppercase for consistency
  const normalized = code.replace(/-/g, '').toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generate new recovery codes for a user
 * @param pool Database pool
 * @param userId User ID
 * @returns Array of plaintext recovery codes (show to user once)
 */
export async function generateRecoveryCodes(
  pool: Pool,
  userId: number
): Promise<string[]> {
  const codes: string[] = [];
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + RECOVERY_CODE_EXPIRY_DAYS);

  // Delete existing unused codes for this user
  await pool.query(
    'DELETE FROM recovery_codes WHERE user_id = $1 AND used = FALSE',
    [userId]
  );

  // Generate and store new codes
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = generateRecoveryCode();
    const codeHash = hashRecoveryCode(code);

    await pool.query(
      'INSERT INTO recovery_codes (user_id, code_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, codeHash, expiresAt]
    );

    codes.push(code);
  }

  return codes;
}

/**
 * Verify a recovery code and mark as used
 * @param pool Database pool
 * @param userId User ID
 * @param code Plaintext recovery code
 * @returns True if code is valid and unused
 */
export async function verifyRecoveryCode(
  pool: Pool,
  userId: number,
  code: string
): Promise<boolean> {
  const codeHash = hashRecoveryCode(code);

  // Find valid, unused, non-expired code
  const result = await pool.query(
    `SELECT id FROM recovery_codes
     WHERE user_id = $1
     AND code_hash = $2
     AND used = FALSE
     AND expires_at > NOW()`,
    [userId, codeHash]
  );

  if (result.rows.length === 0) {
    return false;
  }

  // Mark as used
  await pool.query(
    'UPDATE recovery_codes SET used = TRUE, used_at = NOW() WHERE id = $1',
    [result.rows[0].id]
  );

  return true;
}

/**
 * Get recovery code status for a user
 * @param pool Database pool
 * @param userId User ID
 * @returns Object with total, used, and remaining counts
 */
export async function getRecoveryCodeStatus(
  pool: Pool,
  userId: number
): Promise<{ total: number; used: number; remaining: number; hasExpired: boolean }> {
  const result = await pool.query(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN used = TRUE THEN 1 ELSE 0 END) as used,
       SUM(CASE WHEN used = FALSE AND expires_at > NOW() THEN 1 ELSE 0 END) as remaining,
       BOOL_OR(expires_at <= NOW() AND used = FALSE) as has_expired
     FROM recovery_codes
     WHERE user_id = $1`,
    [userId]
  );

  const row = result.rows[0];
  return {
    total: parseInt(row.total || '0', 10),
    used: parseInt(row.used || '0', 10),
    remaining: parseInt(row.remaining || '0', 10),
    hasExpired: row.has_expired || false,
  };
}

/**
 * Check if user has valid recovery codes
 * @param pool Database pool
 * @param userId User ID
 * @returns True if user has at least one unused, non-expired code
 */
export async function hasValidRecoveryCodes(
  pool: Pool,
  userId: number
): Promise<boolean> {
  const status = await getRecoveryCodeStatus(pool, userId);
  return status.remaining > 0;
}

/**
 * Delete all recovery codes for a user
 * @param pool Database pool
 * @param userId User ID
 * @returns Number of codes deleted
 */
export async function deleteAllRecoveryCodes(
  pool: Pool,
  userId: number
): Promise<number> {
  const result = await pool.query(
    'DELETE FROM recovery_codes WHERE user_id = $1',
    [userId]
  );
  return result.rowCount || 0;
}

/**
 * Clean up expired recovery codes
 * @param pool Database pool
 * @returns Number of codes deleted
 */
export async function cleanupExpiredRecoveryCodes(pool: Pool): Promise<number> {
  const result = await pool.query(
    'DELETE FROM recovery_codes WHERE expires_at <= NOW()'
  );
  return result.rowCount || 0;
}
