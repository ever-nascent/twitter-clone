import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * Two-Factor Authentication Utilities
 *
 * Implements TOTP (Time-based One-Time Password) authentication
 * Compatible with Google Authenticator, Authy, Microsoft Authenticator, etc.
 */

const APP_NAME = 'Social Media';

/**
 * Generate a new TOTP secret for a user
 * @param username User's username for QR code label
 * @param email User's email for QR code label
 * @returns Object with secret and QR code data URL
 */
export async function generateTOTPSecret(
  username: string,
  email: string
): Promise<{ secret: string; qrCodeUrl: string; otpauthUrl: string }> {
  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `${APP_NAME} (${username})`,
    issuer: APP_NAME,
    length: 32, // 32 bytes = 256 bits of entropy
  });

  if (!secret.otpauth_url) {
    throw new Error('Failed to generate TOTP secret');
  }

  // Generate QR code as data URL
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32, // Base32-encoded secret (to store in DB)
    qrCodeUrl, // Data URL for QR code image
    otpauthUrl: secret.otpauth_url, // otpauth:// URL (for manual entry)
  };
}

/**
 * Verify a TOTP code
 * @param secret User's TOTP secret (base32)
 * @param token 6-digit code from authenticator app
 * @returns True if code is valid
 */
export function verifyTOTP(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // Allow 1 step (30s) before/after for clock skew
  });
}

/**
 * Generate backup codes for 2FA recovery
 * @param count Number of backup codes to generate (default: 10)
 * @returns Array of backup codes (plaintext) and their hashes
 */
export function generateBackupCodes(
  count: number = 10
): { codes: string[]; hashedCodes: string[] } {
  const codes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto
      .randomBytes(6)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 8)
      .toUpperCase();

    // Hash the code for storage
    const hashedCode = hashBackupCode(code);

    codes.push(code);
    hashedCodes.push(hashedCode);
  }

  return { codes, hashedCodes };
}

/**
 * Hash a backup code for secure storage
 * @param code Plaintext backup code
 * @returns SHA-256 hash of the code
 */
export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
}

/**
 * Verify a backup code
 * @param code Plaintext code provided by user
 * @param hashedCodes Array of hashed backup codes from database
 * @returns Index of matching code, or -1 if not found
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): number {
  const hashedCode = hashBackupCode(code);
  return hashedCodes.findIndex((stored) => stored === hashedCode);
}

/**
 * Format backup codes for display
 * @param codes Array of backup codes
 * @returns Formatted string for display
 */
export function formatBackupCodes(codes: string[]): string[] {
  return codes.map((code) => {
    // Format as XXXX-XXXX for readability
    return code.substring(0, 4) + '-' + code.substring(4);
  });
}
