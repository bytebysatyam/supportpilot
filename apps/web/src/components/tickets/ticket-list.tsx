"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  type TicketList as TicketListResponse,
} from "@supportpilot/types";
import { api, errorMessage } from "../../lib/api";
import { formatDate, label, initials } from "../../lib/format";
import { Badge, EmptyState, ErrorState, Loading } from "../ui/states";
import { useUser } from "../app-shell/app-shell";

export function TicketList({ customer = false }: { customer?: boolean }) {
  const user = useUser();
  const [data, setData] = useState<TicketListResponse | null>(null);
  const [query, setQuery] = useState({
    search: "",
    status: "",
    priority: "",
    category: "",
    assignedAgentId: "",
  });
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: "12" });
    Object.entries(query).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    void api<TicketListResponse>(`/tickets?${params}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(err));
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [query, page, revision]);
  function filter(key: keyof typeof query, value: string) {
    setPage(1);
    setQuery((current) => ({ ...current, [key]: value }));
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    filter(
      "search",
      String(new FormData(event.currentTarget).get("search")).trim(),
    );
  }
  return (
    <section
      className="panel queue-panel"
      aria-label={customer ? "Your support requests" : "Ticket queue"}
    >
      <div className="panel-heading">
        <div>
          <h2>{customer ? "Your requests" : "All tickets"}</h2>
          <p className="muted">
            {data
              ? `${data.pagination.total} ${customer ? "request" : "ticket"}${data.pagination.total === 1 ? "" : "s"}`
              : "Live ticket queue"}{" "}
            <span aria-hidden="true">·</span> Latest activity first
          </p>
        </div>
        <button
          className="button button-small"
          disabled={loading}
          onClick={() => setRevision((v) => v + 1)}
        >
          Refresh
        </button>
      </div>
      <div className="filter-bar">
        <form className="search-form" onSubmit={search}>
          <label className="sr-only" htmlFor="ticket-search">
            Search tickets
          </label>
          <input
            id="ticket-search"
            name="search"
            placeholder="Search subject or description…"
            maxLength={100}
            type="search"
          />
          <button className="button button-small">Search</button>
        </form>
        <label className="filter-label">
          <span className="sr-only">Filter by status</span>
          <select
            value={query.status}
            onChange={(e) => filter("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {TICKET_STATUSES.map((v) => (
              <option key={v} value={v}>
                {label(v)}
              </option>
            ))}
          </select>
        </label>
        {!customer && (
          <>
            <label className="filter-label">
              <span className="sr-only">Filter by priority</span>
              <select
                value={query.priority}
                onChange={(e) => filter("priority", e.target.value)}
              >
                <option value="">All priorities</option>
                {TICKET_PRIORITIES.map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-label">
              <span className="sr-only">Filter by category</span>
              <select
                value={query.category}
                onChange={(e) => filter("category", e.target.value)}
              >
                <option value="">All categories</option>
                {TICKET_CATEGORIES.map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={query.assignedAgentId === user.id}
                onChange={(e) =>
                  filter("assignedAgentId", e.target.checked ? user.id : "")
                }
              />
              Assigned to me
            </label>
          </>
        )}
      </div>
      {query.search && (
        <p className="search-summary">
          Results for “{query.search}”{" "}
          <button className="text-button" onClick={() => filter("search", "")}>
            Clear search
          </button>
        </p>
      )}
      {error ? (
        <ErrorState message={error} retry={() => setRevision((v) => v + 1)} />
      ) : loading ? (
        <Loading text="Loading tickets" />
      ) : !data?.items.length ? (
        <EmptyState title="No tickets here">
          {customer ? (
            <>
              Your requests will appear here.{" "}
              <Link href="/customer/tickets/new">Create a request</Link> to get
              started.
            </>
          ) : (
            "Try a different search or change the filters."
          )}
        </EmptyState>
      ) : (
        <>
          <div className={`ticket-table ${customer ? "customer-table" : ""}`}>
            <div className="ticket-table-heading" aria-hidden="true">
              <span>Ticket</span>
              <span>Status</span>
              {!customer && (
                <>
                  <span>Priority</span>
                  <span>Owner</span>
                </>
              )}
              <span>Updated</span>
            </div>
            {data.items.map((ticket) => (
              <Link
                className="ticket-row"
                key={ticket.id}
                href={`${customer ? "/customer/tickets" : "/dashboard/tickets"}/${ticket.id}`}
              >
                <div className="ticket-subject">
                  <span className="ticket-reference">
                    SP-{ticket.ticketNumber}
                  </span>
                  <strong>{ticket.subject}</strong>
                  <span className="muted">
                    {customer
                      ? label(ticket.category)
                      : `${ticket.customer.name} · ${label(ticket.category)}`}
                  </span>
                </div>
                <div>
                  <Badge value={ticket.status} />
                </div>
                {!customer && (
                  <>
                    <div>
                      <Badge value={ticket.priority} />
                    </div>
                    <div className="owner-cell">
                      {ticket.assignedAgent ? (
                        <>
                          <span className="avatar avatar-small">
                            {initials(ticket.assignedAgent.name)}
                          </span>
                          <span>{ticket.assignedAgent.name}</span>
                        </>
                      ) : (
                        <span className="muted">Unassigned</span>
                      )}
                    </div>
                  </>
                )}
                <time className="ticket-date" dateTime={ticket.updatedAt}>
                  {formatDate(ticket.updatedAt)}
                </time>
                <span className="row-chevron" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))}
          </div>
          <div className="pagination">
            <span>
              Page {data.pagination.page} of {data.pagination.totalPages}
            </span>
            <div>
              <button
                className="button button-small"
                disabled={page <= 1}
                onClick={() => setPage((v) => v - 1)}
              >
                Previous
              </button>
              <button
                className="button button-small"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((v) => v + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
