import dotenv from "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./Routes/auth.routes.js";
import walletRoutes from "./Routes/wallet.routes.js";
import paymentRoutes from "./Routes/payment.routes.js";
import transactionHistoryRoutes from "./Routes/transaction.routes.js";
import sessionRoutes from "./Routes/session.routes.js";
import requestPaymentRoutes from "./Routes/requestPayment.routes.js";
import { requireAuth } from "./Middlewares/auth.middleware.js";
import { globalRateLimiter } from "./Middlewares/global.rate.limiter.js";
import { errorHandler } from "./Middlewares/error.handler.js";
import "./Workers/email.worker.js";

const app = express();

app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

const allowedOrigins = process.env.ALLOWED_ORIGINS.split(",");

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(globalRateLimiter);

app.use("/auth", authRoutes);
app.use("/wallet", requireAuth, walletRoutes);
app.use("/sessions", requireAuth, sessionRoutes);
app.use("/payments", requireAuth, paymentRoutes);
app.use("/req-payments", requireAuth, requestPaymentRoutes);
app.use("/transactions", requireAuth, transactionHistoryRoutes);

app.use(errorHandler);

export default app;
