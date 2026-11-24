// Market myself, per agent (Michael 2026-11-22 "All of it" + "make sure they work properly", DM 1795360151.449479):
// Google review requests, past-client touch plan, open house calendar, market update kit (+ settings).
// Business card and monthly post ideas are client-side only (src/lib/marketMe.ts).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { AGENTS, agentSlug } from "./agentsData";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { MARKET_AREAS, MAX_AGENT_AREAS, MONTHLY_AREA_CAP, TEAM_REVIEW_URL } from "./marketDefs";
import { syncRoster } from "./rosterSync";

const clean = (s: string | undefined, max = 200) => (s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
const newToken = () => Array.from({ length: 8 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
const chicagoDate = (t = Date.now()) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const MICHAEL = "michael@spacematchinc.com";

// Google review links agents can paste: g.page/r/…/review, search.google.com/local/writereview?placeid=…, maps links.
const GOOGLE_HOSTS = ["g.page", "search.google.com", "www.google.com", "google.com", "maps.app.goo.gl", "goo.gl", "maps.google.com", "g.co"];
export function validReviewUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "";
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!GOOGLE_HOSTS.includes(u.hostname.toLowerCase())) return null;
    u.protocol = "https:";
    return u.toString().slice(0, 500);
  } catch {
    return null;
  }
}

async function settingsRow(ctx: { db: any }, email: string): Promise<Doc<"agentMarketing"> | null> {
  return await ctx.db.query("agentMarketing").withIndex("by_email", (q: any) => q.eq("email", email.toLowerCase())).unique();
}

// ───────────── Settings ─────────────
export const settings = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    const row = await settingsRow(ctx, me.email);
    const agent = AGENTS.find(a => a.email.toLowerCase() === me.email.toLowerCase());
    return {
      email: me.email,
      name: agent?.name ?? me.name,
      phone: agent?.phone ?? "",
      slug: agent ? agentSlug(agent.name) : null,
      isAgent: !!agent,
      isStaff: me.isStaff,
      reviewUrl: row?.reviewUrl ?? "",
      areas: row?.areas ?? [],
      teamReviewUrl: TEAM_REVIEW_URL,
    };
  },
});

export const saveSettings = authenticatedMutation({
  args: { reviewUrl: v.optional(v.string()), areas: v.optional(v.array(v.string())) },
  handler: async (ctx, a) => {
    const me = await hubViewer(ctx, ctx.userId);
    const patch: Partial<Doc<"agentMarketing">> = { updatedAt: Date.now() };
    if (a.reviewUrl !== undefined) {
      const url = validReviewUrl(a.reviewUrl);
      if (url === null) throw new Error("That doesn't look like a Google review link. It should start with g.page or search.google.com.");
      patch.reviewUrl = url;
    }
    if (a.areas !== undefined) {
      const keys = [...new Set(a.areas)].filter(k => MARKET_AREAS.some(m => m.key === k));
      if (keys.length > MAX_AGENT_AREAS) throw new Error(`Pick up to ${MAX_AGENT_AREAS} areas`);
      patch.areas = keys;
    }
    const row = await settingsRow(ctx, me.email);
    if (row) await ctx.db.patch(row._id, patch);
    else await ctx.db.insert("agentMarketing", { email: me.email.toLowerCase(), updatedAt: Date.now(), ...patch });
    return { ok: true };
  },
});

// ───────────── Google review requests ─────────────
export const createReview = authenticatedMutation({
  args: { clientName: v.string(), channel: v.string() },
  handler: async (ctx, a) => {
    const me = await hubViewer(ctx, ctx.userId);
    const name = clean(a.clientName, 60);
    if (!name) throw new Error("Type the client's name");
    const agent = AGENTS.find(x => x.email.toLowerCase() === me.email.toLowerCase());
    const row = await settingsRow(ctx, me.email);
    let token = newToken();
    while (await ctx.db.query("reviewRequests").withIndex("by_token", q => q.eq("token", token)).first()) token = newToken();
    await ctx.db.insert("reviewRequests", {
      token,
      agentEmail: me.email.toLowerCase(),
      agentName: agent?.name ?? me.name,
      clientName: name,
      channel: ["text", "email", "copy"].includes(a.channel) ? a.channel : "copy",
      target: row?.reviewUrl ? "agent" : "team",
      createdAt: Date.now(),
      opens: 0,
    });
    return { token };
  },
});

export const myReviews = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    const rows = await ctx.db
      .query("reviewRequests")
      .withIndex("by_agent", q => q.eq("agentEmail", me.email.toLowerCase()))
      .order("desc")
      .take(200);
    const mentionsRow = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", "reviewMentions")).unique();
    const mentions = mentionsRow ? (JSON.parse(mentionsRow.value) as { at: number; total: number; byAgent: Record<string, number> }) : null;
    const agent = AGENTS.find(x => x.email.toLowerCase() === me.email.toLowerCase());
    let team: { agentName: string; sent: number; opened: number; clicked: number; mentions: number }[] = [];
    if (me.isStaff) {
      const all = await ctx.db.query("reviewRequests").order("desc").take(2000);
      const by = new Map<string, { agentName: string; sent: number; opened: number; clicked: number; mentions: number }>();
      for (const r of all) {
        const t = by.get(r.agentName) ?? { agentName: r.agentName, sent: 0, opened: 0, clicked: 0, mentions: mentions?.byAgent[r.agentName] ?? 0 };
        t.sent += 1;
        if (r.firstOpenedAt) t.opened += 1;
        if (r.clickedAt) t.clicked += 1;
        by.set(r.agentName, t);
      }
      team = [...by.values()].sort((x, y) => y.sent - x.sent);
    }
    return {
      rows: rows.map(r => ({
        _id: r._id,
        token: r.token,
        clientName: r.clientName,
        channel: r.channel,
        target: r.target,
        createdAt: r.createdAt,
        opened: !!r.firstOpenedAt,
        clicked: !!r.clickedAt,
        note: r.note ?? null,
      })),
      sent: rows.length,
      opened: rows.filter(r => r.firstOpenedAt).length,
      clicked: rows.filter(r => r.clickedAt).length,
      mentions: mentions && agent ? { count: mentions.byAgent[agent.name] ?? 0, total: mentions.total, at: mentions.at } : null,
      team,
    };
  },
});

// Public: the client's page /r/:token (no login).
export const reviewView = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await syncRoster(ctx);
    const r = await ctx.db.query("reviewRequests").withIndex("by_token", q => q.eq("token", clean(token, 12))).first();
    if (!r) return null;
    const row = await settingsRow(ctx, r.agentEmail);
    const agent = AGENTS.find(a => a.email.toLowerCase() === r.agentEmail);
    const url = row?.reviewUrl || TEAM_REVIEW_URL;
    return {
      clientFirst: r.clientName.split(/\s+/)[0],
      agentName: r.agentName,
      agentSlug: agentSlug(r.agentName),
      agentPhone: agent?.phone ?? "",
      reviewUrl: url,
      team: !row?.reviewUrl,
      noteSent: !!r.note,
    };
  },
});

export const reviewPing = mutation({
  args: { token: v.string(), event: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, a) => {
    await syncRoster(ctx);
    const r = await ctx.db.query("reviewRequests").withIndex("by_token", q => q.eq("token", clean(a.token, 12))).first();
    if (!r) return null;
    const now = Date.now();
    if (a.event === "open") {
      await ctx.db.patch(r._id, { opens: r.opens + 1, ...(r.firstOpenedAt ? {} : { firstOpenedAt: now }) });
    } else if (a.event === "click") {
      if (!r.clickedAt) {
        await ctx.db.patch(r._id, { clickedAt: now });
        await ctx.scheduler.runAfter(0, internal.push.toEmail, {
          email: r.agentEmail,
          title: `${r.clientName} is leaving you a Google review`,
          body: "They just tapped the Google review button on your link.",
          url: "/reviews",
        });
      }
    } else if (a.event === "note") {
      const note = clean(a.note, 1000);
      if (!note || r.note) return { ok: !!r.note };
      await ctx.db.patch(r._id, { note, noteAt: now });
      for (const email of [r.agentEmail, MICHAEL]) {
        await ctx.scheduler.runAfter(0, internal.push.toEmail, {
          email,
          title: `Private note from ${r.clientName} (${r.agentName}'s client)`,
          body: note.slice(0, 160),
          url: "/reviews",
        });
      }
    }
    return { ok: true };
  },
});

// Monthly script: reviews on the SpaceMatch Google page that name an agent.
export const saveReviewMentionsInternal = internalMutation({
  args: { total: v.number(), byAgent: v.record(v.string(), v.number()) },
  handler: async (ctx, a) => {
    const value = JSON.stringify({ at: Date.now(), total: a.total, byAgent: a.byAgent });
    const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", "reviewMentions")).unique();
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("hubSettings", { key: "reviewMentions", value });
  },
});
export const agentNamesInternal = internalQuery({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    return AGENTS.map(a => a.name);
  },
});

// ───────────── Past clients ─────────────
export const myClients = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    const rows = await ctx.db.query("pastClients").withIndex("by_agent", q => q.eq("agentEmail", me.email.toLowerCase())).take(1000);
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

const SIDES = ["seller", "buyer", "renter", "landlord"];
export const saveClient = authenticatedMutation({
  args: {
    id: v.optional(v.id("pastClients")),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    closedOn: v.string(),
    side: v.string(),
  },
  handler: async (ctx, a) => {
    const me = await hubViewer(ctx, ctx.userId);
    const name = clean(a.name, 80);
    if (!name) throw new Error("Type the client's name");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.closedOn)) throw new Error("Pick the closing date");
    const doc = {
      name,
      phone: clean(a.phone, 30) || undefined,
      email: clean(a.email, 120) || undefined,
      address: clean(a.address, 160) || undefined,
      closedOn: a.closedOn,
      side: SIDES.includes(a.side) ? a.side : "buyer",
    };
    if (a.id) {
      const row = await ctx.db.get(a.id);
      if (!row || row.agentEmail !== me.email.toLowerCase()) throw new Error("Not your client");
      await ctx.db.patch(a.id, doc);
      return a.id;
    }
    return await ctx.db.insert("pastClients", { ...doc, agentEmail: me.email.toLowerCase(), done: [], createdAt: Date.now() });
  },
});

export const removeClient = authenticatedMutation({
  args: { id: v.id("pastClients") },
  handler: async (ctx, { id }) => {
    const me = await hubViewer(ctx, ctx.userId);
    const row = await ctx.db.get(id);
    if (!row || row.agentEmail !== me.email.toLowerCase()) throw new Error("Not your client");
    await ctx.db.delete(id);
  },
});

export const markTouch = authenticatedMutation({
  args: { id: v.id("pastClients"), key: v.string(), done: v.boolean() },
  handler: async (ctx, a) => {
    const me = await hubViewer(ctx, ctx.userId);
    const row = await ctx.db.get(a.id);
    if (!row || row.agentEmail !== me.email.toLowerCase()) throw new Error("Not your client");
    const key = clean(a.key, 40);
    const done = a.done ? [...new Set([...row.done, key])] : row.done.filter(k => k !== key);
    await ctx.db.patch(a.id, { done: done.slice(-200) });
  },
});

// ───────────── Open house calendar ─────────────
export const openHouses = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    const today = chicagoDate();
    const slots = await ctx.db.query("openHouses").withIndex("by_date", q => q.gte("date", today)).take(300);
    const listings = (await ctx.db.query("listings").order("desc").take(400))
      .filter(l => ["Coming soon", "Active"].includes(l.status))
      .map(l => ({ _id: l._id, address: l.address, agentName: l.agentName }));
    const email = me.email.toLowerCase();
    return {
      me: email,
      isStaff: me.isStaff,
      listings,
      slots: slots
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
        .map(s => ({
          ...s,
          mine: s.hostEmail === email,
          canEdit: me.isStaff || s.createdByEmail === email,
        })),
    };
  },
});

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const addOpenHouse = authenticatedMutation({
  args: {
    listingId: v.optional(v.id("listings")),
    address: v.optional(v.string()),
    date: v.string(),
    start: v.string(),
    end: v.string(),
    hostMe: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date) || a.date < chicagoDate()) throw new Error("Pick a date from today on");
    if (!HHMM.test(a.start) || !HHMM.test(a.end) || a.end <= a.start) throw new Error("Pick a start and end time");
    let address = clean(a.address, 160);
    let listingAgent = me.name;
    if (a.listingId) {
      const l = await ctx.db.get(a.listingId);
      if (!l) throw new Error("Listing not found");
      address = l.address;
      listingAgent = l.agentName;
    }
    if (!address) throw new Error("Pick a listing or type the address");
    const agent = AGENTS.find(x => x.email.toLowerCase() === me.email.toLowerCase());
    return await ctx.db.insert("openHouses", {
      listingId: a.listingId,
      address,
      date: a.date,
      start: a.start,
      end: a.end,
      listingAgent,
      ...(a.hostMe ? { hostEmail: me.email.toLowerCase(), hostName: agent?.name ?? me.name } : {}),
      notes: clean(a.notes, 300) || undefined,
      createdByEmail: me.email.toLowerCase(),
      createdAt: Date.now(),
    });
  },
});

export const claimOpenHouse = authenticatedMutation({
  args: { id: v.id("openHouses"), claim: v.boolean() },
  handler: async (ctx, a) => {
    const me = await hubViewer(ctx, ctx.userId);
    const s = await ctx.db.get(a.id);
    if (!s) throw new Error("That open house was removed");
    const email = me.email.toLowerCase();
    if (a.claim) {
      if (s.hostEmail && s.hostEmail !== email) throw new Error(`${s.hostName} is already hosting this one`);
      const agent = AGENTS.find(x => x.email.toLowerCase() === email);
      await ctx.db.patch(a.id, { hostEmail: email, hostName: agent?.name ?? me.name });
      if (s.createdByEmail !== email) {
        await ctx.scheduler.runAfter(0, internal.push.toEmail, {
          email: s.createdByEmail,
          title: `${agent?.name ?? me.name} will host your open house`,
          body: `${s.address} · ${s.date} ${s.start}–${s.end}`,
          url: "/open-houses",
        });
      }
    } else {
      if (s.hostEmail !== email && !me.isStaff && s.createdByEmail !== email) throw new Error("Only the host can give it up");
      await ctx.db.patch(a.id, { hostEmail: undefined, hostName: undefined });
    }
  },
});

export const removeOpenHouse = authenticatedMutation({
  args: { id: v.id("openHouses") },
  handler: async (ctx, { id }) => {
    const me = await hubViewer(ctx, ctx.userId);
    const s = await ctx.db.get(id);
    if (!s) return;
    if (!me.isStaff && s.createdByEmail !== me.email.toLowerCase()) throw new Error("Only whoever added it can remove it");
    await ctx.db.delete(id);
  },
});

// ───────────── Market update kit ─────────────
type StatRow = Doc<"marketStats">;
export const marketKit = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    const row = await settingsRow(ctx, me.email);
    const email = me.email.toLowerCase();
    const areas = row?.areas ?? [];
    const out: { area: string; mred: StatRow | null; mine: StatRow | null }[] = [];
    for (const area of areas) {
      const rows = await ctx.db.query("marketStats").withIndex("by_area_month", q => q.eq("area", area)).order("desc").take(30);
      out.push({
        area,
        mred: rows.find(r => r.source === "mred") ?? null,
        mine: rows.find(r => r.source === "agent" && r.enteredBy === email) ?? null,
      });
    }
    return { areas: out };
  },
});

export const enterStats = authenticatedMutation({
  args: {
    area: v.string(),
    month: v.string(),
    median: v.number(),
    sales: v.number(),
    domMedian: v.number(),
    active: v.number(),
  },
  handler: async (ctx, a) => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!MARKET_AREAS.some(m => m.key === a.area)) throw new Error("Unknown area");
    if (!/^\d{4}-\d{2}$/.test(a.month)) throw new Error("Pick the month");
    for (const [k, n] of Object.entries({ median: a.median, sales: a.sales, domMedian: a.domMedian, active: a.active }))
      if (!Number.isFinite(n) || n < 0) throw new Error(`Check ${k}`);
    const email = me.email.toLowerCase();
    const old = (await ctx.db.query("marketStats").withIndex("by_area_month", q => q.eq("area", a.area).eq("month", a.month)).take(50)).find(
      r => r.source === "agent" && r.enteredBy === email,
    );
    const doc = { median: a.median, sales: a.sales, domMedian: a.domMedian, active: a.active, pulledAt: Date.now() };
    if (old) await ctx.db.patch(old._id, doc);
    else await ctx.db.insert("marketStats", { area: a.area, month: a.month, source: "agent", enteredBy: email, ...doc });
  },
});

// Monthly script (skills/mred_mls): which areas to pull (most-wanted first, capped) and where to save them.
export const areasWantedInternal = internalQuery({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query("agentMarketing").take(500);
    const n = new Map<string, number>();
    for (const r of rows) for (const a of r.areas ?? []) n.set(a, (n.get(a) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, MONTHLY_AREA_CAP).map(([area, agents]) => ({ area, agents }));
  },
});

export const saveStatsInternal = internalMutation({
  args: {
    month: v.string(),
    rows: v.array(
      v.object({
        area: v.string(),
        sales: v.optional(v.number()),
        median: v.optional(v.number()),
        yoyPct: v.optional(v.number()),
        domMedian: v.optional(v.number()),
        soldToList: v.optional(v.number()),
        active: v.optional(v.number()),
        monthsSupply: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, a) => {
    let saved = 0;
    for (const r of a.rows) {
      if (!MARKET_AREAS.some(m => m.key === r.area)) continue;
      const old = (await ctx.db.query("marketStats").withIndex("by_area_month", q => q.eq("area", r.area).eq("month", a.month)).take(50)).find(
        x => x.source === "mred",
      );
      const doc = { ...r, pulledAt: Date.now() };
      if (old) await ctx.db.patch(old._id, doc);
      else await ctx.db.insert("marketStats", { ...doc, month: a.month, source: "mred" });
      saved += 1;
    }
    return { saved };
  },
});

// e2e cleanup (dev only use)
export const cleanupE2eInternal = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const e = email.toLowerCase();
    for (const r of await ctx.db.query("reviewRequests").withIndex("by_agent", q => q.eq("agentEmail", e)).take(500)) await ctx.db.delete(r._id);
    for (const r of await ctx.db.query("pastClients").withIndex("by_agent", q => q.eq("agentEmail", e)).take(500)) await ctx.db.delete(r._id);
    for (const r of await ctx.db.query("openHouses").take(500)) if (r.createdByEmail === e) await ctx.db.delete(r._id as Id<"openHouses">);
    for (const r of await ctx.db.query("marketStats").take(2000)) if (r.enteredBy === e) await ctx.db.delete(r._id);
    const s = await settingsRow(ctx, e);
    if (s) await ctx.db.delete(s._id);
  },
});
