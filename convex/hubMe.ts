// Who is signed in, as the Hub sees it: matched agent (by @spacematchinc.com email),
// role flags, and whether this is the shared team@ login (Michael 2026-10-18).
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { AGENTS, GUESTS, NEW_LEADS_EMAILS, OPS_EMAILS, agentByEmail, isAdminEmail } from "./agentsData";
import { authenticatedQuery } from "./functions";
import { syncRoster } from "./rosterSync";

export const SHARED_EMAILS = ["team@spacematchinc.com"];
export const LEADER_EMAILS = ["brandon@spacematchinc.com", "sergio.monjane@spacematchinc.com"];

const OPS_NAMES: Record<string, string> = {
  "smm@spacematchinc.com": "Cris Castillo",
  "tc@spacematchinc.com": "Anthony Arpia",
};

export type HubViewer = {
  userId: Id<"users">;
  email: string;
  name: string; // best display name
  firstName: string;
  initials: string;
  agentName: string | null; // matched AGENTS entry
  isAdmin: boolean;
  isOps: boolean;
  isLeader: boolean;
  isStaff: boolean; // admin + ops + leaders
  isShared: boolean;
  canNewLeads: boolean; // New Leads tracker access (Michael, Cristina, Anthony only)
};

const initialsOf = (n: string) =>
  n.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();

declare const process: { env: Record<string, string | undefined> };

export async function hubViewer(ctx: QueryCtx, userId: Id<"users">): Promise<HubViewer> {
  await syncRoster(ctx);
  const user = (await ctx.db.get(userId)) as Doc<"users"> | null;
  let email = (user?.email ?? "").toLowerCase();
  // Dev-only e2e hook: HUB_TEST_AS is never set on prod.
  if (process.env.HUB_TEST_AS && email.startsWith("space-session-")) email = process.env.HUB_TEST_AS.toLowerCase();
  const agent = agentByEmail(email);
  const isShared = SHARED_EMAILS.includes(email);
  const raw = (user?.name ?? "").trim();
  const realName = agent?.name ?? OPS_NAMES[email] ?? GUESTS[email] ?? (raw && raw.toLowerCase() !== "team" && !raw.startsWith("space-session") && !raw.includes("@") ? raw : "");
  const name = realName || (isShared ? "SpaceMatch Team" : email.split("@")[0]);
  const isAdmin = isAdminEmail(email);
  const isOps = OPS_EMAILS.includes(email);
  const isLeader = LEADER_EMAILS.includes(email);
  return {
    userId,
    email,
    name,
    firstName: realName ? realName.split(" ")[0] : "",
    initials: realName ? initialsOf(realName) : "SM",
    agentName: agent?.name ?? null,
    isAdmin,
    isOps,
    isLeader,
    isStaff: isAdmin || isOps || isLeader,
    isShared,
    canNewLeads: NEW_LEADS_EMAILS.includes(email),
  };
}

export const me = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const v = await hubViewer(ctx, ctx.userId);
    return { ...v, agents: v.isStaff ? AGENTS.map(a => a.name) : [] };
  },
});
