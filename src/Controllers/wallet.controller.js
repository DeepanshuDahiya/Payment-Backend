import Ledgers from "../Models/ledger.model.js";
import Wallets from "../Models/wallet.model.js";

export const getWallet = async (req, res) => {
  try {
    const wallet = await Wallets.findOne({ userId: req.user.userId });

    if (!wallet) return res.status(400).json({ error: "Wallet not found" });

    return res.status(200).json(wallet);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const verifyWallet = async (req, res) => {
  try {
    const wallet = await Wallets.findOne({ userId: req.user.userId });

    if (!wallet) return res.status(400).json({ error: "Wallet not found" });

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

    return res
      .status(200)
      .json({ walletBalance: wallet.balance, computedBalance, isConsistent });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
