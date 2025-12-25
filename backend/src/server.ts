import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { pool } from './config/database';
import { connectRedis } from './config/redis';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import { generateCsrfToken, csrfErrorHandler } from './middleware/csrf';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - required for rate limiting behind reverse proxies (nginx, AWS ELB, Cloudflare, etc.)
// This allows express-rate-limit to correctly identify client IPs
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy
}

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
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
  console.error('Error:', err);
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
    console.log('[Database] Database connected successfully');

    // Connect to Redis
    await connectRedis();

    // Start listening
    app.listen(PORT, () => {
      console.log(`[Server] Server running on http://localhost:${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[Server] Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
