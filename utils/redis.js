const Redis = require('ioredis');

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
});

/**
 * Set a key with TTL in Redis
 * @param {string} key - Redis key
 * @param {string} value - Value to store
 * @param {number} ttl - Time-to-live in seconds
 */
async function setKeyWithTTL(key, value, ttl) {
  await redis.setex(key, ttl, value);
}

/**
 * Get a key from Redis
 * @param {string} key - Redis key
 * @returns {Promise<string|null>} - Value or null if not found
 */
async function getKey(key) {
  return await redis.get(key);
}

/**
 * Delete a key from Redis
 * @param {string} key - Redis key
 */
async function deleteKey(key) {
  await redis.del(key);
}

module.exports = {
  setKeyWithTTL,
  getKey,
  deleteKey,
};