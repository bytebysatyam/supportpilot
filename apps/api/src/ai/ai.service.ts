import crypto from "node:crypto";
import type {
  AIAnalysisType,
  Prisma,
  UserRole,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  classificationResultSchema,
  draftResponseResultSchema,
  priorityResultSchema,
  summaryResultSchema,
} from "./ai.schemas.js";
import { getAiProvider } from "./provider.factory.js";

type Actor = {
  userId: string;
  role: UserRole;
};

function assertStaff(actor: Actor) {
  if (actor.role === "CUSTOMER") {
    throw new Error("FORBIDDEN");
  }
}

function validateResult(type: AIAnalysisType, raw: unknown) {
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

export async function runTicketAiAnalysis(
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
        orderBy: {
          createdAt: "asc",
        },
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

  const analysis = await prisma.aIAnalysis.create({
    data: {
      ticketId,
      type,
      status: "PENDING",
      inputHash,
    },
    select: {
      id: true,
      ticketId: true,
      type: true,
      status: true,
      createdAt: true,
    },
  });

  try {
    const provider = getAiProvider();
    const generated = await provider.run(type, ticket);
    const result = validateResult(type, generated.raw);

    const completed = await prisma.aIAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: "COMPLETED",
        provider: generated.provider,
        model: generated.model,
        result: result as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
      select: {
        id: true,
        ticketId: true,
        type: true,
        status: true,
        provider: true,
        model: true,
        result: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        ticketId,
        actorId: actor.userId,
        action: "AI_ANALYSIS_CREATED",
        metadata: {
          analysisId: completed.id,
          type,
          provider: completed.provider,
          model: completed.model,
        },
      },
    });

    return completed;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI_ANALYSIS_FAILED";

    await prisma.aIAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: "FAILED",
        errorMessage: message.slice(0, 1000),
        completedAt: new Date(),
      },
    });

    throw error;
  }
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
