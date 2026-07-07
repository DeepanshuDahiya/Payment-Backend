import express from "express";
import { getWallet, verifyWallet } from "../Controllers/wallet.controller.js";

const router = express.Router();

router.get("/", getWallet);

router.get("/verify", verifyWallet);

export default router;
