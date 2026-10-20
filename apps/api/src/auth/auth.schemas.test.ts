import assert from "node:assert/strict";
import test from "node:test";
import { loginSchema, registerSchema } from "./auth.schemas.js";

test("registration normalizes email and accepts a strong password", () => {
  const result = registerSchema.parse({
    name: "Satyam Shukla",
    email: "  SATYAM@example.com ",
    password: "Support123",
  });

  assert.equal(result.email, "satyam@example.com");
});

test("registration rejects passwords without required character classes", () => {
  const result = registerSchema.safeParse({
    name: "Satyam Shukla",
    email: "satyam@example.com",
    password: "password",
  });

  assert.equal(result.success, false);
});

test("login rejects invalid email input", () => {
  const result = loginSchema.safeParse({
    email: "not-an-email",
    password: "anything",
  });

  assert.equal(result.success, false);
});
