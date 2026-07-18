import Ledgers from "../Models/ledger.model.js";
import Wallets from "../Models/wallet.model.js";
import customError from "../Utilities/customError.js";
import sendResponse from "../Utilities/sendResponse.js";

export const getWallet = async (req, res, next) => {
  try {
    const wallet = await Wallets.findOne({ userId: req.user.userId });

    if (!wallet) throw new customError(404, "Wallet not found");

    return sendResponse(res, 200, "", { wallet });
  } catch (error) {
    next(error);
  }
};

export const verifyWallet = async (req, res, next) => {
  try {
    const wallet = await Wallets.findOne({ userId: req.user.userId });
    if (!wallet) throw new customError(404, "Wallet not found");

    const result = await Ledgers.aggregate([
      {
        $match: { userId: req.user.userId },
      },
      {
        $group: { _id: null, total: { $sum: "$amount" } },
      },
    ]);

    const computedBalance = result.length > 0 ? result[0].total : 0;

    let isConsistent;

    if (wallet.balance === computedBalance) {
      isConsistent = true;
    } else isConsistent = false;

    return sendResponse(res, 200, "Wallet verified", {
      walletBalance: wallet.balance,
      computedBalance,
      isConsistent,
    });
  } catch (error) {
    next(error);
  }
};
