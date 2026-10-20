import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function getDashboardSummary(userId: string, now = new Date()) {
  const active: Prisma.TicketWhereInput = {
    status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"] },
  };
  const overdue: Prisma.TicketWhereInput = {
    OR: [
      { firstRespondedAt: null, firstResponseDueAt: { lt: now } },
      { resolvedAt: null, resolutionDueAt: { lt: now } },
    ],
  };
  const atRisk: Prisma.TicketWhereInput = {
    NOT: overdue,
    OR: [
      {
        firstRespondedAt: null,
        firstResponseDueAt: {
          gte: now,
          lte: new Date(now.getTime() + 30 * 60_000),
        },
      },
      {
        resolvedAt: null,
        resolutionDueAt: {
          gte: now,
          lte: new Date(now.getTime() + 60 * 60_000),
        },
      },
    ],
  };
  const [open, unassigned, urgent, breached, atRiskCount, assignedToMe] =
    await prisma.$transaction([
      prisma.ticket.count({ where: active }),
      prisma.ticket.count({ where: { ...active, assignedAgentId: null } }),
      prisma.ticket.count({ where: { ...active, priority: "URGENT" } }),
      prisma.ticket.count({ where: { AND: [active, overdue] } }),
      prisma.ticket.count({ where: { AND: [active, atRisk] } }),
      prisma.ticket.count({ where: { ...active, assignedAgentId: userId } }),
    ]);
  return {
    open,
    unassigned,
    urgent,
    breached,
    atRisk: atRiskCount,
    assignedToMe,
    asOf: now,
  };
}

export async function getStaffDirectory() {
  return prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPPORT_AGENT"] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      _count: {
        select: {
          assignedTickets: {
            where: {
              status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"] },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}
