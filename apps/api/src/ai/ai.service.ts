import crypto from "node:crypto";
import type { AIAnalysisType, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { enqueueAiAnalysis } from "../jobs/enqueue.js";

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
      }),
    )
    .digest("hex");

  const recentEquivalent = await prisma.aIAnalysis.findFirst({
    where: {
      ticketId,
      type,
      inputHash,
      status: {
        in: ["PENDING", "COMPLETED"],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentEquivalent) {
    return {
      analysis: recentEquivalent,
      queued: false,
      deduplicated: true,
    };
  }

  const analysis = await prisma.aIAnalysis.create({
    data: {
      ticketId,
      type,
      status: "PENDING",
      inputHash,
    },
  });

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

    throw error;
  }

  return {
    analysis,
    queued: true,
    deduplicated: false,
  };
}

export async function listTicketAiAnalyses(
  actor: Actor,
  ticketId: string,
) {
  assertStaff(actor);

  const exists = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });

  if (!exists) {
    throw new Error("TICKET_NOT_FOUND");
  }

  return prisma.aIAnalysis.findMany({
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
}
