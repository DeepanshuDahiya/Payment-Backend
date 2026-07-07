import { redisClient } from "../../server.js";
import Sessions from "../Models/session.model.js";
import Users from "../Models/user.model.js";

export const requireAuth = async (req, res, next) => {
  try {
    const sid = req.signedCookies.sid;
    if (!sid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let session = await redisClient.get(sid);

    if (!session) {
      res.clearCookie("sid");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = JSON.parse(session);

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
