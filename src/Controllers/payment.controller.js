import mongoose from "mongoose";
import Ledgers from "../Models/ledger.model.js";
import Transactions from "../Models/transaction.model.js";
import Users from "../Models/user.model.js";
import Wallets from "../Models/wallet.model.js";
import { sanitizeUser } from "../Utilities/sanitizeUser.js";
import customError from "../Utilities/customError.js";
import { redis } from "../Config/redis.js";
import sendResponse from "../Utilities/sendResponse.js";
import { transferMoney } from "../Services/transfer.services.js";
import {
  checkIdempotency,
  markFailed,
  markSuccess,
} from "../Services/idempotency.services.js";

export const getReceiver = async (req, res, next) => {
  try {
    const { email } = req.params;

    if (!email)
      throw new customError(400, "Email is required to find receiver");

    const user = await Users.findOne({ email }).lean();
    if (!user) throw new customError(404, "User not found");

    if (user._id.equals(req.user.userId))
      throw new customError(400, "Users cannot send money to themselves");

    const sanitizedUser = sanitizeUser(user);
    return sendResponse(res, 200, "Current User", { receiver: sanitizedUser });
  } catch (error) {
    next(error);
  }
};

export const createTransfer = async (req, res, next) => {
  const session = await mongoose.startSession();
  let transaction;
  let idempotencyKey;
  try {
    const receiverId = req.body.receiverId;
    const amount = Number(req.body.amount);
    const idemKey = req.body.idempotencyKey;

    if (!receiverId || typeof amount !== "number" || amount <= 0)
      throw new customError(400, "Invalid amount or receiver Id");

    if (!idemKey) throw new customError(400, "Idempotency key is required");

    idempotencyKey = `idem:${req.user.userId}:${idemKey}`;

    const existing = await checkIdempotency(idempotencyKey);

    if (existing) {
      return sendResponse(
        res,
        200,
        "Transaction with this idempotency key exists",
        { status: existing },
      );
    }

    const receiver = await Users.findById(receiverId);

    if (!receiver || !receiver.walletId)
      throw new customError(404, "Receiver or wallet not found");

    if (receiver._id.equals(req.user.userId))
      throw new customError(404, "Receiver cannot send money to themselves.");

    await session.startTransaction();

    transaction = await transferMoney({
      senderId: req.user.userId,
      senderWalletId: req.user.walletId,
      receiverId: receiver._id,
      receiverWalletId: receiver.walletId,
      amount,
      session,
    });

    await markSuccess(idempotencyKey);

    await session.commitTransaction();

    return sendResponse(res, 200, "Transfer successful");
  } catch (error) {
    if (transaction) {
      await Transactions.findByIdAndUpdate(transaction._id, {
        status: "failed",
      });
    }
    if (idempotencyKey) {
      await markFailed(idempotencyKey);
    }
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    next(error);
  } finally {
    await session.endSession();
  }
};

export const createDeposit = async (req, res, next) => {
  const session = await mongoose.startSession();
  let transaction;
  let idempotencyKey;
  try {
    const amount = Number(req.body.amount);
    const idemKey = req.body.idempotencyKey;

    if (typeof amount !== "number" || amount <= 0)
      throw new customError(400, "Invalid amount or receiver Id");

    if (!idemKey) throw new customError(400, "Idempotency key is required");

    idempotencyKey = `idem:${req.user.userId}:${idemKey}`;

    const existing = await checkIdempotency(idempotencyKey);

    if (existing) {
      return sendResponse(
        res,
        200,
        "Transaction with this idempotency key exists",
        { status: existing },
      );
    }

    await session.startTransaction();

    const walletResult = await Wallets.findByIdAndUpdate(
      req.user.walletId,
      {
        $inc: { balance: amount },
      },
      { session },
    );

    if (!walletResult) throw new customError(400, "Wallet not updated.");

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

    if (!transaction) throw new customError(400, "Transaction not updated.");

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

    await markSuccess(idempotencyKey);

    await session.commitTransaction();

    return sendResponse(res, 200, "Deposit successful");
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

export const createWithdrawal = async (req, res, next) => {
  const session = await mongoose.startSession();
  let transaction;
  let idempotencyKey;
  try {
    const amount = Number(req.body.amount);
    const idemKey = req.body.idempotencyKey;

    if (typeof amount !== "number" || amount <= 0)
      throw new customError(400, "Invalid amount or receiver Id");

    if (!idemKey) throw new customError(400, "Idempotency key is required");

    idempotencyKey = `idem:${req.user.userId}:${idemKey}`;

    const existing = await checkIdempotency(idempotencyKey);

    if (existing) {
      return sendResponse(
        res,
        200,
        "Transaction with this idempotency key exists",
        { status: existing },
      );
    }

    await session.startTransaction();

    const walletResult = await Wallets.findOneAndUpdate(
      { _id: req.user.walletId, balance: { $gte: amount } },
      {
        $inc: { balance: -amount },
      },
      { session },
    );

    if (!walletResult) throw new customError(400, "Wallet not updated.");

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

    if (!transaction) throw new customError(400, "Transaction not updated.");

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

    await markSuccess(idempotencyKey);

    await session.commitTransaction();

    return sendResponse(res, 200, "Withdrawal successful");
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
