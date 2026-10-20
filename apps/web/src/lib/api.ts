const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SUPPORT_AGENT" | "CUSTOMER";
};

export type Session = {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
};

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;

  const raw = sessionStorage.getItem("supportpilot.session");
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Session;
  } catch {
    sessionStorage.removeItem("supportpilot.session");
    return null;
  }
}

export function saveSession(session: Session) {
  sessionStorage.setItem("supportpilot.session", JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem("supportpilot.session");
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const body = (await response.json()) as T & ApiErrorBody;

  if (!response.ok) {
    throw new Error(
      body.error?.message ??
        body.error?.code ??
        `Request failed with status ${response.status}`,
    );
  }

  return body;
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  return parseResponse<Session>(response);
}

export async function logout(session: Session) {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
  } finally {
    clearSession();
  }
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  session = loadSession(),
): Promise<T> {
  if (!session) throw new Error("Session expired. Please sign in again.");

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.accessToken}`,
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 401) {
    clearSession();
    throw new Error("Session expired. Please sign in again.");
  }

  return parseResponse<T>(response);
}
