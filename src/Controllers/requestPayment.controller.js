import mongoose from "mongoose";
import PaymentRequests from "../Models/paymentRequests.model.js";
import Users from "../Models/user.model.js";
import Wallets from "../Models/wallet.model.js";
import Transactions from "../Models/transaction.model.js";
import Ledgers from "../Models/ledger.model.js";
import customError from "../Utilities/customError.js";
import sendResponse from "../Utilities/sendResponse.js";
import { redis } from "../Config/redis.js";

export const requestPayment = async (req, res, next) => {
  try {
    const { requestedTo, amount } = req.body;

    if (!requestedTo || !amount || amount < 0)
      throw new customError(400, "All fields are required and must be valid.");

    const requesterId = req.user.userId;
    const requestedToUser = await Users.findOne({ email: requestedTo }).lean();

    if (!requestedToUser) throw new customError(400, "User not found.");

    if (requestedToUser._id.equals(requesterId))
      throw new customError(
        400,
        "Receiver cannot request payment to themselves.",
      );

    await PaymentRequests.create({
      requestedBy: requesterId,
      requestedTo: requestedToUser._id,
      amount,
    });

    return sendResponse(res, 201, "Payment requested successfully.");
  } catch (error) {
    next(error);
  }
};

export const incomingPaymentRequests = async (req, res, next) => {
  try {
  } catch (error) {
    next(error);
  }
};

export const outgoingPaymentRequests = async (req, res, next) => {
  try {
  } catch (error) {
    next(error);
  }
};

export const handlePaymentRequest = async (req, res, next) => {
  let session = await mongoose.startSession();
  let transaction;
  let idempotencyKey;
  try {
    const { paymentRequestId, action, idemKey } = req.body;

    if (!paymentRequestId || !action || !idemKey)
      throw new customError(400, "Invalid request");

    idempotencyKey = `idem:${req.user.userId}:${idemKey}`;

    const isSet = await redis.set(
      idempotencyKey,
      "PENDING",
      "EX",
      60 * 5,
      "NX",
    );

    if (!isSet) {
      const existing = await redis.get(idempotencyKey);
      return sendResponse(
        res,
        200,
        "Transaction already exists with this idempotency key",
        { status: existing },
      );
    }

    if (action === "reject") {
      await PaymentRequests.findOneAndUpdate(
        {
          _id: paymentRequestId,
          requestedTo: req.user.userId,
          status: "pending",
        },
        { status: "rejected" },
      );

      await redis.set(idempotencyKey, "rejected", "EX", 60 * 5);

      return sendResponse(res, 200, "Payment request rejected successfully.");
    } else if (action === "accept") {
      await session.startTransaction();

      const request = await PaymentRequests.findOneAndUpdate(
        {
          _id: paymentRequestId,
          requestedTo: req.user.userId,
          status: "pending",
        },
        { status: "accepted" },
        { session, new: true },
      );

      if (!request) throw new customError(404, "Payment request not found.");

      const receiver = await Users.findById(request.requestedBy);
      if (!receiver || !receiver.walletId)
        throw new customError(400, "Receiver or wallet not found.");

      if (receiver._id.equals(req.user.userId))
        throw new customError(400, "Receiver cannot send money to themselves.");

      const senderObjectId = request.requestedTo;
      const receiverObjectId = receiver._id;

      const sendResult = await Wallets.findOneAndUpdate(
        { _id: req.user.walletId, balance: { $gte: request.amount } },
        { $inc: { balance: -request.amount } },
        { session },
      );

      if (!sendResult) throw new customError(400, "Insufficient balance");

      const receiveResult = await Wallets.findOneAndUpdate(
        { _id: receiver.walletId },
        { $inc: { balance: request.amount } },
        { session },
      );

      if (!receiveResult)
        throw new customError(400, `Failed to send money to ${receiver.name}`);

      [transaction] = await Transactions.create(
        [
          {
            type: "transfer",
            amount: request.amount,
            status: "success",
            senderId: senderObjectId,
            receiverId: receiverObjectId,
          },
        ],
        { session },
      );

      await Ledgers.insertMany(
        [
          {
            type: "debit",
            userId: senderObjectId,
            amount: -request.amount,
            transactionId: transaction._id,
          },
          {
            type: "credit",
            userId: receiverObjectId,
            amount: request.amount,
            transactionId: transaction._id,
          },
        ],
        { session },
      );

      await session.commitTransaction();

      await redis.set(idempotencyKey, "SUCCESS", "EX", 60 * 5);
    }

    return sendResponse(res, 200, "Payment done successfully.");
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    if (transaction) {
      await Transactions.findByIdAndUpdate(transaction._id, {
        status: "failed",
      });
    }
    if (idempotencyKey) {
      await redis.set(idempotencyKey, "FAILED", "EX", 60 * 5);
    }

    next(error);
  } finally {
    await session.endSession();
  }
};
