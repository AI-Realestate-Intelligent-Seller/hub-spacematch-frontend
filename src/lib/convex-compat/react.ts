// Runtime stand-in for "convex/react" while pages move from Convex to the new backend.
// Wired by an alias in vite.config.ts: every `import … from "convex/react"` resolves here.
//
// Everything is re-exported unchanged, except `useQuery`:
//   Convex's useQuery THROWS when a query fails. Since sign-in moved to the new backend, the old
//   Convex functions answer "Not authenticated", which would crash every not-yet-migrated page.
//   This useQuery is a line-for-line copy of Convex's own (convex/dist/esm/react/client.js),
//   except a failed query returns `undefined` ("still loading") instead of throwing, so the
//   original pages and layout render with empty/loading sections until each module is rebuilt.
//
// Delete this file and the alias once no page imports "convex/react" any more.
import { useQueries } from "convex-react-original";
import { getFunctionName, makeFunctionReference } from "convex/server";
import { convexToJson, type Value } from "convex/values";
import { useMemo } from "react";

export * from "convex-react-original";

const reported = new Set<string>();

// biome-ignore lint/suspicious/noExplicitAny: same loose signature as Convex's runtime implementation
export function useQuery(query: any, ...args: any[]): any {
  const skip = !import.meta.env.VITE_CONVEX_URL?.trim() || args[0] === "skip";
  const argsObject: Record<string, Value> = skip ? {} : (args[0] ?? {});
  const queryReference = typeof query === "string" ? makeFunctionReference<"query">(query) : query;
  const queryName = getFunctionName(queryReference);
  const queries = useMemo(
    () =>
      (skip ? {} : { query: { query: queryReference, args: argsObject } }) as Parameters<typeof useQueries>[0],
    // Same dependency trick as Convex: stringified args so equal args don't re-subscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(convexToJson(argsObject)), queryName, skip],
  );
  const results = useQueries(queries);
  const result = results.query;
  if (result instanceof Error) {
    if (import.meta.env.DEV && !reported.has(queryName)) {
      reported.add(queryName);
      console.info(`[convex-compat] ${queryName} not available on the old backend (${result.message.split("\n")[0]}); showing as loading.`);
    }
    return undefined;
  }
  return result;
}
