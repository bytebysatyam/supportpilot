import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { z } from "zod";

export type AccessTokenPayload = {
  sub: string;
  role: "ADMIN" | "SUPPORT_AGENT" | "CUSTOMER";
  email: string;
};

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
    issuer: "supportpilot-api",
    audience: "supportpilot-web",
  });
}

export function verifyAccessToken(token: string) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"],
    issuer: "supportpilot-api",
    audience: "supportpilot-web",
  });
  return z
    .object({
      sub: z.string().min(1),
      email: z.string().email(),
      role: z.enum(["ADMIN", "SUPPORT_AGENT", "CUSTOMER"]),
    })
    .parse(payload);
}

export function createRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
}
