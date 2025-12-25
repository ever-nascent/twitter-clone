import { createClient } from 'redis';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

// Redis client for caching
export const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (err) => {
  logger.error('Redis client error', {
    error: err instanceof Error ? err.message : 'Unknown error',
    stack: err instanceof Error ? err.stack : undefined,
  });
});

// Connect to Redis
export const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};

// Cache helper functions
export const cacheHelpers = {
  // Set value with expiration (in seconds)
  set: async (key: string, value: unknown, expirationSeconds: number = 3600) => {
    try {
      await redisClient.setEx(key, expirationSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error('Redis SET operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });
    }
  },

  // Get value
  get: async (key: string) => {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Redis GET operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });
      return null;
    }
  },

  // Delete value
  del: async (key: string) => {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error('Redis DEL operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });
    }
  },

  // Delete all keys matching pattern
  delPattern: async (pattern: string) => {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      logger.error('Redis DEL pattern operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pattern,
      });
    }
  },
};

// NOTE: Graceful shutdown is now handled centrally in server.ts
// This prevents duplicate shutdown handlers and ensures proper coordination
// of all service shutdowns (HTTP server -> Database -> Redis)
