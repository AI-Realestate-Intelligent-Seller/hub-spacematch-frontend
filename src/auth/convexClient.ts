import { ConvexReactClient, useQueries } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

const deploymentUrl = import.meta.env.VITE_CONVEX_URL?.trim();
export const hasConvexDeployment = Boolean(deploymentUrl);

class UnconfiguredConvexClient extends ConvexReactClient {
  constructor() {
    super("https://convex-disabled.invalid");
    void this.close();
  }

  // Legacy callers handle promise rejections. A closed client's default methods throw synchronously.
  override async mutation(): Promise<never> {
    throw new Error("This feature requires a configured Convex deployment.");
  }

  override async action(): Promise<never> {
    throw new Error("This feature requires a configured Convex deployment.");
  }
}

export const convex = deploymentUrl
  ? new ConvexReactClient(deploymentUrl, { skipConvexDeploymentUrlCheck: true })
  : new UnconfiguredConvexClient();

/** Lets optional legacy widgets display query failures without replacing the whole page. */
export function useLegacyQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query> | "skip",
): FunctionReturnType<Query> | Error | undefined {
  return useQueries(args === "skip" ? {} : { result: { query, args } }).result;
}
