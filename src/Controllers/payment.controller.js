import mongoose from "mongoose";
import Ledgers from "../Models/ledger.model.js";
import Transactions from "../Models/transaction.model.js";
import Users from "../Models/user.model.js";
import Wallets from "../Models/wallet.model.js";
import { sanitizeUser } from "../Utilities/sanitizeUser.js";
import { redisClient } from "../../server.js";
import { performance } from "node:perf_hooks";

export const getReceiver = async (req, res) => {
  const email = req.params.email;

  if (!email) {
    res.status(400).json({ error: "Email is required to find receiver." });
  }

  const receiverEmail = decodeURIComponent(email);

  try {
    const user = await Users.findOne({ email: receiverEmail }).lean();
    if (!user) {
      return res
        .status(404)
        .json({ error: "Enter a valid email of existing user." });
    }
    if (user._id.equals(req.user.userId)) {
      return res
        .status(400)
        .json({ error: "Users cannot send money to themselves" });
    }
    const safeUser = sanitizeUser(user);
    return res.json({ safeUser });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const createTransfer = async (req, res) => {
  const receiverId = req.body.receiverId;
  const amount = Number(req.body.amount);
  const idemKey = req.body.idempotencyKey;

  if (!receiverId || typeof amount !== "number" || amount <= 0 || !idemKey) {
    return res.status(400).json({ error: "Invalid amount or receiverId" });
  }

  const idempotencyKey = `idem:${req.user.userId}:${idemKey}`;

  const isSet = await redisClient.set(idempotencyKey, "PENDING", {
    NX: true,
    EX: 60 * 5,
  });

  if (!isSet) {
    const existing = await redisClient.get(idempotencyKey);
    return res.status(200).json({ status: existing });
  }

  const session = await mongoose.startSession();
  let transaction;

  try {
    const receiver = await Users.findById(receiverId);
    if (!receiver || !receiver.walletId) {
      return res.status(404).json({ error: "Receiver or wallet not found." });
    }
    if (receiver._id.equals(req.user.userId)) {
      return res
        .status(400)
        .json({ error: "Receiver cannot send money to themselves." });
    }

    const senderObjectId = req.user.userId;
    const receiverObjectId = receiver._id;

    await session.startTransaction();

    const sendResult = await Wallets.findOneAndUpdate(
      { _id: req.user.walletId, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { session },
    );

    if (!sendResult) {
      throw new Error("Insufficient balance");
    }

    const receiveResult = await Wallets.findOneAndUpdate(
      { _id: receiver.walletId },
      { $inc: { balance: amount } },
      { session },
    );

    if (!receiveResult) {
      throw new Error(`Failed to send money to ${receiver.name}`);
    }

    [transaction] = await Transactions.create(
      [
        {
          type: "transfer",
          amount,
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
          amount: -amount,
          transactionId: transaction._id,
        },
        {
          type: "credit",
          userId: receiverObjectId,
          amount: amount,
          transactionId: transaction._id,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    await redisClient.set(idempotencyKey, "SUCCESS", { EX: 60 * 5 });

    return res.status(200).json({ message: "Transfer Successful" });
  } catch (error) {
    if (transaction) {
      await Transactions.findByIdAndUpdate(transaction._id, {
        status: "failed",
      });
      await redisClient.set(idempotencyKey, "FAILED", { EX: 60 * 5 });
    }
    await session.abortTransaction();

    return res.status(500).json({ error: error.message });
  } finally {
    await session.endSession();
  }
};

export const createDeposit = async (req, res) => {
  const amount = Number(req.body.amount);
  const idemKey = req.body.idempotencyKey;

  if (isNaN(amount) || amount <= 0 || !idemKey) {
    return res
      .status(400)
      .json({ message: "Valid amount is required for deposit." });
  }

  const idempotencyKey = `idem:${req.user.userId}:${idemKey}`;

  const isSet = await redisClient.set(idempotencyKey, "PENDING", {
    NX: true,
    EX: 60 * 5,
  });

  if (!isSet) {
    const existing = await redisClient.get(idempotencyKey);
    return res.status(200).json({ status: existing });
  }

  const session = await mongoose.startSession();
  let transaction;

  try {
    await session.startTransaction();

    const walletResult = await Wallets.findByIdAndUpdate(
      req.user.walletId,
      {
        $inc: { balance: amount },
      },
      { session },
    );

    if (!walletResult) throw new Error("Wallet not updated.");

    [transaction] = await Transactions.create(
      [
        {
          type: "deposit",
          amount,
          status: "success",
          receiverId: req.user.userId,
        },
      ],
      { session },
    );

    if (!transaction) throw new Error("Transaction not updated.");

    await Ledgers.create(
      [
        {
          type: "credit",
          userId: req.user.userId,
          amount,
          transactionId: transaction._id,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    await redisClient.set(idempotencyKey, "SUCCESS", { EX: 60 * 5 });

    return res.status(200).json({ message: "Deposit Successful." });
  } catch (error) {
    await session.abortTransaction();
    if (transaction) {
      await Transactions.findByIdAndUpdate(transaction._id, {
        status: "failed",
      });
      await redisClient.set(idempotencyKey, "FAILED", { EX: 60 * 5 });
    }
    return res.status(500).json({ error: error.message });
  } finally {
    await session.endSession();
  }
};

export const createWithdrawal = async (req, res) => {
  const amount = Number(req.body.amount);

  const idemKey = req.body.idempotencyKey;

  if (isNaN(amount) || amount <= 0 || !idemKey) {
    return res
      .status(400)
      .json({ message: "Valid amount is required for withdrawal." });
  }

  const idempotencyKey = `idem:${req.user.userId}:${idemKey}`;

  const isSet = await redisClient.set(idempotencyKey, "PENDING", {
    NX: true,
    EX: 60 * 5,
  });

  if (!isSet) {
    const existing = await redisClient.get(idempotencyKey);
    return res.status(200).json({ status: existing });
  }

  const session = await mongoose.startSession();
  let transaction;

  try {
    await session.startTransaction();

    const walletResult = await Wallets.findOneAndUpdate(
      { _id: req.user.walletId, balance: { $gte: amount } },
      {
        $inc: { balance: -amount },
      },
      { session },
    );

    if (!walletResult) throw new Error("Wallet not updated.");

    [transaction] = await Transactions.create(
      [
        {
          type: "withdrawal",
          amount,
          status: "success",
          senderId: req.user.userId,
        },
      ],
      { session },
    );

    if (!transaction) throw new Error("Transaction not updated.");

    await Ledgers.create(
      [
        {
          type: "debit",
          userId: req.user.userId,
          amount: -amount,
          transactionId: transaction._id,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    await redisClient.set(idempotencyKey, "SUCCESS", { EX: 60 * 5 });

    return res.status(200).json({ message: "Withdrawal Successful." });
  } catch (error) {
    await session.abortTransaction();
    if (transaction) {
      await Transactions.findByIdAndUpdate(transaction._id, {
        status: "failed",
      });
      await redisClient.set(idempotencyKey, "FAILED", { EX: 60 * 5 });
    }

    return res.status(500).json({ error: error.message });
  } finally {
    await session.endSession();
  }
};
