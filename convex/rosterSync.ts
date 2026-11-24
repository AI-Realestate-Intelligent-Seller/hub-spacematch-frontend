// Refreshes the live roster arrays (AGENTS, REMOVED_EMAILS in agentsData.ts) from the rosterAgents
// table. Kept free of functions.ts / hubMe.ts imports so both can call it without an import cycle.
import { makeFunctionReference } from "convex/server";
import { applyRoster, type RosterRow } from "./agentsData";

type DbCtx = { db: { query: (t: "rosterAgents") => { collect: () => Promise<RosterRow[]> } } };
type RunCtx = { runQuery: (ref: never, args: Record<string, never>) => Promise<unknown> };

export const rowsRef = makeFunctionReference<"query", Record<string, never>, RosterRow[]>("rosterRows:rows");

export const pickRow = (r: RosterRow): RosterRow => ({
  email: r.email,
  name: r.name,
  phone: r.phone,
  status: r.status,
  title: r.title,
  lic: r.lic,
  bio: r.bio,
  photoUrl: r.photoUrl,
  folderId: r.folderId,
});

/** Call at the start of any function that reads AGENTS / agentByEmail / REMOVED_EMAILS. */
export async function syncRoster(ctx: unknown): Promise<void> {
  const c = ctx as Partial<DbCtx & RunCtx>;
  let rows: RosterRow[];
  if (c.db) rows = (await c.db.query("rosterAgents").collect()).map(pickRow);
  else if (c.runQuery) rows = (await c.runQuery(rowsRef as never, {})) as RosterRow[];
  else return; // http actions without runQuery: keep the last list
  applyRoster(rows);
}
