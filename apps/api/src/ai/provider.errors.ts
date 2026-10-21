import { ZodError } from "zod";

const providerCodes = [
  "AI_PROVIDER_AUTH_ERROR",
  "AI_PROVIDER_RATE_LIMITED",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_PROVIDER_TIMEOUT",
  "AI_PROVIDER_MODEL_UNAVAILABLE",
  "AI_PROVIDER_INVALID_REQUEST",
  "AI_PROVIDER_INVALID_RESPONSE",
  "AI_PROVIDER_INVALID_JSON",
  "AI_PROVIDER_EMPTY_RESPONSE",
  "AI_PROVIDER_BLOCKED",
  "AI_PROVIDER_TRUNCATED",
  "AI_PROVIDER_INVALID_OUTPUT",
  "AI_PROVIDER_DISABLED",
  "AI_PROVIDER_CONFIGURATION_ERROR",
  "AI_PROVIDER_CONFIGURATION_CHANGED",
] as const;
export type ProviderErrorCode = (typeof providerCodes)[number];

export class AiProviderError extends Error {
  constructor(readonly code: ProviderErrorCode) {
    super(code);
    this.name = "AiProviderError";
  }
}

export function safeAiErrorCode(error: unknown): string {
  if (error instanceof ZodError) return "AI_PROVIDER_INVALID_OUTPUT";
  if (error instanceof Error && error.message === "QUEUE_ENQUEUE_FAILED")
    return error.message;
  if (
    error instanceof Error &&
    providerCodes.some((code) => code === error.message)
  )
    return error.message;
  return "AI_ANALYSIS_FAILED";
}

export function providerHttpError(status: number): AiProviderError {
  if (status === 401 || status === 403)
    return new AiProviderError("AI_PROVIDER_AUTH_ERROR");
  if (status === 404)
    return new AiProviderError("AI_PROVIDER_MODEL_UNAVAILABLE");
  if (status === 429) return new AiProviderError("AI_PROVIDER_RATE_LIMITED");
  if (status === 408 || status === 504)
    return new AiProviderError("AI_PROVIDER_TIMEOUT");
  if (status >= 500) return new AiProviderError("AI_PROVIDER_UNAVAILABLE");
  return new AiProviderError("AI_PROVIDER_INVALID_REQUEST");
}

export function providerNetworkError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  if (
    error instanceof Error &&
    ["TimeoutError", "AbortError"].includes(error.name)
  )
    return new AiProviderError("AI_PROVIDER_TIMEOUT");
  return new AiProviderError("AI_PROVIDER_UNAVAILABLE");
}
