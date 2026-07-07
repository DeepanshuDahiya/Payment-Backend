import { redisClient } from "../../server.js";

export const paymentRateLimiter = async (req, res, next) => {
  // const id = req.user.userId;
  // const key = `rate:user:${id}`;

  // const counter = await redisClient.incr(key);

  // if (counter === 1) {
  //   redisClient.expire(key, 60);
  // }
  // if (counter > 3) {
  //   return res.status(429).json({ error: "Too many requests" });
  // }
  next();
};
