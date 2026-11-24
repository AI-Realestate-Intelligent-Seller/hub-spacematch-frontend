import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexProvider } from "convex/react";
import type { ReactNode } from "react";
import { convex, hasConvexDeployment } from "@/auth/convexClient";

export function ViktorProductAuthProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  if (!enabled) return <>{children}</>;
  if (!hasConvexDeployment) return <ConvexProvider client={convex}>{children}</ConvexProvider>;
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
