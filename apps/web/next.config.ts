import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "node:path";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Next loads workspace env files first; root values are fallback defaults.
if (!process.env.VERCEL && process.env.NODE_ENV !== "production")
  config({ path: resolve(process.cwd(), "../../.env") });

const apiBase = process.env.NEXT_PUBLIC_API_URL;
if (apiBase) {
  let url: URL;
  try {
    url = new URL(apiBase);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_API_URL must be a valid HTTP(S) API base ending in /api/v1.",
    );
  }
  if (!["http:", "https:"].includes(url.protocol) ||
      url.pathname.replace(/\/$/, "") !== "/api/v1" ||
      url.username || url.password || url.search || url.hash)
    throw new Error(
      "NEXT_PUBLIC_API_URL must be an HTTP(S) API base ending in /api/v1, without credentials or /health.",
    );
} else if (process.env.VERCEL) {
  throw new Error("Set NEXT_PUBLIC_API_URL in Vercel before building the frontend.");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@supportpilot/types"],
  output: "standalone",
  outputFileTracingRoot: resolve(process.cwd(), "../.."),
};

export default function configForPhase(phase: string): NextConfig {
  return {
    ...nextConfig,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
