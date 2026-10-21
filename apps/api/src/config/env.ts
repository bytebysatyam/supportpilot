import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { envSchema } from "./env.schema.js";

// Keep injected variables and workspace overrides ahead of root defaults.
if (process.env.NODE_ENV !== "production") {
  config();
  config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment configuration:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
