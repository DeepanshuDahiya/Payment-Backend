import { redis } from "../Config/redis.js";
import sendResponse from "../Utilities/sendResponse.js";

export const paymentRateLimiter = async (req, res, next) => {
  const id = req.user.userId;
  const key = `rate:user:${id}`;

  const counter = await redis.incr(key);

  if (counter === 1) {
    await redis.expire(key, 60);
  }
  if (counter > 3) {
    return sendResponse(res, 429, "Too many requests");
  }
  next();
};
