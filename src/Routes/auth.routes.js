import express from "express";
import {
  registerController,
  loginController,
  logoutController,
  currentUserController,
  emailVerifyOtp,
  verifyUser,
  resetPassword,
  resetPasswordOtp,
} from "../Controllers/auth.controller.js";
import { requireAuth } from "../Middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", registerController);

router.post("/login", loginController);

router.post("/emailVerifyOtp", emailVerifyOtp);

router.post("/verify", verifyUser);

router.post("/resetPassOtp", resetPasswordOtp);

router.post("/resetPass", resetPassword);

router.post("/logout", requireAuth, logoutController);

router.get("/me", requireAuth, currentUserController);

export default router;
