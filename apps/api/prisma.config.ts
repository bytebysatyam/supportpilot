import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

if (process.env.NODE_ENV !== "production") {
  config();
  config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx src/seed.ts" },
});
