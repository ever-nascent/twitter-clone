import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'http';
import { pool } from './config/database';
import { connectRedis, redisClient } from './config/redis';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import twoFactorRoutes from './routes/twoFactorRoutes';
import sessionRoutes from './routes/sessionRoutes';
import alternative2FARoutes from './routes/alternative2FARoutes';
import recoveryCodesRoutes from './routes/recoveryCodesRoutes';
import trustedDevicesRoutes from './routes/trustedDevicesRoutes';
import loginHistoryRoutes from './routes/loginHistoryRoutes';
import statusRoutes from './routes/statusRoutes';
import { generateCsrfToken, csrfErrorHandler } from './middleware/csrf';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Track server start time for uptime calculation
const serverStartTime = Date.now();

// Store server instance for graceful shutdown
let server: http.Server | null = null;

// Trust proxy - required for rate limiting behind reverse proxies (nginx, AWS ELB, Cloudflare, etc.)
// This allows express-rate-limit to correctly identify client IPs
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy
}

// Security middleware - Comprehensive Helmet configuration
app.use(
  helmet({
    // Content Security Policy - Prevents XSS attacks
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Tailwind
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"], // Prevent clickjacking
        upgradeInsecureRequests: [], // Upgrade HTTP to HTTPS
      },
    },
    // Strict Transport Security - Force HTTPS in production
    strictTransportSecurity: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // Prevent MIME type sniffing
    noSniff: true,
    // Referrer Policy - Control referrer information
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    // X-Frame-Options - Prevent clickjacking (already set by frameAncestors in CSP)
    frameguard: {
      action: 'deny',
    },
    // XSS Protection header (legacy browsers)
    xssFilter: true,
    // Hide X-Powered-By header
    hidePoweredBy: true,
    // DNS Prefetch Control
    dnsPrefetchControl: {
      allow: false,
    },
    // IE No Open - Prevent IE from executing downloads
    ieNoOpen: true,
  })
);

// CORS configuration
// SECURITY: Validate FRONTEND_URL in production to prevent misconfiguration
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  logger.error('FRONTEND_URL environment variable is required in production', {
    environment: process.env.NODE_ENV,
    severity: 'CRITICAL',
  });
  process.exit(1);
}

app.use(
  cors({
    origin: frontendUrl,
    credentials: true, // Allow cookies
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parsing middleware
app.use(cookieParser());

// Logging middleware
app.use(morgan('dev'));

// CSRF token endpoint (GET request - no CSRF protection needed)
// Frontend should call this on app initialization to get CSRF token
// API versioning: Available on both /api and /api/v1 for backward compatibility
app.get('/api/csrf-token', generateCsrfToken);
app.get('/api/v1/csrf-token', generateCsrfToken);

// Routes - API v1
// API versioning allows for future breaking changes without affecting existing clients
// Example: /api/v2/auth could have different authentication flow
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth/2fa', twoFactorRoutes);
app.use('/api/v1/auth/2fa/alternative', alternative2FARoutes);
app.use('/api/v1/auth/recovery-codes', recoveryCodesRoutes);
app.use('/api/v1/auth/trusted-devices', trustedDevicesRoutes);
app.use('/api/v1/auth/login-history', loginHistoryRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/status', statusRoutes);

// Backward compatibility: Redirect /api/auth and /api/admin to /api/v1
// TODO: Remove these redirects in v2.0.0 (breaking change)
app.use('/api/auth', authRoutes);
app.use('/api/auth/2fa', twoFactorRoutes);
app.use('/api/auth/2fa/alternative', alternative2FARoutes);
app.use('/api/auth/recovery-codes', recoveryCodesRoutes);
app.use('/api/auth/trusted-devices', trustedDevicesRoutes);
app.use('/api/auth/login-history', loginHistoryRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/status', statusRoutes);

// Health check endpoint
// PRODUCTION: Used by K8s liveness/readiness probes, load balancers, monitoring systems
// Returns 200 if all critical services are healthy, 503 if any are down
app.get('/health', async (req, res) => {
  const checks = {
    server: { status: 'healthy', message: 'Server is running' },
    database: { status: 'unknown', message: '' },
    redis: { status: 'unknown', message: '' },
  };

  let isHealthy = true;

  // Check database connection
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const duration = Date.now() - start;
    checks.database = {
      status: 'healthy',
      message: `Connected (${duration}ms)`,
    };
  } catch (error) {
    isHealthy = false;
    checks.database = {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }

  // Check Redis connection
  try {
    if (!redisClient.isOpen) {
      throw new Error('Redis client not connected');
    }
    const start = Date.now();
    await redisClient.ping();
    const duration = Date.now() - start;
    checks.redis = {
      status: 'healthy',
      message: `Connected (${duration}ms)`,
    };
  } catch (error) {
    isHealthy = false;
    checks.redis = {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }

  // Calculate uptime
  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
  const uptimeFormatted = `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`;

  // Return appropriate status code
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: uptimeFormatted,
    uptimeSeconds,
    checks,
    environment: process.env.NODE_ENV || 'development',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// CSRF error handler (must be before general error handler)
app.use(csrfErrorHandler);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error in request', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
  });
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    logger.info('Database connected successfully');

    // Connect to Redis
    await connectRedis();

    // Start listening
    server = app.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        frontendUrl: frontendUrl,
        url: `http://localhost:${PORT}`,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
};

/**
 * Graceful Shutdown Handler
 *
 * PRODUCTION CRITICAL: Prevents connection leaks and data loss during deployments
 *
 * Shutdown sequence:
 * 1. Stop accepting new connections (close HTTP server)
 * 2. Wait for active requests to complete (with timeout)
 * 3. Close database connection pool
 * 4. Close Redis connection
 * 5. Exit process
 *
 * Why this is important:
 * - Kubernetes sends SIGTERM before killing pods
 * - Load balancers need time to deregister instance
 * - Active requests should complete gracefully
 * - Database connections must be released properly
 * - Prevents "connection pool exhausted" errors
 *
 * References:
 * - Node.js Best Practices: Graceful Shutdown
 * - Kubernetes: Container Lifecycle Hooks
 * - AWS ECS: Task Shutdown
 */
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown...`, {
    signal,
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
  });

  // Track shutdown timeout
  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded, forcing exit', {
      timeout: '30s',
    });
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    // Step 1: Stop accepting new connections
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => {
          if (err) {
            logger.error('Error closing HTTP server', {
              error: err.message,
            });
            reject(err);
          } else {
            logger.info('HTTP server closed (no longer accepting connections)');
            resolve();
          }
        });
      });
    }

    // Step 2: Close database connection pool
    logger.info('Closing database connection pool...');
    await pool.end();
    logger.info('Database connection pool closed');

    // Step 3: Close Redis connection
    if (redisClient.isOpen) {
      logger.info('Closing Redis connection...');
      await redisClient.quit();
      logger.info('Redis connection closed');
    }

    // Clear timeout
    clearTimeout(shutdownTimeout);

    logger.info('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

// Register shutdown handlers
// SIGTERM: Kubernetes, Docker, AWS ECS send this for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// SIGINT: Ctrl+C in terminal (useful for local development)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught exceptions (last resort - should be prevented by proper error handling)
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception detected, initiating emergency shutdown', {
    error: error.message,
    stack: error.stack,
    severity: 'CRITICAL',
  });
  gracefulShutdown('uncaughtException');
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection detected', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    severity: 'CRITICAL',
  });
  gracefulShutdown('unhandledRejection');
});

startServer();

export default app;
