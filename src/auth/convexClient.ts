import { ConvexReactClient } from "convex/react";

// The old Convex backend only serves pages that haven't moved to the new API yet.
// Without VITE_CONVEX_URL (e.g. on Vercel, where there's no Convex deployment of our own),
// Convex would throw at start-up and the whole app would be blank. Instead we point at an
// address that never answers: old pages render with empty/loading sections (see
// src/lib/convex-compat/react.ts) while sign-in and migrated pages use the new backend.
const CONVEX_URL = (import.meta.env.VITE_CONVEX_URL as string | undefined) || "https://convex-disabled.invalid";

if (!import.meta.env.VITE_CONVEX_URL) {
  console.info("[convex] VITE_CONVEX_URL is not set: old Convex pages will show no data.");
}

export const convex = new ConvexReactClient(CONVEX_URL, {
  skipConvexDeploymentUrlCheck: true,
});
