import { model, Schema } from "mongoose";

const ledgerSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["debit", "credit"],
      required: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      required: true,
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
    transactionId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

ledgerSchema.index({ userId: 1 });

function isModifyingLedger() {
  throw new Error("Ledger modification is not allowed.");
}

ledgerSchema.pre("updateOne", isModifyingLedger);
ledgerSchema.pre("updateMany", isModifyingLedger);
ledgerSchema.pre("deleteOne", isModifyingLedger);
ledgerSchema.pre("deleteMany", isModifyingLedger);
ledgerSchema.pre("findOneAndDelete", isModifyingLedger);
ledgerSchema.pre("findOneAndReplace", isModifyingLedger);
ledgerSchema.pre("findOneAndUpdate", isModifyingLedger);
ledgerSchema.pre("save", function () {
  if (!this.isNew) {
    return new Error("Ledger modification is not allowed.");
  }
});

const Ledgers = model("Ledgers", ledgerSchema);

export default Ledgers;
