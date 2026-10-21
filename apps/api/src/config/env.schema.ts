import { z } from "zod";

function hasProtocol(value: string, protocols: string[]) {
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function isWebOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.origin === value && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  WEB_ORIGIN: z.string()
    .refine(
      value => value.split(",").every(origin => isWebOrigin(origin.trim())),
      "Use comma-separated HTTP(S) origins without paths, credentials, or wildcards.",
    ).optional(),
  DATABASE_URL: z.string().refine(
    value => hasProtocol(value, ["postgres:", "postgresql:"]),
    "Use a PostgreSQL connection URL.",
  ),
  REDIS_URL: z.string().refine(
    value => hasProtocol(value, ["redis:", "rediss:"]),
    "Use a Redis connection URL.",
  ).optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().regex(/^[1-9]\d*(s|m|h|d)$/).default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  SLA_SCAN_INTERVAL_MS: z.coerce.number().int().min(60000).default(300000),
  AI_PROVIDER: z.enum(["disabled", "groq"]).default("disabled"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === "production") {
    for (const key of ["WEB_ORIGIN", "REDIS_URL"] as const)
      if (!env[key]) ctx.addIssue({
        code: "custom", path: [key], message: "Required in production.",
      });
  }
  if (env.AI_PROVIDER === "groq" && !env.GROQ_API_KEY?.trim())
    ctx.addIssue({
      code: "custom", path: ["GROQ_API_KEY"], message: "Required when AI_PROVIDER=groq.",
    });
  if (env.NODE_ENV === "production" &&
      /replace|placeholder|example/i.test(env.JWT_ACCESS_SECRET))
    ctx.addIssue({
      code: "custom", path: ["JWT_ACCESS_SECRET"], message: "Production requires a generated secret.",
    });
}).transform(env => ({
  ...env,
  WEB_ORIGIN: env.WEB_ORIGIN ?? "http://localhost:3000",
  REDIS_URL: env.REDIS_URL ?? "redis://localhost:6379",
}));
