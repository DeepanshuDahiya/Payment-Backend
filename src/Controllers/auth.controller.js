import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import Users from "../Models/user.model.js";
import Wallets from "../Models/wallet.model.js";
import { sanitizeUser } from "../Utilities/sanitizeUser.js";
import { sendOtp, verifyOtp } from "../Services/otp.services.js";
import customError from "../Utilities/customError.js";
import sendResponse from "../Utilities/sendResponse.js";
import { redis } from "../Config/redis.js";
import { UAParser } from "ua-parser-js";

const otpTypes = {
  email_verification: "email-verification",
  password_reset: "password-reset",
};

export const registerController = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      throw new customError(400, "All fields are required");

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await Users.create({
      name,
      email,
      password: hashedPassword,
    });

    await sendOtp({
      email,
      userName: name,
      purpose: otpTypes.email_verification,
    });

    return sendResponse(
      res,
      201,
      "User created successfully, now verify the email",
    );
  } catch (error) {
    if (error.code === 11000)
      throw new customError(400, "User with this Email already exists");

    next(error);
  }
};

export const emailVerifyOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await Users.findOne({ email });
    if (!user) throw new customError(400, "Enter a valid and registered Email");

    await sendOtp({
      email,
      userName: user.name,
      purpose: otpTypes.email_verification,
    });

    return sendResponse(res, 200, "Otp sent to the Email");
  } catch (error) {
    next(error);
  }
};

export const verifyUser = async (req, res, next) => {
  let session = await mongoose.startSession();
  try {
    const { email, otp } = req.body;
    if (!email || !otp) throw new customError(400, "All fields are required");

    const user = await Users.findOne({ email });

    if (!user) throw new customError(400, "User not registered");

    if (user.isVerified === true)
      throw new customError(400, "User is already verified");

    await verifyOtp({ email, otp, purpose: otpTypes.email_verification });

    await session.startTransaction();

    const [wallet] = await Wallets.create(
      [
        {
          userId: user._id,
        },
      ],
      { session },
    );

    await Users.findOneAndUpdate(
      { _id: user._id },
      {
        $set: { isVerified: true, walletId: wallet._id },
        $unset: { expiresAt: "" },
      },

      { session },
    );

    await session.commitTransaction();

    return sendResponse(res, 200, "Email verified successfully ");
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    next(error);
  } finally {
    await session.endSession();
  }
};

export const loginController = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      throw new customError(400, "All fields are required");

    if (req.signedCookies.sid)
      throw new customError(400, "User already logged in");

    const user = await Users.findOne({ email }).lean();
    if (!user) throw new customError(401, "Invalid credentials");

    if (!user.isVerified)
      throw new customError(400, "Verify the Email to log into the account");

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) throw new customError(401, "Invalid credentials");

    const key = `user_sessions:${user._id}`;

    let count = await redis.zcard(key);
    while (count >= user.maxDevices) {
      const [oldestSid] = await redis.zrange(key, 0, 0);

      if (!oldestSid) break;

      const exists = await redis.exists(`session:${oldestSid}`);

      if (!exists) {
        await redis.zrem(key, oldestSid);
        count = await redis.zcard(key);
        continue;
      }

      await redis
        .multi()
        .del(`session:${oldestSid}`)
        .zrem(key, oldestSid)
        .exec();

      break;
    }

    const parser = new UAParser(req.headers["user-agent"]);
    const result = parser.getResult();

    const sid = new ObjectId().toString();
    const sessionData = JSON.stringify({
      userId: user._id,
      walletId: user.walletId,
      email: user.email,
      name: user.name,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      browser: result.browser.name,
      os: result.os.name,
      deviceType: result.device.type || "Desktop",
    });

    await redis
      .multi()
      .set(`session:${sid}`, sessionData, "EX", 60 * 60 * 24)
      .zadd(key, Date.now(), sid)
      .exec();

    res.cookie("sid", sid, {
      httpOnly: true,
      signed: true,
      maxAge: 1000 * 60 * 60 * 24,
    });

    return sendResponse(res, 200, "User logged in successfully");
  } catch (error) {
    next(error);
  }
};

export const logoutController = async (req, res, next) => {
  try {
    const sid = req.signedCookies.sid;

    await redis
      .multi()
      .del(`session:${sid}`)
      .zrem(`user_sessions:${req.user.userId}`, sid)
      .exec();

    res.clearCookie("sid");
    return sendResponse(res, 200, "User logged out successfully");
  } catch (error) {
    next(error);
  }
};

export const currentUserController = async (req, res, next) => {
  try {
    const sanitizedUser = sanitizeUser(req.user);
    return sendResponse(res, 200, "Current user fetched successfully", {
      user: sanitizedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const resetPasswordOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await Users.findOne({ email });
    if (!user) throw new customError(400, "Enter a valid and registered Email");

    await sendOtp({
      email,
      userName: user.name,
      purpose: otpTypes.password_reset,
    });
    return sendResponse(res, 200, "Otp sent");
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { otp, email, newPassword } = req.body;

    if (!otp || !email || !newPassword)
      throw new customError(400, "All fields are required");

    const user = await Users.findOne({ email });
    if (!user) throw new customError(400, "User does not exists");

    await verifyOtp({ email, otp, purpose: otpTypes.password_reset });

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await Users.findOneAndUpdate(
      { _id: user._id },
      { password: hashedPassword },
    );

    return sendResponse(res, 200, "Password updated successfully");
  } catch (error) {
    next(error);
  }
};
