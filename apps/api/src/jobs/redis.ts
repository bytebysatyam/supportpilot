import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logInfrastructureError } from "../lib/infrastructure-log.js";

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
redisConnection.on("error", () =>
  logInfrastructureError("redis_unavailable", "api/queue"),
);

export function createWorkerConnection() {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on("error", () =>
    logInfrastructureError("redis_unavailable", "worker"),
  );
  return connection;
}
