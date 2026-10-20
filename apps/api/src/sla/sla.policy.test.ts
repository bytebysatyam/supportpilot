import assert from "node:assert/strict";
import test from "node:test";
import {
  addMinutes,
  getSlaDeadlines,
  SLA_POLICY,
} from "./sla.policy.js";

test("addMinutes does not mutate the original date", () => {
  const original = new Date("2026-01-01T00:00:00.000Z");
  const result = addMinutes(original, 15);

  assert.equal(original.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(result.toISOString(), "2026-01-01T00:15:00.000Z");
});

test("urgent SLA uses 15 minute response and 4 hour resolution targets", () => {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  const deadlines = getSlaDeadlines("URGENT", createdAt);

  assert.equal(
    deadlines.firstResponseDueAt.toISOString(),
    "2026-01-01T00:15:00.000Z",
  );
  assert.equal(
    deadlines.resolutionDueAt.toISOString(),
    "2026-01-01T04:00:00.000Z",
  );
});

test("all policies have a shorter first-response target than resolution target", () => {
  for (const policy of Object.values(SLA_POLICY)) {
    assert.ok(policy.firstResponseMinutes < policy.resolutionMinutes);
  }
});
