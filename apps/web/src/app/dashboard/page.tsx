"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  clearSession,
  loadSession,
  logout,
  type Session,
} from "../../lib/api";

type Ticket = {
  id: string;
  ticketNumber: number;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; email: string };
  assignedAgent: { id: string; name: string; email: string } | null;
  firstResponseDueAt?: string | null;
  firstRespondedAt?: string | null;
  resolutionDueAt?: string | null;
  resolvedAt?: string | null;
};

type TicketList = {
  items: Ticket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type Agent = {
  id: string;
  name: string;
  email: string;
};

type TimelineItem =
  | {
      type: "MESSAGE";
      occurredAt: string;
      data: {
        id: string;
        body: string;
        isInternal: boolean;
        authorType: string;
        author: { id: string; name: string; role: string } | null;
      };
    }
  | {
      type: "AUDIT";
      occurredAt: string;
      data: {
        id: string;
        action: string;
        metadata: unknown;
        actor: { id: string; name: string; role: string } | null;
      };
    };

type SlaSnapshot = {
  firstResponse: {
    dueAt: string | null;
    respondedAt: string | null;
    met: boolean;
    breached: boolean;
    atRisk: boolean;
  };
  resolution: {
    dueAt: string | null;
    resolvedAt: string | null;
    met: boolean;
    breached: boolean;
    atRisk: boolean;
  };
};

type AiAnalysis = {
  id: string;
  type: string;
  status: string;
  provider: string | null;
  model: string | null;
  result: unknown;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

const statuses = [
  "",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CUSTOMER",
  "RESOLVED",
  "CLOSED",
];

const priorities = ["", "LOW", "MEDIUM", "HIGH", "URGENT"];
const categories = [
  "",
  "GENERAL",
  "BILLING",
  "TECHNICAL",
  "ACCOUNT",
  "PRODUCT",
  "FEATURE_REQUEST",
  "OTHER",
];

function nice(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function slaClass(item?: { breached: boolean; atRisk: boolean; met: boolean }) {
  if (!item) return "";
  if (item.breached) return "danger";
  if (item.atRisk) return "warning";
  if (item.met) return "success";
  return "";
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [sla, setSla] = useState<SlaSnapshot | null>(null);
  const [analyses, setAnalyses] = useState<AiAnalysis[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const counts = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter((ticket) => ticket.status === "OPEN").length,
      active: tickets.filter((ticket) =>
        ["IN_PROGRESS", "WAITING_ON_CUSTOMER"].includes(ticket.status),
      ).length,
      urgent: tickets.filter((ticket) => ticket.priority === "URGENT").length,
    };
  }, [tickets]);

  useEffect(() => {
    const current = loadSession();

    if (!current || current.user.role === "CUSTOMER") {
      clearSession();
      router.replace("/");
      return;
    }

    setSession(current);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    void loadTickets();
    void loadAgents();
  }, [session, status, priority, category]);

  useEffect(() => {
    if (!session || !selectedId) return;
    void loadDetail(selectedId);
  }, [session, selectedId]);

  async function loadTickets() {
    setLoading(true);
    setNotice("");

    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (category) params.set("category", category);
      if (search.trim()) params.set("search", search.trim());

      const result = await api<TicketList>(`/tickets?${params.toString()}`);
      setTickets(result.items);

      if (!selectedId && result.items[0]) {
        setSelectedId(result.items[0].id);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load tickets.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAgents() {
    try {
      setAgents(await api<Agent[]>("/users/support-agents"));
    } catch {
      setAgents([]);
    }
  }

  async function loadDetail(ticketId: string) {
    setDetailLoading(true);

    try {
      const [ticket, ticketTimeline, ticketSla, ticketAnalyses] =
        await Promise.all([
          api<Ticket>(`/tickets/${ticketId}`),
          api<TimelineItem[]>(`/tickets/${ticketId}/timeline`),
          api<SlaSnapshot>(`/sla/tickets/${ticketId}`),
          api<AiAnalysis[]>(`/ai/tickets/${ticketId}/analyses`),
        ]);

      setSelected(ticket);
      setTimeline(ticketTimeline);
      setSla(ticketSla);
      setAnalyses(ticketAnalyses);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load ticket.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function updateTicket(data: Record<string, string>) {
    if (!selectedId) return;

    await api<Ticket>(`/tickets/${selectedId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });

    await Promise.all([loadTickets(), loadDetail(selectedId)]);
  }

  async function assign(agentId: string) {
    if (!selectedId) return;

    await api<Ticket>(`/tickets/${selectedId}/assignment`, {
      method: "PUT",
      body: JSON.stringify({ agentId: agentId || null }),
    });

    await Promise.all([loadTickets(), loadDetail(selectedId)]);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !reply.trim()) return;

    await api(`/tickets/${selectedId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        body: reply.trim(),
        isInternal: internal,
      }),
    });

    setReply("");
    setInternal(false);
    await loadDetail(selectedId);
  }

  async function runAi(type: string) {
    if (!selectedId) return;

    setNotice("AI analysis queued.");

    await api(`/ai/tickets/${selectedId}/analyze`, {
      method: "POST",
      body: JSON.stringify({ type }),
    });

    window.setTimeout(() => {
      void loadDetail(selectedId);
    }, 1800);
  }

  async function signOut() {
    if (session) {
      await logout(session);
    }
    router.replace("/");
  }

  if (!session) {
    return <main className="loading-screen">Opening workspace…</main>;
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">SUPPORTPILOT</p>
          <h2 className="workspace-title">Operations</h2>
          <p className="muted small">Human-reviewed AI support workspace</p>
        </div>

        <nav className="side-nav" aria-label="Workspace">
          <span className="nav-item active">Ticket Queue</span>
          <span className="nav-item">SLA Monitor</span>
          <span className="nav-item">AI Analyses</span>
        </nav>

        <div className="profile-block">
          <strong>{session.user.name}</strong>
          <span>{nice(session.user.role)}</span>
          <button className="text-button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">LIVE WORKSPACE</p>
            <h1>Support queue</h1>
          </div>
          <button className="secondary-button" onClick={() => void loadTickets()}>
            Refresh
          </button>
        </header>

        <section className="metric-grid">
          <article className="metric-card">
            <span>Visible tickets</span>
            <strong>{counts.total}</strong>
          </article>
          <article className="metric-card">
            <span>Open</span>
            <strong>{counts.open}</strong>
          </article>
          <article className="metric-card">
            <span>Active work</span>
            <strong>{counts.active}</strong>
          </article>
          <article className="metric-card">
            <span>Urgent</span>
            <strong>{counts.urgent}</strong>
          </article>
        </section>

        <section className="filters">
          <form
            className="search-row"
            onSubmit={(event) => {
              event.preventDefault();
              void loadTickets();
            }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search subject or description"
            />
            <button className="secondary-button">Search</button>
          </form>

          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value ? nice(value) : "All statuses"}
              </option>
            ))}
          </select>

          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            {priorities.map((value) => (
              <option key={value} value={value}>
                {value ? nice(value) : "All priorities"}
              </option>
            ))}
          </select>

          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value ? nice(value) : "All categories"}
              </option>
            ))}
          </select>
        </section>

        {notice ? <p className="notice">{notice}</p> : null}

        <div className="workspace-grid">
          <section className="ticket-list panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">QUEUE</p>
                <h3>Tickets</h3>
              </div>
              <span className="muted small">{loading ? "Loading…" : `${tickets.length} shown`}</span>
            </div>

            <div className="ticket-stack">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  className={`ticket-row ${selectedId === ticket.id ? "selected" : ""}`}
                  onClick={() => setSelectedId(ticket.id)}
                >
                  <div className="ticket-row-top">
                    <span>#{ticket.ticketNumber}</span>
                    <span className={`badge priority-${ticket.priority.toLowerCase()}`}>
                      {nice(ticket.priority)}
                    </span>
                  </div>
                  <strong>{ticket.subject}</strong>
                  <span className="muted">{ticket.customer.name}</span>
                  <div className="ticket-row-bottom">
                    <span>{nice(ticket.status)}</span>
                    <span>{nice(ticket.category)}</span>
                  </div>
                </button>
              ))}

              {!loading && tickets.length === 0 ? (
                <div className="empty-state">
                  No tickets match the current filters.
                </div>
              ) : null}
            </div>
          </section>

          <section className="ticket-detail panel">
            {!selected || detailLoading ? (
              <div className="empty-state">
                {detailLoading ? "Loading ticket…" : "Select a ticket to inspect it."}
              </div>
            ) : (
              <>
                <div className="detail-header">
                  <div>
                    <p className="eyebrow">TICKET #{selected.ticketNumber}</p>
                    <h2>{selected.subject}</h2>
                    <p className="muted">
                      {selected.customer.name} · {selected.customer.email}
                    </p>
                  </div>
                  <span className={`badge priority-${selected.priority.toLowerCase()}`}>
                    {nice(selected.priority)}
                  </span>
                </div>

                <p className="ticket-description">{selected.description}</p>

                <div className="control-grid">
                  <label>
                    Status
                    <select
                      value={selected.status}
                      onChange={(event) => void updateTicket({ status: event.target.value })}
                    >
                      {statuses.filter(Boolean).map((value) => (
                        <option key={value} value={value}>
                          {nice(value)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Priority
                    <select
                      value={selected.priority}
                      onChange={(event) => void updateTicket({ priority: event.target.value })}
                    >
                      {priorities.filter(Boolean).map((value) => (
                        <option key={value} value={value}>
                          {nice(value)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Category
                    <select
                      value={selected.category}
                      onChange={(event) => void updateTicket({ category: event.target.value })}
                    >
                      {categories.filter(Boolean).map((value) => (
                        <option key={value} value={value}>
                          {nice(value)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Assignee
                    <select
                      value={selected.assignedAgent?.id ?? ""}
                      onChange={(event) => void assign(event.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <section className="sla-grid">
                  <article className={`sla-card ${slaClass(sla?.firstResponse)}`}>
                    <span>First response</span>
                    <strong>
                      {sla?.firstResponse.breached
                        ? "Breached"
                        : sla?.firstResponse.met
                          ? "Met"
                          : sla?.firstResponse.atRisk
                            ? "At risk"
                            : "Tracking"}
                    </strong>
                    <small>Due {formatDate(sla?.firstResponse.dueAt)}</small>
                  </article>

                  <article className={`sla-card ${slaClass(sla?.resolution)}`}>
                    <span>Resolution</span>
                    <strong>
                      {sla?.resolution.breached
                        ? "Breached"
                        : sla?.resolution.met
                          ? "Met"
                          : sla?.resolution.atRisk
                            ? "At risk"
                            : "Tracking"}
                    </strong>
                    <small>Due {formatDate(sla?.resolution.dueAt)}</small>
                  </article>
                </section>

                <section className="section-block">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">AI COPILOT</p>
                      <h3>Human-reviewed assistance</h3>
                    </div>
                  </div>

                  <div className="ai-actions">
                    <button onClick={() => void runAi("CLASSIFICATION")}>Classify</button>
                    <button onClick={() => void runAi("SUMMARY")}>Summarize</button>
                    <button onClick={() => void runAi("PRIORITY_SUGGESTION")}>Suggest priority</button>
                    <button onClick={() => void runAi("DRAFT_RESPONSE")}>Draft response</button>
                  </div>

                  <div className="analysis-stack">
                    {analyses.slice(0, 4).map((analysis) => (
                      <article className="analysis-card" key={analysis.id}>
                        <div>
                          <strong>{nice(analysis.type)}</strong>
                          <span className={`badge state-${analysis.status.toLowerCase()}`}>
                            {nice(analysis.status)}
                          </span>
                        </div>
                        {analysis.result ? (
                          <pre>{JSON.stringify(analysis.result, null, 2)}</pre>
                        ) : (
                          <p className="muted">
                            {analysis.errorMessage ?? "Waiting for worker…"}
                          </p>
                        )}
                      </article>
                    ))}
                    {analyses.length === 0 ? (
                      <p className="muted small">
                        No AI analysis has been requested for this ticket.
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="section-block">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">TIMELINE</p>
                      <h3>Conversation & activity</h3>
                    </div>
                  </div>

                  <div className="timeline">
                    {timeline.map((item) => (
                      <article className="timeline-item" key={`${item.type}-${item.data.id}`}>
                        <div className="timeline-marker" />
                        <div>
                          {item.type === "MESSAGE" ? (
                            <>
                              <div className="timeline-title">
                                <strong>{item.data.author?.name ?? item.data.authorType}</strong>
                                {item.data.isInternal ? (
                                  <span className="badge internal">Internal note</span>
                                ) : null}
                              </div>
                              <p>{item.data.body}</p>
                            </>
                          ) : (
                            <>
                              <div className="timeline-title">
                                <strong>{nice(item.data.action)}</strong>
                                <span className="muted small">
                                  {item.data.actor?.name ?? "System"}
                                </span>
                              </div>
                            </>
                          )}
                          <small className="muted">{formatDate(item.occurredAt)}</small>
                        </div>
                      </article>
                    ))}
                  </div>

                  <form className="reply-box" onSubmit={sendMessage}>
                    <textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder={internal ? "Add an internal note…" : "Reply to customer…"}
                      rows={4}
                    />
                    <div className="reply-actions">
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={internal}
                          onChange={(event) => setInternal(event.target.checked)}
                        />
                        Internal note
                      </label>
                      <button className="primary-button">
                        {internal ? "Add note" : "Send reply"}
                      </button>
                    </div>
                  </form>
                </section>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
