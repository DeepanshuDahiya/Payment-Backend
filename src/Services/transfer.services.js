import Wallets from "../Models/wallet.model.js";
import Transactions from "../Models/transaction.model.js";
import Ledgers from "../Models/ledger.model.js";
import customError from "../Utilities/customError.js";

export const transferMoney = async ({
  senderId,
  senderWalletId,
  receiverId,
  receiverWalletId,
  amount,
  session,
}) => {
  const sendResult = await Wallets.findOneAndUpdate(
    {
      _id: senderWalletId,
      balance: { $gte: amount },
    },
    {
      $inc: { balance: -amount },
    },
    { session },
  );

  if (!sendResult) {
    throw new customError(400, "Insufficient balance");
  }

  const receiveResult = await Wallets.findOneAndUpdate(
    {
      _id: receiverWalletId,
    },
    {
      $inc: { balance: amount },
    },
    { session },
  );

  if (!receiveResult) {
    throw new customError(400, "Failed to send money");
  }

  const [transaction] = await Transactions.create(
    [
      {
        type: "transfer",
        amount,
        status: "success",
        senderId,
        receiverId,
      },
    ],
    { session },
  );

  await Ledgers.insertMany(
    [
      {
        type: "debit",
        userId: senderId,
        amount: -amount,
        transactionId: transaction._id,
      },
      {
        type: "credit",
        userId: receiverId,
        amount,
        transactionId: transaction._id,
      },
    ],
    { session },
  );

  return transaction;
};
