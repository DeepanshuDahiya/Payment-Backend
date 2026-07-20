import { redis } from "../Config/redis.js";
import Users from "../Models/user.model.js";
import customError from "../Utilities/customError.js";

export const requireAuth = async (req, res, next) => {
  try {
    const sid = req.signedCookies.sid;
    if (!sid) throw new customError(401, "Unauthorized");

    let session = await redis.get(`session:${sid}`);

    if (!session) {
      res.clearCookie("sid");
      throw new customError(400, "Session not found");
    }

    const user = JSON.parse(session);

    const now = Date.now();

    if (user.lastSeen < now + 1000 * 60 * 5) {
      user.lastSeen = now;

      await redis.set(`session:${sid}`, JSON.stringify(user), "KEEPTTL");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
