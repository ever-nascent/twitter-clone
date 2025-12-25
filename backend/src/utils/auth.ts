import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWTPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

/**
 * Hash a password using bcrypt
 * Salt rounds: 10 (recommended for good security/performance balance)
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare a plain text password with a hashed password
 */
export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Generate a JWT access token
 */
export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Generate a refresh token (random string)
 */
export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Verify and decode a JWT token
 */
export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Validate password strength
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export const validatePassword = (password: string): string | null => {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null; // Valid password
};

/**
 * Validate username
 * Requirements:
 * - 3-50 characters
 * - Only letters, numbers, and underscores
 * - Must start with a letter
 */
export const validateUsername = (username: string): string | null => {
  if (username.length < 3 || username.length > 50) {
    return 'Username must be between 3 and 50 characters';
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(username)) {
    return 'Username must start with a letter and contain only letters, numbers, and underscores';
  }
  return null; // Valid username
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): string | null => {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  if (!emailRegex.test(email)) {
    return 'Invalid email format';
  }
  return null; // Valid email
};

/**
 * Mask email address for privacy compliance (GDPR/CCPA)
 * Shows only first character and domain, masks the rest
 * Example: "john.doe@example.com" -> "j****@example.com"
 */
export const maskEmail = (email: string): string => {
  if (!email || typeof email !== 'string') {
    return '****@****.***';
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return '****@****.***';
  }

  const [localPart, domain] = parts;

  // Show only first character of local part
  const maskedLocal = localPart.length > 0
    ? localPart[0] + '****'
    : '****';

  return `${maskedLocal}@${domain}`;
};
