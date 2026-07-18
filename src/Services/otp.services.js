import { redisClient } from "../../server.js";
import emailQueue from "../Queues/email.queue.js";
import Crypto from "crypto";
import customError from "../Utilities/customError.js";

export async function sendOtp({
  email,
  userName,
  queueName = "email-queue",
  purpose,
}) {
  // Generate OTP
  const otp = Crypto.randomInt(1000, 10000);

  // Store in Redis
  const isResendAllowed = await redisClient.set(
    `resend:${email}`,
    otp,
    "EX",
    60,
    "NX",
  );

  if (!isResendAllowed)
    throw new customError(
      400,
      "Please try after 60 seconds to resend OTP again.",
    );

  await redisClient.set(`otp:${purpose}:${email}`, otp, "EX", 60 * 5);

  // Queue email
  await emailQueue.add(
    `${queueName}`,
    {
      email,
      name: userName,
      otp,
    },
    {
      removeOnComplete: true,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 3000,
      },
    },
  );
}

export async function verifyOtp({ email, otp, purpose }) {
  if (!otp || !email)
    throw new customError(400, "Valid OTP and Email are required");

  const generatedOtp = await redis.get(`otp:${purpose}:${email}`);

  if (!generatedOtp) throw new customError(400, "OTP expired.");

  if (generatedOtp !== otp) throw new customError(400, "Invalid OTP.");

  await redis.del(`otp:${purpose}:${email}`);
}
