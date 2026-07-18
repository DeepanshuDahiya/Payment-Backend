import express from "express";
import {
  handlePaymentRequest,
  incomingPaymentRequests,
  outgoingPaymentRequests,
  requestPayment,
} from "../Controllers/requestPayment.controller.js";

const router = express.Router();

router.post("/req", requestPayment);

router.get("/incoming", incomingPaymentRequests);

router.get("/outgoing", outgoingPaymentRequests);

router.post("/handle-req", handlePaymentRequest);

export default router;
