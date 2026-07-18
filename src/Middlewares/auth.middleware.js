import { redis } from "../Config/redis.js";
import Users from "../Models/user.model.js";
import customError from "../Utilities/customError.js";

export const requireAuth = async (req, res, next) => {
  try {
    const sid = req.signedCookies.sid;
    if (!sid) throw new customError(401, "Unauthorized");

    let session = await redis.get(sid);

    if (!session) {
      res.clearCookie("sid");
      throw new customError(400, "Session not found");
    }

    const user = JSON.parse(session);

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
