import { useConvexAuth } from "convex/react";
import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ViktorSignInSection } from "@/components/ViktorSignInSection";
import { getViktorSignInAvailable } from "@/lib/viktor-spaces-access/config";
import { ViktorProductAuthProvider } from "@/lib/viktor-spaces-access/ViktorProductAuthProvider";
import { ViktorOAuthCallbackPage } from "@/pages/ViktorOAuthCallbackPage";
import { OAUTH_CALLBACK_PATH } from "./oauthReturn";

/** Shared session lifecycle for authenticated Spaces, independent of app layout. */
export function SpaceSession({ children }: { children: ReactNode }) {
  return (
    // Sign-in is handled by the new backend (SessionProvider). Viktor auto sign-in, space-session
    // sign-in and membership re-checks are switched off; the Convex provider stays because the
    // not-yet-migrated pages still read data through it.
    <ViktorProductAuthProvider enabled>{children}</ViktorProductAuthProvider>
  );
}

/** For single-surface Spaces without application login routes. */
export function SpaceSessionRequired({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { pathname } = useLocation();
  if (pathname === OAUTH_CALLBACK_PATH) return <ViktorOAuthCallbackPage />;
  if (isLoading) return <p role="status">Signing you in...</p>;
  if (isAuthenticated) return <>{children}</>;
  let available = false;
  try {
    available = getViktorSignInAvailable();
  } catch {
    // Invalid configuration stays closed.
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      {available ? (
        <ViktorSignInSection />
      ) : (
        <Alert variant="destructive">
          <AlertDescription>
            Viktor sign-in is unavailable. Contact the Space owner.
          </AlertDescription>
        </Alert>
      )}
    </main>
  );
}
