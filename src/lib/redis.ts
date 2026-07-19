import Redis from "ioredis";

let redis: Redis;

const REDIS_URL =
  process.env.REDIS_URL || "redis://localhost:6379";

redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

/**
 * Verify Redis connectivity by sending a PING command.
 * Throws if the connection cannot be established.
 */
export async function checkRedisConnection(): Promise<void> {
  await redis.ping();
}

export { redis };
