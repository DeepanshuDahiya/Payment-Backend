import Transactions from "../Models/transaction.model.js";
import { cursorPagination } from "../Services/cursorPagination.service.js";

export const getTransactionHistory = async (req, res, next) => {
  try {
    const { limit, cursorId, cursorCreatedAt } = req.query;

    const baseQuery = {
      $or: [{ senderId: req.user.userId }, { receiverId: req.user.userId }],
    };

    const {
      data: transactions,
      nextCursor,
      hasMore,
    } = await cursorPagination({
      model: Transactions,
      baseQuery,
      cursorId,
      cursorCreatedAt,
      limit,
      populate: [
        {
          path: "senderId",
          select: "name email",
        },
        {
          path: "receiverId",
          select: "name email",
        },
      ],
    });

    const transactionsWithDirection = transactions.map((transaction) => {
      if (transaction.type === "deposit") {
        return { ...transaction, direction: "Received" };
      }

      if (transaction.type === "withdrawal") {
        return { ...transaction, direction: "Sent" };
      }

      if (transaction.senderId?._id.equals(req.user.userId)) {
        return { ...transaction, direction: "Sent" };
      }

      return { ...transaction, direction: "Received" };
    });

    return res.json({
      transactionsData: transactionsWithDirection,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
};
