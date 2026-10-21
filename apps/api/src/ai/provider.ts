import type { AIAnalysisType } from "@prisma/client";

export type TicketAiContext = {
  subject: string;
  description: string;
  messages: Array<{
    authorType: string;
    body: string;
    isInternal: boolean;
  }>;
};

export type AiProviderResult = {
  provider: string;
  model: string;
  raw: unknown;
};

export interface AiProvider {
  readonly name: "groq" | "gemini";
  readonly model: string;
  run(
    type: AIAnalysisType,
    context: TicketAiContext,
  ): Promise<AiProviderResult>;
}
