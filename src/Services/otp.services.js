import { redisClient } from "../../server.js";
import emailQueue from "../Queues/email.queue.js";
import Crypto from "crypto";

export async function sendVerificationOtp({
  email,
  userName,
  queueName,
  purpose,
}) {
  try {
    // Generate OTP
    const otp = Crypto.randomInt(1000, 10000);

    // Store in Redis
    const isResendAllowed = await redisClient.set(`resend:${email}`, otp, {
      EX: 60,
      NX: true,
    });

    if (isResendAllowed === null) {
      throw new Error("Please try after 60 seconds to resend OTP again.");
    }

    await redisClient.set(`otp:${purpose}:${email}`, otp, {
      EX: 60 * 5,
    });

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
    return { message: "OTP sent successfully." };
  } catch (error) {
    return { error: error.message };
  }
}
