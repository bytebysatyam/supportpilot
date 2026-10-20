"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TicketDetail } from "@supportpilot/types";
import { api, errorMessage } from "../../lib/api";
import { ErrorState, PageHeader } from "../ui/states";

export function NewTicket() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const ticket = await api<TicketDetail>("/tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: form.get("subject"),
          description: form.get("description"),
        }),
      });
      router.push(`/customer/tickets/${ticket.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" href="/customer/tickets">
        ← All requests
      </Link>
      <PageHeader
        eyebrow="Customer support"
        title="How can we help?"
        description="Share what happened and what you were trying to do. Our team will follow up here."
      />
      <div className="new-ticket-layout">
        <form className="panel form-stack request-form" onSubmit={submit}>
          <label>
            Subject
            <input
              name="subject"
              required
              minLength={4}
              maxLength={160}
              placeholder="A short description of the issue"
            />
          </label>
          <label>
            What happened?
            <textarea
              name="description"
              rows={9}
              required
              minLength={10}
              maxLength={10000}
              placeholder="Include relevant steps, error messages, and when the issue started."
              aria-describedby="request-help"
            />
          </label>
          <p id="request-help" className="field-help">
            Please leave out passwords, authentication codes, and payment card
            details.
          </p>
          {error && <ErrorState message={error} />}
          <div className="form-actions">
            <Link className="button" href="/customer/tickets">
              Cancel
            </Link>
            <button className="button button-primary" disabled={busy}>
              {busy ? "Creating request…" : "Create request"}
            </button>
          </div>
        </form>
        <aside className="request-aside">
          <h3>What happens next</h3>
          <ol>
            <li>Your request joins our support queue.</li>
            <li>A support agent reviews the details.</li>
            <li>Replies and updates appear in your ticket.</li>
          </ol>
          <p className="muted">
            Response and resolution targets are shown once your request is
            created.
          </p>
        </aside>
      </div>
    </>
  );
}
