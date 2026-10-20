import type { SlaIndicator, SlaSnapshot } from "@supportpilot/types";
import { formatDate } from "../../lib/format";
export function SlaCard({ snapshot }: { snapshot: SlaSnapshot }) {
  function indicator(
    name: string,
    item: SlaIndicator,
    completed: string | null,
    closedWithoutReply = false,
  ) {
    const state = item.breached
      ? completed || closedWithoutReply
        ? "Missed target"
        : "Overdue"
      : item.met
        ? "Target met"
        : closedWithoutReply
          ? "Closed without reply"
          : item.atRisk
            ? "At risk"
            : item.dueAt
              ? "On track"
              : "Not scheduled";
    return (
      <div className="sla-item">
        <div>
          <strong>{name}</strong>
          <span
            className={`sla-state ${item.breached ? "danger" : item.atRisk ? "warning" : "success"}`}
          >
            {state}
          </span>
        </div>
        <p>Target: {formatDate(item.dueAt)}</p>
        {completed && <p>Completed: {formatDate(completed)}</p>}
      </div>
    );
  }
  return (
    <section className="panel detail-card">
      <h2>Response targets</h2>
      {indicator(
        "First response",
        snapshot.firstResponse,
        snapshot.firstResponse.respondedAt,
        snapshot.firstResponse.closedWithoutReply,
      )}
      {indicator(
        "Resolution",
        snapshot.resolution,
        snapshot.resolution.resolvedAt,
      )}
      <p className="field-help">
        Targets are set when a ticket is created. Priority changes and reopening
        do not reset the clock.
      </p>
    </section>
  );
}
