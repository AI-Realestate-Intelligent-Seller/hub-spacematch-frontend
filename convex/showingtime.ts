// Reads forwarded ShowingTime emails in team@ (agents add a forward rule) and
// files them on the matching listing. Plain code, no AI. Runs every 2 hours.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { parseShowingTime } from "./showingtimeParse";

declare const process: { env: Record<string, string | undefined> };

const QUERY = 'subject:("FEEDBACK RECEIVED" OR "SHOWING CONFIRMED" OR "SHOWING CANCELLED") newer_than:3d';

type Msg = { id: string; subject?: string; bodyText?: string };

async function findEmails(q: string, max: number): Promise<Msg[]> {
  const res = await fetch(`${process.env.VIKTOR_SPACES_API_URL}/api/viktor-spaces/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_name: process.env.VIKTOR_SPACES_PROJECT_NAME,
      project_secret: process.env.VIKTOR_SPACES_PROJECT_SECRET,
      space_id: process.env.VIKTOR_AUTH_RESOURCE_ID,
      role: "mcp_pd_gmail_find_email",
      arguments: { q, maxResults: max, fields: ["subject", "bodyText"], bodyChars: 6000 },
    }),
  });
  if (!res.ok) throw new Error(`Gmail tool HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Gmail tool failed");
  const r = json.result as { content?: string; error?: string };
  if (!r?.content) throw new Error(r?.error ?? "Gmail tool returned no content");
  const c = JSON.parse(r.content);
  return (Array.isArray(c) ? c : c.messages ?? c.ret ?? []) as Msg[];
}

export const scan = internalAction({
  args: { query: v.optional(v.string()), max: v.optional(v.number()) },
  handler: async (ctx, { query, max }): Promise<Record<string, number>> => {
    const msgs = await findEmails(query ?? QUERY, max ?? 40);
    const tally: Record<string, number> = { seen: msgs.length, skipped: 0 };
    for (const m of msgs) {
      const p = parseShowingTime(m.subject ?? "", m.bodyText ?? "");
      if (!p) { tally.skipped++; continue; }
      const r: { status: string } = await ctx.runMutation(internal.listings.ingestShowing, { externalId: `gmail:${m.id}`, subject: m.subject ?? "", parsed: JSON.stringify(p) });
      tally[r.status] = (tally[r.status] ?? 0) + 1;
    }
    console.log("showingtime scan", JSON.stringify(tally));
    return tally;
  },
});
