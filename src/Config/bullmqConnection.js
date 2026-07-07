import IORedis from "ioredis";

const bullmqConnection = new IORedis({
  host: process.env.IO_REDIS_HOST,
  port: process.env.IO_REDIS_PORT,
  maxRetriesPerRequest: null,
});

export default bullmqConnection;
