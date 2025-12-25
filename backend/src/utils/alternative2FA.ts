import crypto from 'crypto';

/**
 * Alternative 2FA Methods (SMS and Email)
 *
 * Provides SMS and Email-based 2FA as alternatives to TOTP
 * SMS via Twilio, Email via existing email system
 */

/**
 * Generate a 6-digit numeric OTP code
 * @returns 6-digit code as string
 */
export function generateOTPCode(): string {
  // Generate cryptographically secure 6-digit code
  const code = crypto.randomInt(100000, 999999).toString();
  return code;
}

/**
 * Store OTP code in Redis with expiration
 * @param redisClient Redis client
 * @param userId User ID
 * @param code OTP code
 * @param type 'sms' or 'email'
 * @param expiryMinutes Expiry time in minutes (default: 10)
 */
export async function storeOTPCode(
  redisClient: any,
  userId: number,
  code: string,
  type: 'sms' | 'email',
  expiryMinutes: number = 10
): Promise<void> {
  const key = `otp:${type}:${userId}`;
  await redisClient.setEx(key, expiryMinutes * 60, code);
}

/**
 * Verify OTP code from Redis
 * @param redisClient Redis client
 * @param userId User ID
 * @param code Code to verify
 * @param type 'sms' or 'email'
 * @returns True if code matches
 */
export async function verifyOTPCode(
  redisClient: any,
  userId: number,
  code: string,
  type: 'sms' | 'email'
): Promise<boolean> {
  const key = `otp:${type}:${userId}`;
  const storedCode = await redisClient.get(key);

  if (!storedCode || storedCode !== code) {
    return false;
  }

  // Delete code after successful verification (one-time use)
  await redisClient.del(key);
  return true;
}

/**
 * Check if OTP rate limit is exceeded
 * @param redisClient Redis client
 * @param userId User ID
 * @param type 'sms' or 'email'
 * @returns True if rate limit exceeded
 */
export async function isOTPRateLimited(
  redisClient: any,
  userId: number,
  type: 'sms' | 'email'
): Promise<boolean> {
  const key = `otp:ratelimit:${type}:${userId}`;
  const count = await redisClient.get(key);

  if (!count) {
    return false;
  }

  // Limit: 3 requests per 10 minutes
  return parseInt(count, 10) >= 3;
}

/**
 * Increment OTP rate limit counter
 * @param redisClient Redis client
 * @param userId User ID
 * @param type 'sms' or 'email'
 */
export async function incrementOTPRateLimit(
  redisClient: any,
  userId: number,
  type: 'sms' | 'email'
): Promise<void> {
  const key = `otp:ratelimit:${type}:${userId}`;
  const current = await redisClient.get(key);

  if (!current) {
    // First request, set counter to 1 with 10 minute expiry
    await redisClient.setEx(key, 600, '1');
  } else {
    await redisClient.incr(key);
  }
}

/**
 * Send SMS OTP via Twilio
 * @param phone Phone number (E.164 format)
 * @param code 6-digit OTP code
 * @returns Success status
 */
export async function sendSMSOTP(phone: string, code: string): Promise<boolean> {
  // Check if Twilio is configured
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('[SMS 2FA] Twilio not configured, skipping SMS send');
    // In development, log the code
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SMS 2FA] OTP Code for ${phone}: ${code}`);
    }
    return true; // Return success in dev mode
  }

  try {
    // Import Twilio dynamically (only if configured)
    const twilio = require('twilio');
    const client = twilio(accountSid, authToken);

    await client.messages.create({
      body: `Your verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\n- Social Media`,
      from: fromNumber,
      to: phone,
    });

    return true;
  } catch (error) {
    console.error('[SMS 2FA] Failed to send SMS:', error);
    return false;
  }
}

/**
 * Send Email OTP
 * @param email Email address
 * @param username Username
 * @param code 6-digit OTP code
 * @returns Success status
 */
export async function sendEmailOTP(
  email: string,
  username: string,
  code: string
): Promise<boolean> {
  // This will use the existing email system
  // Import here to avoid circular dependencies
  const { sendEmail } = require('./email');

  const subject = 'Your Verification Code';
  const html = `
    <h2>Verification Code</h2>
    <p>Hi ${username},</p>
    <p>Your verification code is:</p>
    <h1 style="font-size: 32px; letter-spacing: 5px; color: #3b82f6;">${code}</h1>
    <p>This code will expire in 10 minutes.</p>
    <p>If you didn't request this code, please ignore this email.</p>
    <hr>
    <p style="color: #666; font-size: 12px;">Social Media Platform</p>
  `;

  try {
    await sendEmail(email, subject, html);
    return true;
  } catch (error) {
    console.error('[Email 2FA] Failed to send email:', error);
    return false;
  }
}

/**
 * Format phone number to E.164 format
 * @param phone Phone number (various formats)
 * @returns E.164 formatted number or null if invalid
 */
export function formatPhoneNumber(phone: string): string | null {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Check if it starts with country code
  if (digits.length === 11 && digits.startsWith('1')) {
    // US/Canada number with country code
    return `+${digits}`;
  } else if (digits.length === 10) {
    // US/Canada number without country code
    return `+1${digits}`;
  } else if (digits.length >= 10 && digits.length <= 15) {
    // International number
    return `+${digits}`;
  }

  // Invalid phone number
  return null;
}

/**
 * Validate phone number
 * @param phone Phone number
 * @returns True if valid format
 */
export function isValidPhoneNumber(phone: string): boolean {
  return formatPhoneNumber(phone) !== null;
}
