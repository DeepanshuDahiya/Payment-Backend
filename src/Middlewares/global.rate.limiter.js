import { redisClient } from "../../server.js";
import crypto from "crypto";

export const globalRateLimiter = async (req, res, next) => {
  // let ip = req.ip;

  // ip = ip.replace(/:/g, "_");

  // const key = `rate:ip:${ip}`;

  // const count = await redisClient.incr(key);

  // if (count === 1) {
  //   await redisClient.expire(key, 60);
  // }

  // if (count > 100) {
  //   return res.status(429).json({ error: "Too many requests" });
  // }
  next();
};
