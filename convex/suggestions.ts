// "What we'd do next": rule-based suggestions from the listing's own numbers.
// Plain code, no AI. Agent reviews drafts on /listings/:id and publishes; the
// seller sees published ones on /s/:token and can approve the plan.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { mine, openHouseSignins } from "./listings";

export type Rule = { ruleKey: string; title: string; why: string; action: string };

// Benchmarks (tunable): 1 showing per 150 Zillow views; 3% saves-to-views.
export const VIEWS_PER_SHOWING = 150;
export const SAVE_RATE = 0.03;

const THEMES: { key: string; label: string; re: RegExp; action: string }[] = [
  { key: "price", label: "price", re: /\b(price|priced|pricey|overpriced|expensive|too high|value|cost)\b/i, action: "Review price against the latest comps, or offer a buyer credit." },
  { key: "size", label: "size or layout", re: /\b(small|size|tight|cramped|layout|bedroom|closet|storage|square f|sq ?ft)\b/i, action: "Add a floor plan with room sizes and photos that show scale." },
  { key: "condition", label: "condition", re: /\b(condition|dated|update|updates|repair|repairs|worn|old|smell|odor|damage|carpet|kitchen needs|bath needs)\b/i, action: "Fix or disclose what buyers mention; consider a pre-inspection report." },
];

const daysOn = (live?: string) => {
  if (!live) return null;
  const d = Math.floor((Date.now() - new Date(`${live}T12:00:00-05:00`).getTime()) / 864e5);
  return d >= 0 ? d : null;
};

export type RuleInput = {
  views: number; saves: number; showings: number; offers: number; dom: number | null;
  openHouseDone: boolean; openHouseVisitors: number;
  feedback: { text: string; priceOpinion?: string }[];
};

export function computeRules(x: RuleInput): Rule[] {
  const out: Rule[] = [];
  const n = (k: number) => k.toLocaleString("en-US");
  if (x.views >= 300 && x.views / Math.max(1, x.showings) > VIEWS_PER_SHOWING) {
    const per = x.showings ? `about 1 showing per ${n(Math.round(x.views / x.showings))} views` : "no showings yet";
    out.push({ ruleKey: "views_showings", title: "Turn online views into showings", why: `${n(x.views)} Zillow views but ${x.showings} showing${x.showings === 1 ? "" : "s"}: ${per}. Healthy is 1 per ${VIEWS_PER_SHOWING} or better.`, action: "Hold an open house, test a new cover photo, and check price against the newest comps." });
  }
  if (x.views >= 200 && x.saves / x.views < SAVE_RATE) {
    out.push({ ruleKey: "save_rate", title: "Refresh the lead photo", why: `${n(x.saves)} saves from ${n(x.views)} views (${((x.saves / x.views) * 100).toFixed(1)}%). Strong listings get ${SAVE_RATE * 100}% or more.`, action: "Swap the first photo for the strongest exterior or living-room shot and re-order the gallery." });
  }
  if (x.dom !== null && x.dom >= 14 && x.offers === 0) {
    out.push({ ruleKey: "day14_pricing", title: "Pricing review against new comps", why: `${x.dom} days on market and no offers yet.`, action: "Day-14 checkpoint: compare price to homes listed or sold nearby in the last 30 days, then adjust or hold." });
  }
  if (x.dom !== null && x.dom >= 3 && x.dom <= 21 && !x.openHouseDone && x.openHouseVisitors === 0) {
    out.push({ ruleKey: "open_house", title: "Schedule an open house", why: `${x.dom} day${x.dom === 1 ? "" : "s"} live with no open house yet. The first 10 days bring the most buyer traffic.`, action: "Book an open house for this weekend and send it to our buyer list." });
  }
  if (x.feedback.length) {
    for (const t of THEMES) {
      const hits = x.feedback.filter(f => t.re.test(f.text) || (t.key === "price" && /high|over/i.test(f.priceOpinion ?? ""))).length;
      if (hits >= 2) out.push({ ruleKey: `feedback_${t.key}`, title: `Address ${t.label} feedback`, why: `${hits} of ${x.feedback.length} buyer feedback notes mention ${t.label}.`, action: t.action });
    }
  }
  return out;
}

async function ruleInput(ctx: QueryCtx, l: Doc<"listings">): Promise<RuleInput> {
  const ev = await ctx.db.query("listingEvents").withIndex("by_listing", q => q.eq("listingId", l._id)).collect();
  const m = await ctx.db.query("listingMetrics").withIndex("by_listing_week", q => q.eq("listingId", l._id)).collect();
  const views = Math.max(m.reduce((a, r) => a + (r.zillowViews ?? 0), 0), l.zillowPage?.views ?? 0);
  const saves = Math.max(m.reduce((a, r) => a + (r.zillowSaves ?? 0), 0), l.zillowPage?.saves ?? 0);
  const visitors = (await openHouseSignins(ctx, l)).length;
  return {
    views, saves,
    showings: ev.filter(e => e.kind === "showing").length - ev.filter(e => e.kind === "cancelled").length,
    offers: ev.filter(e => e.kind === "offer").length,
    dom: daysOn(l.liveDate),
    openHouseDone: !!l.steps.find(s => s.key === "openHouse")?.done,
    openHouseVisitors: visitors,
    // Only published feedback, and only the words: never buyer-agent names.
    feedback: ev.filter(e => e.kind === "feedback" && e.status === "published").map(e => ({ text: `${e.title} ${e.body ?? ""}`, priceOpinion: e.priceOpinion })),
  };
}

const clean = (s: string, max: number) => s.trim().slice(0, max);
const rows = (ctx: QueryCtx, id: Id<"listings">) => ctx.db.query("listingSuggestions").withIndex("by_listing", q => q.eq("listingId", id)).collect();

/** Inserts a draft for each rule that fires and has never been suggested for this listing. */
async function sync(ctx: MutationCtx, l: Doc<"listings">) {
  const have = new Set((await rows(ctx, l._id)).map(r => r.ruleKey));
  const now = Date.now();
  let added = 0;
  for (const r of computeRules(await ruleInput(ctx, l))) {
    if (have.has(r.ruleKey)) continue;
    await ctx.db.insert("listingSuggestions", { listingId: l._id, ...r, status: "draft", createdAt: now, updatedAt: now });
    added++;
  }
  return added;
}

// ---------- Agent side ----------

export const forListing = authenticatedQuery({
  args: { id: v.id("listings") },
  handler: async (ctx, { id }) => {
    const { l } = await mine(ctx, ctx.userId, id);
    const all = await rows(ctx, id);
    const live = new Set(computeRules(await ruleInput(ctx, l)).map(r => r.ruleKey));
    return all.filter(r => r.status !== "dismissed").map(r => ({ ...r, stillTrue: r.ruleKey === "custom" || live.has(r.ruleKey) }));
  },
});

export const refresh = authenticatedMutation({
  args: { id: v.id("listings") },
  handler: async (ctx, { id }) => {
    const { l } = await mine(ctx, ctx.userId, id);
    return await sync(ctx, l);
  },
});

const text = { title: v.string(), why: v.string(), action: v.string() };
const check = (a: { title: string; why: string; action: string }) => {
  const t = { title: clean(a.title, 120), why: clean(a.why, 300), action: clean(a.action, 300) };
  if (!t.title) throw new Error("Add a title");
  return t;
};

export const edit = authenticatedMutation({
  args: { suggestionId: v.id("listingSuggestions"), ...text },
  handler: async (ctx, { suggestionId, ...a }) => {
    const s = await ctx.db.get(suggestionId);
    if (!s) throw new Error("Not found");
    await mine(ctx, ctx.userId, s.listingId);
    await ctx.db.patch(suggestionId, { ...check(a), updatedAt: Date.now() });
    return null;
  },
});

export const addCustom = authenticatedMutation({
  args: { id: v.id("listings"), ...text },
  handler: async (ctx, { id, ...a }) => {
    await mine(ctx, ctx.userId, id);
    const now = Date.now();
    return await ctx.db.insert("listingSuggestions", { listingId: id, ruleKey: "custom", ...check(a), status: "draft", createdAt: now, updatedAt: now });
  },
});

export const setStatus = authenticatedMutation({
  args: { suggestionId: v.id("listingSuggestions"), status: v.union(v.literal("draft"), v.literal("published"), v.literal("dismissed")) },
  handler: async (ctx, { suggestionId, status }) => {
    const s = await ctx.db.get(suggestionId);
    if (!s) throw new Error("Not found");
    await mine(ctx, ctx.userId, s.listingId);
    // Dismissed rule suggestions stay as a tombstone so the rule doesn't re-add them.
    if (status === "dismissed" && s.ruleKey === "custom") await ctx.db.delete(suggestionId);
    else await ctx.db.patch(suggestionId, { status, ...(status !== "published" ? { approvedAt: undefined } : {}), updatedAt: Date.now() });
    await ctx.db.patch(s.listingId, { updatedAt: Date.now() });
    return null;
  },
});

// ---------- Seller side (token, no login) ----------

export async function publicSuggestions(ctx: QueryCtx, id: Id<"listings">) {
  return (await rows(ctx, id)).filter(r => r.status === "published").map(r => ({ _id: r._id, title: r.title, why: r.why, action: r.action, approvedAt: r.approvedAt }));
}

export const approvePlan = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (token.length < 20) throw new Error("Link expired");
    const l = await ctx.db.query("listings").withIndex("by_token", q => q.eq("token", token)).first();
    if (!l) throw new Error("Link expired");
    const open = (await rows(ctx, l._id)).filter(r => r.status === "published" && !r.approvedAt);
    if (!open.length) return null;
    const now = Date.now();
    for (const r of open) await ctx.db.patch(r._id, { approvedAt: now });
    await ctx.db.insert("listingEvents", {
      listingId: l._id, kind: "approval", status: "published", source: "seller", createdAt: now,
      title: `${l.sellerName.split(/\s+/)[0]} approved the plan`, body: open.map(r => `• ${r.title}`).join("\n"),
    });
    await ctx.db.patch(l._id, { updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.listingMail.planApproved, { listingId: l._id, titles: open.map(r => r.title) });
    return null;
  },
});
