import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { pool } from './config/database';
import { connectRedis, redisClient } from './config/redis';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import { generateCsrfToken, csrfErrorHandler } from './middleware/csrf';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Track server start time for uptime calculation
const serverStartTime = Date.now();

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
app.get('/api/csrf-token', generateCsrfToken);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

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
    app.listen(PORT, () => {
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

startServer();

export default app;
