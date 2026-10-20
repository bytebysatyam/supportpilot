"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@supportpilot/types";
import {
  api,
  errorMessage,
  homeFor,
  loadSession,
  logout,
  saveSession,
} from "../../lib/api";
import { initials, label } from "../../lib/format";
import { ErrorState, Loading } from "../ui/states";

const UserContext = createContext<SessionUser | null>(null);
export function useUser() {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser requires AppShell");
  return user;
}

export function AppShell({
  audience,
  children,
}: {
  audience: "customer" | "staff";
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    let active = true;
    const ended = () => router.replace("/login");
    window.addEventListener("supportpilot:session-ended", ended);
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return () =>
        window.removeEventListener("supportpilot:session-ended", ended);
    }
    setError("");
    void api<SessionUser>("/auth/me")
      .then((current) => {
        if (!active) return;
        const latest = loadSession();
        if (latest) saveSession({ ...latest, user: current });
        if ((audience === "customer") !== (current.role === "CUSTOMER")) {
          router.replace(homeFor(current));
          return;
        }
        setUser(current);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      });
    return () => {
      active = false;
      window.removeEventListener("supportpilot:session-ended", ended);
    };
  }, [audience, retry, router]);

  async function signOut() {
    setSigningOut(true);
    try {
      await logout();
      router.replace("/login");
    } catch {
      router.replace("/login?logout=offline");
    }
  }
  if (!user)
    return (
      <main className="boot-screen">
        <Link href="/" className="brand">
          <span className="brand-mark">S</span>SupportPilot
        </Link>
        {error ? (
          <ErrorState message={error} retry={() => setRetry((v) => v + 1)} />
        ) : (
          <Loading text="Opening your workspace" />
        )}
      </main>
    );
  const customer = user.role === "CUSTOMER";
  const links = customer
    ? [
        { href: "/customer/tickets", name: "My tickets", symbol: "▤" },
        { href: "/customer/tickets/new", name: "New request", symbol: "+" },
      ]
    : [
        { href: "/dashboard", name: "Support queue", symbol: "▤" },
        ...(user.role === "ADMIN"
          ? [{ href: "/dashboard/team", name: "Team overview", symbol: "◎" }]
          : []),
      ];
  return (
    <UserContext.Provider value={user}>
      <div className="app-shell">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <aside className="sidebar">
          <Link href={homeFor(user)} className="brand">
            <span className="brand-mark">S</span>SupportPilot
          </Link>
          <div className="workspace-label">
            <span className="workspace-avatar">{customer ? "C" : "O"}</span>
            <div>
              <strong>{customer ? "Customer portal" : "Operations"}</strong>
              <span>
                {customer ? "Your support workspace" : "Customer support"}
              </span>
            </div>
          </div>
          <p className="nav-label">Workspace</p>
          <nav aria-label="Main navigation">
            {links.map((link) => {
              const active =
                pathname === link.href ||
                (link.href.endsWith("tickets") &&
                  pathname.includes("/tickets/") &&
                  !pathname.endsWith("/new"));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-item ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span aria-hidden="true">{link.symbol}</span>
                  {link.name}
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-note">
            <span className="status-dot green" />
            {customer
              ? "Conversations stay in one place."
              : "AI assists. Your team decides."}
          </div>
          <div className="user-menu">
            <span className="avatar">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <span>{label(user.role)}</span>
            </div>
            <button
              className="icon-button"
              onClick={signOut}
              disabled={signingOut}
              aria-label="Sign out"
              title="Sign out"
            >
              ↗
            </button>
          </div>
        </aside>
        <div className="app-main">
          <div className="topbar">
            <span>{customer ? "Support center" : "Support operations"}</span>
            <span className="topbar-detail">{user.email}</span>
          </div>
          <main id="main-content" className="page-content">
            {children}
          </main>
          <footer className="app-footer">
            SupportPilot <span>Clear conversations. Accountable support.</span>
          </footer>
        </div>
      </div>
    </UserContext.Provider>
  );
}
