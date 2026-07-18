import app from "./src/app.js";
import connectDB from "./src/Config/db.js";
import { connectRedis } from "./src/Config/redis.js";

const PORT = process.env.PORT;

await connectDB();
await connectRedis();

app.listen(PORT, () => {
  console.log(`Server is running on the port ${PORT}`);
});
