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

export { redis };
