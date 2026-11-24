// Admin-only helpers (internal functions; not callable from the browser).
// Used by Viktor to pre-register SpaceMatch agents with a temporary password,
// so they can sign in without waiting for an OTP email.
import { createAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { REMOVED_EMAILS, isGuestEmail } from "./agentsData";
import { syncRoster } from "./rosterSync";

const ALLOWED_DOMAIN = "spacematchinc.com";

export const findUser = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await syncRoster(ctx);
    const e = email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("email", q => q.eq("email", e))
      .first();
    const account = await ctx.db
      .query("authAccounts")
      .filter(q => q.eq(q.field("providerAccountId"), e))
      .first();
    return {
      user: user
        ? { id: user._id, name: user.name ?? null, email: user.email ?? null, createdAt: user._creationTime }
        : null,
      account: account
        ? { provider: account.provider, emailVerified: account.emailVerified ?? null, createdAt: account._creationTime }
        : null,
    };
  },
});

export const createAgentAccount = internalAction({
  args: { email: v.string(), name: v.string(), password: v.string() },
  handler: async (ctx, { email, name, password }) => {
    await syncRoster(ctx);
    const e = email.trim().toLowerCase();
    if (e.split("@")[1] !== ALLOWED_DOMAIN && !isGuestEmail(e)) throw new Error(`Only @${ALLOWED_DOMAIN} emails`);
    if (REMOVED_EMAILS.includes(e)) throw new Error("Former team member: no Hub access");
    if (password.length < 8) throw new Error("Password must be at least 8 characters");
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: e, secret: password },
      // emailVerified marks the account verified so password sign-in skips the OTP step.
      profile: { email: e, name, emailVerified: true } as never,
      shouldLinkViaEmail: true,
    });
    return { userId: user._id, email: e };
  },
});

// One-off: lowercase password-account ids + user emails (sign-in is now
// case-insensitive, so mixed-case rows would no longer match). Skips conflicts.
export const normalizeEmails = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun }) => {
    await syncRoster(ctx);
    const changed: string[] = [];
    const accts = await ctx.db.query("authAccounts").take(2000);
    for (const a of accts) {
      if (a.provider !== "password") continue;
      const low = a.providerAccountId.trim().toLowerCase();
      if (low === a.providerAccountId) continue;
      if (accts.some(b => b.provider === "password" && b._id !== a._id && b.providerAccountId === low)) {
        // Unverified mixed-case duplicate (e.g. an abandoned sign-up): remove it
        // and its user if that user has no other account. Verified ones are kept.
        const others = accts.filter(b => b.userId === a.userId && b._id !== a._id);
        if (!a.emailVerified && others.length === 0) {
          changed.push(`delete unverified duplicate ${a.providerAccountId}`);
          if (!dryRun) {
            const codes = await ctx.db.query("authVerificationCodes").withIndex("accountId", q => q.eq("accountId", a._id)).collect();
            for (const c of codes) await ctx.db.delete(c._id);
            await ctx.db.delete(a._id);
            await ctx.db.delete(a.userId);
          }
        } else changed.push(`SKIP conflict ${a.providerAccountId}`);
        continue;
      }
      changed.push(`account ${a.providerAccountId} -> ${low}`);
      if (!dryRun) {
        const patch: Record<string, string> = { providerAccountId: low };
        if (a.emailVerified) patch.emailVerified = a.emailVerified.trim().toLowerCase();
        await ctx.db.patch(a._id, patch);
      }
    }
    const users = await ctx.db.query("users").take(2000);
    for (const u of users) {
      if (!u.email || u.email.endsWith("@viktor.invalid")) continue;
      if (!dryRun && !(await ctx.db.get(u._id))) continue;
      const low = u.email.trim().toLowerCase();
      if (low === u.email) continue;
      changed.push(`user ${u.email} -> ${low}`);
      if (!dryRun) await ctx.db.patch(u._id, { email: low });
    }
    return changed;
  },
});

// Signs former team members (REMOVED_EMAILS) out everywhere: deletes their
// sessions + refresh tokens. Their account rows stay, so re-enabling is just
// taking them out of REMOVED_EMAILS (2026-11-17).
export const revokeRemovedSessions = internalMutation({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const out: { email: string; sessions: number }[] = [];
    for (const email of REMOVED_EMAILS) {
      const users = await ctx.db
        .query("users")
        .withIndex("email", q => q.eq("email", email))
        .collect();
      let n = 0;
      for (const u of users) {
        const sessions = await ctx.db
          .query("authSessions")
          .withIndex("userId", q => q.eq("userId", u._id))
          .collect();
        for (const s of sessions) {
          const tokens = await ctx.db
            .query("authRefreshTokens")
            .withIndex("sessionId", q => q.eq("sessionId", s._id))
            .collect();
          for (const t of tokens) await ctx.db.delete(t._id);
          await ctx.db.delete(s._id);
          n++;
        }
      }
      out.push({ email, sessions: n });
    }
    return out;
  },
});
