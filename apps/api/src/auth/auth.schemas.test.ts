import assert from "node:assert/strict";
import test from "node:test";
import { loginSchema, registerSchema } from "./auth.schemas.js";

test("public registration strips privileged role and account status", () => {
  const parsed = registerSchema.parse({
    name: "Casey Ellis",
    email: "casey@example.test",
    password: "StrongPass123!",
    role: "ADMIN",
    status: "ACTIVE",
  });
  assert.equal("role" in parsed, false);
  assert.equal("status" in parsed, false);
});
test("registration rejects passwords that bcrypt would truncate", () => {
  assert.equal(
    registerSchema.safeParse({
      name: "Casey Ellis",
      email: "casey@example.test",
      password: "Aa1" + "é".repeat(40),
    }).success,
    false,
  );
});

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
