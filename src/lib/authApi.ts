// Calls to the new backend's auth endpoints (Better Auth at /api/v1/auth/*) and the users module.
import { ApiError, api } from "./api";

export type Role = "admin" | "ops" | "agent" | "guest";

/** Only emails at this domain can sign up. The backend enforces it (AUTH_ALLOWED_DOMAINS);
 *  the frontend checks first so people get an instant message. */
export const ALLOWED_EMAIL_DOMAIN = (
  (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN as string | undefined) || "linchpinglobal.net"
)
  .trim()
  .toLowerCase();

export function isAllowedSignupEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

export interface HubUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: "active" | "removed";
  emailVerified: boolean;
  phone: string | null;
  title: string | null;
  licenseNo: string | null;
  bio: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

const post = <T>(path: string, body: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(body) });
const norm = (email: string) => email.trim().toLowerCase();

export const authApi = {
  /** Current session, or null when signed out. */
  getSession: () => api<{ user: { id: string; email: string; name: string } } | null>("/auth/get-session"),

  signIn: (email: string, password: string) => post("/auth/sign-in/email", { email: norm(email), password }),
  signUp: (name: string, email: string, password: string) =>
    post("/auth/sign-up/email", { name: name.trim(), email: norm(email), password }),
  signOut: () => post("/auth/sign-out", {}),

  /** Sends a 6-digit code. type: confirm a new account, or sign in by code. */
  sendCode: (email: string, type: "email-verification" | "sign-in") =>
    post("/auth/email-otp/send-verification-otp", { email: norm(email), type }),
  verifyEmail: (email: string, otp: string) => post("/auth/email-otp/verify-email", { email: norm(email), otp: otp.trim() }),

  requestPasswordReset: (email: string) => post("/auth/email-otp/request-password-reset", { email: norm(email) }),
  /** Checks a reset code without using it up (the same code is then used by resetPassword). */
  checkResetCode: (email: string, otp: string) =>
    post("/auth/email-otp/check-verification-otp", { email: norm(email), type: "forget-password", otp: otp.trim() }),
  resetPassword: (email: string, otp: string, password: string) =>
    post("/auth/email-otp/reset-password", { email: norm(email), otp: otp.trim(), password }),

  me: () => api<HubUser>("/users/me"),
};

export interface ProfilePatch {
  name?: string;
  phone?: string | null;
  title?: string | null;
  licenseNo?: string | null;
  bio?: string | null;
}

export interface Invitation {
  email: string;
  role: Role;
  invitedBy: string;
  note: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const send = <T>(method: "PATCH" | "DELETE", path: string, body?: unknown) =>
  api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

/** Profile (any signed-in user) and team management (admins) on the new backend. */
export const usersApi = {
  updateMe: (patch: ProfilePatch) => send<HubUser>("PATCH", "/users/me", patch),

  list: (filter: { role?: Role; status?: "active" | "removed" } = {}) => {
    const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]).toString();
    return api<{ items: HubUser[] }>(`/users${q ? `?${q}` : ""}`);
  },
  update: (id: string, patch: ProfilePatch & { role?: Role; status?: "active" | "removed" }) =>
    send<HubUser>("PATCH", `/users/${encodeURIComponent(id)}`, patch),

  listInvitations: () => api<{ items: Invitation[] }>("/users/invitations"),
  invite: (email: string, role: Role, note?: string) =>
    post<Invitation>("/users/invitations", { email: norm(email), role, ...(note ? { note } : {}) }),
  revokeInvitation: (email: string) => send<Invitation>("DELETE", `/users/invitations/${encodeURIComponent(norm(email))}`),
};

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", ops: "Operations", agent: "Agent", guest: "Guest" };

/** Plain-English message for an auth error (falls back to the server's own message). */
export function authErrorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!(e instanceof ApiError)) return "Can't reach the server. Check your connection and try again.";
  switch (e.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Wrong email or password. Tap Forgot password if you're not sure.";
    case "EMAIL_NOT_VERIFIED":
      return "Please confirm your email first. We've sent you a new code.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "There's already an account with this email. Sign in instead.";
    case "INVALID_OTP":
    case "OTP_EXPIRED":
      return "That code is wrong or has expired. Request a new one.";
    case "TOO_MANY_ATTEMPTS":
      return "Too many tries with this code. Request a new one.";
    case "PASSWORD_TOO_SHORT":
      return "Your password must be at least 8 characters.";
    case "PASSWORD_TOO_LONG":
      return "Your password is too long (128 characters max).";
    case "PASSWORD_REUSED":
      return "Your new password must be different from your current password.";
    case "USER_NOT_FOUND":
      return "There's no account with this email.";
    default:
      if (e.status === 429) return "Too many attempts. Wait a minute and try again.";
      return e.message || fallback;
  }
}
