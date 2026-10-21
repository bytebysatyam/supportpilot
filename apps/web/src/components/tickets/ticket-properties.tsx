import {
  STATUS_TRANSITIONS,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  type Person,
  type TicketDetail,
  type TicketStatus,
  type TicketPriority,
  type TicketCategory,
} from "@supportpilot/types";
import { label } from "../../lib/format";

export type TicketUpdate = {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
};
export function TicketProperties({
  ticket,
  agents,
  busy,
  onUpdate,
  onAssign,
}: {
  ticket: TicketDetail;
  agents: Person[];
  busy: boolean;
  onUpdate: (value: TicketUpdate) => Promise<void>;
  onAssign: (agentId: string | null) => void;
}) {
  return (
    <section className="panel detail-card">
      <h2>Ticket properties</h2>
      <div className="form-stack compact-form">
        <label>
          Status
          <select
            disabled={busy}
            value={ticket.status}
            onChange={(e) =>
              void onUpdate({ status: e.target.value as TicketStatus })
            }
          >
            <option value={ticket.status}>{label(ticket.status)}</option>
            {STATUS_TRANSITIONS[ticket.status].map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select
            disabled={busy}
            value={ticket.priority}
            onChange={(e) =>
              void onUpdate({ priority: e.target.value as TicketPriority })
            }
          >
            {TICKET_PRIORITIES.map((priority) => (
              <option value={priority} key={priority}>
                {label(priority)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            disabled={busy}
            value={ticket.category}
            onChange={(e) =>
              void onUpdate({ category: e.target.value as TicketCategory })
            }
          >
            {TICKET_CATEGORIES.map((category) => (
              <option value={category} key={category}>
                {label(category)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assigned agent
          <select
            disabled={busy}
            value={ticket.assignedAgent?.id ?? ""}
            onChange={(e) => onAssign(e.target.value || null)}
          >
            <option value="">Unassigned</option>
            {ticket.assignedAgent &&
              !agents.some(
                (agent) => agent.id === ticket.assignedAgent!.id,
              ) && (
                <option disabled value={ticket.assignedAgent.id}>
                  {ticket.assignedAgent.name} (unavailable)
                </option>
              )}
            {agents.map((agent) => (
              <option value={agent.id} key={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
