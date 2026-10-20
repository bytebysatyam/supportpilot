import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import { z } from "zod";

export const createTicketSchema = z.object({
  subject: z.string().trim().min(4).max(160),
  description: z.string().trim().min(10).max(10000),
});

export const listTicketsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  assignedAgentId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export const updateTicketSchema = z
  .object({
    status: z.nativeEnum(TicketStatus).optional(),
    priority: z.nativeEnum(TicketPriority).optional(),
    category: z.nativeEnum(TicketCategory).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one ticket field must be supplied.",
  });

export const assignTicketSchema = z.object({
  agentId: z.string().cuid().nullable(),
});
