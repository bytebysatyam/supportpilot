import crypto from "node:crypto";
import type { AIAnalysisType } from "@prisma/client";
import { aiQueue, slaQueue } from "./queues.js";

export async function enqueueAiAnalysis(input: {
  analysisId: string;
  ticketId: string;
  actorId: string;
  type: AIAnalysisType;
}) {
  return aiQueue.add("ticket-analysis", input, {
    jobId: `ai-${input.analysisId}`,
  });
}

export async function enqueueSlaScan() {
  const bucket = Math.floor(Date.now() / 60_000);
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
