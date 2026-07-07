import { model, Schema } from "mongoose";

const paymentRequestSchema = new Schema({
  requestedBy: {
    type: Schema.ObjectId,
    required: true,
    ref: "Users",
  },
  requestedTo: {
    type: Schema.ObjectId,
    required: true,
    ref: "Users",
  },
  amount: {
    type: Number,
    required: true,
    min: [1, "Amount must be greater than 0"],
    // validate: {
    //   validator: Number.isInteger,
    //   message: "Amount must be stored in paise as an integer.",
    // },
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 1000 * 60 * 60 * 24),
  },
});

paymentRequestSchema.index({ requestedBy: 1 });
paymentRequestSchema.index({ requestedTo: 1 });
paymentRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PaymentRequests = model("PaymentRequests", paymentRequestSchema);

export default PaymentRequests;
