// "Why SpaceMatch" link: each agent's branded, interactive pitch page for prospects on the phone.
// Agents create a tracked link (prospect first name + sell/buy/both), send it by text/email,
// and watch it live (opened, which section, what they tapped). A one-time tutorial gates sending.
// Public page: /m/<agent-slug>?k=<token>  (no token = the agent's generic page, not tracked).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { AGENTS, agentBySlug, agentSlug } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { WHY_QUIZ } from "./whyDefs";

const PATHS = ["sell", "buy", "both"];
const CHANNELS = ["text", "email", "copy", "qr", "present"];
const tutKey = (email: string) => `whytutorial:${email.toLowerCase()}`;
const clean = (s: string | undefined, max = 200) => (s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const digits = (s: string) => s.replace(/\D/g, "");
const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
const newToken = () => Array.from({ length: 7 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");

type Tut = { at: number; name: string };

/** Which agent a signed-in user sends as. Agents = themselves; staff may pick any agent. */
function resolveAgent(v: Awaited<ReturnType<typeof hubViewer>>, agentName?: string) {
  if (v.agentName && !v.isStaff) return AGENTS.find(a => a.name === v.agentName)!;
  const picked = agentName ? AGENTS.find(a => a.name === agentName) : undefined;
  return picked ?? (v.agentName ? AGENTS.find(a => a.name === v.agentName) : undefined) ?? AGENTS[0];
}

// ---------- signed-in (agents) ----------

export const tutorial = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", tutKey(me.email))).unique();
    return { done: !!row, at: row ? (JSON.parse(row.value) as Tut).at : null, isStaff: me.isStaff, agentName: me.agentName, isShared: me.isShared };
  },
});

export const completeTutorial = authenticatedMutation({
  args: { answers: v.array(v.number()) },
  handler: async (ctx, { answers }) => {
    const me = await hubViewer(ctx, ctx.userId);
    const wrong = WHY_QUIZ.filter((q, i) => answers[i] !== q.answer).map(q => q.q);
    if (wrong.length) return { ok: false, wrong };
    const k = tutKey(me.email);
    const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", k)).unique();
    const value = JSON.stringify({ at: Date.now(), name: me.name } satisfies Tut);
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("hubSettings", { key: k, value });
    return { ok: true, wrong: [] as string[] };
  },
});

export const create = authenticatedMutation({
  args: { agentName: v.optional(v.string()), prospectName: v.string(), path: v.string(), channel: v.string() },
  handler: async (ctx, a) => {
    const me = await hubViewer(ctx, ctx.userId);
    const tut = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", tutKey(me.email))).unique();
    if (!tut) throw new Error("Finish the 3-minute tutorial first");
    if (!PATHS.includes(a.path)) throw new Error("Pick seller, buyer or both");
    const agent = resolveAgent(me, a.agentName);
    let token = newToken();
    while (await ctx.db.query("whyLinks").withIndex("by_token", q => q.eq("token", token)).first()) token = newToken();
    await ctx.db.insert("whyLinks", {
      token,
      agentSlug: agentSlug(agent.name),
      agentEmail: agent.email.toLowerCase(),
      createdByEmail: me.email,
      prospectName: clean(a.prospectName, 40),
      path: a.path,
      channel: CHANNELS.includes(a.channel) ? a.channel : "copy",
      createdAt: Date.now(),
      opens: 0,
      sections: [],
      actions: [],
    });
    return { token, slug: agentSlug(agent.name) };
  },
});

export const setChannel = authenticatedMutation({
  args: { token: v.string(), channel: v.string() },
  handler: async (ctx, { token, channel }) => {
    const row = await ctx.db.query("whyLinks").withIndex("by_token", q => q.eq("token", token)).first();
    if (row && CHANNELS.includes(channel)) await ctx.db.patch(row._id, { channel });
    return null;
  },
});

export const mine = authenticatedQuery({
  args: { agentName: v.optional(v.string()) },
  handler: async (ctx, { agentName }) => {
    const me = await hubViewer(ctx, ctx.userId);
    const agent = resolveAgent(me, agentName);
    const rows = await ctx.db
      .query("whyLinks")
      .withIndex("by_agent", q => q.eq("agentEmail", agent.email.toLowerCase()))
      .order("desc")
      .take(25);
    return {
      agentName: agent.name,
      slug: agentSlug(agent.name),
      links: rows.map(r => ({
        token: r.token, prospectName: r.prospectName, path: r.path, chosenPath: r.chosenPath ?? null, channel: r.channel,
        createdAt: r.createdAt, opens: r.opens, firstOpenedAt: r.firstOpenedAt ?? null, lastSeenAt: r.lastSeenAt ?? null,
        section: r.section ?? null, sections: r.sections, actions: r.actions, requestedAt: r.requestedAt ?? null,
      })),
    };
  },
});

/** Staff: who finished the tutorial and how much each agent uses the link. */
export const team = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!me.isStaff) return null;
    const since = Date.now() - 30 * 864e5;
    const out = [];
    for (const a of AGENTS) {
      const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", tutKey(a.email))).unique();
      const links = await ctx.db.query("whyLinks").withIndex("by_agent", q => q.eq("agentEmail", a.email.toLowerCase()).gt("createdAt", since)).collect();
      out.push({
        name: a.name,
        tutorialAt: row ? (JSON.parse(row.value) as Tut).at : null,
        sent: links.length,
        opened: links.filter(l => l.opens > 0).length,
        requests: links.filter(l => l.requestedAt).length,
      });
    }
    return out;
  },
});

// ---------- public (prospect page) ----------

export const view = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await syncRoster(ctx);
    const row = await ctx.db.query("whyLinks").withIndex("by_token", q => q.eq("token", clean(token, 12))).first();
    return row ? { prospectName: row.prospectName, path: row.path, agentSlug: row.agentSlug } : null;
  },
});

export const ping = mutation({
  args: { token: v.string(), open: v.optional(v.boolean()), section: v.optional(v.string()), action: v.optional(v.string()), path: v.optional(v.string()) },
  handler: async (ctx, a) => {
    await syncRoster(ctx);
    const row = await ctx.db.query("whyLinks").withIndex("by_token", q => q.eq("token", clean(a.token, 12))).first();
    if (!row) return null;
    const now = Date.now();
    const patch: Partial<Doc<"whyLinks">> = { lastSeenAt: now };
    if (a.open) {
      patch.opens = row.opens + 1;
      if (!row.firstOpenedAt) {
        patch.firstOpenedAt = now;
        await ctx.scheduler.runAfter(0, internal.push.toEmail, {
          email: row.agentEmail,
          title: `${row.prospectName || "Your prospect"} just opened your link`,
          body: "They're on your Why SpaceMatch page right now. Open the Hub to see what they're looking at.",
          url: "/why",
        });
      }
    }
    const section = clean(a.section, 40);
    if (section) {
      patch.section = section;
      if (!row.sections.includes(section) && row.sections.length < 30) patch.sections = [...row.sections, section];
    }
    const action = clean(a.action, 60);
    if (action && !row.actions.includes(action) && row.actions.length < 40) patch.actions = [...row.actions, action];
    if (a.path && PATHS.includes(a.path)) patch.chosenPath = a.path;
    await ctx.db.patch(row._id, patch);
    return null;
  },
});

/** Prospect asks for the next step → Hub inbox lead for the agent + email (code-defined intake, no form def). */
export const request = mutation({
  args: {
    agentSlug: v.string(), token: v.optional(v.string()), path: v.string(),
    fullName: v.string(), phone: v.string(), email: v.string(), address: v.string(), timeline: v.string(), note: v.string(),
    hp: v.string(),
  },
  handler: async (ctx, a) => {
    await syncRoster(ctx);
    if (a.hp) return { ok: true };
    const agent = agentBySlug(a.agentSlug);
    if (!agent) throw new Error("This link isn't valid anymore");
    const fullName = clean(a.fullName, 80);
    const email = clean(a.email, 120).toLowerCase();
    const phone = clean(a.phone, 30);
    if (fullName.length < 2) throw new Error("Please add your name");
    if (!email && !phone) throw new Error("Please add a phone number or an email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("That email doesn't look right");
    if (phone && digits(phone).length < 10) throw new Error("That phone number doesn't look right");
    const path = PATHS.includes(a.path) ? a.path : "sell";
    const what = { sell: "Home value + selling plan", buy: "Home search plan", both: "Sell-and-buy plan" }[path]!;
    const answers: Record<string, string> = { Name: fullName };
    if (phone) answers.Phone = phone;
    if (email) answers.Email = email;
    answers["Asked for"] = what;
    if (clean(a.address)) answers[path === "buy" ? "Looking in" : "Property address"] = clean(a.address);
    if (clean(a.timeline)) answers.Timeline = clean(a.timeline, 40);
    if (clean(a.note)) answers.Note = clean(a.note, 1000);
    let link: Doc<"whyLinks"> | null = null;
    if (a.token) link = await ctx.db.query("whyLinks").withIndex("by_token", q => q.eq("token", clean(a.token, 12))).first();
    if (link) {
      const seen = link.sections.length ? link.sections.join(", ") : "";
      if (seen) answers["Viewed on the page"] = seen;
      if (link.actions.length) answers["Tapped"] = link.actions.join(", ");
    }
    answers.Source = `Why SpaceMatch link (${agent.name})`;
    const sid = await ctx.db.insert("formSubmissions", {
      formId: "why-spacematch",
      formTitle: `Why SpaceMatch · ${what}`,
      group: "Leads",
      audience: "client",
      agentEmail: agent.email.toLowerCase(),
      agentName: agent.name,
      contactName: fullName,
      contactEmail: email || undefined,
      contactPhone: phone || undefined,
      propertyAddress: path === "buy" ? undefined : clean(a.address) || undefined,
      answers,
      status: "new",
      isLead: true,
    });
    if (link) {
      await ctx.db.patch(link._id, {
        requestedAt: Date.now(),
        lastSeenAt: Date.now(),
        actions: link.actions.includes("Asked for a plan") ? link.actions : [...link.actions, "Asked for a plan"],
      });
    }
    await ctx.scheduler.runAfter(0, internal.notify.formSubmitted, { id: sid });
    await ctx.scheduler.runAfter(0, internal.lofty.pushLead, { id: sid }); // lead under the agent, tag Why SpaceMatch (Michael 2026-10-26)
    await ctx.scheduler.runAfter(0, internal.push.toEmail, {
      email: agent.email.toLowerCase(),
      title: `${fullName} asked for a ${what.toLowerCase()}`,
      body: [phone, email].filter(Boolean).join(" · ") || "Open the Hub inbox",
      url: `/inbox?open=${sid}`,
    });
    return { ok: true };
  },
});

// ---------- internal ----------

export const subsFor = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) =>
    (await ctx.db.query("pushSubs").collect()).filter(s => s.userEmail.toLowerCase() === email.toLowerCase()),
});

/** Ops: remove test links (run_app_function). */
export const removeInternal = internalMutation({
  args: { tokens: v.array(v.string()) },
  handler: async (ctx, { tokens }) => {
    await syncRoster(ctx);
    let n = 0;
    for (const t of tokens) {
      const row = await ctx.db.query("whyLinks").withIndex("by_token", q => q.eq("token", t)).first();
      if (row) { await ctx.db.delete(row._id); n++; }
    }
    return n;
  },
});

export const recentInternal = internalQuery({
  args: {},
  handler: async ctx => (await ctx.db.query("whyLinks").order("desc").take(30)).map(r => ({ token: r.token, agent: r.agentSlug, prospect: r.prospectName, opens: r.opens, sections: r.sections.length, requested: !!r.requestedAt, at: r.createdAt })),
});

/** Ops/tests: make someone take the tutorial again. */
export const resetTutorialInternal = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await syncRoster(ctx);
    const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", tutKey(email))).unique();
    if (row) await ctx.db.delete(row._id);
    return !!row;
  },
});
