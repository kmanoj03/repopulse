import { RedisOptions } from "ioredis";

/**
 * Redis connection configuration for BullMQ
 * 
 * Environment variables:
 * - REDIS_HOST: Redis host (default: 127.0.0.1)
 * - REDIS_PORT: Redis port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 */
export const redisConnection: RedisOptions = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
  // password: process.env.REDIS_PASSWORD, // Uncomment if you have Redis password
  maxRetriesPerRequest: null, // Required for BullMQ
};

