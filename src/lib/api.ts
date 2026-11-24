// Client for the new Express backend (backend/).
//
// Requests are same-origin by default so auth cookies work. Vite proxies them locally
// and vercel.json proxies them on Vercel. Set VITE_API_URL to override the API origin.

const API_BASE = `${import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "") ?? ""}/api/v1`;

/** The error shape every backend error uses. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, details?: unknown, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    credentials: "include", // auth cookies, once authentication is in place
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) {
    // Our API: { error: { code, message, details, requestId } }. Better Auth (/auth/*): { code, message }.
    const b = body as
      | { error?: { code?: string; message?: string; details?: unknown; requestId?: string }; code?: string; message?: string }
      | undefined;
    const e = b?.error;
    throw new ApiError(
      res.status,
      e?.code ?? b?.code ?? "http_error",
      e?.message ?? b?.message ?? `Request failed (${res.status})`,
      e?.details,
      e?.requestId ?? res.headers.get("x-request-id") ?? undefined,
    );
  }
  return body as T;
}

export type HealthCheck = { state: "ok" | "not_configured" | "error"; ms?: number };
export type Health = {
  status: "ok" | "degraded";
  environment: string;
  checks: { database: HealthCheck; storage: HealthCheck & { bucket: string }; auth: HealthCheck; mail: HealthCheck };
};

/** Connection test: `await checkApiHealth()` in the browser console during development. */
export const checkApiHealth = () => api<Health>("/health");

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { checkApiHealth: typeof checkApiHealth }).checkApiHealth = checkApiHealth;
}
