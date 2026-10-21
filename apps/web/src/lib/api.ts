import type { Session, SessionUser } from "@supportpilot/types";
export type { Session, SessionUser } from "@supportpilot/types";
const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/+$/, "");
const SESSION_KEY = "supportpilot.session";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(SESSION_KEY) ?? "null",
    );
    if (
      !value ||
      typeof value !== "object" ||
      !("accessToken" in value) ||
      !("refreshToken" in value) ||
      !("user" in value)
    )
      return null;
    if (
      typeof value.accessToken !== "string" ||
      typeof value.refreshToken !== "string" ||
      !value.user ||
      typeof value.user !== "object"
    )
      return null;
    const user = value.user;
    if (
      !("id" in user) ||
      typeof user.id !== "string" ||
      !("name" in user) ||
      typeof user.name !== "string" ||
      !("email" in user) ||
      typeof user.email !== "string" ||
      !("role" in user) ||
      !["CUSTOMER", "SUPPORT_AGENT", "ADMIN"].includes(String(user.role))
    )
      return null;
    return value as Session;
  } catch {
    return null;
  }
}
export function saveSession(session: Session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("supportpilot:session-ended"));
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string; code?: string; details?: unknown };
  } | null;
  if (!response.ok) {
    const fieldErrors: Record<string, string[]> = {};
    const details = body?.error?.details;
    if (details && typeof details === "object") {
      for (const [field, messages] of Object.entries(details)) {
        if (Array.isArray(messages) && messages.every(message => typeof message === "string"))
          fieldErrors[field] = messages;
      }
    }
    throw new ApiError(
      body?.error?.message ?? "The service could not complete this request.",
      response.status,
      body?.error?.code ?? "REQUEST_FAILED",
      fieldErrors,
    );
  }
  return body as T;
}
async function publicRequest<T>(path: string, body: unknown): Promise<T> {
  return parseResponse<T>(
    await fetch(API_BASE + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    }),
  );
}
export function login(email: string, password: string) {
  return publicRequest<Session>("/auth/login", { email, password });
}
export function register(name: string, email: string, password: string) {
  return publicRequest<Session>("/auth/register", { name, email, password });
}
let refreshing: Promise<Session> | null = null;
async function refreshSession() {
  if (refreshing) return refreshing;
  const current = loadSession();
  if (!current)
    throw new ApiError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  refreshing = publicRequest<{ accessToken: string; refreshToken: string }>(
    "/auth/refresh",
    { refreshToken: current.refreshToken },
  )
    .then((tokens) => {
      // A late response must not sign a user back in after logout/account change.
      const latest = loadSession();
      if (!latest || latest.refreshToken !== current.refreshToken)
        throw new ApiError(
          "Session changed. Please sign in again.",
          401,
          "SESSION_CHANGED",
        );
      const next = { ...current, ...tokens };
      saveSession(next);
      return next;
    })
    .catch((error) => {
      if (error instanceof ApiError && error.status === 401) clearSession();
      throw error;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = loadSession();
  if (!session)
    throw new ApiError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  const request = (accessToken: string) => {
    const headers = new Headers(init.headers);
    headers.set("authorization", "Bearer " + accessToken);
    if (init.body) headers.set("content-type", "application/json");
    return fetch(API_BASE + path, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(20000),
    });
  };
  let response = await request(session.accessToken);
  if (response.status === 401) {
    const latest = loadSession();
    const fresh =
      latest && latest.accessToken !== session.accessToken
        ? latest
        : await refreshSession();
    response = await request(fresh.accessToken);
    if (response.status === 401) clearSession();
  }
  try {
    return await parseResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError && error.code === "ACCOUNT_NOT_ACTIVE")
      clearSession();
    throw error;
  }
}
export async function logout() {
  const session = loadSession();
  try {
    if (session)
      await publicRequest<void>("/auth/logout", {
        refreshToken: session.refreshToken,
      });
  } finally {
    clearSession();
  }
}
export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  )
    return "The request timed out. Please try again.";
  return "Could not connect to SupportPilot. Check that the API is running, then retry.";
}
export function homeFor(user: SessionUser) {
  return user.role === "CUSTOMER" ? "/customer/tickets" : "/dashboard";
}
