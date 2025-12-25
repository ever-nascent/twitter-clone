import { Pool } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

/**
 * PostgreSQL Connection Pool Configuration
 *
 * PERFORMANCE & RELIABILITY: Industry-standard pool configuration
 *
 * Pool sizing formula: max = (num_cores * 2) + effective_spindle_count
 * For most web apps: 10-20 connections is optimal
 *
 * Configuration details:
 * - max: Maximum pool size (prevent resource exhaustion)
 * - min: Minimum pool size (prevent cold start delays)
 * - idleTimeoutMillis: Close idle connections after this period
 * - connectionTimeoutMillis: Timeout for acquiring connection from pool
 * - statement_timeout: Prevent runaway queries (PostgreSQL setting)
 *
 * References:
 * - PostgreSQL wiki: Number of Database Connections
 * - HikariCP (industry benchmark): Connection Pool Sizing
 * - OWASP: Database Security Configuration
 */
export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'twitter_clone',
  user: process.env.DB_USER || 'twitter',
  password: process.env.DB_PASSWORD || 'twitter_dev_password',

  // Pool size configuration (environment-aware)
  max: parseInt(process.env.DB_POOL_MAX || '20'), // Max connections in pool
  min: parseInt(process.env.DB_POOL_MIN || '2'),  // Min connections (prevent cold starts)

  // Timeout configuration
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // 30s - Close idle connections
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'), // 5s - Timeout for acquiring connection

  // Query timeout (prevent long-running queries)
  // This is a PostgreSQL statement_timeout setting, not a pool setting
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '60000'), // 60s - Kill queries after this

  // Connection keep-alive (prevent firewall/proxy timeouts)
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // 10s - Start keep-alive after this
});

// Test database connection
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', {
    error: err instanceof Error ? err.message : 'Unknown error',
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(-1);
});

/**
 * Helper function to execute queries with logging and error handling
 *
 * SECURITY & RELIABILITY:
 * - Type-safe query parameters (unknown[] instead of any[])
 * - Query performance logging (detect slow queries)
 * - Detailed error logging for debugging
 * - Always use parameterized queries to prevent SQL injection
 *
 * @param text - SQL query string (use $1, $2, etc. for parameters)
 * @param params - Query parameters (will be safely escaped by pg library)
 * @returns Query result
 */
export const query = async (text: string, params?: unknown[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (configurable threshold)
    const slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'); // 1s default
    if (duration > slowQueryThreshold) {
      logger.warn('Slow query detected', {
        duration,
        query: text.substring(0, 100), // First 100 chars
        rows: res.rowCount,
      });
    } else {
      logger.debug('Query executed', {
        duration,
        rows: res.rowCount,
      });
    }

    return res;
  } catch (error) {
    logger.error('Database query failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: text.substring(0, 100), // First 100 chars (don't log full query - may contain sensitive data)
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down database pool...');
  await pool.end();
  logger.info('Database pool closed successfully');
  process.exit(0);
});
