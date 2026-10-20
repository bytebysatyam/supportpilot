"use client";
import { useEffect, useState } from "react";
import type { DashboardSummary } from "@supportpilot/types";
import { api, errorMessage } from "../../lib/api";
import { ErrorState } from "../ui/states";
export function Metrics() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void api<DashboardSummary>("/dashboard/summary", {
      signal: controller.signal,
    })
      .then(setData)
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [revision]);
  if (error)
    return (
      <ErrorState message={error} retry={() => setRevision((v) => v + 1)} />
    );
  const metrics = [
    ["Active tickets", data?.open, "Across the support queue"],
    ["Unassigned", data?.unassigned, "Waiting for an owner"],
    ["Assigned to you", data?.assignedToMe, "Your active workload"],
    ["SLA overdue", data?.breached, "Active tickets past a deadline"],
    ["At risk", data?.atRisk, "Approaching a deadline"],
    ["Urgent", data?.urgent, "Active urgent tickets"],
  ] as const;
  return (
    <section
      className="metrics-grid"
      aria-label="Organization-wide active ticket metrics"
    >
      {metrics.map(([name, value, hint]) => (
        <article
          key={name}
          className={`metric ${name === "SLA overdue" && value ? "metric-alert" : ""}`}
        >
          <span>{name}</span>
          <strong>{value ?? "—"}</strong>
          <p>{hint}</p>
        </article>
      ))}
    </section>
  );
}
