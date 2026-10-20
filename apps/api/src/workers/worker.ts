import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import {
  AI_QUEUE_NAME,
  SLA_QUEUE_NAME,
  redisConnection,
} from "../jobs/queues.js";
import type {
  AiAnalysisJob,
  SlaScanJob,
} from "../jobs/job.types.js";
import { processAiAnalysis } from "../ai/ai.worker.service.js";
import { refreshOpenTicketBreaches } from "../sla/sla.service.js";

const aiWorker = new Worker<AiAnalysisJob>(
  AI_QUEUE_NAME,
  async (job) => processAiAnalysis(job.data),
  {
    connection: redisConnection,
    concurrency: 3,
  },
);

const slaWorker = new Worker<SlaScanJob>(
  SLA_QUEUE_NAME,
  async () => refreshOpenTicketBreaches(),
  {
    connection: redisConnection,
    concurrency: 1,
  },
);

const scheduleSlaScan = setInterval(async () => {
  const bucket = Math.floor(Date.now() / env.SLA_SCAN_INTERVAL_MS);

  try {
    const { slaQueue } = await import("../jobs/queues.js");
    await slaQueue.add(
      "sla-scan",
      { requestedAt: new Date().toISOString() },
      {
        jobId: `sla-scan-${bucket}`,
      },
    );
  } catch (error) {
    console.error("Failed to enqueue SLA scan:", error);
  }
}, env.SLA_SCAN_INTERVAL_MS);

async function shutdown(signal: string) {
  console.log(`${signal} received. Shutting down workers gracefully.`);
  clearInterval(scheduleSlaScan);

  await Promise.allSettled([
    aiWorker.close(),
    slaWorker.close(),
    prisma.$disconnect(),
    redisConnection.quit(),
  ]);

  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

console.log("SupportPilot background workers started.");
