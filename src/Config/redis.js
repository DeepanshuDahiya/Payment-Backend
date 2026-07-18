import { createClient } from "redis";
import Redis from "ioredis";

export default async function connectRedis() {
  try {
    const redisClient = createClient({
      url: process.env.REDIS_URI,
    });

    redisClient.on("error", (err) => {
      console.log("Redis Error:", err);
    });

    await redisClient.connect();
    console.log("Redis Connected");

    return redisClient;
  } catch (error) {
    console.log(error.message);
  }
}

export const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
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

export async function connectIORedis() {
  try {
    await redis.connect();
    await redis.ping();
  } catch (error) {
    console.log("Redis error: ", error.message);
    throw error;
  }
}
