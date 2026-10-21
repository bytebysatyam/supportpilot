import type { Prisma, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getSlaDeadlines } from "./sla.policy.js";
import { lockTicket } from "../tickets/ticket.policy.js";

type Tx = Prisma.TransactionClient;

type SlaState = {
  id: string;
  priority: TicketPriority;
  status: TicketStatus;
  firstResponseDueAt: Date | null;
  firstRespondedAt: Date | null;
  resolutionDueAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
};

export function slaFieldsForNewTicket(
  priority: TicketPriority,
  createdAt = new Date(),
) {
  return getSlaDeadlines(priority, createdAt);
}

export function computeSlaSnapshot(ticket: SlaState, now = new Date()) {
  const firstResponseBreached =
    !!ticket.firstResponseDueAt &&
    (ticket.firstRespondedAt ?? ticket.closedAt ?? now) >
      ticket.firstResponseDueAt;

  const resolutionCompleted = Boolean(ticket.resolvedAt || ticket.closedAt);

  const resolutionBreached =
    !!ticket.resolutionDueAt &&
    (ticket.resolvedAt ?? ticket.closedAt ?? now) > ticket.resolutionDueAt;

  const firstResponseAtRisk =
    !ticket.firstRespondedAt &&
    !ticket.closedAt &&
    !!ticket.firstResponseDueAt &&
    !firstResponseBreached &&
    ticket.firstResponseDueAt.getTime() - now.getTime() <= 30 * 60_000;

  const resolutionAtRisk =
    !resolutionCompleted &&
    !!ticket.resolutionDueAt &&
    !resolutionBreached &&
    ticket.resolutionDueAt.getTime() - now.getTime() <= 60 * 60_000;

  const completionTime = ticket.resolvedAt ?? ticket.closedAt;

  return {
    firstResponse: {
      dueAt: ticket.firstResponseDueAt,
      respondedAt: ticket.firstRespondedAt,
      closedWithoutReply: !!ticket.closedAt && !ticket.firstRespondedAt,
      met:
        !!ticket.firstRespondedAt &&
        !!ticket.firstResponseDueAt &&
        ticket.firstRespondedAt <= ticket.firstResponseDueAt,
      breached: firstResponseBreached,
      atRisk: firstResponseAtRisk,
    },
    resolution: {
      dueAt: ticket.resolutionDueAt,
      resolvedAt: completionTime,
      met:
        !!completionTime &&
        !!ticket.resolutionDueAt &&
        completionTime <= ticket.resolutionDueAt,
      breached: resolutionBreached,
      atRisk: resolutionAtRisk,
    },
  };
}

async function createEventOnce(
  tx: Tx,
  input: {
    ticketId: string;
    type:
      | "FIRST_RESPONSE_DUE"
      | "FIRST_RESPONSE_MET"
      | "FIRST_RESPONSE_BREACHED"
      | "RESOLUTION_DUE"
      | "RESOLUTION_MET"
      | "RESOLUTION_BREACHED";
    dueAt?: Date | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  const created = await tx.sLAEvent.createMany({
    skipDuplicates: true,
    data: [
      {
        ticketId: input.ticketId,
        type: input.type,
        dueAt: input.dueAt ?? undefined,
        metadata: input.metadata,
      },
    ],
  });
  if (created.count === 0) return false;

  await tx.auditLog.create({
    data: {
      ticketId: input.ticketId,
      action: "SLA_EVENT_CREATED",
      metadata: {
        type: input.type,
        dueAt: input.dueAt?.toISOString() ?? null,
      },
    },
  });

  return true;
}

export async function createInitialSlaEvents(
  tx: Tx,
  ticket: {
    id: string;
    firstResponseDueAt: Date | null;
    resolutionDueAt: Date | null;
  },
) {
  if (ticket.firstResponseDueAt) {
    await createEventOnce(tx, {
      ticketId: ticket.id,
      type: "FIRST_RESPONSE_DUE",
      dueAt: ticket.firstResponseDueAt,
    });
  }

  if (ticket.resolutionDueAt) {
    await createEventOnce(tx, {
      ticketId: ticket.id,
      type: "RESOLUTION_DUE",
      dueAt: ticket.resolutionDueAt,
    });
  }
}

export async function recordFirstResponseSla(
  tx: Tx,
  ticket: { id: string; firstResponseDueAt: Date | null },
  respondedAt: Date,
) {
  if (!ticket.firstResponseDueAt) return;

  await createEventOnce(tx, {
    ticketId: ticket.id,
    type:
      respondedAt <= ticket.firstResponseDueAt
        ? "FIRST_RESPONSE_MET"
        : "FIRST_RESPONSE_BREACHED",
    dueAt: ticket.firstResponseDueAt,
    metadata: { respondedAt: respondedAt.toISOString() },
  });
}

export async function recordResolutionSla(
  tx: Tx,
  ticket: { id: string; resolutionDueAt: Date | null },
  resolvedAt: Date,
) {
  if (!ticket.resolutionDueAt) return;

  await createEventOnce(tx, {
    ticketId: ticket.id,
    type:
      resolvedAt <= ticket.resolutionDueAt
        ? "RESOLUTION_MET"
        : "RESOLUTION_BREACHED",
    dueAt: ticket.resolutionDueAt,
    metadata: { resolvedAt: resolvedAt.toISOString() },
  });
}

export async function refreshOpenTicketBreaches(now = new Date()) {
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { not: "CLOSED" },
      OR: [
        {
          firstRespondedAt: null,
          firstResponseDueAt: { lt: now },
        },
        {
          resolvedAt: null,
          resolutionDueAt: { lt: now },
        },
      ],
    },
    select: {
      id: true,
      firstResponseDueAt: true,
      firstRespondedAt: true,
      resolutionDueAt: true,
      resolvedAt: true,
      closedAt: true,
    },
    orderBy: { id: "asc" },
  });

  let eventsCreated = 0;

  for (const candidate of tickets) {
    eventsCreated += await prisma.$transaction(async (tx) => {
      let created = 0;
      await lockTicket(tx, candidate.id);
      const ticket = await tx.ticket.findUnique({
        where: { id: candidate.id },
      });
      if (!ticket || ticket.status === "CLOSED") return 0;
      if (
        !ticket.firstRespondedAt &&
        ticket.firstResponseDueAt &&
        ticket.firstResponseDueAt < now
      ) {
        if (
          await createEventOnce(tx, {
            ticketId: ticket.id,
            type: "FIRST_RESPONSE_BREACHED",
            dueAt: ticket.firstResponseDueAt,
          })
        ) {
          created += 1;
        }
      }

      if (
        !ticket.resolvedAt &&
        !ticket.closedAt &&
        ticket.resolutionDueAt &&
        ticket.resolutionDueAt < now
      ) {
        if (
          await createEventOnce(tx, {
            ticketId: ticket.id,
            type: "RESOLUTION_BREACHED",
            dueAt: ticket.resolutionDueAt,
          })
        ) {
          created += 1;
        }
      }
      return created;
    });
  }

  return {
    checkedAt: now,
    ticketsChecked: tickets.length,
    eventsCreated,
  };
}

export async function getTicketSla(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      priority: true,
      status: true,
      firstResponseDueAt: true,
      firstRespondedAt: true,
      resolutionDueAt: true,
      resolvedAt: true,
      closedAt: true,
      slaEvents: {
        select: {
          id: true,
          type: true,
          dueAt: true,
          occurredAt: true,
          metadata: true,
        },
        orderBy: { occurredAt: "asc" },
      },
    },
  });

  if (!ticket) throw new Error("TICKET_NOT_FOUND");

  return {
    ticketId: ticket.id,
    priority: ticket.priority,
    status: ticket.status,
    ...computeSlaSnapshot(ticket),
    events: ticket.slaEvents,
  };
}
