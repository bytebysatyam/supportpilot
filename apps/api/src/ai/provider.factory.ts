import { env } from "../config/env.js";
import type { AiProvider } from "./provider.js";
import { GroqProvider } from "./groq.provider.js";

export function getAiProvider(): AiProvider {
  if (env.AI_PROVIDER === "groq") {
    return new GroqProvider();
  }

  throw new Error("AI_PROVIDER_DISABLED");
}
