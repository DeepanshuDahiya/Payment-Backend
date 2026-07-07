import express from "express";
import {
  getAllSessionsController,
  // terminateAllSessionController,
  terminateSessionController,
} from "../Controllers/session.controller.js";

const router = express.Router();

router.get("/allSessions", getAllSessionsController);

router.delete("/{:sessionId}", terminateSessionController);

// router.delete("/allSession", requireAuth, terminateAllSessionController);

export default router;
