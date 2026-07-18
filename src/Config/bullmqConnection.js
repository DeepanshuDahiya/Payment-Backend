import IORedis from "ioredis";

const bullmqConnection = new IORedis({
  host: process.env.IO_REDIS_HOST,
  port: process.env.IO_REDIS_PORT,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 3) {
      return null;
    }
    return 2000;
  },
});

export default bullmqConnection;
