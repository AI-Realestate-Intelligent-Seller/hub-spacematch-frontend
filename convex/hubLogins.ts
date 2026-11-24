// Agent logins (Michael 2026-10-29, #team-app-design 1793285849.414399):
// email codes sometimes land in junk, so admins + ops (Cris, Atom) can create or
// reset an agent's login right in the Hub and text them a temporary password.
// Accounts made here are pre-verified, so sign-in never asks for an email code.
import { createAccount, modifyAccountCredentials } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { AGENTS, GUESTS, REMOVED_EMAILS, isGuestEmail } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedAction, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";

const DOMAIN = "spacematchinc.com";
const canManage = (v: { isAdmin: boolean; isOps: boolean }) => v.isAdmin || v.isOps;

export const viewerInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await syncRoster(ctx);
    const me = await hubViewer(ctx, userId);
    return { allowed: canManage(me), name: me.name };
  },
});

// Everyone who should have a login, with whether they have one and when they last signed in.
export const list = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!canManage(me)) return null;
    const accts = await ctx.db.query("authAccounts").take(2000);
    const pw = new Map(accts.filter(a => a.provider === "password").map(a => [a.providerAccountId.toLowerCase(), a]));
    const sessions = await ctx.db.query("authSessions").take(10000);
    const last = new Map<string, number>();
    for (const s of sessions) last.set(s.userId, Math.max(last.get(s.userId) ?? 0, s._creationTime));
    const people = [
      ...AGENTS.map(a => ({ name: a.name, email: a.email.toLowerCase() })),
      ...Object.entries(GUESTS).map(([email, name]) => ({ name: `${name} (guest)`, email })),
    ];
    return people
      .filter(p => p.email.endsWith(`@${DOMAIN}`) || isGuestEmail(p.email))
      .map(p => {
        const a = pw.get(p.email);
        const t = a ? last.get(a.userId as Id<"users">) : undefined;
        return { name: p.name, email: p.email, hasLogin: !!a, verified: !!a?.emailVerified, lastSignIn: t ?? null };
      })
      .sort((x, y) => Number(x.hasLogin) - Number(y.hasLogin) || x.name.localeCompare(y.name));
  },
});

export const markVerified = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await syncRoster(ctx);
    const accts = await ctx.db.query("authAccounts").take(2000);
    for (const a of accts) {
      if (a.provider === "password" && a.providerAccountId.toLowerCase() === email && !a.emailVerified) {
        await ctx.db.patch(a._id, { emailVerified: email });
      }
    }
  },
});

const WORDS = ["Lake", "River", "Maple", "Harbor", "Cedar", "Summit", "Willow", "Granite", "Bridge", "Garden", "Loop", "Shore"];
function tempPassword() {
  const r = crypto.getRandomValues(new Uint32Array(3));
  return `${WORDS[r[0] % WORDS.length]}-${WORDS[r[1] % WORDS.length]}-${1000 + (r[2] % 9000)}`;
}

// Create a login, or reset an existing one, with a temporary password (also used by roster.save).
export async function issueLogin(
  ctx: Parameters<typeof createAccount>[0],
  email: string,
  name: string,
): Promise<{ email: string; password: string; created: boolean }> {
  const e = email.trim().toLowerCase();
  const password = tempPassword();
  const found = await ctx.runQuery(internal.adminAccounts.findUser, { email: e });
  if (found.account && found.account.provider === "password") {
    await modifyAccountCredentials(ctx, { provider: "password", account: { id: e, secret: password } });
    await ctx.runMutation(internal.hubLogins.markVerified, { email: e });
    return { email: e, password, created: false };
  }
  await createAccount(ctx, {
    provider: "password",
    account: { id: e, secret: password },
    profile: { email: e, name, emailVerified: true } as never,
    shouldLinkViaEmail: true,
  });
  return { email: e, password, created: true };
}

// Create or reset a login. Returns the temporary password to text the agent.
export const reset = authenticatedAction({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<{ email: string; password: string; created: boolean }> => {
    const me = await ctx.runQuery(internal.hubLogins.viewerInternal, { userId: ctx.userId });
    if (!me.allowed) throw new Error("Only admins and ops can reset logins");
    const e = email.trim().toLowerCase();
    if (e.split("@")[1] !== DOMAIN && !isGuestEmail(e)) throw new Error(`Only @${DOMAIN} emails`);
    if (REMOVED_EMAILS.includes(e)) throw new Error("Former team member: no Hub access");
    const agent = AGENTS.find(a => a.email.toLowerCase() === e);
    return issueLogin(ctx, e, agent?.name ?? GUESTS[e] ?? e.split("@")[0]);
  },
});
