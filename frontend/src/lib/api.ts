/**
 * Thin fetch wrapper for the POS backend API.
 *
 * Auth model:
 * - Login/refresh set an httponly refresh-token cookie (handled entirely by
 *   the browser; we never read it from JS).
 * - We hold the short-lived access token in memory + localStorage and send
 *   it as `Authorization: Bearer <token>` on every request.
 * - On a 401, we try one silent refresh (via the cookie) and retry once.
 */

// `??` (not `||`) so an explicitly empty string means "same origin" (used
// behind the local HTTPS proxy), while an unset var keeps the localhost default.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_STORAGE_KEY = "pos.access_token";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== "undefined") {
    accessToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: Record<string, string>;
  skipAuth?: boolean;
  /** Set true only for the login/refresh/logout calls that need the refresh cookie. */
  withCredentials?: boolean;
}

async function rawRequest(path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (options.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(options.form).toString();
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  if (!options.skipAuth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  return fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body,
    credentials: options.withCredentials ? "include" : "same-origin",
  });
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await rawRequest("/api/access/refresh", {
      method: "POST",
      skipAuth: true,
      withCredentials: true,
    });
    if (!res.ok) return false;
    const data = await res.json();
    const token = data.access_token || data.accessToken;
    if (!token) return false;
    setAccessToken(token);
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await rawRequest(path, options);

  if (res.status === 401 && !options.skipAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawRequest(path, options);
    }
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || data.message || detail;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};

export async function login(username: string, password: string): Promise<string> {
  const res = await rawRequest("/api/access/login", {
    method: "POST",
    form: { username, password },
    skipAuth: true,
    withCredentials: true,
  });
  if (!res.ok) {
    let detail = "Invalid email or password.";
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail);
  }
  const data = await res.json();
  if (data.mfaRequired || data.mfa_required) {
    throw new ApiError(401, "This account requires MFA, which isn't supported by this frontend yet.");
  }
  const token = data.access_token || data.accessToken;
  setAccessToken(token);
  return token;
}

export async function logout(): Promise<void> {
  try {
    await rawRequest("/api/access/logout", { method: "POST", skipAuth: true, withCredentials: true });
  } finally {
    setAccessToken(null);
  }
}

export async function signup(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<void> {
  await apiFetch("/api/access/signup", { method: "POST", body: input, skipAuth: true });
}
