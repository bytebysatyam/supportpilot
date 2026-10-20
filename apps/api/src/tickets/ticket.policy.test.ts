import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedStatusTransitions,
  assertStaff,
  scopeWhere,
} from "./ticket.policy.js";

test("customer queries are always scoped to their user id", () => {
  assert.deepEqual(scopeWhere({ userId: "customer-a", role: "CUSTOMER" }), {
    customerId: "customer-a",
  });
  assert.deepEqual(
    scopeWhere({ userId: "agent-a", role: "SUPPORT_AGENT" }),
    {},
  );
});
test("customer cannot perform staff operations", () => {
  assert.throws(
    () => assertStaff({ userId: "customer-a", role: "CUSTOMER" }),
    /FORBIDDEN/,
  );
  assert.doesNotThrow(() => assertStaff({ userId: "admin-a", role: "ADMIN" }));
});
test("closed tickets are terminal and resolved tickets can reopen", () => {
  assert.deepEqual(allowedStatusTransitions.CLOSED, []);
  assert.ok(allowedStatusTransitions.RESOLVED.includes("IN_PROGRESS"));
  assert.ok(!allowedStatusTransitions.OPEN.includes("RESOLVED"));
});
