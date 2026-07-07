import { createClient } from "redis";

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
