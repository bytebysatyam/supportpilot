import crypto from "node:crypto";
import type { AIAnalysisType, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { enqueueAiAnalysis } from "../jobs/enqueue.js";
import { lockTicket } from "../tickets/ticket.policy.js";
import { env } from "../config/env.js";
import { getAiProvider } from "./provider.factory.js";
import { safeAiErrorCode } from "./provider.errors.js";

type Actor = {
  userId: string;
  role: UserRole;
};

function assertStaff(actor: Actor) {
  if (actor.role === "CUSTOMER") {
    throw new Error("FORBIDDEN");
  }
}

export async function requestTicketAiAnalysis(
  actor: Actor,
  ticketId: string,
  type: AIAnalysisType,
) {
  assertStaff(actor);
  if (env.AI_PROVIDER === "disabled") throw new Error("AI_PROVIDER_DISABLED");
  const provider = getAiProvider();

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
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
    throw new Error("TICKET_NOT_FOUND");
  }

  const inputHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        subject: ticket.subject,
        description: ticket.description,
        messages: ticket.messages,
        type,
        provider: provider.name,
        model: provider.model,
      }),
    )
    .digest("hex");

  const prepared = await prisma.$transaction(async (tx) => {
    await lockTicket(tx, ticketId);
    const existing = await tx.aIAnalysis.findFirst({
      where: {
        ticketId,
        type,
        inputHash,
        status: { in: ["PENDING", "COMPLETED"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return { analysis: existing, deduplicated: true };
    const analysis = await tx.aIAnalysis.create({
      data: {
        ticketId,
        type,
        status: "PENDING",
        inputHash,
        provider: provider.name,
        model: provider.model,
      },
    });
    return { analysis, deduplicated: false };
  });
  const { analysis } = prepared;
  if (prepared.deduplicated)
    return { analysis, queued: false, deduplicated: true };

  try {
    await enqueueAiAnalysis({
      analysisId: analysis.id,
      ticketId,
      actorId: actor.userId,
      type,
    });
  } catch (error) {
    await prisma.aIAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: "FAILED",
        errorMessage: "QUEUE_ENQUEUE_FAILED",
        completedAt: new Date(),
      },
    });

    throw new Error("AI_QUEUE_UNAVAILABLE");
  }

  return {
    analysis,
    queued: true,
    deduplicated: false,
  };
}

export async function listTicketAiAnalyses(actor: Actor, ticketId: string) {
  assertStaff(actor);

  const exists = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });

  if (!exists) {
    throw new Error("TICKET_NOT_FOUND");
  }

  const analyses = await prisma.aIAnalysis.findMany({
    where: { ticketId },
    select: {
      id: true,
      type: true,
      status: true,
      provider: true,
      model: true,
      result: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  // Older rows may contain raw provider messages; expose only allowlisted failure codes.
  return analyses.map((analysis) => ({
    ...analysis,
    errorMessage: analysis.errorMessage
      ? safeAiErrorCode(new Error(analysis.errorMessage))
      : null,
  }));
}
