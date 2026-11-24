// Read-only adoption snapshot for Viktor / Michael (run_app_function prod hubStats:usage).
import { internalQuery } from "./_generated/server";

const TABLES = [
  ["cmaRequests", "submittedByEmail"],
  ["formSubmissions", "agentEmail"],
  ["listings", "agentEmail"],
  ["listingMetrics", "enteredByEmail"],
  ["whyLinks", "agentEmail"],
  ["mailCampaigns", "agentEmail"],
  ["helpRequests", "fromEmail"],
  ["feedback", "fromEmail"],
  ["adOrders", "agentEmail"],
  ["growthProgress", "email"],
  ["agentVideoBriefs", "agentEmail"],
  ["vendors", "addedByEmail"],
  ["announcements", "authorEmail"],
  ["pushSubs", "userEmail"],
] as const;

export const usage = internalQuery({
  args: {},
  handler: async ctx => {
    const now = Date.now();
    const d14 = now - 14 * 864e5;
    const out: Record<string, unknown> = {};
    for (const [t, f] of TABLES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = await (ctx.db.query(t as any) as any).take(5000);
      const who = new Set(rows.map(r => r[f]).filter(Boolean));
      out[t] = {
        total: rows.length,
        last14: rows.filter(r => r._creationTime >= d14).length,
        people: who.size,
      };
    }
    const users = await ctx.db.query("users").take(1000);
    const sessions = await ctx.db.query("authSessions").take(10000);
    const last = new Map<string, number>();
    for (const s of sessions) last.set(s.userId, Math.max(last.get(s.userId) ?? 0, s._creationTime));
    out.users = users.map(u => ({
      email: u.email,
      created: new Date(u._creationTime).toISOString().slice(0, 10),
      lastSession: last.get(u._id) ? new Date(last.get(u._id)!).toISOString().slice(0, 10) : null,
    }));
    const settings = await ctx.db.query("hubSettings").take(5000);
    const pref: Record<string, number> = {};
    for (const s of settings) {
      const k = s.key.split(":")[0];
      pref[k] = (pref[k] ?? 0) + 1;
    }
    out.hubSettings = pref;
    return out;
  },
});
