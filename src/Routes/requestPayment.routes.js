import express from "express";
import {
  handlePaymentRequest,
  requestPayment,
} from "../Controllers/requestPayment.controller.js";

const router = express.Router();

router.post("/req", requestPayment);

router.post("/handle-req", handlePaymentRequest);

export default router;
