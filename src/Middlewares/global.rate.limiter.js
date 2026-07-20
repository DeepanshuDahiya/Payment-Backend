import crypto from "crypto";
import sendResponse from "../Utilities/sendResponse.js";
import { redis } from "../Config/redis.js";

export const globalRateLimiter = async (req, res, next) => {
  let ip = req.ip;

  // ip = ip.replace(/:/g, "_");

  const key = `rate:ip:${ip}`;

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 60);
  }

  if (count > 100) {
    return sendResponse(res, 429, "Too many requests");
  }
  next();
};
