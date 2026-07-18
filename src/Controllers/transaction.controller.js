import Transactions from "../Models/transaction.model.js";

export const getTransactionHistory = async (req, res) => {
  const { limit = 10, cursorId, cursorCreatedAt } = req.query;

  const maxLimit = Math.min(50, limit);

  const baseQuery = {
    $or: [{ senderId: req.user.userId }, { receiverId: req.user.userId }],
  };

  let cursorQuery = {};

  if (cursorId && cursorCreatedAt) {
    cursorQuery = {
      $or: [
        {
          createdAt: { $lt: new Date(cursorCreatedAt) },
        },
        {
          createdAt: { $lt: new Date(cursorCreatedAt) },
          _id: { $lt: cursorId },
        },
      ],
    };
  }

  const finalQuery = cursorId ? { $and: [baseQuery, cursorQuery] } : baseQuery;

  try {
    const transactions = await Transactions.find(finalQuery)
      .sort({ createdAt: -1, _id: -1 })
      .limit(maxLimit + 1)
      .populate("senderId", "name email")
      .populate("receiverId", "name email")
      .lean();

    const hasMore = transactions.length > maxLimit;

    if (hasMore) {
      transactions.pop();
    }

    let nextCursor = null;

    if (transactions.length > 0) {
      const last = transactions[transactions.length - 1];

      nextCursor = {
        createdAt: last.createdAt,
        _id: last._id,
      };
    }

    const transactionsWithDirection = transactions.map((transaction) => {
      if (transaction.type === "deposit") {
        return { ...transaction, direction: "Received" };
      } else if (transaction.type === "withdrawal") {
        return { ...transaction, direction: "Sent" };
      } else if (transaction.senderId._id.equals(req.user.userId)) {
        return { ...transaction, direction: "Sent" };
      } else {
        return { ...transaction, direction: "Received" };
      }
    });

    return res.json({
      transactionsData: transactionsWithDirection,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
