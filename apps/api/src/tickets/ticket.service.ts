import {
  Prisma,
  TicketStatus,
  type TicketCategory,
  type TicketPriority,
  type UserRole,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  createInitialSlaEvents,
  recordResolutionSla,
  slaFieldsForNewTicket,
} from "../sla/sla.service.js";
import {
  allowedStatusTransitions,
  scopeWhere,
  lockTicket,
} from "./ticket.policy.js";

type Actor = {
  userId: string;
  role: UserRole;
};

type ListFilters = {
  page: number;
  limit: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedAgentId?: string;
  customerId?: string;
  search?: string;
};

const ticketSummarySelect = {
  id: true,
  ticketNumber: true,
  subject: true,
  status: true,
  priority: true,
  category: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  assignedAgent: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.TicketSelect;

const ticketDetailSelect = {
  ...ticketSummarySelect,
  description: true,
  firstResponseDueAt: true,
  firstRespondedAt: true,
  resolutionDueAt: true,
  resolvedAt: true,
  closedAt: true,
  team: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.TicketSelect;

export async function createTicket(
  actor: Actor,
  input: { subject: string; description: string },
) {
  if (actor.role !== "CUSTOMER") {
    throw new Error("CUSTOMER_ONLY_OPERATION");
  }

  return prisma.$transaction(async (tx) => {
    const sla = slaFieldsForNewTicket("MEDIUM");

    const ticket = await tx.ticket.create({
      data: {
        customerId: actor.userId,
        subject: input.subject,
        description: input.description,
        firstResponseDueAt: sla.firstResponseDueAt,
        resolutionDueAt: sla.resolutionDueAt,
      },
      select: ticketDetailSelect,
    });

    await createInitialSlaEvents(tx, ticket);

    await tx.auditLog.create({
      data: {
        ticketId: ticket.id,
        actorId: actor.userId,
        action: "TICKET_CREATED",
        metadata: {
          subject: ticket.subject,
          priority: ticket.priority,
          category: ticket.category,
          status: ticket.status,
        },
      },
    });

    return ticket;
  });
}

export async function listTickets(actor: Actor, filters: ListFilters) {
  const where: Prisma.TicketWhereInput = {
    ...scopeWhere(actor),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.category ? { category: filters.category } : {}),
  };

  if (actor.role !== "CUSTOMER") {
    if (filters.assignedAgentId) {
      where.assignedAgentId = filters.assignedAgentId;
    }

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }
  }

  if (filters.search) {
    where.OR = [
      {
        subject: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
    ];
  }

  const skip = (filters.page - 1) * filters.limit;

  const [items, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      select: ticketSummarySelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip,
      take: filters.limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  };
}

export async function getTicketById(actor: Actor, ticketId: string) {
  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      ...scopeWhere(actor),
    },
    select: ticketDetailSelect,
  });

  if (!ticket) {
    throw new Error("TICKET_NOT_FOUND");
  }

  return ticket;
}

export async function updateTicket(
  actor: Actor,
  ticketId: string,
  input: {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
  },
) {
  if (actor.role === "CUSTOMER") {
    throw new Error("FORBIDDEN");
  }

  return prisma.$transaction(async (tx) => {
    await lockTicket(tx, ticketId);
    const current = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        status: true,
        priority: true,
        category: true,
        resolvedAt: true,
        closedAt: true,
        resolutionDueAt: true,
      },
    });

    if (!current) {
      throw new Error("TICKET_NOT_FOUND");
    }

    if (
      input.status &&
      input.status !== current.status &&
      !allowedStatusTransitions[current.status].includes(input.status)
    ) {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    const lifecycleData: Prisma.TicketUpdateInput = {};

    if (input.status && input.status !== current.status) {
      if (input.status === "RESOLVED") {
        lifecycleData.resolvedAt = new Date();
      } else if (current.status === "RESOLVED") {
        lifecycleData.resolvedAt = null;
      }

      if (input.status === "CLOSED") {
        lifecycleData.closedAt = new Date();
      }
    }

    const updatedTicket = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        ...lifecycleData,
        ...(input.status ? { status: input.status } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.category ? { category: input.category } : {}),
      },
      select: ticketDetailSelect,
    });

    if (
      input.status &&
      input.status !== current.status &&
      (input.status === "RESOLVED" || input.status === "CLOSED") &&
      !current.resolvedAt &&
      !current.closedAt
    ) {
      const completedAt =
        updatedTicket.resolvedAt ?? updatedTicket.closedAt ?? new Date();

      await recordResolutionSla(tx, current, completedAt);
    }

    if (input.status && input.status !== current.status) {
      await tx.auditLog.create({
        data: {
          ticketId,
          actorId: actor.userId,
          action: "STATUS_CHANGED",
          metadata: {
            from: current.status,
            to: input.status,
          },
        },
      });
    }

    if (input.priority && input.priority !== current.priority) {
      await tx.auditLog.create({
        data: {
          ticketId,
          actorId: actor.userId,
          action: "PRIORITY_CHANGED",
          metadata: {
            from: current.priority,
            to: input.priority,
          },
        },
      });
    }

    if (input.category && input.category !== current.category) {
      await tx.auditLog.create({
        data: {
          ticketId,
          actorId: actor.userId,
          action: "CATEGORY_CHANGED",
          metadata: {
            from: current.category,
            to: input.category,
          },
        },
      });
    }

    return updatedTicket;
  });
}

export async function assignTicket(
  actor: Actor,
  ticketId: string,
  agentId: string | null,
) {
  if (actor.role === "CUSTOMER") {
    throw new Error("FORBIDDEN");
  }

  return prisma.$transaction(async (tx) => {
    await lockTicket(tx, ticketId);
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        assignedAgentId: true,
      },
    });

    if (!ticket) {
      throw new Error("TICKET_NOT_FOUND");
    }

    if (ticket.assignedAgentId === agentId) {
      return tx.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        select: ticketDetailSelect,
      });
    }

    const previousAgentId = ticket.assignedAgentId;

    if (agentId) {
      const agent = await tx.user.findFirst({
        where: {
          id: agentId,
          role: "SUPPORT_AGENT",
          status: "ACTIVE",
        },
        select: { id: true },
      });

      if (!agent) {
        throw new Error("INVALID_ASSIGNEE");
      }
    }

    if (ticket.assignedAgentId) {
      await tx.ticketAssignment.updateMany({
        where: {
          ticketId,
          agentId: ticket.assignedAgentId,
          unassignedAt: null,
        },
        data: {
          unassignedAt: new Date(),
        },
      });
    }

    if (agentId) {
      await tx.ticketAssignment.create({
        data: {
          ticketId,
          agentId,
          assignedById: actor.userId,
        },
      });
    }

    const updatedTicket = await tx.ticket.update({
      where: { id: ticketId },
      data: { assignedAgentId: agentId },
      select: ticketDetailSelect,
    });

    await tx.auditLog.create({
      data: {
        ticketId,
        actorId: actor.userId,
        action: agentId ? "ASSIGNED" : "UNASSIGNED",
        metadata: {
          previousAgentId,
          agentId,
        },
      },
    });

    return updatedTicket;
  });
}

export async function getAssignmentHistory(actor: Actor, ticketId: string) {
  if (actor.role === "CUSTOMER") {
    throw new Error("FORBIDDEN");
  }

  const exists = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });

  if (!exists) {
    throw new Error("TICKET_NOT_FOUND");
  }

  return prisma.ticketAssignment.findMany({
    where: { ticketId },
    select: {
      id: true,
      assignedAt: true,
      unassignedAt: true,
      agent: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });
}
