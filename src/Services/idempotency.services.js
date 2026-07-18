import { redis } from "../Config/redis.js";

export const checkIdempotency = async (key) => {
  const isSet = await redis.set(key, "PENDING", "EX", 60 * 5, "NX");

  if (isSet) {
    return null;
  }

  return await redis.get(key);
};

export const markSuccess = async (key) => {
  await redis.set(key, "SUCCESS", "EX", 60 * 5);
};

export const markFailed = async (key) => {
  await redis.set(key, "FAILED", "EX", 60 * 5);
};

export const markRejected = async (key) => {
  await redis.set(key, "REJECTED", "EX", 60 * 5);
};
