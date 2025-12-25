/**
 * Structured logging utility
 *
 * RELIABILITY & DEBUGGING: Industry-standard structured logging
 *
 * Why structured logging?
 * - Machine-readable logs (JSON format) for log aggregation tools (ELK, Datadog, etc.)
 * - Consistent log format across the application
 * - Easier to search, filter, and analyze logs
 * - Includes contextual information (timestamp, level, service, etc.)
 * - Production-ready logging without third-party dependencies
 *
 * Log levels:
 * - error: Application errors, exceptions, failures
 * - warn: Warning conditions (slow queries, deprecated features, etc.)
 * - info: General informational messages (startup, shutdown, etc.)
 * - debug: Detailed debugging information (only in development)
 *
 * Usage:
 * ```typescript
 * import { logger } from './utils/logger';
 *
 * logger.info('User logged in', { userId: 123, ip: '192.168.1.1' });
 * logger.error('Database query failed', { error: err.message, query: 'SELECT ...' });
 * logger.warn('Slow query detected', { duration: 1500, query: 'SELECT ...' });
 * ```
 *
 * References:
 * - 12-Factor App: Treat logs as event streams
 * - OWASP Logging Cheat Sheet
 * - Industry standard: Winston, Pino, Bunyan (we implement similar patterns)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  [key: string]: unknown;
}

class Logger {
  private serviceName: string;
  private environment: string;
  private minLevel: LogLevel;

  constructor() {
    this.serviceName = process.env.SERVICE_NAME || 'twitter-clone-api';
    this.environment = process.env.NODE_ENV || 'development';

    // Set minimum log level based on environment
    // Production: only info, warn, error (no debug)
    // Development: all levels including debug
    const configuredLevel = process.env.LOG_LEVEL as LogLevel;
    this.minLevel = configuredLevel || (this.environment === 'production' ? 'info' : 'debug');
  }

  /**
   * Get numeric level for comparison
   */
  private getLevelValue(level: LogLevel): number {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level];
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return this.getLevelValue(level) >= this.getLevelValue(this.minLevel);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      environment: this.environment,
      ...context,
    };

    // In production: JSON format for log aggregation
    // In development: Pretty format for readability
    if (this.environment === 'production') {
      // JSON format - one line per log entry
      console.log(JSON.stringify(logEntry));
    } else {
      // Pretty format for development
      const colorCodes = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m', // Red
      };
      const reset = '\x1b[0m';
      const color = colorCodes[level];

      const contextStr = context ? ` ${JSON.stringify(context, null, 2)}` : '';
      console.log(`${color}[${level.toUpperCase()}]${reset} ${message}${contextStr}`);
    }
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  /**
   * Log HTTP request
   * Useful for request logging middleware
   */
  http(method: string, url: string, statusCode: number, duration: number, context?: Record<string, unknown>): void {
    this.info(`${method} ${url} ${statusCode}`, {
      method,
      url,
      statusCode,
      duration,
      ...context,
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for external use
export type { LogLevel };
