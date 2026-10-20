import assert from "node:assert/strict";
import test from "node:test";
import { validateResult } from "./ai.worker.service.js";
import { getAiProvider } from "./provider.factory.js";
import { env } from "../config/env.js";

test("AI output must match the requested result shape and enum", () => {
  assert.deepEqual(
    validateResult("PRIORITY_SUGGESTION", {
      priority: "HIGH",
      confidence: 0.85,
      rationale: "Duplicate payment reported.",
    }),
    {
      priority: "HIGH",
      confidence: 0.85,
      rationale: "Duplicate payment reported.",
    },
  );
  assert.throws(() =>
    validateResult("CLASSIFICATION", {
      category: "INVENTED",
      confidence: 1,
      rationale: "Invalid category.",
    }),
  );
  assert.throws(() =>
    validateResult("PRIORITY_SUGGESTION", {
      priority: "HIGH",
      confidence: 8,
      rationale: "Out of bounds.",
    }),
  );
  assert.throws(() =>
    validateResult("DRAFT_RESPONSE", { response: "", tone: "professional" }),
  );
  assert.throws(() =>
    validateResult("SUMMARY", { summary: "Context", keyPoints: [""] }),
  );
});
test("disabled provider fails clearly without a network call", () => {
  const provider = env.AI_PROVIDER;
  env.AI_PROVIDER = "disabled";
  try {
    assert.throws(() => getAiProvider(), /AI_PROVIDER_DISABLED/);
  } finally {
    env.AI_PROVIDER = provider;
  }
});
