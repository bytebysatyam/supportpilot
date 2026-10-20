import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
redisConnection.on("error", () =>
  console.error(
    JSON.stringify({ event: "redis_unavailable", process: "api/queue" }),
  ),
);

export function createWorkerConnection() {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on("error", () =>
    console.error(
      JSON.stringify({ event: "redis_unavailable", process: "worker" }),
    ),
  );
  return connection;
}
