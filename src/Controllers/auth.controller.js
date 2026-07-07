import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import Users from "../Models/user.model.js";
import Wallets from "../Models/wallet.model.js";
import Sessions from "../Models/session.model.js";
import { sanitizeUser } from "../Utilities/sanitizeUser.js";
import { redisClient } from "../../server.js";
import emailQueue from "../Queues/email.queue.js";
import { sendVerificationOtp } from "../Services/otp.services.js";

const otpTypes = {
  email_verification: "email-verification",
  password_reset: "password-reset",
};

export const registerController = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = Users.create({
      name,
      email,
      password: hashedPassword,
    });

    await sendVerificationOtp({
      email,
      userName: name,
      queueName: "email-queue",
      purpose: otpTypes.email_verification,
    });

    return res
      .status(201)
      .json({ message: "User created Successfully, now verify the user." });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        error: "Email already exists",
      });
    }
    return res.status(500).json({ error: error.message });
  }
};

export const emailVerifyOtp = async (req, res) => {
  const { email } = req.body;

  const user = Users.findOne(email);
  if (!user)
    return res
      .status(400)
      .json({ message: "Enter a valid and registered E-mail." });

  try {
    const result = await sendVerificationOtp({
      email,
      userName: user.name,
      queueName: "email-queue",
      purpose: otpTypes.email_verification,
    });
    return res.send(result);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

export const verifyUser = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res
      .status(400)
      .json({ message: "All fields are required to verify the User." });
  }
  let session = await mongoose.startSession();

  try {
    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not registered." });
    }
    if (user.isVerified === true) {
      return res.status(400).json({ message: "User is already verified." });
    }
    const generatedOTP = await redisClient.get(
      `otp:${otpTypes.email_verification}:${email}`,
    );
    console.log(generatedOTP);

    if (!generatedOTP)
      return res.status(400).json({ message: "OTP has been expired." });

    if (generatedOTP !== otp) {
      return res.status(400).json({ message: "Enter a valid OTP." });
    }

    await session.startTransaction();

    const [wallet] = await Wallets.create(
      [
        {
          userId: user._id,
        },
      ],
      { session },
    );

    const updatedUser = await Users.findOneAndUpdate(
      { _id: user._id },
      {
        $set: { isVerified: true, walletId: wallet._id },
        $unset: { expiresAt: "" },
      },

      { session },
    );

    await session.commitTransaction();

    await redisClient.del(`otp:${otpTypes.email_verification}:${email}`);

    return res.status(200).json({ message: "User verified successfully." });
  } catch (error) {
    if (session) await session.abortTransaction();
    return res.status(error.status || 500).json({ error: error });
  } finally {
    session.endSession();
  }
};

export const loginController = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    if (req.signedCookies.sid) {
      return res.status(400).json({ error: "User already logged in" });
    }

    const user = await Users.findOne({ email }).lean();
    if (!user) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }
    if (!user.isVerified) {
      return res
        .status(400)
        .json({ message: "Verify the user's E-mail to log into the account." });
    }

    // const isValidPassword = await bcrypt.compare(password, user.password);
    // if (!isValidPassword) {
    //   return res.status(401).json({ error: "Invalid Credentials" });
    // }

    let sid = new ObjectId().toString();
    await redisClient.set(
      sid,
      JSON.stringify({
        userId: user._id,
        walletId: user.walletId,
        email: user.email,
      }),
      {
        EX: 60 * 60 * 24,
      },
    );

    res.cookie("sid", sid, {
      httpOnly: true,
      signed: true,
      maxAge: 60 * 60 * 60 * 24,
    });

    res.status(201).json({ message: "User logged in successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const logoutController = async (req, res) => {
  try {
    await redisClient.del(req.signedCookies.sid);
    res.clearCookie("sid");
    return res.json({ message: "User logged out successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const currentUserController = async (req, res) => {
  try {
    const safeUser = sanitizeUser(req.user);
    return res.json({ user: safeUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const resetPasswordOtp = async (req, res) => {
  const { email } = req.body;

  const user = Users.findOne(email);
  if (!user)
    return res
      .status(400)
      .json({ message: "Enter a valid and registered E-mail." });

  try {
    const result = await sendVerificationOtp({
      email,
      userName: user.name,
      queueName: "email-queue",
      purpose: otpTypes.password_reset,
    });
    return res.send(result);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

export const resetPassword = async (req, res) => {
  const { otp, email, newPassword } = req.body;

  if (!otp || !email) {
    return res.status(400).json({ message: "All fields are required." });
  }
  try {
    const user = Users.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User does not exists" });
    }

    const generatedOTP = await redisClient.get(
      `otp:${otpTypes.password_reset}:${email}`,
    );
    console.log(generatedOTP);

    if (!generatedOTP)
      return res.status(400).json({ message: "OTP has been expired." });
    if (generatedOTP !== otp) {
      return res.status(400).json({ message: "Enter a valid OTP." });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await Users.findOneAndUpdate(
      { _id: user._id },
      { password: hashedPassword },
    );

    await redisClient.del(`otp:${otpTypes.password_reset}:${email}`);
    return res.json({ message: "Password updated successfully." });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};
