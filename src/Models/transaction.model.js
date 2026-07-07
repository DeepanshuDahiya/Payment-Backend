import { model, Schema } from "mongoose";

const transactionSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["deposit", "transfer", "withdrawal"],
      required: true,
    },

    senderId: {
      type: Schema.Types.ObjectId,
      required: function () {
        return this.type === "transfer";
      },
      default: null,
      ref: "Users",
    },

    receiverId: {
      type: Schema.Types.ObjectId,
      required: function () {
        return this.type !== "withdrawal";
      },
      default: null,
      ref: "Users",
    },

    amount: {
      type: Number,
      required: true,
      // validate: {
      //   validator: Number.isInteger,
      //   message: "Amount must be stored in paise as an integer.",
      // },
    },

    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

transactionSchema.index({ senderId: 1, createdAt: -1, _id: -1 });
transactionSchema.index({ receiverId: 1, createdAt: -1, _id: -1 });

const Transactions = model("Transactions", transactionSchema);

export default Transactions;
