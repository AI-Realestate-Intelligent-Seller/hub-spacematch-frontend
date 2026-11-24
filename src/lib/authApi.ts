// Calls to the new backend's auth endpoints (Better Auth at /api/v1/auth/*) and the users module.
import { ApiError, api } from "./api";

export type Role = "admin" | "ops" | "agent" | "guest";

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
  resetPassword: (email: string, otp: string, password: string) =>
    post("/auth/email-otp/reset-password", { email: norm(email), otp: otp.trim(), password }),

  me: () => api<HubUser>("/users/me"),
};

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
    default:
      if (e.status === 429) return "Too many attempts. Wait a minute and try again.";
      return e.message || fallback;
  }
}
