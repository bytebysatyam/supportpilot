import type { Prisma, TicketStatus, UserRole } from "@prisma/client";

export type Actor = { userId: string; role: UserRole };

export const allowedStatusTransitions: Record<
  TicketStatus,
  readonly TicketStatus[]
> = {
  OPEN: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["OPEN", "WAITING_ON_CUSTOMER", "RESOLVED"],
  WAITING_ON_CUSTOMER: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: [],
};

export function scopeWhere(actor: Actor): Prisma.TicketWhereInput {
  return actor.role === "CUSTOMER" ? { customerId: actor.userId } : {};
}

export function assertStaff(actor: Actor) {
  if (actor.role === "CUSTOMER") throw new Error("FORBIDDEN");
}

export async function lockTicket(
  tx: Prisma.TransactionClient,
  ticketId: string,
) {
  // Serialize edits to the same ticket, including assignment and first response.
  await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
}
