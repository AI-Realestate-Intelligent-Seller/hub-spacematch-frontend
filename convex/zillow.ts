// Zillow views/saves without typing. Reads Zillow "Your Daily Listing Report"
// emails in team@ (agents forward them) and michael@ (his Zillow login), stores
// one row per address per day, and sums them into each listing's weekly numbers.
// Plain code, no AI. Also: Gmail forwarding confirmation codes for agents
// setting up their forward rule to team@.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { authenticatedAction, authenticatedQuery } from "./functions";
import { MAILBOXES, gmailFind, gmailGetFull } from "./gateway";
import { addressKey, weekOf } from "./launchSteps";
import { formatPrice } from "./address";
import { mine } from "./listings";
import { gmailBody, parseForwardingConfirmation, parseZillowDaily } from "./zillowParse";

const QUERY = 'subject:"Daily Listing Report"';
// Only for a one-off backfill of Michael's own past reports (never in the cron).
const EXTRA = { hurrikang: { key: "hurrikang", label: "hurrikang78@gmail.com", prefix: "mcp_gmail_2_pd_gmail_" } } as const;

const dayMs = (day: string) => Date.parse(`${day}T12:00:00Z`);

/** Sum a listing's Zillow reports into weekly listingMetrics rows. */
export async function rollupZillow(ctx: MutationCtx, l: Doc<"listings">) {
  const start = new Date((l.liveDate ? dayMs(l.liveDate) : l.createdAt) - 21 * 864e5).toISOString().slice(0, 10);
  const reports = await ctx.db.query("zillowReports").withIndex("by_address_day", q => q.eq("addressKey", l.addressKey).gte("day", start)).collect();
  const weeks = new Map<string, { views: number; saves: number; days: number }>();
  for (const r of reports) {
    const wk = weekOf(dayMs(r.day));
    const w = weeks.get(wk) ?? { views: 0, saves: 0, days: 0 };
    w.views += r.views; w.saves += r.saves; w.days++;
    weeks.set(wk, w);
  }
  for (const [wk, w] of weeks) {
    const cur = await ctx.db.query("listingMetrics").withIndex("by_listing_week", q => q.eq("listingId", l._id).eq("weekOf", wk)).first();
    if (cur && cur.zillowViews === w.views && cur.zillowSaves === w.saves && cur.zillowDays === w.days && cur.auto?.includes("zillow")) continue;
    const auto = Array.from(new Set([...(cur?.auto ?? []), "zillow"]));
    if (cur) await ctx.db.patch(cur._id, { zillowViews: w.views, zillowSaves: w.saves, zillowDays: w.days, auto, updatedAt: Date.now() });
    else await ctx.db.insert("listingMetrics", { listingId: l._id, weekOf: wk, zillowViews: w.views, zillowSaves: w.saves, zillowDays: w.days, auto, enteredByEmail: "auto", updatedAt: Date.now() });
  }
  return weeks.size;
}

export const ingest = internalMutation({
  args: { externalId: v.string(), address: v.string(), day: v.string(), views: v.number(), saves: v.number() },
  handler: async (ctx, a) => {
    const key = addressKey(a.address);
    const cur = await ctx.db.query("zillowReports").withIndex("by_address_day", q => q.eq("addressKey", key).eq("day", a.day)).first();
    if (cur && cur.views === a.views && cur.saves === a.saves) return { status: "dup" };
    if (cur) await ctx.db.patch(cur._id, { views: a.views, saves: a.saves, externalId: a.externalId });
    else await ctx.db.insert("zillowReports", { addressKey: key, address: a.address.slice(0, 200), day: a.day, views: a.views, saves: a.saves, externalId: a.externalId, createdAt: Date.now() });
    const listings = await ctx.db.query("listings").withIndex("by_addressKey", q => q.eq("addressKey", key)).collect();
    for (const l of listings) await rollupZillow(ctx, l);
    return { status: listings.length ? "matched" : "unmatched" };
  },
});

export const rollupListing = internalMutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const l = await ctx.db.get(listingId);
    return l ? await rollupZillow(ctx, l) : 0;
  },
});

export const knownIds = internalQuery({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }) => {
    const out: string[] = [];
    for (const id of ids) if (await ctx.db.query("zillowReports").withIndex("by_external", q => q.eq("externalId", id)).first()) out.push(id);
    return out;
  },
});

export const saveStatus = internalMutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, { key, value }) => {
    const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", key)).unique();
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("hubSettings", { key, value });
  },
});

export const scan = internalAction({
  args: { days: v.optional(v.number()), max: v.optional(v.number()), mailbox: v.optional(v.string()) },
  handler: async (ctx, { days, max, mailbox }): Promise<Record<string, unknown>> => {
    const boxes = mailbox === "hurrikang" ? [EXTRA.hurrikang] : MAILBOXES.filter(b => !mailbox || b.key === mailbox);
    const tally: Record<string, number> = { seen: 0, skipped: 0, known: 0 };
    const errors: string[] = [];
    for (const box of boxes) {
      try {
        const msgs = await gmailFind(box.prefix, `${QUERY} newer_than:${days ?? 4}d`, max ?? 60, ["subject", "date"]);
        tally.seen += msgs.length;
        const ext = msgs.map(m => `gmail:${box.key}:${m.id}`);
        const known = new Set(await ctx.runQuery(internal.zillow.knownIds, { ids: ext }));
        for (const m of msgs) {
          const externalId = `gmail:${box.key}:${m.id}`;
          if (known.has(externalId)) { tally.known++; continue; }
          const full = await gmailGetFull(box.prefix, m.id);
          const p = parseZillowDaily(m.subject ?? "", gmailBody(full.payload as never), Number(full.internalDate));
          if (!p || !p.day) { tally.skipped++; continue; }
          const r: { status: string } = await ctx.runMutation(internal.zillow.ingest, { externalId, ...p });
          tally[r.status] = (tally[r.status] ?? 0) + 1;
        }
      } catch (e) {
        errors.push(`${box.label}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300));
      }
    }
    const status = { at: Date.now(), tally, errors };
    if (!mailbox) await ctx.runMutation(internal.zillow.saveStatus, { key: "zillow:lastScan", value: JSON.stringify(status) });
    console.log("zillow scan", JSON.stringify(status));
    if (errors.length && errors.length === boxes.length) throw new Error(errors.join(" | "));
    return status;
  },
});

// ---------- Agent side ----------

export const forListing = authenticatedQuery({
  args: { id: v.id("listings") },
  handler: async (ctx, { id }) => {
    const { l } = await mine(ctx, ctx.userId, id);
    const recent = await ctx.db.query("zillowReports").withIndex("by_address_day", q => q.eq("addressKey", l.addressKey)).order("desc").take(14);
    const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", "zillow:lastScan")).unique();
    const last = row ? (JSON.parse(row.value) as { at: number; errors: string[] }) : null;
    return {
      days: recent.map(r => ({ day: r.day, views: r.views, saves: r.saves })),
      lastScanAt: last?.at ?? null,
      scanOk: last ? last.errors.length === 0 : null,
      reel: l.reelAuto ?? null,
      page: l.zillowPage ?? null,
    };
  },
});

/** Gmail sends a confirmation code to team@ when an agent adds team@ as a forwarding address. */
export const forwardingCode = authenticatedAction({
  args: { email: v.string() },
  handler: async (_ctx, { email }): Promise<{ code: string; from: string; at: string } | null> => {
    const want = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(want)) throw new Error("Type the Gmail address you are forwarding from");
    const msgs = await gmailFind(MAILBOXES[0].prefix, 'subject:"Gmail Forwarding Confirmation" newer_than:2d', 25, ["subject", "date"]);
    for (const m of msgs) {
      const p = parseForwardingConfirmation(m.subject ?? "");
      if (p && p.from === want) return { code: p.code, from: p.from, at: m.date ?? "" };
    }
    return null;
  },
});

// ---------- Public Zillow page (read by a Viktor script twice a week) ----------

const PAGE_LIVE = ["Coming soon", "Active", "Under contract"];

export const pageTargets = internalQuery({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query("listings").collect();
    return rows.filter(l => PAGE_LIVE.includes(l.status) || (l.status === "Preparing" && !!l.links?.zillow)).map(l => ({ _id: l._id, address: l.address, zillow: l.links?.zillow ?? null }));
  },
});

/** Totals off the Zillow page → this week's views/saves = growth since the last check before this week. */
export const ingestPage = internalMutation({
  args: {
    listingId: v.id("listings"), url: v.string(), views: v.number(), saves: v.number(), daysOnZillow: v.optional(v.number()),
    price: v.optional(v.number()), homeStatus: v.optional(v.string()), contingent: v.optional(v.boolean()),
  },
  handler: async (ctx, { listingId, url, views, saves, daysOnZillow, price, homeStatus, contingent }) => {
    const l = await ctx.db.get(listingId);
    if (!l) return { status: "gone" };
    const now = Date.now();
    await ctx.db.insert("zillowSnapshots", { listingId, at: now, views, saves });
    await ctx.db.patch(listingId, {
      zillowPage: { url, views, saves, checkedAt: now, ...(price ? { price } : {}), ...(homeStatus ? { homeStatus } : {}) },
      ...(l.links?.zillow ? {} : { links: { ...(l.links ?? {}), zillow: url } }),
    });
    const sync = await applyZillowPriceStatus(ctx, l, price, homeStatus, contingent, now);
    if (sync.length) console.log("zillow price/status", l.address, sync.join("; "));
    const wk = weekOf(now);
    const weekStart = Date.parse(`${wk}T00:00:00Z`);
    const before = await ctx.db.query("zillowSnapshots").withIndex("by_listing", q => q.eq("listingId", listingId).lt("at", weekStart)).order("desc").first();
    // First check ever: only a listing that went live this week gets its whole total
    // as this week's number; otherwise wait for the next check to measure growth.
    if (!before) {
      const first = await ctx.db.query("zillowSnapshots").withIndex("by_listing", q => q.eq("listingId", listingId).lt("at", now)).first();
      const fresh = (daysOnZillow ?? 99) <= (now - weekStart) / 864e5 + 1;
      if (!first && !fresh) return { status: "baseline" };
      if (first && !fresh) {
        const wv = Math.max(0, views - first.views), ws = Math.max(0, saves - first.saves);
        return await writeWeek(ctx, listingId, wk, wv, ws, now);
      }
    }
    const wViews = Math.max(0, views - (before?.views ?? 0));
    const wSaves = Math.max(0, saves - (before?.saves ?? 0));
    return await writeWeek(ctx, listingId, wk, wViews, wSaves, now);
  },
});

// Zillow status → Hub status. Only moves forward (Coming soon → Active → Under
// contract → Closed); a step back (deal fell through) is left to the agent.
const STATUS_ORDER = ["Preparing", "Coming soon", "Active", "Under contract", "Closed"];
export function hubStatusFromZillow(homeStatus?: string, contingent?: boolean): string | undefined {
  const z = (homeStatus ?? "").toUpperCase();
  if (z === "SOLD" || z === "RECENTLY_SOLD") return "Closed";
  if (z === "PENDING") return "Under contract";
  if (z === "FOR_SALE") return contingent ? "Under contract" : "Active";
  if (z === "COMING_SOON" || z === "PRE_FORECLOSURE_COMING_SOON") return "Coming soon";
  return undefined;
}

/** Price changes and Pending/Sold read off the Zillow page → listing + seller feed. */
export async function applyZillowPriceStatus(ctx: MutationCtx, l: Doc<"listings">, price: number | undefined, homeStatus: string | undefined, contingent: boolean | undefined, now: number) {
  const changes: string[] = [];
  const patch: Partial<Doc<"listings">> = {};
  const next = hubStatusFromZillow(homeStatus, contingent);
  const cur = STATUS_ORDER.indexOf(l.status);
  if (next && cur >= 0 && STATUS_ORDER.indexOf(next) > cur) {
    patch.status = next;
    const title = next === "Closed" ? `Sold${price ? ` for ${formatPrice(String(price))}` : ""}` : next === "Under contract" ? "Under contract" : `Now ${next.toLowerCase()}`;
    await ctx.db.insert("listingEvents", { listingId: l._id, kind: "update", status: "published", title, body: "Updated automatically from the listing's Zillow page.", source: "zillow", createdAt: now });
    changes.push(`status ${l.status} → ${next}`);
  }
  // List price: only while it's for sale (a sold page shows the sale price).
  const forSale = (homeStatus ?? "").toUpperCase() === "FOR_SALE" || (homeStatus ?? "").toUpperCase() === "COMING_SOON";
  if (price && price > 1000 && forSale) {
    const np = formatPrice(String(price));
    const old = Number((l.price ?? "").replace(/[^\d.]/g, ""));
    if (np && old !== price) {
      patch.price = np;
      if (l.price && old) {
        const dir = price < old ? "Price reduced" : "Price updated";
        await ctx.db.insert("listingEvents", { listingId: l._id, kind: "price", status: "published", title: `${dir} to ${np}`, body: "Updated automatically from the listing's Zillow page.", source: "zillow", createdAt: now });
      }
      changes.push(`price ${l.price ?? "none"} → ${np}`);
    }
  }
  if (Object.keys(patch).length) await ctx.db.patch(l._id, { ...patch, updatedAt: now });
  return changes;
}

async function writeWeek(ctx: MutationCtx, listingId: Id<"listings">, wk: string, views: number, saves: number, now: number) {
  const cur = await ctx.db.query("listingMetrics").withIndex("by_listing_week", q => q.eq("listingId", listingId).eq("weekOf", wk)).first();
  if (cur?.zillowDays) return { status: "email-wins" }; // daily email reports are more exact
  const auto = Array.from(new Set([...(cur?.auto ?? []), "zillow"]));
  if (cur) await ctx.db.patch(cur._id, { zillowViews: views, zillowSaves: saves, auto, updatedAt: now });
  else await ctx.db.insert("listingMetrics", { listingId, weekOf: wk, zillowViews: views, zillowSaves: saves, auto, enteredByEmail: "auto", updatedAt: now });
  return { status: "ok", weekViews: views, weekSaves: saves };
}
