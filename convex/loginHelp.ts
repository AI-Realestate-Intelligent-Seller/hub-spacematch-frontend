// Sign-in help (Michael 2026-11-03, #team-app-design 1793726653.941859): Brendan's
// password and "Email me a code" both failed because the email he typed had no Hub
// login (logs: InvalidAccountId), but the screen only said "email and password don't
// match". After a failed sign-in / reset the screen asks this which case it is and
// suggests the right login email. Anonymous on purpose (it runs before sign-in); it
// only reveals team emails that are already public on spacematchinc.com.
import { createAccount, modifyAccountCredentials } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, query } from "./_generated/server";
import { AGENTS, GUESTS, REMOVED_EMAILS } from "./agentsData";
import { syncRoster } from "./rosterSync";

const people = () => [
  ...AGENTS.map(a => ({ name: a.name, email: a.email.toLowerCase() })),
  ...Object.entries(GUESTS).map(([email, name]) => ({ name, email })),
];

function suggest(typed: string): string | null {
  const local = typed.split("@")[0].replace(/[^a-z]/g, "");
  if (local.length < 3) return null;
  const hits = people().filter(p => {
    const parts = p.name.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    const theirLocal = p.email.split("@")[0].replace(/[^a-z]/g, "");
    return parts.some(w => local.includes(w)) || theirLocal.includes(local) || local.includes(theirLocal);
  });
  return hits.length === 1 ? hits[0].email : null;
}

export const check = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await syncRoster(ctx);
    const e = email.trim().toLowerCase().slice(0, 200);
    if (!e) return { status: "no-login" as const, suggestion: null };
    if (REMOVED_EMAILS.includes(e)) return { status: "removed" as const, suggestion: null };
    const acct = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", q => q.eq("provider", "password").eq("providerAccountId", e))
      .first();
    const suggestion = acct ? null : suggest(e);
    console.log(`[login-help] typed=${e} hasLogin=${!!acct} suggestion=${suggestion ?? "-"}`);
    return acct ? { status: "has-login" as const, suggestion: null } : { status: "no-login" as const, suggestion };
  },
});

const WORDS = ["Lake", "River", "Maple", "Harbor", "Cedar", "Summit", "Willow", "Granite", "Bridge", "Garden", "Loop", "Shore"];

// Viktor-only (run_app_function): set a fresh temporary password, creating the login if missing.
export const resetInternal = internalAction({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await syncRoster(ctx);
    const e = email.trim().toLowerCase();
    const agent = people().find(p => p.email === e);
    if (!agent) throw new Error("Not a team member or guest");
    const r = crypto.getRandomValues(new Uint32Array(3));
    const password = `${WORDS[r[0] % 12]}-${WORDS[r[1] % 12]}-${1000 + (r[2] % 9000)}`;
    const found = await ctx.runQuery(internal.adminAccounts.findUser, { email: e });
    if (found.account?.provider === "password") {
      await modifyAccountCredentials(ctx, { provider: "password", account: { id: e, secret: password } });
      await ctx.runMutation(internal.hubLogins.markVerified, { email: e });
      return { email: e, password, created: false };
    }
    await createAccount(ctx, {
      provider: "password",
      account: { id: e, secret: password },
      profile: { email: e, name: agent.name, emailVerified: true } as never,
      shouldLinkViaEmail: true,
    });
    return { email: e, password, created: true };
  },
});
