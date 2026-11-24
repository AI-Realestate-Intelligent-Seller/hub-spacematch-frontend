// Follow Up Boss: copy Hub leads routed to an agent into that agent's own FUB.
// Angel Zhang's Hub idea, approved by Michael 2026-11-02. Lofty stays the team CRM
// (lofty.pushLead is unchanged); this is an extra copy for agents who also run FUB.
// Each agent pastes their own FUB API key once (FUB → Admin → API). Uses the
// /v1/events endpoint, which FUB recommends for new leads (dedupes by email/phone
// and starts the agent's FUB action plans).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { authenticatedAction, authenticatedMutation, authenticatedQuery } from "./functions";
import { formById } from "./formDefs";

declare const process: { env: Record<string, string | undefined> };

const FUB = "https://api.followupboss.com/v1";

function headers(apiKey: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Basic ${btoa(`${apiKey}:`)}`,
    "Content-Type": "application/json",
  };
  // Optional registered-system headers (set in Hub env if Michael registers one).
  if (process.env.FUB_SYSTEM) h["X-System"] = process.env.FUB_SYSTEM;
  if (process.env.FUB_SYSTEM_KEY) h["X-System-Key"] = process.env.FUB_SYSTEM_KEY;
  return h;
}

async function fubFetch(apiKey: string, path: string, body?: unknown) {
  const res = await fetch(`${FUB}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: headers(apiKey),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401) throw new Error("Follow Up Boss didn't accept that API key. Copy it again from FUB → Admin → API.");
    throw new Error(`Follow Up Boss ${res.status}: ${text.slice(0, 200)}`);
  }
  return text ? JSON.parse(text) : {};
}

const hint = (k: string) => `••••${k.slice(-4)}`;

// What the Settings card shows. Never returns the key itself.
export const mine = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const row = await ctx.db.query("fubConnections").withIndex("by_user", q => q.eq("userId", ctx.userId)).unique();
    if (!row) return null;
    return {
      enabled: row.enabled,
      keyHint: hint(row.apiKey),
      accountLabel: row.accountLabel ?? "",
      connectedAt: row.connectedAt,
      pushedCount: row.pushedCount ?? 0,
      lastPushAt: row.lastPushAt ?? null,
      lastError: row.lastError ?? null,
      lastErrorAt: row.lastErrorAt ?? null,
    };
  },
});

export const viewerEmail = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => ((await ctx.db.get(userId))?.email ?? "").toLowerCase(),
});

export const save = internalMutation({
  args: { userId: v.id("users"), email: v.string(), apiKey: v.string(), accountLabel: v.string() },
  handler: async (ctx, a) => {
    const row = await ctx.db.query("fubConnections").withIndex("by_user", q => q.eq("userId", a.userId)).unique();
    const fields = {
      email: a.email,
      apiKey: a.apiKey,
      accountLabel: a.accountLabel,
      enabled: true,
      connectedAt: Date.now(),
      lastError: undefined,
      lastErrorAt: undefined,
    };
    if (row) await ctx.db.patch(row._id, fields);
    else await ctx.db.insert("fubConnections", { userId: a.userId, ...fields, pushedCount: 0 });
  },
});

// Checks the key against FUB (GET /identity) before saving it.
export const connect = authenticatedAction({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }): Promise<{ accountLabel: string }> => {
    const key = apiKey.trim();
    if (key.length < 20 || /\s/.test(key)) throw new Error("That doesn't look like a Follow Up Boss API key. It's a long code from FUB → Admin → API.");
    const email = await ctx.runQuery(internal.fub.viewerEmail, { userId: ctx.userId });
    if (!email) throw new Error("Sign in first");
    const id = await fubFetch(key, "/identity");
    const user = id?.user ?? {};
    const name: string = user.name || [user.firstName, user.lastName].filter(Boolean).join(" ");
    const accountLabel = [name, id?.account?.name ?? id?.account?.domain].filter(Boolean).join(" · ").slice(0, 120) || "Follow Up Boss";
    await ctx.runMutation(internal.fub.save, { userId: ctx.userId, email, apiKey: key, accountLabel });
    return { accountLabel };
  },
});

export const setEnabled = authenticatedMutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const row = await ctx.db.query("fubConnections").withIndex("by_user", q => q.eq("userId", ctx.userId)).unique();
    if (!row) throw new Error("Connect Follow Up Boss first");
    await ctx.db.patch(row._id, { enabled });
    return null;
  },
});

export const disconnect = authenticatedMutation({
  args: {},
  handler: async ctx => {
    const row = await ctx.db.query("fubConnections").withIndex("by_user", q => q.eq("userId", ctx.userId)).unique();
    if (row) await ctx.db.delete(row._id);
    return null;
  },
});

export const connectionFor = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const rows = await ctx.db.query("fubConnections").withIndex("by_email", q => q.eq("email", email.toLowerCase())).collect();
    return rows.find(r => r.enabled) ?? null;
  },
});

export const recordPush = internalMutation({
  args: { id: v.id("fubConnections"), error: v.optional(v.string()) },
  handler: async (ctx, { id, error }) => {
    const row = await ctx.db.get(id);
    if (!row) return;
    if (error) await ctx.db.patch(id, { lastError: error.slice(0, 300), lastErrorAt: Date.now() });
    else await ctx.db.patch(id, { pushedCount: (row.pushedCount ?? 0) + 1, lastPushAt: Date.now(), lastError: undefined, lastErrorAt: undefined });
  },
});

function eventType(formId: string, group: string): string {
  if (formId === "open-house-signin") return "Visited Open House";
  if (group === "Seller" || formId === "mailer-reply" || formId === "pricing-review") return "Seller Inquiry";
  if (group === "Buyer") return "Property Search";
  return "General Inquiry";
}

// Scheduled from lofty.pushLead, i.e. for every Hub lead (forms with lead:true,
// mailer replies, Why SpaceMatch, pricing reviews, Trusted Local Pros).
export const pushLead = internalAction({
  args: { id: v.id("formSubmissions") },
  handler: async (ctx, { id }) => {
    const s = await ctx.runQuery(internal.notify.submissionForMail, { id });
    if (!s || s.audience !== "client" || !s.agentEmail) return;
    if (!s.contactEmail && !s.contactPhone) return;
    if (s.contactEmail?.endsWith("@example.com")) return; // e2e test leads
    const conn = await ctx.runQuery(internal.fub.connectionFor, { email: s.agentEmail });
    if (!conn) return;
    const def = formById(s.formId);
    const pairs = def
      ? def.fields.map(f => [f.label, s.answers[f.id]] as const)
      : (Object.entries(s.answers) as [string, string][]);
    const lines = pairs.filter(([, val]) => val).map(([k, val]) => `${k}: ${val}`);
    const [firstName, ...rest] = s.contactName.trim().split(/\s+/);
    const tags = ["SpaceMatch Hub", s.formTitle, s.formId === "open-house-signin" ? s.propertyAddress ?? "" : ""]
      .filter(Boolean)
      .map(t => t.slice(0, 50));
    const body = {
      source: "SpaceMatch Hub",
      system: "SpaceMatch Hub",
      type: eventType(s.formId, s.group),
      message: `${s.formTitle} via SpaceMatch Hub`,
      description: lines.join("\n").slice(0, 3000),
      person: {
        firstName: firstName || "Unknown",
        lastName: rest.join(" ") || undefined,
        emails: s.contactEmail ? [{ value: s.contactEmail }] : [],
        phones: s.contactPhone ? [{ value: s.contactPhone }] : [],
        tags,
      },
      ...(s.propertyAddress ? { property: { street: s.propertyAddress } } : {}),
    };
    try {
      await fubFetch(conn.apiKey, "/events", body);
      await ctx.runMutation(internal.fub.recordPush, { id: conn._id });
    } catch (e) {
      console.error("fub pushLead", String(e));
      await ctx.runMutation(internal.fub.recordPush, { id: conn._id, error: String(e) });
    }
  },
});
