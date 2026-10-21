import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  classificationResultSchema,
  draftResponseResultSchema,
  priorityResultSchema,
  summaryResultSchema,
} from "./ai.schemas.js";
import { getAiProvider } from "./provider.factory.js";
import type { AiAnalysisJob } from "../jobs/job.types.js";
import { lockTicket } from "../tickets/ticket.policy.js";
import { safeAiErrorCode } from "./provider.errors.js";

export function validateResult(type: AiAnalysisJob["type"], raw: unknown) {
  switch (type) {
    case "CLASSIFICATION":
      return classificationResultSchema.parse(raw);
    case "SUMMARY":
      return summaryResultSchema.parse(raw);
    case "PRIORITY_SUGGESTION":
      return priorityResultSchema.parse(raw);
    case "DRAFT_RESPONSE":
      return draftResponseResultSchema.parse(raw);
  }
}

export async function processAiAnalysis(
  job: AiAnalysisJob,
  options = { finalAttempt: true },
) {
  const analysis = await prisma.aIAnalysis.findUnique({
    where: { id: job.analysisId },
    select: {
      id: true,
      status: true,
      ticketId: true,
      type: true,
      provider: true,
      model: true,
    },
  });

  if (!analysis) {
    throw new Error("AI_ANALYSIS_NOT_FOUND");
  }

  if (analysis.ticketId !== job.ticketId || analysis.type !== job.type)
    throw new Error("AI_JOB_MISMATCH");

  if (analysis.status === "COMPLETED") {
    return analysis;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: job.ticketId },
    select: {
      subject: true,
      description: true,
      messages: {
        select: {
          authorType: true,
          body: true,
          isInternal: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) {
    await prisma.aIAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: "FAILED",
        errorMessage: "TICKET_NOT_FOUND",
        completedAt: new Date(),
      },
    });
    return;
  }

  try {
    await prisma.aIAnalysis.update({
      where: { id: analysis.id },
      data: { status: "PENDING", errorMessage: null, completedAt: null },
    });
    const provider = getAiProvider();
    if (
      analysis.provider &&
      (analysis.provider !== provider.name || analysis.model !== provider.model)
    )
      throw new Error("AI_PROVIDER_CONFIGURATION_CHANGED");
    const generated = await provider.run(job.type, ticket);
    const result = validateResult(job.type, generated.raw);

    return await prisma.$transaction(async (tx) => {
      await lockTicket(tx, job.ticketId);
      const existing = await tx.aIAnalysis.findUniqueOrThrow({
        where: { id: analysis.id },
      });
      if (existing.status === "COMPLETED") return existing;
      const completed = await tx.aIAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: "COMPLETED",
          provider: generated.provider,
          model: generated.model,
          result: result as Prisma.InputJsonValue,
          errorMessage: null,
          completedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          ticketId: job.ticketId,
          actorId: job.actorId,
          action: "AI_ANALYSIS_CREATED",
          metadata: {
            analysisId: completed.id,
            type: job.type,
            provider: generated.provider,
            model: generated.model,
            execution: "background-job",
          },
        },
      });

      return completed;
    });
  } catch (error) {
    const message = safeAiErrorCode(error);

    await prisma.aIAnalysis.updateMany({
      where: { id: analysis.id, status: { not: "COMPLETED" } },
      data: {
        status: options.finalAttempt ? "FAILED" : "PENDING",
        errorMessage: message,
        completedAt: options.finalAttempt ? new Date() : null,
      },
    });

    throw new Error(message);
  }
}
