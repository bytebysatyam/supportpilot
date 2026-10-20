import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";

export const AI_QUEUE_NAME = "supportpilot-ai";
export const SLA_QUEUE_NAME = "supportpilot-sla";

export const aiQueue = new Queue(AI_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const slaQueue = new Queue(SLA_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

export async function closeQueues() {
  await Promise.all([aiQueue.close(), slaQueue.close()]);
  await redisConnection.quit();
}
