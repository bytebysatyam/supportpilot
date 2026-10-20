import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { recordFirstResponseSla } from "../sla/sla.service.js";
import { lockTicket } from "./ticket.policy.js";

type Actor = {
  userId: string;
  role: UserRole;
};

function ticketScope(actor: Actor, ticketId: string) {
  return actor.role === "CUSTOMER"
    ? { id: ticketId, customerId: actor.userId }
    : { id: ticketId };
}

export async function addTicketMessage(
  actor: Actor,
  ticketId: string,
  input: { body: string; isInternal: boolean },
) {
  if (actor.role === "CUSTOMER" && input.isInternal) {
    throw new Error("CUSTOMERS_CANNOT_CREATE_INTERNAL_NOTES");
  }

  return prisma.$transaction(async (tx) => {
    await lockTicket(tx, ticketId);
    const ticket = await tx.ticket.findFirst({
      where: ticketScope(actor, ticketId),
      select: {
        id: true,
        customerId: true,
        firstRespondedAt: true,
        firstResponseDueAt: true,
      },
    });

    if (!ticket) {
      throw new Error("TICKET_NOT_FOUND");
    }

    const authorType = actor.role === "CUSTOMER" ? "CUSTOMER" : "AGENT";

    const message = await tx.ticketMessage.create({
      data: {
        ticketId,
        authorId: actor.userId,
        authorType,
        body: input.body,
        isInternal: input.isInternal,
      },
      select: {
        id: true,
        body: true,
        isInternal: true,
        authorType: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    const respondedAt = new Date();
    const isFirstStaffReply =
      actor.role !== "CUSTOMER" &&
      !input.isInternal &&
      !ticket.firstRespondedAt;
    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        updatedAt: respondedAt,
        ...(isFirstStaffReply ? { firstRespondedAt: respondedAt } : {}),
      },
    });
    if (isFirstStaffReply) {
      await recordFirstResponseSla(tx, ticket, respondedAt);
    }

    await tx.auditLog.create({
      data: {
        ticketId,
        actorId: actor.userId,
        action: "MESSAGE_ADDED",
        metadata: {
          messageId: message.id,
          isInternal: input.isInternal,
          authorType,
        },
      },
    });

    return message;
  });
}

export async function listTicketMessages(actor: Actor, ticketId: string) {
  const ticket = await prisma.ticket.findFirst({
    where: ticketScope(actor, ticketId),
    select: { id: true },
  });

  if (!ticket) {
    throw new Error("TICKET_NOT_FOUND");
  }

  return prisma.ticketMessage.findMany({
    where: {
      ticketId,
      ...(actor.role === "CUSTOMER" ? { isInternal: false } : {}),
    },
    select: {
      id: true,
      body: true,
      isInternal: true,
      authorType: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

export async function getTicketTimeline(actor: Actor, ticketId: string) {
  if (actor.role === "CUSTOMER") throw new Error("FORBIDDEN");
  const ticket = await prisma.ticket.findFirst({
    where: ticketScope(actor, ticketId),
    select: { id: true },
  });

  if (!ticket) {
    throw new Error("TICKET_NOT_FOUND");
  }

  const [messages, audits] = await Promise.all([
    prisma.ticketMessage.findMany({
      where: {
        ticketId,
      },
      select: {
        id: true,
        body: true,
        isInternal: true,
        authorType: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        ticketId,
      },
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    }),
  ]);

  return [
    ...messages.map((message) => ({
      type: "MESSAGE" as const,
      occurredAt: message.createdAt,
      data: message,
    })),
    ...audits.map((audit) => ({
      type: "AUDIT" as const,
      occurredAt: audit.createdAt,
      data: audit,
    })),
  ].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}
