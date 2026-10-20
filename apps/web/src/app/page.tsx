"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadSession,
  login,
  saveSession,
} from "../lib/api";

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (session?.accessToken) {
      router.replace("/dashboard");
    }
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const session = await login(email, password);

      if (session.user.role === "CUSTOMER") {
        setError(
          "This dashboard is for support agents and administrators. Customer workspace will be added separately.",
        );
        return;
      }

      saveSession(session);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <div>
          <p className="eyebrow">SUPPORTPILOT</p>
          <h1>Support operations, with AI in the loop.</h1>
          <p className="lead">
            A production-style ticket workspace with RBAC, SLA tracking,
            auditable workflows and human-reviewed AI assistance.
          </p>
        </div>

        <div className="feature-row">
          <span>Ticket operations</span>
          <span>SLA visibility</span>
          <span>AI assistance</span>
        </div>
      </section>

      <section className="auth-card">
        <div>
          <p className="eyebrow">AGENT WORKSPACE</p>
          <h2>Sign in</h2>
          <p className="muted">
            Use a Support Agent or Admin account.
          </p>
        </div>

        <form onSubmit={onSubmit} className="form-stack">
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="agent@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {error ? <p className="error-box">{error}</p> : null}

          <button className="primary-button" disabled={submitting}>
            {submitting ? "Signing in..." : "Open dashboard"}
          </button>
        </form>
      </section>
    </main>
  );
}
