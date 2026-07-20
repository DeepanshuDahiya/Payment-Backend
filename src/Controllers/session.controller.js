import { redis } from "../Config/redis.js";
import customError from "../Utilities/customError.js";
import sendResponse from "../Utilities/sendResponse.js";

export const getAllSessionsController = async (req, res, next) => {
  try {
    const key = `user_sessions:${req.user.userId}`;

    const sessionIds = await redis.zrange(key, 0, -1);

    if (!sessionIds.length) {
      return sendResponse(res, 200, "No active sessions.", {
        sessions: [],
      });
    }

    // Check which sessions still exist
    const existsPipeline = redis.pipeline();

    for (const sid of sessionIds) {
      existsPipeline.exists(`session:${sid}`);
    }

    const existsResults = await existsPipeline.exec();

    const validSessions = [];
    const staleSessions = [];

    existsResults.forEach(([, exists], index) => {
      if (exists) {
        validSessions.push(sessionIds[index]);
      } else {
        staleSessions.push(sessionIds[index]);
      }
    });

    // Remove stale session ids from ZSET
    if (staleSessions.length) {
      await redis.zrem(key, ...staleSessions);
    }

    // Get all valid sessions
    const sessionPipeline = redis.pipeline();

    for (const sid of validSessions) {
      sessionPipeline.get(`session:${sid}`);
    }

    const sessionResults = await sessionPipeline.exec();

    const sessions = sessionResults.map(([, session], index) => ({
      sessionId: validSessions[index],
      current: validSessions[index] === req.signedCookies.sid,
      ...JSON.parse(session),
    }));

    return sendResponse(res, 200, "Sessions fetched successfully.", {
      sessions,
    });
  } catch (error) {
    next(error);
  }
};

export const terminateSessionController = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await redis.get(`session:${sessionId}`);

    if (!session) {
      throw new customError(404, "Session not found.");
    }

    const parsedSession = JSON.parse(session);

    if (parsedSession.userId !== String(req.user.userId)) {
      throw new customError(403, "Unauthorized.");
    }

    await redis
      .multi()
      .del(`session:${sessionId}`)
      .zrem(`user_sessions:${req.user.userId}`, sessionId)
      .exec();

    if (sessionId === req.signedCookies.sid) {
      res.clearCookie("sid");
    }

    return sendResponse(res, 200, "Session terminated successfully.");
  } catch (error) {
    next(error);
  }
};

export const terminateAllSessionController = async (req, res, next) => {
  try {
    const key = `user_sessions:${req.user.userId}`;

    const sessionIds = await redis.zrange(key, 0, -1);

    const transaction = redis.multi();

    for (const sid of sessionIds) {
      transaction.del(`session:${sid}`);
    }

    transaction.del(key);

    await transaction.exec();

    res.clearCookie("sid");

    return sendResponse(res, 200, "All sessions terminated successfully.");
  } catch (error) {
    next(error);
  }
};
