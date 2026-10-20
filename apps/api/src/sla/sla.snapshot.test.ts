import assert from "node:assert/strict";
import test from "node:test";
import { computeSlaSnapshot } from "./sla.service.js";

const base = {
  id: "ticket-1",
  priority: "MEDIUM" as const,
  status: "IN_PROGRESS" as const,
  firstResponseDueAt: new Date("2026-01-01T04:00:00.000Z"),
  firstRespondedAt: null,
  resolutionDueAt: new Date("2026-01-03T00:00:00.000Z"),
  resolvedAt: null,
  closedAt: null,
};

test("marks first response as breached after its deadline", () => {
  const result = computeSlaSnapshot(
    base,
    new Date("2026-01-01T04:01:00.000Z"),
  );

  assert.equal(result.firstResponse.breached, true);
  assert.equal(result.firstResponse.met, false);
});

test("marks first response as met when staff responded before deadline", () => {
  const result = computeSlaSnapshot(
    {
      ...base,
      firstRespondedAt: new Date("2026-01-01T03:00:00.000Z"),
    },
    new Date("2026-01-01T05:00:00.000Z"),
  );

  assert.equal(result.firstResponse.met, true);
  assert.equal(result.firstResponse.breached, false);
});

test("marks unresolved ticket resolution as at risk inside warning window", () => {
  const result = computeSlaSnapshot(
    base,
    new Date("2026-01-02T23:30:00.000Z"),
  );

  assert.equal(result.resolution.atRisk, true);
  assert.equal(result.resolution.breached, false);
});
