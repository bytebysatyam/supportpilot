"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  errorMessage,
  homeFor,
  loadSession,
  login,
  register,
  saveSession,
} from "../../lib/api";
import { ErrorState } from "../ui/states";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [offlineLogout, setOfflineLogout] = useState(false);
  const registering = mode === "register";
  useEffect(() => {
    const current = loadSession();
    if (current) router.replace(homeFor(current.user));
    setOfflineLogout(
      new URLSearchParams(window.location.search).get("logout") === "offline",
    );
  }, [router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setBusy(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const email = String(data.get("email"));
      const password = String(data.get("password"));
      const session = registering
        ? await register(String(data.get("name")), email, password)
        : await login(email, password);
      saveSession(session);
      router.replace(homeFor(session.user));
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR" &&
          ["name", "email", "password"].some(field => err.fieldErrors[field]?.length)) {
        setFieldErrors(err.fieldErrors);
        setError("Please correct the highlighted fields.");
        const field = ["name", "email", "password"].find(key => err.fieldErrors[key]?.length);
        const input = field ? form.elements.namedItem(field) : null;
        if (input instanceof HTMLElement) input.focus();
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link href="/login" className="brand">
          <span className="brand-mark">S</span>SupportPilot
        </Link>
        <div className="auth-story-content">
          <span className="eyebrow">A shared place for better support</span>
          <h1>
            Every request.
            <br />A clear next step.
          </h1>
          <p>
            Keep conversations, ownership, and response deadlines together —
            from the first question to the final resolution.
          </p>
          <div className="story-features">
            <div>
              <span>01</span>
              <strong>Conversations with context</strong>
              <p>One ticket, one history. No lost handoffs.</p>
            </div>
            <div>
              <span>02</span>
              <strong>People in control</strong>
              <p>AI recommendations stay in human hands.</p>
            </div>
            <div>
              <span>03</span>
              <strong>Follow through</strong>
              <p>See progress and deadlines at a glance.</p>
            </div>
          </div>
        </div>
        <p className="auth-footer">Customer support, thoughtfully organized.</p>
      </section>
      <section className="auth-form-panel">
        <div className="auth-card">
          <p className="eyebrow">
            {registering ? "Customer account" : "Welcome back"}
          </p>
          <h2>
            {registering
              ? "Get the support you need"
              : "Sign in to your workspace"}
          </h2>
          <p className="muted">
            {registering
              ? "Create an account to open requests and follow their progress."
              : "Customers, agents, and administrators sign in here."}
          </p>
          {offlineLogout && (
            <p className="notice" role="status">
              Signed out on this device. The server could not confirm token
              revocation; the token will expire normally.
            </p>
          )}
          <form className="form-stack" onSubmit={submit}>
            {registering && (
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  required
                  placeholder="Your name"
                  aria-invalid={Boolean(fieldErrors.name?.length)}
                  aria-describedby={fieldErrors.name?.length ? "name-error" : undefined}
                />
              </label>
            )}
            {registering && fieldErrors.name?.length ? (
              <p id="name-error" className="field-help">{fieldErrors.name.join(" ")}</p>
            ) : null}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                aria-invalid={Boolean(fieldErrors.email?.length)}
                aria-describedby={fieldErrors.email?.length ? "email-error" : undefined}
              />
            </label>
            {fieldErrors.email?.length ? (
              <p id="email-error" className="field-help">{fieldErrors.email.join(" ")}</p>
            ) : null}
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={registering ? "new-password" : "current-password"}
                minLength={registering ? 8 : 1}
                maxLength={72}
                required
                aria-invalid={Boolean(fieldErrors.password?.length)}
                aria-describedby={[
                  registering ? "password-help" : "",
                  fieldErrors.password?.length ? "password-error" : "",
                ].filter(Boolean).join(" ") || undefined}
              />
            </label>
            {fieldErrors.password?.length ? (
              <p id="password-error" className="field-help">{fieldErrors.password.join(" ")}</p>
            ) : null}
            {registering && (
              <p id="password-help" className="field-help">
                Use 8 or more characters, including uppercase, lowercase, and a
                number. Maximum 72 UTF-8 bytes.
              </p>
            )}
            {error && <ErrorState message={error} />}
            <button
              className="button button-primary button-full"
              disabled={busy}
            >
              {busy
                ? "Please wait…"
                : registering
                  ? "Create customer account"
                  : "Sign in"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="auth-switch">
            {registering
              ? "Already have an account?"
              : "Need help from support?"}{" "}
            <Link href={registering ? "/login" : "/register"}>
              {registering ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className="field-help auth-security">
            Staff access is provisioned by an administrator. Public accounts are
            always customer accounts.
          </p>
        </div>
      </section>
    </main>
  );
}
