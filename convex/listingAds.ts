// "Your ad campaigns" per listing: Instagram/Facebook, Google, Lofty and the
// listing's web pages. Meta/Google numbers come from the connected ads accounts
// (convex/paidAds.ts, matched by street in the campaign name); Lofty has no ads
// API so it is typed in. Website numbers come from Google
// Analytics (property 557186005 tracks spacematchinc.com + teamspacematch.com).
// Sellers see results only, never spend or budget. No AI anywhere here.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { OPS_EMAILS, agentByEmail, isAdminEmail } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { addressKey } from "./launchSteps";

declare const process: { env: Record<string, string | undefined> };

export const AD_CHANNELS = ["meta", "google", "lofty", "website"] as const;
export const AD_STATUSES = ["not_started", "scheduled", "running", "paused", "ended"] as const;
const MANUAL = ["meta", "google", "lofty"] as const;
const GA_PROPERTY = "557186005";
const OUR_HOSTS = /(^|\.)(spacematchinc\.com|teamspacematch\.com)$/i;
const REFRESH_COOLDOWN_MS = 10 * 60e3;
const LEADER_EMAILS = ["brandon@spacematchinc.com", "sergio.monjane@spacematchinc.com"];

async function canEdit(ctx: QueryCtx, userId: Id<"users">, listingId: Id<"listings">) {
  const user = await ctx.db.get(userId);
  const email = (user?.email ?? "").toLowerCase();
  const staff = isAdminEmail(email) || OPS_EMAILS.includes(email) || LEADER_EMAILS.includes(email);
  const l = await ctx.db.get(listingId);
  if (!l || !(staff || l.agentEmail === email)) throw new Error("Listing not found");
  return { email, staff, l, name: agentByEmail(email)?.name ?? user?.name ?? email };
}

const rowsFor = (ctx: QueryCtx, listingId: Id<"listings">) =>
  ctx.db.query("listingAds").withIndex("by_listing", q => q.eq("listingId", listingId)).collect();

// ---------- Agent side ----------

export const forListing = authenticatedQuery({
  args: { id: v.id("listings") },
  handler: async (ctx, { id }) => {
    const { staff, l } = await canEdit(ctx, ctx.userId, id);
    const rows = await rowsFor(ctx, id);
    const web = rows.find(r => r.channel === "website");
    return {
      rows: rows.map(r => ({ ...r, pages: r.pages ? (JSON.parse(r.pages) as WebPage[]) : [] })),
      webMatch: matchInfo(l),
      // Street without the suffix, as agents should put it in campaign names ("2147 W Thomas").
      street: l.address.split(",")[0].replace(/\s+(st|street|ave|avenue|rd|road|blvd|dr|drive|ct|court|pl|place|ln|lane|pkwy|ter|way)\.?$/i, "").trim(),
      webRefreshing: !!web?.requestedAt && (!web.updatedAt || web.requestedAt > web.updatedAt) && Date.now() - web.requestedAt < 5 * 60e3,
      staff,
    };
  },
});

const num = v.optional(v.union(v.number(), v.null()));
export const save = authenticatedMutation({
  args: {
    id: v.id("listings"),
    channel: v.union(v.literal("meta"), v.literal("google"), v.literal("lofty")),
    status: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    reach: num, clicks: num, leads: num, spend: num, budget: num,
    campaignRef: v.optional(v.string()),
    adLink: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { id, channel, ...a }) => {
    const { email } = await canEdit(ctx, ctx.userId, id);
    if (!(AD_STATUSES as readonly string[]).includes(a.status)) throw new Error("Pick a status");
    const date = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
    const n = (x: number | null | undefined) => {
      if (x === null || x === undefined) return undefined;
      if (!Number.isFinite(x) || x < 0 || x > 1e9) throw new Error("Numbers look off");
      return Math.round(x * 100) / 100;
    };
    const link = (a.adLink ?? "").trim().slice(0, 600);
    if (link && !/^https?:\/\//.test(link)) throw new Error("Ad link must start with https://");
    const startDate = date(a.startDate), endDate = date(a.endDate);
    if (startDate && endDate && endDate < startDate) throw new Error("End date is before the start date");
    const row = {
      listingId: id, channel, status: a.status, startDate, endDate,
      reach: n(a.reach), clicks: n(a.clicks), leads: n(a.leads), spend: n(a.spend), budget: n(a.budget),
      campaignRef: (a.campaignRef ?? "").trim().slice(0, 200) || undefined,
      adLink: link || undefined,
      note: (a.note ?? "").trim().slice(0, 400) || undefined,
      source: "manual", updatedByEmail: email, updatedAt: Date.now(),
    };
    const cur = (await rowsFor(ctx, id)).find(r => r.channel === channel);
    if (cur && (cur.source === "meta" || cur.source === "google_ads")) {
      // Numbers come from the ads account; the agent only edits their own fields.
      await ctx.db.patch(cur._id, { campaignRef: row.campaignRef, adLink: row.adLink, note: row.note, budget: row.budget, updatedByEmail: email });
      if (row.campaignRef !== cur.campaignRef) await ctx.scheduler.runAfter(0, internal.paidAds.refresh, { listingId: id });
      return null;
    }
    if (cur) await ctx.db.replace(cur._id, row);
    else await ctx.db.insert("listingAds", row);
    await ctx.db.patch(id, { updatedAt: Date.now() });
    // A typed campaign name may match a Meta/Google campaign → numbers fill in by themselves.
    if (channel !== "lofty" && row.campaignRef) await ctx.scheduler.runAfter(0, internal.paidAds.refresh, { listingId: id });
    return null;
  },
});

export const requestWebRefresh = authenticatedMutation({
  args: { id: v.id("listings") },
  handler: async (ctx, { id }) => {
    const { l } = await canEdit(ctx, ctx.userId, id);
    if (!matchInfo(l).patterns.length) throw new Error("Add the property website link or MLS # in Details first");
    const cur = (await rowsFor(ctx, id)).find(r => r.channel === "website");
    const now = Date.now();
    if (cur && (now - (cur.requestedAt ?? 0) < REFRESH_COOLDOWN_MS || now - cur.updatedAt < REFRESH_COOLDOWN_MS)) return { started: false };
    if (cur) await ctx.db.patch(cur._id, { requestedAt: now });
    else await ctx.db.insert("listingAds", { listingId: id, channel: "website", status: "not_started", source: "ga", requestedAt: now, updatedAt: 0 });
    await ctx.scheduler.runAfter(0, internal.listingAds.refreshWeb, { listingId: id });
    return { started: true };
  },
});

// ---------- Seller side (called from listings.portal) ----------

export type PublicAd = {
  channel: string; status: string; startDate?: string; endDate?: string;
  reach?: number; views?: number; clicks?: number; leads?: number; adLink?: string; note?: string;
  auto: boolean; source: string; updatedAt: number;
};

export async function publicAds(ctx: QueryCtx, listingId: Id<"listings">): Promise<PublicAd[]> {
  const rows = await rowsFor(ctx, listingId);
  const order = (c: string) => (AD_CHANNELS as readonly string[]).indexOf(c);
  return rows
    .filter(r => r.updatedAt > 0 && (r.channel === "website" ? (r.views ?? 0) > 0 : r.status !== "not_started"))
    // A paused auto campaign that never ran (e.g. an Ad Kit draft) isn't shown to sellers.
    .filter(r => !(r.source !== "manual" && r.channel !== "website" && r.status === "paused" && !(r.reach || r.clicks)))
    .sort((a, b) => order(a.channel) - order(b.channel))
    // Spend, budget, campaign IDs and errors stay agent-only.
    .map(r => ({
      channel: r.channel, status: r.channel === "website" ? "running" : r.status, startDate: r.startDate, endDate: r.endDate,
      reach: r.reach, views: r.views, clicks: r.clicks, leads: r.leads, adLink: r.adLink, note: r.note,
      auto: r.source !== "manual", source: r.source, updatedAt: r.updatedAt,
    }));
}

export async function adsSummary(ctx: QueryCtx, listingId: Id<"listings">) {
  const rows = await rowsFor(ctx, listingId);
  return { running: rows.filter(r => r.channel !== "website" && r.status === "running").length };
}

// ---------- Google Analytics (website card) ----------

type WebPage = { host: string; path: string; views: number };

// Which GA page paths belong to this listing: the property website link (if it
// is on one of our two sites), the MLS # and the street address slug, e.g.
// /properties/1651-n-karlov-avenue-…-mrd12544139, /listing-detail/…/4835-N-Kimball-AVE…,
// /home-search/listings/…-926-E-43rd-Street…, /2541-cobblewood.
export function matchInfo(l: Pick<Doc<"listings">, "address" | "mlsNumber" | "links">) {
  const patterns: string[] = [];
  const by: string[] = [];
  const site = l.links?.website;
  let offSite: string | undefined;
  if (site) {
    try {
      const u = new URL(site);
      const path = u.pathname.replace(/\/+$/, "");
      if (OUR_HOSTS.test(u.hostname) && path) {
        patterns.push(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?$`);
        by.push("website link");
      } else if (!OUR_HOSTS.test(u.hostname)) offSite = u.hostname;
    } catch { /* ignore bad link */ }
  }
  const mls = (l.mlsNumber ?? "").replace(/\D/g, "");
  if (mls.length >= 6) { patterns.push(mls); by.push("MLS #"); }
  const m = addressKey(l.address).match(/^(\d+[a-z]?) (?:([nsew]) )?([a-z0-9']+)$/);
  if (m) {
    const dirs: Record<string, string> = { n: "north", s: "south", e: "east", w: "west" };
    const dir = m[2] ? `(${m[2]}|${dirs[m[2]]})-` : "([nsew]-|north-|south-|east-|west-)?";
    patterns.push(`(^|[/-])${m[1]}-${dir}${m[3].replace(/'/g, "")}([-/]|$)`);
    by.push("address");
  }
  return { patterns, by, offSite };
}

export const listingForWeb = internalQuery({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    await syncRoster(ctx);
    const l = await ctx.db.get(listingId);
    if (!l) return null;
    return { address: l.address, mlsNumber: l.mlsNumber, links: l.links, createdAt: l.createdAt, liveDate: l.liveDate };
  },
});

export const activeListingIds = internalQuery({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const rows = await ctx.db.query("listings").collect();
    return rows.filter(l => ["Coming soon", "Active", "Under contract"].includes(l.status)).map(l => l._id);
  },
});

export const saveWeb = internalMutation({
  args: {
    listingId: v.id("listings"),
    ok: v.boolean(),
    error: v.optional(v.string()),
    startDate: v.optional(v.string()),
    reach: v.optional(v.number()), views: v.optional(v.number()), clicks: v.optional(v.number()), leads: v.optional(v.number()),
    pages: v.optional(v.string()),
  },
  handler: async (ctx, { listingId, ok, error, ...d }) => {
    await syncRoster(ctx);
    const cur = (await rowsFor(ctx, listingId)).find(r => r.channel === "website");
    const now = Date.now();
    if (!ok) {
      // Keep the last good numbers; show the error to the agent.
      if (cur) await ctx.db.patch(cur._id, { error: (error ?? "Google Analytics failed").slice(0, 300), requestedAt: undefined });
      else await ctx.db.insert("listingAds", { listingId, channel: "website", status: "not_started", source: "ga", error: (error ?? "Google Analytics failed").slice(0, 300), updatedAt: 0 });
      return null;
    }
    const row = { listingId, channel: "website", status: (d.views ?? 0) > 0 ? "running" : "not_started", source: "ga", ...d, error: undefined, requestedAt: undefined, updatedAt: now };
    if (cur) await ctx.db.replace(cur._id, row);
    else await ctx.db.insert("listingAds", row);
    return null;
  },
});

type GaRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };

async function gaReport(body: Record<string, unknown>): Promise<GaRow[]> {
  const res = await fetch(`${process.env.VIKTOR_SPACES_API_URL}/api/viktor-spaces/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_name: process.env.VIKTOR_SPACES_PROJECT_NAME,
      project_secret: process.env.VIKTOR_SPACES_PROJECT_SECRET,
      space_id: process.env.VIKTOR_AUTH_RESOURCE_ID,
      role: "mcp_pd_google_analytics_run_report_in_ga4",
      arguments: { property: GA_PROPERTY, ...body },
    }),
  });
  if (!res.ok) throw new Error(`Google Analytics HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Google Analytics tool failed");
  const r = json.result as { content?: string; error?: string };
  if (!r?.content) throw new Error(r?.error ?? "Google Analytics returned nothing");
  const c = JSON.parse(r.content);
  const b = c.body ?? c;
  if (c.status_code && c.status_code >= 400) throw new Error(`Google Analytics ${c.status_code}`);
  if (b.error) throw new Error(b.error.message ?? "Google Analytics error");
  return (b.rows ?? []) as GaRow[];
}

const pathFilter = (patterns: string[]) => ({
  orGroup: { expressions: patterns.map(p => ({ filter: { fieldName: "pagePath", stringFilter: { matchType: "PARTIAL_REGEXP", value: p, caseSensitive: false } } })) },
});

export async function fetchWeb(patterns: string[], startDate: string) {
  const range = { startDate, endDate: "today" };
  // 1) Deduplicated visitors + page views across every matching page.
  const totals = await gaReport({ ...range, metrics: ["totalUsers", "screenPageViews"], dimensionFilter: pathFilter(patterns) });
  // 2) Per page views + inquiries (Lofty fires generate_lead / contact_click).
  const events = await gaReport({
    ...range,
    metrics: ["eventCount"],
    dimensions: ["hostName", "pagePath", "eventName"],
    dimensionFilter: {
      andGroup: {
        expressions: [
          pathFilter(patterns),
          { filter: { fieldName: "eventName", inListFilter: { values: ["page_view", "generate_lead", "contact_click"] } } },
        ],
      },
    },
  });
  const t = totals[0]?.metricValues ?? [];
  const pages = new Map<string, WebPage>();
  let leads = 0, clicks = 0;
  for (const r of events) {
    const [host, path, ev] = (r.dimensionValues ?? []).map(d => d.value);
    const n = Number(r.metricValues?.[0]?.value ?? 0);
    if (ev === "generate_lead") leads += n;
    else if (ev === "contact_click") clicks += n;
    else {
      const k = `${host}${path}`;
      const p = pages.get(k) ?? { host: host.replace(/^www\./, ""), path, views: 0 };
      p.views += n;
      pages.set(k, p);
    }
  }
  return {
    reach: Number(t[0]?.value ?? 0),
    views: Number(t[1]?.value ?? 0),
    leads, clicks,
    pages: [...pages.values()].sort((a, b) => b.views - a.views).slice(0, 6),
  };
}

export const refreshWeb = internalAction({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }): Promise<Record<string, unknown>> => {
    await syncRoster(ctx);
    const l = await ctx.runQuery(internal.listingAds.listingForWeb, { listingId });
    if (!l) return { status: "gone" };
    const { patterns } = matchInfo(l);
    if (!patterns.length) return { status: "no-match-info" };
    // From the MLS live date; without one, the 60 days before it was added to the Hub
    // (listings are often added after their pages already exist).
    const startDate = l.liveDate ?? new Date(l.createdAt - 60 * 864e5).toISOString().slice(0, 10);
    try {
      const d = await fetchWeb(patterns, startDate);
      await ctx.runMutation(internal.listingAds.saveWeb, { listingId, ok: true, startDate, reach: d.reach, views: d.views, clicks: d.clicks, leads: d.leads, pages: JSON.stringify(d.pages) });
      return { status: "ok", ...d };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.listingAds.saveWeb, { listingId, ok: false, error: msg });
      return { status: "error", error: msg };
    }
  },
});

export const refreshAllWeb = internalAction({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    await syncRoster(ctx);
    const ids = await ctx.runQuery(internal.listingAds.activeListingIds, {});
    const out: Record<string, number> = { listings: ids.length };
    for (const id of ids) {
      const r = (await ctx.runAction(internal.listingAds.refreshWeb, { listingId: id })) as { status: string };
      out[r.status] = (out[r.status] ?? 0) + 1;
    }
    console.log("listing web refresh", JSON.stringify(out));
    return out;
  },
});

// Sandbox check: GA numbers for any address / MLS / link, nothing saved.
export const previewWeb = internalAction({
  args: { address: v.string(), mlsNumber: v.optional(v.string()), website: v.optional(v.string()), startDate: v.string() },
  handler: async (ctx, a) => {
    await syncRoster(ctx);
    const { patterns, by } = matchInfo({ address: a.address, mlsNumber: a.mlsNumber, links: { website: a.website } });
    return { patterns, by, ...(await fetchWeb(patterns, a.startDate)) };
  },
});

export { MANUAL as MANUAL_AD_CHANNELS };
