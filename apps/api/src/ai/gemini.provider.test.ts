import assert from "node:assert/strict";
import test from "node:test";
import type { AIAnalysisType } from "@prisma/client";
import { GeminiProvider, parseGeminiResponse } from "./gemini.provider.js";
import { GroqProvider } from "./groq.provider.js";
import { getAiProvider } from "./provider.factory.js";
import { DEFAULT_GEMINI_MODEL } from "./provider.config.js";
import { safeAiErrorCode } from "./provider.errors.js";
import { parseStructuredJson } from "./structured-json.js";
import { validateResult } from "./ai.worker.service.js";

const credentials = {
  apiKey: "synthetic-unit-test-key",
  model: DEFAULT_GEMINI_MODEL,
};
const context = {
  subject: "Duplicate invoice",
  description: "A customer reports two demo invoices.",
  messages: [
    {
      authorType: "CUSTOMER",
      body: "Please review my invoice.",
      isInternal: false,
    },
    { authorType: "AGENT", body: "PRIVATE_INTERNAL_NOTE", isInternal: true },
  ],
};
const results: Record<AIAnalysisType, unknown> = {
  CLASSIFICATION: {
    category: "BILLING",
    confidence: 0.9,
    rationale: "Invoice question.",
  },
  SUMMARY: {
    summary: "Customer reports duplicate invoices.",
    keyPoints: ["Review the invoice records."],
  },
  PRIORITY_SUGGESTION: {
    priority: "HIGH",
    confidence: 0.8,
    rationale: "Billing impact reported.",
  },
  DRAFT_RESPONSE: {
    response:
      "Thank you for reporting this. Could you share the invoice references?",
    tone: "professional",
  },
};
const envelope = (text: string) => ({
  candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }],
});

for (const type of Object.keys(results) as AIAnalysisType[]) {
  test(`Gemini ${type} uses JSON mode, excludes notes, and passes authoritative Zod validation`, async () => {
    const request: typeof fetch = async (url, init) => {
      assert.equal(
        String(url),
        `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`,
      );
      assert.ok(!String(url).includes(credentials.apiKey));
      assert.equal(
        new Headers(init?.headers).get("x-goog-api-key"),
        credentials.apiKey,
      );
      assert.ok(init?.signal instanceof AbortSignal);
      const body = String(init?.body);
      assert.ok(!body.includes("PRIVATE_INTERNAL_NOTE"));
      assert.ok(body.includes("human review"));
      const payload = JSON.parse(body) as {
        generationConfig: { responseMimeType: string };
      };
      assert.equal(
        payload.generationConfig.responseMimeType,
        "application/json",
      );
      return Response.json(envelope(JSON.stringify(results[type])));
    };
    const result = await new GeminiProvider(credentials, request).run(
      type,
      context,
    );
    assert.equal(result.provider, "gemini");
    assert.equal(result.model, DEFAULT_GEMINI_MODEL);
    assert.deepEqual(validateResult(type, result.raw), results[type]);
  });
  test(`Groq ${type} retains its endpoint and structured-output contract`, async () => {
    const request: typeof fetch = async (url, init) => {
      assert.equal(
        String(url),
        "https://api.groq.com/openai/v1/chat/completions",
      );
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        `Bearer ${credentials.apiKey}`,
      );
      assert.ok(!String(init?.body).includes("PRIVATE_INTERNAL_NOTE"));
      return Response.json({
        choices: [
          {
            message: { content: JSON.stringify(results[type]) },
            finish_reason: "stop",
          },
        ],
      });
    };
    const result = await new GroqProvider(
      { ...credentials, model: "test-groq-model" },
      request,
    ).run(type, context);
    assert.equal(result.provider, "groq");
    assert.equal(result.model, "test-groq-model");
    assert.deepEqual(validateResult(type, result.raw), results[type]);
  });
}

test("Gemini accepts fences, harmless surrounding prose, multipart text and escaped braces", () => {
  const json = JSON.stringify({
    summary: 'Contains {braces} and a "quote".',
    keyPoints: [],
  });
  for (const content of [
    json,
    `\`\`\`json\n${json}\n\`\`\``,
    `Here is the result:\n${json}\nEnd.`,
  ])
    assert.deepEqual(parseGeminiResponse(envelope(content)), JSON.parse(json));
  assert.deepEqual(
    parseGeminiResponse({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              { thought: true, text: "Private reasoning is excluded" },
              { text: json.slice(0, 10) },
              { text: json.slice(10) },
            ],
          },
        },
      ],
    }),
    JSON.parse(json),
  );
});

test("Gemini rejects malformed, empty, blocked, truncated and ambiguous responses", () => {
  for (const payload of [
    null,
    {},
    { candidates: [{}] },
    envelope(""),
    envelope("not json"),
    envelope("{broken"),
    envelope("{} {}"),
    { promptFeedback: { blockReason: "SAFETY" } },
    { candidates: [{ finishReason: "MAX_TOKENS" }] },
    { candidates: [{ finishReason: "SAFETY" }] },
  ])
    assert.throws(() => parseGeminiResponse(payload), /AI_PROVIDER_/);
  assert.throws(
    () => parseStructuredJson('{"one":1} trailing {'),
    /AI_PROVIDER_INVALID_JSON/,
  );
});

for (const [status, code] of [
  [400, "AI_PROVIDER_INVALID_REQUEST"],
  [401, "AI_PROVIDER_AUTH_ERROR"],
  [403, "AI_PROVIDER_AUTH_ERROR"],
  [404, "AI_PROVIDER_MODEL_UNAVAILABLE"],
  [429, "AI_PROVIDER_RATE_LIMITED"],
  [500, "AI_PROVIDER_UNAVAILABLE"],
  [503, "AI_PROVIDER_UNAVAILABLE"],
  [504, "AI_PROVIDER_TIMEOUT"],
] as const) {
  test(`Gemini safely maps HTTP ${status} without exposing a provider body`, async () => {
    const request: typeof fetch = async () =>
      Response.json(
        { error: { message: "PRIVATE_PROVIDER_DETAIL" } },
        { status },
      );
    await assert.rejects(
      new GeminiProvider(credentials, request).run("SUMMARY", context),
      { message: code },
    );
  });
}

test("Gemini maps Google's HTTP 400 invalid-key response to authentication failure", async () => {
  const request: typeof fetch = async () =>
    Response.json(
      {
        error: {
          message: "API key not valid. Please pass a valid API key.",
          details: [{ reason: "API_KEY_INVALID" }],
        },
      },
      { status: 400 },
    );
  await assert.rejects(
    new GeminiProvider(credentials, request).run("SUMMARY", context),
    { message: "AI_PROVIDER_AUTH_ERROR" },
  );
});

test("Gemini safely handles transport timeout, network failure and non-JSON envelopes", async () => {
  const timeout: typeof fetch = async () => {
    throw new DOMException("PRIVATE_TIMEOUT_DETAIL", "TimeoutError");
  };
  const failed: typeof fetch = async () => {
    throw new Error("PRIVATE_NETWORK_DETAIL");
  };
  const malformed: typeof fetch = async () => new Response("not-json");
  for (const [request, message] of [
    [timeout, "AI_PROVIDER_TIMEOUT"],
    [failed, "AI_PROVIDER_UNAVAILABLE"],
    [malformed, "AI_PROVIDER_INVALID_RESPONSE"],
  ] as const)
    await assert.rejects(
      new GeminiProvider(credentials, request).run("SUMMARY", context),
      { message },
    );
});

test("provider selection is explicit and never silently falls back", () => {
  assert.ok(
    getAiProvider({
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: credentials.apiKey,
    }) instanceof GeminiProvider,
  );
  assert.ok(
    getAiProvider({
      AI_PROVIDER: "groq",
      GROQ_API_KEY: credentials.apiKey,
    }) instanceof GroqProvider,
  );
  assert.throws(
    () => getAiProvider({ AI_PROVIDER: "disabled" }),
    /AI_PROVIDER_DISABLED/,
  );
  assert.throws(
    () =>
      getAiProvider({
        AI_PROVIDER: "gemini",
        GROQ_API_KEY: credentials.apiKey,
      }),
    /AI_PROVIDER_CONFIGURATION_ERROR/,
  );
  assert.throws(
    () =>
      getAiProvider({
        AI_PROVIDER: "groq",
        GEMINI_API_KEY: credentials.apiKey,
      }),
    /AI_PROVIDER_CONFIGURATION_ERROR/,
  );
});

test("invalid model output is rejected by Zod and only safe failure codes are retained", () => {
  for (const [type, raw] of [
    ["CLASSIFICATION", { category: "INVENTED", confidence: 1, rationale: "x" }],
    [
      "PRIORITY_SUGGESTION",
      { priority: "CRITICAL", confidence: 1, rationale: "x" },
    ],
    ["DRAFT_RESPONSE", { response: "", tone: "professional" }],
    ["DRAFT_RESPONSE", { response: "Some reply", tone: "invented" }],
    ["SUMMARY", { summary: "missing key points" }],
  ] as const) {
    try {
      validateResult(type, raw);
      assert.fail("Invalid output accepted");
    } catch (error) {
      assert.equal(safeAiErrorCode(error), "AI_PROVIDER_INVALID_OUTPUT");
    }
  }
  assert.equal(
    safeAiErrorCode(new Error("PRIVATE_PROVIDER_RESPONSE_WITH_KEY")),
    "AI_ANALYSIS_FAILED",
  );
});
