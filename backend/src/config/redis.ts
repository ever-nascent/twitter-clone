import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Redis client for caching
export const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

redisClient.on('connect', () => {
  console.log('[Redis] Connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('[Redis] Client Error:', err);
});

// Connect to Redis
export const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
};

// Cache helper functions
export const cacheHelpers = {
  // Set value with expiration (in seconds)
  set: async (key: string, value: any, expirationSeconds: number = 3600) => {
    try {
      await redisClient.setEx(key, expirationSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Redis SET error:', error);
    }
  },

  // Get value
  get: async (key: string) => {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  },

  // Delete value
  del: async (key: string) => {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error('Redis DEL error:', error);
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
      console.error('Redis DEL pattern error:', error);
    }
  },
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await redisClient.quit();
  console.log('Redis connection closed');
  process.exit(0);
});
