import assert from "node:assert/strict";
import test from "node:test";
import { envSchema } from "./env.schema.js";

const base = {
  DATABASE_URL: "postgresql://demo:demo@localhost:5432/supportpilot",
  JWT_ACCESS_SECRET: "unit-test-only-secret-with-at-least-32-characters",
};

test("Gemini requires only its selected key and defaults to the verified stable model", () => {
  assert.equal(
    envSchema.safeParse({ ...base, AI_PROVIDER: "gemini" }).success,
    false,
  );
  assert.equal(
    envSchema.safeParse({
      ...base,
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "  ",
    }).success,
    false,
  );
  const gemini = envSchema.parse({
    ...base,
    AI_PROVIDER: "gemini",
    GEMINI_API_KEY: "synthetic-test-key",
    GEMINI_MODEL: "",
  });
  assert.equal(gemini.GEMINI_MODEL, "gemini-3.5-flash-lite");
  assert.equal(gemini.GROQ_API_KEY, undefined);
  assert.equal(
    envSchema.parse({
      ...base,
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "synthetic-test-key",
      GROQ_MODEL: "",
    }).GROQ_MODEL,
    "llama-3.3-70b-versatile",
  );
  assert.equal(
    envSchema.safeParse({ ...base, AI_PROVIDER: "groq" }).success,
    false,
  );
  assert.equal(
    envSchema.safeParse({
      ...base,
      AI_PROVIDER: "groq",
      GROQ_API_KEY: "synthetic-test-key",
    }).success,
    true,
  );
  assert.equal(
    envSchema.safeParse({ ...base, AI_PROVIDER: "disabled" }).success,
    true,
  );
  assert.equal(
    envSchema.safeParse({
      ...base,
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "synthetic-test-key",
      GEMINI_MODEL: "https://untrusted.example",
    }).success,
    false,
  );
});
test("local configuration has local defaults and respects Render PORT", () => {
  const parsed = envSchema.parse({ ...base, PORT: "10000" });
  assert.equal(parsed.API_PORT, 4000);
  assert.equal(parsed.PORT, 10000);
  assert.equal(parsed.REDIS_URL, "redis://localhost:6379");
  assert.equal(parsed.WEB_ORIGIN, "http://localhost:3000");
});
test("CORS accepts explicit origin lists and rejects wildcards, paths and credentials", () => {
  assert.equal(
    envSchema.safeParse({
      ...base,
      WEB_ORIGIN: "http://localhost:3000, https://supportpilot-silk.vercel.app",
    }).success,
    true,
  );
  for (const WEB_ORIGIN of [
    "*",
    "https://example.com/path",
    "https://user:password@example.com",
    "http://localhost:3000,",
    "null",
  ])
    assert.equal(envSchema.safeParse({ ...base, WEB_ORIGIN }).success, false);
});
test("database and Redis configuration require the correct protocols", () => {
  assert.equal(
    envSchema.safeParse({ ...base, DATABASE_URL: "https://example.com" })
      .success,
    false,
  );
  assert.equal(
    envSchema.safeParse({ ...base, REDIS_URL: "https://example.com" }).success,
    false,
  );
  assert.equal(
    envSchema.safeParse({
      ...base,
      REDIS_URL: "rediss://demo:demo@redis.example:6379",
    }).success,
    true,
  );
});
test("production requires explicit CORS/Redis configuration and a non-placeholder secret", () => {
  assert.equal(
    envSchema.safeParse({ ...base, NODE_ENV: "production" }).success,
    false,
  );
  const production = {
    ...base,
    NODE_ENV: "production",
    WEB_ORIGIN: "https://supportpilot-silk.vercel.app",
    REDIS_URL: "redis://redis:6379",
  };
  assert.equal(envSchema.safeParse(production).success, true);
  assert.equal(
    envSchema.safeParse({
      ...production,
      JWT_ACCESS_SECRET: "replace-with-a-secret-of-at-least-32-characters",
    }).success,
    false,
  );
});
