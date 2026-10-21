import { env } from "../config/env.js";
import type { AiProvider } from "./provider.js";
import { GroqProvider } from "./groq.provider.js";
import { GeminiProvider } from "./gemini.provider.js";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
  type AiProviderConfig,
} from "./provider.config.js";
import { AiProviderError } from "./provider.errors.js";

export function getAiProvider(config: AiProviderConfig = env): AiProvider {
  if (config.AI_PROVIDER === "groq") {
    return new GroqProvider({
      apiKey: config.GROQ_API_KEY ?? "",
      model: config.GROQ_MODEL ?? DEFAULT_GROQ_MODEL,
    });
  }
  if (config.AI_PROVIDER === "gemini") {
    return new GeminiProvider({
      apiKey: config.GEMINI_API_KEY ?? "",
      model: config.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    });
  }
  throw new AiProviderError("AI_PROVIDER_DISABLED");
}
