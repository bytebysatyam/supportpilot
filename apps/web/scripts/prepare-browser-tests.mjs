import { cpSync, existsSync } from "node:fs";

if (process.env.SUPPORTPILOT_E2E_BASE_URL) process.exit(0);

if (
  !existsSync(".next/BUILD_ID") ||
  !existsSync(".next/standalone/apps/web/server.js")
) {
  throw new Error(
    "Run npm run build before the browser suite. Tests use the standalone production server.",
  );
}
cpSync(".next/static", ".next/standalone/apps/web/.next/static", {
  recursive: true,
});
if (existsSync("public"))
  cpSync("public", ".next/standalone/apps/web/public", { recursive: true });
