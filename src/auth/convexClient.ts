import { ConvexReactClient } from "convex/react";

const deploymentUrl = import.meta.env.VITE_CONVEX_URL?.trim();
export const hasConvexDeployment = Boolean(deploymentUrl);
export const convex = new ConvexReactClient(deploymentUrl || "https://convex-disabled.invalid", {
  skipConvexDeploymentUrlCheck: true,
});

// Keep a provider for legacy hooks, but prevent the unconfigured client from opening a connection.
if (!hasConvexDeployment) void convex.close();
