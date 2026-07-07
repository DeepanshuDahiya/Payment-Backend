import { redisClient } from "../../server.js";
import Sessions from "../Models/session.model.js";

export const getAllSessionsController = async (req, res) => {
  try {
    const allSessions = await redisClient.get(req.signedCookies.sid);
    return res.status(200).json({ allSessions });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const terminateSessionController = async (req, res) => {
  const sessionId = req.params.sessionId;
  try {
    const result = await redisClient.del(sessionId);

    if (!result) return res.status(400).json({ error: "Session not found." });

    return res
      .status(200)
      .json({ message: "Session terminated successfully." });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// export const terminateAllSessionController = async (req, res) => {
//   try {
//     const result = await Sessions.deleteMany({ userId: req.user.userId });

//     if (!result) return res.status(400).json({ error: "Sessions not found." });

//     return res
//       .status(200)
//       .json({ message: "All sessions terminated successfully." });
//   } catch (error) {
//     return res.status(500).json({ error: error.message });
//   }
// };
