// Who is signed in, according to the NEW backend (session cookie from /api/v1/auth).
// Replaces Convex's useConvexAuth() for the route guards and the sign-in pages.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, type HubUser } from "@/lib/authApi";

/** Where a signed-in user lands: the original Home page. */
export const SIGNED_IN_HOME = "/home";

type SessionState =
  | { status: "loading"; user: null }
  | { status: "signedOut"; user: null }
  | { status: "signedIn"; user: HubUser };

interface SessionContextValue {
  status: SessionState["status"];
  user: HubUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Re-reads the session (call after sign-in / sign-out). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading", user: null });

  const refresh = useCallback(async () => {
    try {
      const session = await authApi.getSession();
      if (!session) {
        setState({ status: "signedOut", user: null });
        return;
      }
      setState({ status: "signedIn", user: await authApi.me() });
    } catch {
      setState({ status: "signedOut", user: null });
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.signOut();
    } finally {
      setState({ status: "signedOut", user: null });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      isLoading: state.status === "loading",
      isAuthenticated: state.status === "signedIn",
      refresh,
      signOut,
    }),
    [state, refresh, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

/**
 * Drop-in for the old `useQuery(api.auth.currentUser)`: same shape the pages read
 * (`_id`, `name`, `email`). undefined while loading, null when signed out.
 */
export function useCurrentUser(): { _id: string; name: string; email: string; role: HubUser["role"] } | null | undefined {
  const ctx = useContext(SessionContext);
  if (!ctx || ctx.status === "loading") return undefined;
  if (!ctx.user) return null;
  return { _id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, role: ctx.user.role };
}

/** For shared UI (e.g. the header) that may render outside <SessionProvider>: signed-out when absent. */
export function useOptionalSession(): Pick<SessionContextValue, "isAuthenticated" | "isLoading"> {
  const ctx = useContext(SessionContext);
  return ctx ?? { isAuthenticated: false, isLoading: false };
}
