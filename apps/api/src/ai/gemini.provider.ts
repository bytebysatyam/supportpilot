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

export function parseGeminiResponse(payload: unknown): unknown {
  const root = record(payload);
  if (!root) throw new AiProviderError("AI_PROVIDER_INVALID_RESPONSE");
  if (record(root.promptFeedback)?.blockReason)
    throw new AiProviderError("AI_PROVIDER_BLOCKED");
  const candidate = Array.isArray(root.candidates)
    ? record(root.candidates[0])
    : undefined;
  if (!candidate) throw new AiProviderError("AI_PROVIDER_EMPTY_RESPONSE");
  if (candidate.finishReason === "MAX_TOKENS")
    throw new AiProviderError("AI_PROVIDER_TRUNCATED");
  if (candidate.finishReason && candidate.finishReason !== "STOP")
    throw new AiProviderError("AI_PROVIDER_BLOCKED");
  const parts = record(candidate.content)?.parts;
  if (!Array.isArray(parts))
    throw new AiProviderError("AI_PROVIDER_INVALID_RESPONSE");
  const text = parts
    .map((part) => {
      const item = record(part);
      return item?.thought !== true && typeof item?.text === "string"
        ? item.text
        : "";
    })
    .join("");
  return parseStructuredJson(text);
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  readonly model: string;
  constructor(
    private readonly credentials: ProviderCredentials,
    private readonly request: typeof fetch = fetch,
  ) {
    this.model = credentials.model;
    if (
      !credentials.apiKey.trim() ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(this.model)
    )
      throw new AiProviderError("AI_PROVIDER_CONFIGURATION_ERROR");
  }

  async run(
    type: AIAnalysisType,
    context: TicketAiContext,
  ): Promise<AiProviderResult> {
    try {
      const response = await this.request(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: "POST",
          signal: AbortSignal.timeout(30_000),
          // Use a header, never a query-string key that could appear in access logs.
          headers: {
            "x-goog-api-key": this.credentials.apiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: buildPrompt(type, context) }] },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              maxOutputTokens: 4096,
            },
          }),
        },
      );
      if (!response.ok) {
        if (response.status === 400) {
          const payload: unknown = await response.json().catch(() => null);
          const failure = record(record(payload)?.error);
          const details = failure?.details;
          if (
            (typeof failure?.message === "string" &&
              /API key not valid/i.test(failure.message)) ||
            (Array.isArray(details) &&
              details.some(
                (detail) => record(detail)?.reason === "API_KEY_INVALID",
              ))
          )
            throw new AiProviderError("AI_PROVIDER_AUTH_ERROR");
        }
        throw providerHttpError(response.status);
      }
      const payload: unknown = await response.json().catch(() => {
        throw new AiProviderError("AI_PROVIDER_INVALID_RESPONSE");
      });
      return {
        provider: this.name,
        model: this.model,
        raw: parseGeminiResponse(payload),
      };
    } catch (error) {
      throw providerNetworkError(error);
    }
  }
}
