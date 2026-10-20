import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "node:path";

// Next loads workspace env files first; root values are fallback defaults.
config({ path: resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@supportpilot/types"],
  output: "standalone",
  outputFileTracingRoot: resolve(process.cwd(), "../.."),
};

export default nextConfig;
