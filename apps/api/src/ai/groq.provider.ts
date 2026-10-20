import type { AIAnalysisType } from "@prisma/client";
import { env } from "../config/env.js";
import type {
  AiProvider,
  AiProviderResult,
  TicketAiContext,
} from "./provider.js";

function buildPrompt(type: AIAnalysisType, context: TicketAiContext) {
  const transcript = context.messages
    .filter((message) => !message.isInternal)
    .map((message) => `${message.authorType}: ${message.body}`)
    .join("\n");

  const base = `You are assisting a human customer-support agent.
Return ONLY valid JSON. Do not include markdown fences.
Ticket subject: ${context.subject}
Ticket description: ${context.description}
Conversation:
${transcript || "(no messages yet)"}`;

  switch (type) {
    case "CLASSIFICATION":
      return `${base}
Return: {"category":"GENERAL|BILLING|TECHNICAL|ACCOUNT|PRODUCT|FEATURE_REQUEST|OTHER","confidence":0-1,"rationale":"short explanation"}`;
    case "SUMMARY":
      return `${base}
Return: {"summary":"concise summary","keyPoints":["point 1","point 2"]}`;
    case "PRIORITY_SUGGESTION":
      return `${base}
Return: {"priority":"LOW|MEDIUM|HIGH|URGENT","confidence":0-1,"rationale":"short explanation"}`;
    case "DRAFT_RESPONSE":
      return `${base}
Draft a reply for human review. Do not claim actions were completed unless the ticket text proves it.
Return: {"response":"draft reply","tone":"professional|empathetic|concise"}`;
  }
}

export class GroqProvider implements AiProvider {
  async run(
    type: AIAnalysisType,
    context: TicketAiContext,
  ): Promise<AiProviderResult> {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.GROQ_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: env.GROQ_MODEL,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: buildPrompt(type, context),
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`AI_PROVIDER_ERROR_${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI_PROVIDER_EMPTY_RESPONSE");
    }

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new Error("AI_PROVIDER_INVALID_JSON");
    }

    return {
      provider: "groq",
      model: env.GROQ_MODEL,
      raw,
    };
  }
}
