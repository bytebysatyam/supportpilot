import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  SLA_SCAN_INTERVAL_MS: z.coerce.number().int().min(60000).default(300000),
  AI_PROVIDER: z.enum(["disabled", "groq"]).default("disabled"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment configuration:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

if (
  parsed.data.AI_PROVIDER === "groq" &&
  !parsed.data.GROQ_API_KEY
) {
  console.error("GROQ_API_KEY is required when AI_PROVIDER=groq.");
  process.exit(1);
}

export const env = parsed.data;
