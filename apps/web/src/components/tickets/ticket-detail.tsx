"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  type Assignment,
  type Person,
  type SlaSnapshot,
  type TicketDetail as TicketData,
  type TicketMessage,
  type TicketStatus,
  type TicketPriority,
  type TicketCategory,
  type TimelineItem,
} from "@supportpilot/types";
import { api, errorMessage } from "../../lib/api";
import { formatDate, label } from "../../lib/format";
import { Badge, ErrorState, Loading } from "../ui/states";
import { SlaCard } from "../sla/sla-card";
import { AiPanel } from "../ai/ai-panel";
import { Conversation } from "./conversation";
import { TicketActivity } from "./ticket-activity";
import { TicketProperties } from "./ticket-properties";

type DetailState = {
  ticket: TicketData;
  messages: TicketMessage[];
  sla: SlaSnapshot;
  agents: Person[];
  timeline: TimelineItem[];
  assignments: Assignment[];
};
export function TicketDetail({
  id,
  customer = false,
}: {
  id: string;
  customer?: boolean;
}) {
  const [data, setData] = useState<DetailState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<string | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    const get = <T,>(path: string) =>
      api<T>(path, { signal: controller.signal });
    void Promise.all([
      get<TicketData>(`/tickets/${id}`),
      get<TicketMessage[]>(`/tickets/${id}/messages`),
      get<SlaSnapshot>(`/sla/tickets/${id}`),
      customer ? Promise.resolve([]) : get<Person[]>("/users/support-agents"),
      customer
        ? Promise.resolve([])
        : get<TimelineItem[]>(`/tickets/${id}/timeline`),
      customer
        ? Promise.resolve([])
        : get<Assignment[]>(`/tickets/${id}/assignments`),
    ])
      .then(([ticket, messages, sla, agents, timeline, assignments]) => {
        if (!controller.signal.aborted)
          setData({ ticket, messages, sla, agents, timeline, assignments });
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [id, customer, revision]);
  async function mutate(
    path: string,
    method: string,
    body: unknown,
    message: string,
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(path, { method, body: JSON.stringify(body) });
      setNotice(message);
      setRevision((v) => v + 1);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function update(fields: {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
  }) {
    await mutate(
      `/tickets/${id}`,
      "PATCH",
      fields,
      "Ticket updated. The change has been recorded in its history.",
    );
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      await mutate(
        `/tickets/${id}/messages`,
        "POST",
        { body: reply, isInternal: !customer && internal },
        internal ? "Internal note added." : "Reply sent.",
      )
    )
      setReply("");
  }
  function useDraft(text: string) {
    if (reply.trim()) {
      setPendingDraft(text);
      return;
    }
    setReply(text);
    setInternal(false);
    editor.current?.focus();
    editor.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setNotice("Draft added to the reply editor. Review it before sending.");
  }
  const back = customer ? "/customer/tickets" : "/dashboard";
  if (!data)
    return (
      <>
        <Link className="back-link" href={back}>
          ← All tickets
        </Link>
        {error ? (
          <ErrorState message={error} retry={() => setRevision((v) => v + 1)} />
        ) : (
          <Loading text="Loading ticket and conversation" />
        )}
      </>
    );
  const { ticket, messages, sla, agents, timeline, assignments } = data;
  return (
    <>
      <div className="detail-topline">
        <Link className="back-link" href={back}>
          ← {customer ? "Your requests" : "Support queue"}
        </Link>
        <button
          className="button button-small"
          onClick={() => setRevision((v) => v + 1)}
          disabled={busy}
        >
          Refresh ticket
        </button>
      </div>
      <header className="ticket-detail-heading">
        <p className="eyebrow">
          SP-{ticket.ticketNumber} <span>·</span> {label(ticket.category)}
        </p>
        <h1>{ticket.subject}</h1>
        <div className="ticket-meta">
          <Badge value={ticket.status} />
          <Badge value={ticket.priority} />
          <span>Opened {formatDate(ticket.createdAt)}</span>
        </div>
      </header>
      {error && (
        <ErrorState message={error} retry={() => setRevision((v) => v + 1)} />
      )}
      {notice && (
        <p className="notice notice-success" role="status">
          {notice}
        </p>
      )}
      <div className="ticket-detail-grid">
        <div className="ticket-main-column">
          <section className="panel request-description">
            <div className="panel-heading">
              <h2>Original request</h2>
              <span className="muted">{ticket.customer.name}</span>
            </div>
            <p className="message-body">{ticket.description}</p>
          </section>
          <div className="section-heading">
            <h2>Conversation</h2>
            <span>
              {messages.length} {messages.length === 1 ? "message" : "messages"}
            </span>
          </div>
          <Conversation messages={messages} />
          <form
            className={`panel composer ${internal && !customer ? "composer-internal" : ""}`}
            onSubmit={send}
          >
            <div className="composer-header">
              <h2>
                {internal && !customer ? "Internal note" : "Public reply"}
              </h2>
              {!customer && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                    disabled={busy}
                  />
                  Staff only
                </label>
              )}
            </div>
            <label className="sr-only" htmlFor="reply-body">
              {internal ? "Internal note" : "Reply"}
            </label>
            <textarea
              disabled={busy}
              ref={editor}
              id="reply-body"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              minLength={1}
              maxLength={10000}
              rows={5}
              required
              placeholder={
                internal ? "Add context for your teammates…" : "Write a reply…"
              }
            />
            {pendingDraft && (
              <div className="notice">
                <p>You have an unsent reply. Replace it with the AI draft?</p>
                <button
                  type="button"
                  className="button button-small"
                  onClick={() => {
                    setReply(pendingDraft);
                    setPendingDraft(null);
                    setInternal(false);
                    editor.current?.focus();
                  }}
                >
                  Replace draft
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setPendingDraft(null)}
                >
                  Keep my reply
                </button>
              </div>
            )}
            <div className="composer-footer">
              <span className="field-help">
                {internal && !customer
                  ? "Visible to support staff. Does not count as a customer response."
                  : "Visible to the customer and support team."}
              </span>
              <button
                className="button button-primary"
                disabled={busy || !reply.trim()}
              >
                {busy
                  ? "Saving…"
                  : internal && !customer
                    ? "Add note"
                    : "Send reply"}
              </button>
            </div>
          </form>
          {!customer && <TicketActivity timeline={timeline} assignments={assignments} />}
        </div>
        <aside className="ticket-side-column">
          {!customer && <TicketProperties ticket={ticket} agents={agents} busy={busy} onUpdate={update} onAssign={agentId => void mutate(`/tickets/${id}/assignment`, "PUT", { agentId }, "Assignment updated.")} />}
          <SlaCard snapshot={sla} />
          <section className="panel detail-card">
            <h2>{customer ? "Support contact" : "Customer context"}</h2>
            <strong>
              {customer
                ? (ticket.assignedAgent?.name ?? "Support team")
                : ticket.customer.name}
            </strong>
            {!customer && (
              <p className="muted wrap-text">{ticket.customer.email}</p>
            )}
            <p className="field-help">
              {ticket.team?.name ?? "Customer support"}
            </p>
          </section>
          {!customer && (
            <AiPanel
              ticketId={id}
              busy={busy}
              onApply={update}
              onDraft={useDraft}
            />
          )}
        </aside>
      </div>
    </>
  );
}
