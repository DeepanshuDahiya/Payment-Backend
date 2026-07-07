import mongoose from "mongoose";
import PaymentRequests from "../Models/paymentRequests.model.js";
import Users from "../Models/user.model.js";
import { redisClient } from "../../server.js";
import Wallets from "../Models/wallet.model.js";
import Transactions from "../Models/transaction.model.js";
import Ledgers from "../Models/ledger.model.js";

export const requestPayment = async (req, res) => {
  const { requestedTo, amount } = req.body;

  if (!requestedTo || !amount || amount < 0) {
    return res
      .status(400)
      .json({ message: "All fields are required and must be valid." });
  }
  if (requestedTo.equals(req.user.userId)) {
    return res
      .status(400)
      .json({ error: "Receiver cannot request payment to themselves." });
  }

  try {
    const requesterId = req.user.userId;
    const requestedToUser = await Users.findOne({ email: requestedTo }).lean();

    if (!requestedToUser) {
      res.status(400).json({ message: "User not found." });
    }

    const paymentRequest = await PaymentRequests.create({
      requestedBy: requesterId,
      requestedTo: requestedToUser._id,
      amount,
    });
    return res.json({ message: "Requested payment successfully." });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ error: error.message, user: req.user });
  }
};

export const incomingPaymentRequests = async (req, res) => {
  try {
  } catch (error) {}
};

export const outgoingPaymentRequests = async (req, res) => {
  try {
  } catch (error) {}
};

export const handlePaymentRequest = async (req, res) => {
  const { paymentRequestId, action, idemKey } = req.body;

  if (!paymentRequestId || !action || !idemKey) {
    return res.status(400).json({ message: "Invalid request." });
  }

  let session = await mongoose.startSession();
  let transaction;

  const idempotencyKey = `idem:${req.user.userId}:${idemKey}:`;

  try {
    const isSet = await redisClient.set(idempotencyKey, "PENDING", {
      NX: true,
      EX: 60 * 5,
    });

    if (!isSet) {
      const existing = await redisClient.get(idempotencyKey);
      return res.status(200).json({ status: existing });
    }

    if (action === "reject") {
      await PaymentRequests.findOneAndUpdate(
        { _id: paymentRequestId, requestedTo: req.user.userId },
        { status: "rejected" },
      );
      console.log("inside reject");

      await redisClient.set(idempotencyKey, "rejected", {
        EX: 60 * 5,
      });

      return res.json({ message: "Payment request rejected successfully." });
    } else if (action === "accept") {
      console.log("inside accept");
      await session.startTransaction();

      const request = await PaymentRequests.findOneAndUpdate(
        { _id: paymentRequestId, requestedTo: req.user.userId },
        { status: "accepted" },
        { session, new: true },
      );

      const receiver = await Users.findById(request.requestedBy);
      if (!receiver || !receiver.walletId) {
        return res.status(404).json({ error: "Receiver or wallet not found." });
      }
      if (receiver._id.equals(req.user.userId)) {
        return res
          .status(400)
          .json({ error: "Receiver cannot send money to themselves." });
      }

      const senderObjectId = request.requestedTo;
      const receiverObjectId = receiver._id;

      const sendResult = await Wallets.findOneAndUpdate(
        { _id: req.user.walletId, balance: { $gte: request.amount } },
        { $inc: { balance: -request.amount } },
        { session },
      );

      if (!sendResult) {
        throw new Error("Insufficient balance");
      }

      const receiveResult = await Wallets.findOneAndUpdate(
        { _id: receiver.walletId },
        { $inc: { balance: request.amount } },
        { session },
      );

      if (!receiveResult) {
        throw new Error(`Failed to send money to ${receiver.name}`);
      }

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

      if (!transaction) throw new Error("Transaction not updated.");

      const ledgerResult = await Ledgers.insertMany(
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

      await redisClient.set(idempotencyKey, "SUCCESS", { EX: 60 * 5 });
    }
    return res.json({ message: "Payment done successfully." });
  } catch (error) {
    console.log(error.message);
    if (transaction) {
      await Transactions.findByIdAndUpdate(transaction._id, {
        status: "failed",
      });
      await redisClient.set(idempotencyKey, "FAILED", { EX: 60 * 5 });
    }
    await session.abortTransaction();
    return res.status(error.status || 500).json({ error: error.message });
  } finally {
    await session.endSession();
  }
};
