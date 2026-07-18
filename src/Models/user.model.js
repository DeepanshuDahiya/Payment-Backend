import { model, Schema } from "mongoose";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please use a valid e-mail"],
    },
    password: {
      type: String,
      required: true,
    },
    walletId: {
      type: Schema.Types.ObjectId,
      required: function () {
        return this.isVerified;
      },
      ref: "Wallets",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Users = model("Users", userSchema);

export default Users;
