import { model, Schema } from "mongoose";

const sessionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Users",
  },

  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600,
  },
});

sessionSchema.index({ userId: 1 });

const Sessions = model("Sessions", sessionSchema);

export default Sessions;
