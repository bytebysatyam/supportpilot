import type { Assignment, TimelineItem } from "@supportpilot/types";
import { formatDate, label } from "../../lib/format";

function changeDescription(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("from" in metadata) || !("to" in metadata)) return null;
  return typeof metadata.from === "string" && typeof metadata.to === "string" ? `${label(metadata.from)} → ${label(metadata.to)}` : null;
}
export function TicketActivity({ timeline, assignments }: { timeline: TimelineItem[]; assignments: Assignment[] }) {
  return <section className="panel detail-card activity-panel"><h2>Activity & ownership</h2><details><summary>Audit history</summary><ol className="activity-list">{timeline.filter(item => item.type === "AUDIT").map(item => <li key={item.data.id}><div><strong>{label(item.data.action)}</strong><span>{item.data.actor?.name ?? "System"}</span>{changeDescription(item.data.metadata) && <span>{changeDescription(item.data.metadata)}</span>}</div><time>{formatDate(item.occurredAt)}</time></li>)}</ol></details><details><summary>Assignment history ({assignments.length})</summary>{assignments.length ? <ol className="activity-list">{assignments.map(assignment => <li key={assignment.id}><div><strong>{assignment.agent.name}</strong><span>{assignment.assignedBy ? `Assigned by ${assignment.assignedBy.name}` : "Assigned by system"}</span><span>{formatDate(assignment.assignedAt)} – {assignment.unassignedAt ? formatDate(assignment.unassignedAt) : "Current owner"}</span></div></li>)}</ol> : <p className="muted">This ticket has not been assigned.</p>}</details></section>;
}
