import customError from "../Utilities/customError";
import sendResponse from "../Utilities/sendResponse";

export const getAllSessionsController = async (req, res, next) => {
  try {
    const allSessions = await redis.get(req.signedCookies.sid);

    return sendResponse(res, 200, "Sessions", { allSessions });
  } catch (error) {
    next(error);
  }
};

export const terminateSessionController = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    const result = await redis.del(sessionId);

    if (!result) throw new customError(404, "Session not found");

    return sendResponse(res, 200, "Session terminated successfully.");
  } catch (error) {
    next(error);
  }
};

// export const terminateAllSessionController = async (req, res, next) => {
//   try {
//   } catch (error) {
//     next(error)
//   }
// };
