"use client";
import { useEffect, useState } from "react";
import type { StaffMember } from "@supportpilot/types";
import { useUser } from "../../../components/app-shell/app-shell";
import {
  Badge,
  ErrorState,
  Loading,
  PageHeader,
} from "../../../components/ui/states";
import { api, errorMessage } from "../../../lib/api";
import { initials, label } from "../../../lib/format";

export default function TeamPage() {
  const user = useUser();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (user.role !== "ADMIN") return;
    const controller = new AbortController();
    setError("");
    void api<StaffMember[]>("/dashboard/staff", { signal: controller.signal })
      .then(setStaff)
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [user.role, revision]);
  if (user.role !== "ADMIN")
    return (
      <ErrorState message="The staff directory is available to administrators." />
    );
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Team overview"
        description="Current staff access and active ticket ownership across the support team."
        actions={
          <button className="button" onClick={() => setRevision((v) => v + 1)}>
            Refresh
          </button>
        }
      />
      {error ? (
        <ErrorState message={error} retry={() => setRevision((v) => v + 1)} />
      ) : !staff ? (
        <Loading text="Loading team workload" />
      ) : (
        <section className="panel staff-directory">
          {staff.map((member) => (
            <article key={member.id} className="staff-card">
              <span className="avatar avatar-agent">
                {initials(member.name)}
              </span>
              <div>
                <h2>{member.name}</h2>
                <p className="muted wrap-text">{member.email}</p>
                <span className="field-help">{label(member.role)}</span>
              </div>
              <Badge value={member.status} />
              <div className="workload-count">
                <strong>{member._count.assignedTickets}</strong>
                <span>active tickets</span>
              </div>
            </article>
          ))}
        </section>
      )}
      <p className="field-help">
        Workload includes open, in-progress, and waiting tickets. Resolved and
        closed tickets are excluded.
      </p>
    </>
  );
}
