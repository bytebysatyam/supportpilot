import { AiProviderError } from "./provider.errors.js";

export function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

// Permit one JSON object with harmless fences/prose, never eval model output.
export function parseStructuredJson(content: string): unknown {
  const text = content.trim();
  if (!text) throw new AiProviderError("AI_PROVIDER_EMPTY_RESPONSE");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    /* Inspect a wrapped object. */
  }
  const candidates: unknown[] = [];
  let start = -1,
    depth = 0,
    quoted = false,
    escaped = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (start < 0) {
      if (char === "{") {
        start = index;
        depth = 1;
        quoted = false;
        escaped = false;
      }
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) {
      try {
        candidates.push(JSON.parse(text.slice(start, index + 1)) as unknown);
      } catch {
        /* Reject below. */
      }
      start = -1;
    }
  }
  if (candidates.length !== 1 || start !== -1)
    throw new AiProviderError("AI_PROVIDER_INVALID_JSON");
  return candidates[0];
}
