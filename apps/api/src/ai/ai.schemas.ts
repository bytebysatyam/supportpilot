import {
  TicketCategory,
  TicketPriority,
  AIAnalysisType,
} from "@prisma/client";
import { z } from "zod";

export const aiRunSchema = z.object({
  type: z.nativeEnum(AIAnalysisType),
});

export const classificationResultSchema = z.object({
  category: z.nativeEnum(TicketCategory),
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1).max(1000),
});

export const summaryResultSchema = z.object({
  summary: z.string().trim().min(1).max(3000),
  keyPoints: z.array(z.string().trim().min(1).max(500)).max(10),
});

export const priorityResultSchema = z.object({
  priority: z.nativeEnum(TicketPriority),
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1).max(1000),
});

export const draftResponseResultSchema = z.object({
  response: z.string().trim().min(1).max(5000),
  tone: z.enum(["professional", "empathetic", "concise"]),
});
