// Verified in Google's model/pricing/deprecation docs on 2026-10-21.
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

export type AiProviderConfig = {
  AI_PROVIDER: "disabled" | "groq" | "gemini";
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
};

export type ProviderCredentials = { apiKey: string; model: string };
