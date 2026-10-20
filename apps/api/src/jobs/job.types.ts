import type { AIAnalysisType } from "@prisma/client";

export type AiAnalysisJob = {
  analysisId: string;
  ticketId: string;
  actorId: string;
  type: AIAnalysisType;
};

export type SlaScanJob = {
  requestedAt: string;
};
