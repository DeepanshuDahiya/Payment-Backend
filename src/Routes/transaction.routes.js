import express from "express";
import { getTransactionHistory } from "../Controllers/transaction.controller.js";

const router = express.Router();

router.get("/history", getTransactionHistory);

export default router;
