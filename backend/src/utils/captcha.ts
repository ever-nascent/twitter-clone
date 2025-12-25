/**
 * Google reCAPTCHA v3 Verification Utility
 *
 * reCAPTCHA v3 returns a score (1.0 is very likely a good interaction, 0.0 is very likely a bot)
 *
 * SECURITY:
 * - reCAPTCHA v3 is invisible and provides a score-based approach
 * - Threshold of 0.5 is recommended by Google (can adjust based on traffic patterns)
 * - Always verify on server-side (never trust client-side only)
 * - Rate limiting should still be in place as secondary defense
 */

interface RecaptchaResponse {
  success: boolean;
  score: number;
  action: string;
  challenge_ts: string;
  hostname: string;
  'error-codes'?: string[];
}

/**
 * Verify reCAPTCHA token with Google's API
 * @param token The reCAPTCHA token from the client
 * @param expectedAction The expected action (e.g., 'login', 'register')
 * @returns True if verification passes, false otherwise
 */
export async function verifyCaptcha(
  token: string,
  expectedAction: string
): Promise<{ success: boolean; score?: number; error?: string }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.error('[CAPTCHA] RECAPTCHA_SECRET_KEY not configured');
    // In development, allow bypass if not configured
    if (process.env.NODE_ENV === 'development') {
      console.warn('[CAPTCHA] Bypassing verification in development mode');
      return { success: true, score: 1.0 };
    }
    return { success: false, error: 'CAPTCHA not configured' };
  }

  if (!token) {
    return { success: false, error: 'CAPTCHA token required' };
  }

  try {
    // Call Google's reCAPTCHA API
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const data: RecaptchaResponse = await response.json();

    // Check if verification was successful
    if (!data.success) {
      console.error('[CAPTCHA] Verification failed:', data['error-codes']);
      return {
        success: false,
        error: 'CAPTCHA verification failed',
      };
    }

    // Verify the action matches what we expected
    if (data.action !== expectedAction) {
      console.error(
        `[CAPTCHA] Action mismatch. Expected: ${expectedAction}, Got: ${data.action}`
      );
      return {
        success: false,
        error: 'CAPTCHA action mismatch',
      };
    }

    // Check the score threshold (0.5 is Google's recommended threshold)
    // Lower scores indicate more likely to be a bot
    const threshold = parseFloat(process.env.RECAPTCHA_SCORE_THRESHOLD || '0.5');

    if (data.score < threshold) {
      console.warn(
        `[CAPTCHA] Low score detected. Score: ${data.score}, Threshold: ${threshold}`
      );
      return {
        success: false,
        score: data.score,
        error: 'CAPTCHA score too low',
      };
    }

    // Success!
    console.log(`[CAPTCHA] Verification passed. Score: ${data.score}, Action: ${data.action}`);
    return {
      success: true,
      score: data.score,
    };
  } catch (error) {
    console.error('[CAPTCHA] Error verifying token:', error);
    return {
      success: false,
      error: 'CAPTCHA verification error',
    };
  }
}

/**
 * Express middleware to verify reCAPTCHA token
 * Usage: Add before your route handler
 *
 * @param expectedAction The expected action (e.g., 'login', 'register')
 */
export function captchaMiddleware(expectedAction: string) {
  return async (req: any, res: any, next: any) => {
    // In test environment, skip CAPTCHA verification
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const token = req.body.captchaToken;

    const result = await verifyCaptcha(token, expectedAction);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'CAPTCHA verification failed. Please try again.',
      });
    }

    // CAPTCHA verified, continue to route handler
    next();
  };
}
