import type { TicketPriority } from "@prisma/client";

export type SlaPolicy = {
  firstResponseMinutes: number;
  resolutionMinutes: number;
};

export const SLA_POLICY: Record<TicketPriority, SlaPolicy> = {
  LOW: { firstResponseMinutes: 480, resolutionMinutes: 4320 },
  MEDIUM: { firstResponseMinutes: 240, resolutionMinutes: 2880 },
  HIGH: { firstResponseMinutes: 60, resolutionMinutes: 1440 },
  URGENT: { firstResponseMinutes: 15, resolutionMinutes: 240 },
};

export function addMinutes(from: Date, minutes: number) {
  return new Date(from.getTime() + minutes * 60_000);
}

export function getSlaDeadlines(priority: TicketPriority, from = new Date()) {
  const policy = SLA_POLICY[priority];

  return {
    firstResponseDueAt: addMinutes(from, policy.firstResponseMinutes),
    resolutionDueAt: addMinutes(from, policy.resolutionMinutes),
  };
}
