import app from "./src/app.js";
import connectDB from "./src/Config/db.js";
import connectRedis, { connectIORedis } from "./src/Config/redis.js";

const PORT = process.env.PORT;

await connectDB();
const redisClient = await connectRedis();
await connectIORedis();

app.listen(PORT, () => {
  console.log(`Server is running on the port ${PORT}`);
});

export { redisClient };
