import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import {
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from "./token.js";
import { env } from "../config/env.js";

const claims = {
  sub: "customer-a",
  email: "casey@example.test",
  role: "CUSTOMER" as const,
};
test("access tokens have expiry and verify expected audience and role", () => {
  const token = signAccessToken(claims);
  assert.equal(verifyAccessToken(token).sub, claims.sub);
  const decoded = jwt.decode(token);
  assert.ok(
    decoded && typeof decoded === "object" && typeof decoded.exp === "number",
  );
  assert.throws(() =>
    verifyAccessToken(
      jwt.sign(claims, env.JWT_ACCESS_SECRET, {
        expiresIn: -1,
        issuer: "supportpilot-api",
        audience: "supportpilot-web",
      }),
    ),
  );
  assert.throws(() =>
    verifyAccessToken(
      jwt.sign(claims, env.JWT_ACCESS_SECRET, {
        audience: "other-application",
      }),
    ),
  );
  assert.throws(() =>
    verifyAccessToken(
      jwt.sign({ ...claims, role: "OWNER" }, env.JWT_ACCESS_SECRET, {
        issuer: "supportpilot-api",
        audience: "supportpilot-web",
      }),
    ),
  );
});
test("refresh tokens are random and hash without retaining their raw value", () => {
  const first = createRefreshToken();
  const second = createRefreshToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 64);
  assert.equal(hashRefreshToken(first), hashRefreshToken(first));
  assert.notEqual(hashRefreshToken(first), first);
  assert.notEqual(hashRefreshToken(first), hashRefreshToken(second));
});
