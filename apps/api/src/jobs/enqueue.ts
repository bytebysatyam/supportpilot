import crypto from "node:crypto";
import type { AIAnalysisType } from "@prisma/client";
import { aiQueue, slaQueue } from "./queues.js";
import { redisConnection } from "./redis.js";
import { env } from "../config/env.js";

export async function enqueueAiAnalysis(input: {
  analysisId: string;
  ticketId: string;
  actorId: string;
  type: AIAnalysisType;
}) {
  if (redisConnection.status !== "ready") throw new Error("QUEUE_NOT_READY");
  return aiQueue.add("ticket-analysis", input, {
    jobId: `ai-${input.analysisId}`,
  });
}

export async function enqueueSlaScan() {
  if (redisConnection.status !== "ready") throw new Error("QUEUE_NOT_READY");
  const bucket = Math.floor(Date.now() / env.SLA_SCAN_INTERVAL_MS);
  return slaQueue.add(
    "sla-scan",
    { requestedAt: new Date().toISOString() },
    {
      jobId: `sla-scan-${bucket}`,
    },
  );
}

export function makeIdempotencyKey(parts: string[]) {
  return crypto.createHash("sha256").update(parts.join(":")).digest("hex");
}
