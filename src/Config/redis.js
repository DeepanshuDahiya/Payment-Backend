import Redis from "ioredis";

export const redis = new Redis({
  host: process.env.IO_REDIS_HOST,
  port: process.env.IO_REDIS_PORT,
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) {
      return null;
    }
    return 2000;
  },
});

redis.on("ready", () => {
  console.log("Redis is now connected successfully.");
});

redis.on("error", (error) => {
  console.log("Redis error: ", error.message);
});

export async function connectRedis() {
  try {
    await redis.connect();
    await redis.ping();
  } catch (error) {
    console.log("Redis error: ", error.message);
    throw error;
  }
}
