import type { AIAnalysisType } from "@prisma/client";
import type {
  AiProvider,
  AiProviderResult,
  TicketAiContext,
} from "./provider.js";
import type { ProviderCredentials } from "./provider.config.js";
import { buildPrompt } from "./ai.prompts.js";
import {
  AiProviderError,
  providerHttpError,
  providerNetworkError,
} from "./provider.errors.js";
import { parseStructuredJson, record } from "./structured-json.js";

export class GroqProvider implements AiProvider {
  readonly name = "groq";
  readonly model: string;
  constructor(
    private readonly credentials: ProviderCredentials,
    private readonly request: typeof fetch = fetch,
  ) {
    this.model = credentials.model;
    if (!credentials.apiKey.trim() || !this.model.trim())
      throw new AiProviderError("AI_PROVIDER_CONFIGURATION_ERROR");
  }

  async run(
    type: AIAnalysisType,
    context: TicketAiContext,
  ): Promise<AiProviderResult> {
    try {
      const response = await this.request(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          signal: AbortSignal.timeout(30_000),
          method: "POST",
          headers: {
            authorization: `Bearer ${this.credentials.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: buildPrompt(type, context) }],
          }),
        },
      );
      if (!response.ok) throw providerHttpError(response.status);
      const payload: unknown = await response.json().catch(() => {
        throw new AiProviderError("AI_PROVIDER_INVALID_RESPONSE");
      });
      const choices = record(payload)?.choices;
      const choice = Array.isArray(choices) ? record(choices[0]) : undefined;
      if (choice?.finish_reason === "length")
        throw new AiProviderError("AI_PROVIDER_TRUNCATED");
      const content = record(choice?.message)?.content;
      if (typeof content !== "string")
        throw new AiProviderError("AI_PROVIDER_EMPTY_RESPONSE");
      return {
        provider: this.name,
        model: this.model,
        raw: parseStructuredJson(content),
      };
    } catch (error) {
      throw providerNetworkError(error);
    }
  }
}
