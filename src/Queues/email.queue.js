import { Queue } from "bullmq";
import bullmqConnection from "../Config/bullmqConnection.js";

const emailQueue = new Queue("email-queue", {
  connection: bullmqConnection,
});

export default emailQueue;
