import { Request, Response } from 'express';
import { pool } from '../config/database';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Service status types
 */
type ServiceStatus = 'available' | 'unavailable' | 'degraded';

interface Service {
  name: string;
  status: ServiceStatus;
  description?: string;
}

/**
 * Check if database is healthy
 */
async function checkDatabase(): Promise<ServiceStatus> {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const duration = Date.now() - start;

    // Degraded if query takes > 1 second
    if (duration > 1000) {
      return 'degraded';
    }

    return 'available';
  } catch (error) {
    logger.error('Database health check failed', { error });
    return 'unavailable';
  }
}

/**
 * Check if Redis is healthy
 */
async function checkRedis(): Promise<ServiceStatus> {
  try {
    if (!redisClient.isOpen) {
      return 'unavailable';
    }

    const start = Date.now();
    await redisClient.ping();
    const duration = Date.now() - start;

    // Degraded if ping takes > 500ms
    if (duration > 500) {
      return 'degraded';
    }

    return 'available';
  } catch (error) {
    logger.error('Redis health check failed', { error });
    return 'unavailable';
  }
}

/**
 * Check if email service is configured
 */
function checkEmailService(): ServiceStatus {
  const isConfigured =
    process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD;

  if (!isConfigured && process.env.NODE_ENV === 'production') {
    return 'unavailable';
  }

  // In development, Ethereal is always available
  return 'available';
}

/**
 * Check if Twilio SMS service is configured
 */
function checkSMSService(): ServiceStatus {
  const isConfigured =
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER;

  if (!isConfigured) {
    // SMS not configured, but that's okay (dev mode logs to console)
    return 'available';
  }

  return 'available';
}

/**
 * Check if reCAPTCHA is configured
 */
function checkRecaptcha(): ServiceStatus {
  const isConfigured = process.env.RECAPTCHA_SECRET_KEY;

  if (!isConfigured || process.env.RECAPTCHA_SECRET_KEY === 'your_recaptcha_secret_key_here') {
    return 'unavailable';
  }

  return 'available';
}

/**
 * Get system status
 * GET /api/status
 *
 * Public endpoint - no authentication required
 * Returns status of all services
 */
export const getSystemStatus = async (req: Request, res: Response) => {
  try {
    // Run all health checks in parallel
    const [databaseStatus, redisStatus] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    const emailStatus = checkEmailService();
    const smsStatus = checkSMSService();
    const recaptchaStatus = checkRecaptcha();

    // Define all services
    const services: Service[] = [
      // Authentication Services
      {
        name: 'Account Registration',
        status: databaseStatus === 'available' && recaptchaStatus === 'available'
          ? 'available'
          : databaseStatus === 'unavailable' ? 'unavailable' : 'degraded',
        description: 'User registration and account creation',
      },
      {
        name: 'Login & Authentication',
        status: databaseStatus === 'available' && redisStatus === 'available'
          ? 'available'
          : databaseStatus === 'unavailable' || redisStatus === 'unavailable'
          ? 'unavailable'
          : 'degraded',
        description: 'User login and session management',
      },
      {
        name: 'Password Reset',
        status: databaseStatus === 'available' && emailStatus === 'available'
          ? 'available'
          : databaseStatus === 'unavailable' || emailStatus === 'unavailable'
          ? 'unavailable'
          : 'degraded',
        description: 'Password recovery and reset',
      },
      {
        name: 'Email Verification',
        status: databaseStatus === 'available' && emailStatus === 'available'
          ? 'available'
          : databaseStatus === 'unavailable' || emailStatus === 'unavailable'
          ? 'unavailable'
          : 'degraded',
        description: 'Email address verification',
      },

      // Security Services
      {
        name: 'Two-Factor Authentication (TOTP)',
        status: databaseStatus === 'available' && redisStatus === 'available'
          ? 'available'
          : databaseStatus === 'unavailable'
          ? 'unavailable'
          : 'degraded',
        description: 'Authenticator app-based 2FA',
      },
      {
        name: 'SMS Two-Factor Authentication',
        status: databaseStatus === 'available' && redisStatus === 'available' && smsStatus === 'available'
          ? 'available'
          : databaseStatus === 'unavailable'
          ? 'unavailable'
          : 'degraded',
        description: 'SMS-based verification codes',
      },
      {
        name: 'Email Two-Factor Authentication',
        status: databaseStatus === 'available' && redisStatus === 'available' && emailStatus === 'available'
          ? 'available'
          : databaseStatus === 'unavailable'
          ? 'unavailable'
          : 'degraded',
        description: 'Email-based verification codes',
      },
      {
        name: 'Trusted Devices',
        status: databaseStatus === 'available'
          ? 'available'
          : 'unavailable',
        description: 'Device trust and 2FA bypass',
      },

      // Session & Account Management
      {
        name: 'Session Management',
        status: databaseStatus === 'available' && redisStatus === 'available'
          ? 'available'
          : databaseStatus === 'unavailable'
          ? 'unavailable'
          : 'degraded',
        description: 'Active session tracking and management',
      },
      {
        name: 'Login History',
        status: databaseStatus === 'available'
          ? 'available'
          : 'unavailable',
        description: 'Login attempt tracking and audit logs',
      },
      {
        name: 'Recovery Codes',
        status: databaseStatus === 'available'
          ? 'available'
          : 'unavailable',
        description: 'Emergency account recovery',
      },

      // Infrastructure
      {
        name: 'Database',
        status: databaseStatus,
        description: 'PostgreSQL database',
      },
      {
        name: 'Cache',
        status: redisStatus,
        description: 'Redis cache and session store',
      },

      // Third-Party Services
      {
        name: 'Email Service',
        status: emailStatus,
        description: 'Email delivery',
      },
      {
        name: 'SMS Service',
        status: smsStatus,
        description: 'SMS delivery via Twilio',
      },
      {
        name: 'Bot Protection',
        status: recaptchaStatus,
        description: 'Google reCAPTCHA',
      },
    ];

    // Calculate overall status
    const hasUnavailable = services.some((s) => s.status === 'unavailable');
    const hasDegraded = services.some((s) => s.status === 'degraded');

    let overallStatus: ServiceStatus = 'available';
    if (hasUnavailable) {
      overallStatus = 'unavailable';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    }

    // Group services by category
    const groupedServices = {
      'Authentication Services': services.slice(0, 4),
      'Security Services': services.slice(4, 8),
      'Session & Account Management': services.slice(8, 11),
      'Infrastructure': services.slice(11, 13),
      'Third-Party Services': services.slice(13, 16),
    };

    res.json({
      success: true,
      data: {
        overallStatus,
        lastUpdated: new Date().toISOString(),
        services: groupedServices,
      },
    });
  } catch (error) {
    logger.error('Status check error', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to check system status',
    });
  }
};
