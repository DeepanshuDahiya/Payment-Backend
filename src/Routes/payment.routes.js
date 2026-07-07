import express from "express";
import {
  createDeposit,
  createTransfer,
  createWithdrawal,
  getReceiver,
} from "../Controllers/payment.controller.js";
import { paymentRateLimiter } from "../Middlewares/payments.rate.limiter.js";

const router = express.Router();

router.get("/receiver/:email", getReceiver);

router.post("/transfer", paymentRateLimiter, createTransfer);

router.post("/deposit", paymentRateLimiter, createDeposit);

router.post("/withdraw", paymentRateLimiter, createWithdrawal);

export default router;
