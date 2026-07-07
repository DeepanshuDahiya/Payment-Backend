import { Worker } from "bullmq";
import bullmqConnection from "../Config/bullmqConnection.js";
import { sendMail } from "../Services/email.services.js";
import { redisClient } from "../../server.js";
import { otpTemplate } from "../Templates/otp.template.js";

const emailWorker = new Worker(
  "email-queue",
  async (job) => {
    try {
      await sendMail({
        to: job.data.email,
        subject: "Your Verification Code",
        text: `Your OTP is ${job.data.otp}`,
        html: otpTemplate(job.data.name, job.data.otp),
      });
      console.log({ message: `sent successfully to ${job.data.email}` });
    } catch (error) {
      console.log({ error: error.message });
    }
  },
  {
    connection: bullmqConnection,
    concurrency: 20,
  },
);
