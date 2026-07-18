import mongoose from "mongoose";
import PaymentRequests from "../Models/paymentRequests.model.js";
import Users from "../Models/user.model.js";
import Wallets from "../Models/wallet.model.js";
import Transactions from "../Models/transaction.model.js";
import Ledgers from "../Models/ledger.model.js";
import customError from "../Utilities/customError.js";
import sendResponse from "../Utilities/sendResponse.js";
import { redis } from "../Config/redis.js";
import {
  markFailed,
  markRejected,
  markSuccess,
} from "../Services/idempotency.services.js";
import { transferMoney } from "../Services/transfer.services.js";
import { cursorPagination } from "../Services/cursorPagination.service.js";

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
    const { limit, cursorId, cursorCreatedAt } = req.query;

    const {
      data: paymentRequests,
      nextCursor,
      hasMore,
    } = await cursorPagination({
      model: PaymentRequests,
      baseQuery: {
        requestedTo: req.user.userId,
      },
      cursorId,
      cursorCreatedAt,
      limit,
      populate: [
        {
          path: "requestedBy",
          select: "name email",
        },
      ],
    });

    return sendResponse(
      res,
      200,
      "Incoming payment requests fetched successfully",
      {
        paymentRequests,
        nextCursor,
        hasMore,
      },
    );
  } catch (error) {
    next(error);
  }
};

export const outgoingPaymentRequests = async (req, res, next) => {
  try {
    const { limit, cursorId, cursorCreatedAt } = req.query;

    const {
      data: paymentRequests,
      nextCursor,
      hasMore,
    } = await cursorPagination({
      model: PaymentRequests,
      baseQuery: {
        requestedBy: req.user.userId,
      },
      cursorId,
      cursorCreatedAt,
      limit,
      populate: [
        {
          path: "requestedTo",
          select: "name email",
        },
      ],
    });

    return sendResponse(
      res,
      200,
      "Outgoing payment requests fetched successfully",
      {
        paymentRequests,
        nextCursor,
        hasMore,
      },
    );
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

    const existing = await checkIdempotency(idempotencyKey);

    if (existing) {
      return sendResponse(
        res,
        200,
        "Action on this payment with this idempotency key has already been taken",
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

      await markRejected(idempotencyKey);

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

      transaction = await transferMoney({
        senderId: request.requestedTo,
        senderWalletId: req.user.walletId,
        receiverId: receiver._id,
        receiverWalletId: receiver.walletId,
        amount: request.amount,
        session,
      });

      await markSuccess(idempotencyKey);

      await session.commitTransaction();
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
      await markFailed(idempotencyKey);
    }
    next(error);
  } finally {
    await session.endSession();
  }
};
