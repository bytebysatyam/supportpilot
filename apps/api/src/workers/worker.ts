import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { AI_QUEUE_NAME, SLA_QUEUE_NAME, closeQueues } from "../jobs/queues.js";
import { createWorkerConnection } from "../jobs/redis.js";
import type { AiAnalysisJob, SlaScanJob } from "../jobs/job.types.js";
import { processAiAnalysis } from "../ai/ai.worker.service.js";
import { refreshOpenTicketBreaches } from "../sla/sla.service.js";
import { enqueueSlaScan } from "../jobs/enqueue.js";

const workerConnection = createWorkerConnection();
const aiWorker = new Worker<AiAnalysisJob>(
  AI_QUEUE_NAME,
  async (job) => processAiAnalysis(job.data),
  {
    connection: workerConnection,
    concurrency: 3,
  },
);

const slaWorker = new Worker<SlaScanJob>(
  SLA_QUEUE_NAME,
  async () => refreshOpenTicketBreaches(),
  {
    connection: workerConnection,
    concurrency: 1,
  },
);

for (const worker of [aiWorker, slaWorker]) {
  worker.on("error", () =>
    console.error(
      JSON.stringify({ event: "worker_error", queue: worker.name }),
    ),
  );
  worker.on("failed", (job) =>
    console.error(
      JSON.stringify({
        event: "job_failed",
        queue: worker.name,
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
      }),
    ),
  );
}

const scheduleSlaScan = setInterval(async () => {
  try {
    await enqueueSlaScan();
  } catch {
    console.error(JSON.stringify({ event: "sla_enqueue_failed" }));
  }
}, env.SLA_SCAN_INTERVAL_MS);

async function shutdown(signal: string) {
  console.log(`${signal} received. Shutting down workers gracefully.`);
  clearInterval(scheduleSlaScan);

  // Let in-flight jobs finish before closing their database/queue connections.
  await Promise.all([aiWorker.close(), slaWorker.close()]);
  await Promise.allSettled([
    closeQueues(),
    prisma.$disconnect(),
    workerConnection.quit(),
  ]);

  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

console.log("SupportPilot background workers started.");
