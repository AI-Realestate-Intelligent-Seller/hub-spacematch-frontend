// Ad Kit orders (Michael 2026-10-18): an agent who promised a seller advertising
// taps "Order ads", picks Essential/Signature/Luxury, pays ahead (Zelle/check) or
// from commission at closing (+surcharge). Admins approve → kit + paused Meta draft;
// admin flips it live → seller page shows "Ads live". Ledger per agent. No AI.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { agentByEmail, isAdminEmail } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { DEFAULT_PRICING, buildKit, priceOf, streetOf, type AdPricing } from "./adKit";
import { esc, hubUrl, sendMail, shell, table } from "./notify";
import { callIntegration } from "./gateway";

const META_ACCOUNT = "act_1658554918209535";
const PRICING_KEY = "adkit:pricing";
const BILLABLE = ["approved", "live", "done"];
const money = (n: number) => `$${n.toLocaleString()}`;
const TIER_NAME: Record<string, string> = { essential: "Essential", signature: "Signature", luxury: "Luxury" };

export async function getPricing(ctx: QueryCtx): Promise<AdPricing> {
  const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", PRICING_KEY)).first();
  if (!row) return DEFAULT_PRICING;
  try {
    return { ...DEFAULT_PRICING, ...(JSON.parse(row.value) as Partial<AdPricing>) };
  } catch {
    return DEFAULT_PRICING;
  }
}

async function viewer(ctx: QueryCtx, userId: Id<"users">) {
  const v = await hubViewer(ctx, userId);
  return { ...v, isAdmin: isAdminEmail(v.email) };
}

async function requireAdmin(ctx: QueryCtx, userId: Id<"users">) {
  const me = await viewer(ctx, userId);
  if (!me.isAdmin) throw new Error("Only admins can do that");
  return me;
}

const view = (o: Doc<"adOrders">) => ({ ...o, tierName: TIER_NAME[o.tier] ?? o.tier, kit: undefined, hasKit: !!o.kit });

// ---------- Agent side ----------

export const config = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await viewer(ctx, ctx.userId);
    const pending = me.isAdmin ? (await ctx.db.query("adOrders").withIndex("by_status", q => q.eq("status", "requested")).collect()).length : 0;
    return { pricing: await getPricing(ctx), isAdmin: me.isAdmin, pending };
  },
});

export const forListing = authenticatedQuery({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    const me = await viewer(ctx, ctx.userId);
    const l = await ctx.db.get(listingId);
    if (!l || !(me.isStaff || l.agentEmail === me.email)) return null;
    const rows = await ctx.db.query("adOrders").withIndex("by_listing", q => q.eq("listingId", listingId)).order("desc").collect();
    return {
      orders: rows.map(o => ({ ...view(o), kit: o.kit ? JSON.parse(o.kit) : null })),
      isAdmin: me.isAdmin,
    };
  },
});

export const place = authenticatedMutation({
  args: {
    listingId: v.id("listings"),
    tier: v.string(),
    openHouse: v.boolean(),
    payment: v.union(v.literal("ahead"), v.literal("closing")),
    authorized: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const me = await viewer(ctx, ctx.userId);
    const l = await ctx.db.get(a.listingId);
    if (!l || !(me.isStaff || l.agentEmail === me.email)) throw new Error("Listing not found");
    if (!a.authorized) throw new Error("Tick the box to authorize the charge");
    const open = await ctx.db.query("adOrders").withIndex("by_listing", q => q.eq("listingId", a.listingId)).collect();
    if (open.some(o => o.status === "requested")) throw new Error("There's already an ad order waiting for approval on this listing");
    const p = priceOf(await getPricing(ctx), a.tier, a.openHouse, a.payment);
    const now = Date.now();
    const id = await ctx.db.insert("adOrders", {
      listingId: l._id, address: l.address, agentEmail: l.agentEmail, agentName: l.agentName,
      tier: p.tier.key, openHouse: a.openHouse, payment: a.payment,
      spend: p.spend, fee: p.fee, surcharge: p.surcharge, total: p.total,
      status: "requested", paymentStatus: "unpaid", authorizedAt: now, orderedByEmail: me.email,
      note: a.note?.trim().slice(0, 500) || undefined, createdAt: now, updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.adOrders.mailAdmins, { id });
    return id;
  },
});

export const cancel = authenticatedMutation({
  args: { id: v.id("adOrders") },
  handler: async (ctx, { id }) => {
    const me = await viewer(ctx, ctx.userId);
    const o = await ctx.db.get(id);
    if (!o || !(me.isAdmin || o.agentEmail === me.email || o.orderedByEmail === me.email)) throw new Error("Order not found");
    if (o.status !== "requested") throw new Error("Only orders still waiting for approval can be cancelled — ask an admin");
    await ctx.db.patch(id, { status: "cancelled", updatedAt: Date.now() });
    return null;
  },
});

type LedgerRow = { agentEmail: string; agentName: string; owed: number; owedAhead: number; owedClosing: number; paid: number; feesEarned: number; feesPending: number; orders: number };

function ledgerOf(rows: Doc<"adOrders">[]) {
  const by = new Map<string, LedgerRow>();
  for (const o of rows) {
    if (!BILLABLE.includes(o.status)) continue;
    const r = by.get(o.agentEmail) ?? { agentEmail: o.agentEmail, agentName: o.agentName, owed: 0, owedAhead: 0, owedClosing: 0, paid: 0, feesEarned: 0, feesPending: 0, orders: 0 };
    r.orders++;
    const smFee = o.fee + o.surcharge;
    if (o.paymentStatus === "paid" || o.paymentStatus === "deducted") {
      r.paid += o.total;
      r.feesEarned += smFee;
    } else {
      r.owed += o.total;
      r.feesPending += smFee;
      if (o.payment === "ahead") r.owedAhead += o.total;
      else r.owedClosing += o.total;
    }
    by.set(o.agentEmail, r);
  }
  const list = [...by.values()].sort((a, b) => b.owed - a.owed);
  const totals = list.reduce(
    (t, r) => ({ owed: t.owed + r.owed, paid: t.paid + r.paid, feesEarned: t.feesEarned + r.feesEarned, feesPending: t.feesPending + r.feesPending }),
    { owed: 0, paid: 0, feesEarned: 0, feesPending: 0 },
  );
  return { list, totals };
}

export const mine = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await viewer(ctx, ctx.userId);
    const rows = await ctx.db.query("adOrders").withIndex("by_agent", q => q.eq("agentEmail", me.email)).order("desc").take(200);
    return { orders: rows.map(view), ledger: ledgerOf(rows).list[0] ?? null };
  },
});

// ---------- Admin side ----------

export const queue = authenticatedQuery({
  args: {},
  handler: async ctx => {
    await requireAdmin(ctx, ctx.userId);
    const rows = await ctx.db.query("adOrders").order("desc").take(500);
    return { orders: rows.map(view), ledger: ledgerOf(rows) };
  },
});

export const decide = authenticatedMutation({
  args: { id: v.id("adOrders"), action: v.union(v.literal("approve"), v.literal("decline")), tier: v.optional(v.string()), note: v.optional(v.string()) },
  handler: async (ctx, { id, action, tier, note }) => {
    const me = await requireAdmin(ctx, ctx.userId);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("Order not found");
    if (o.status !== "requested") throw new Error("This order was already decided");
    const now = Date.now();
    const adminNote = note?.trim().slice(0, 500) || undefined;
    if (action === "decline") {
      await ctx.db.patch(id, { status: "declined", adminNote, decidedByEmail: me.email, decidedAt: now, updatedAt: now });
      await ctx.scheduler.runAfter(0, internal.adOrders.mailAgent, { id });
      return null;
    }
    const pricing = await getPricing(ctx);
    const p = priceOf(pricing, tier ?? o.tier, o.openHouse, o.payment as "ahead" | "closing");
    const l = await ctx.db.get(o.listingId);
    if (!l) throw new Error("Listing is gone");
    const kit = buildKit(
      { address: l.address, price: l.price, agentName: l.agentName, agentPhone: agentByEmail(l.agentEmail)?.phone, website: l.links?.website, tour: l.links?.tour, reel: l.links?.reel },
      p.tier, o.openHouse, pricing.openHouse.spend,
    );
    await ctx.db.patch(id, {
      tier: p.tier.key, spend: p.spend, fee: p.fee, surcharge: p.surcharge, total: p.total,
      status: "approved", adminNote, decidedByEmail: me.email, decidedAt: now, kit: JSON.stringify(kit), updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.adOrders.createMetaDraft, { id });
    await ctx.scheduler.runAfter(0, internal.adOrders.mailAgent, { id });
    return null;
  },
});

export const setStatus = authenticatedMutation({
  args: { id: v.id("adOrders"), status: v.union(v.literal("live"), v.literal("done"), v.literal("approved")) },
  handler: async (ctx, { id, status }) => {
    await requireAdmin(ctx, ctx.userId);
    const o = await ctx.db.get(id);
    if (!o || !BILLABLE.includes(o.status)) throw new Error("Approve the order first");
    const now = Date.now();
    await ctx.db.patch(id, { status, liveAt: status === "live" ? (o.liveAt ?? now) : o.liveAt, updatedAt: now });
    // Seller page: tick the "Ads live" launch step.
    if (status === "live") {
      const l = await ctx.db.get(o.listingId);
      if (l && !l.steps.find(s => s.key === "ads")?.done) {
        await ctx.db.patch(l._id, { steps: l.steps.map(s => (s.key === "ads" ? { ...s, done: true, doneAt: now } : s)), updatedAt: now });
      }
    }
    return null;
  },
});

export const setPayment = authenticatedMutation({
  args: { id: v.id("adOrders"), paymentStatus: v.union(v.literal("unpaid"), v.literal("paid"), v.literal("deducted"), v.literal("rolled")), note: v.optional(v.string()) },
  handler: async (ctx, { id, paymentStatus, note }) => {
    const me = await requireAdmin(ctx, ctx.userId);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("Order not found");
    const settled = paymentStatus === "paid" || paymentStatus === "deducted";
    const stamp = `${new Date().toISOString().slice(0, 10)} ${me.email.split("@")[0]}`;
    await ctx.db.patch(id, {
      paymentStatus,
      paymentNote: [o.paymentNote, `${stamp}: ${paymentStatus}${note?.trim() ? ` — ${note.trim().slice(0, 200)}` : ""}`].filter(Boolean).join("\n"),
      settledAt: settled ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Pay by card (convex/cardPay.ts) for a "pay ahead" order an admin approved.
export const adCode = (id: string) => `AD-${id.slice(-5).toUpperCase()}`;

export async function cardPayable(ctx: QueryCtx, userId: Id<"users">, id: string) {
  const aid = ctx.db.normalizeId("adOrders", id);
  const me = await viewer(ctx, userId);
  const o = aid ? await ctx.db.get(aid) : null;
  if (!aid || !o || !(me.isAdmin || o.agentEmail === me.email || o.orderedByEmail === me.email)) throw new Error("Order not found");
  if (o.payment !== "ahead" || o.paymentStatus !== "unpaid" || !BILLABLE.includes(o.status)) throw new Error("Nothing is waiting for payment on this order");
  return {
    code: adCode(aid), amount: o.total, agentEmail: o.agentEmail, agentName: o.agentName, backPath: "/ad-orders",
    label: `${TIER_NAME[o.tier] ?? o.tier} ad package (${streetOf(o.address)})`,
  };
}

export async function cardSettle(ctx: MutationCtx, id: string, code: string, by: string) {
  const aid = ctx.db.normalizeId("adOrders", id);
  const o = aid ? await ctx.db.get(aid) : null;
  if (!aid || !o || adCode(aid) !== code || o.paymentStatus !== "unpaid" || !BILLABLE.includes(o.status)) return { ok: false as const };
  const now = Date.now();
  await ctx.db.patch(aid, {
    paymentStatus: "paid", settledAt: now, updatedAt: now,
    paymentNote: [o.paymentNote, `${new Date(now).toISOString().slice(0, 10)} ${by}: paid`].filter(Boolean).join("\n"),
  });
  return { ok: true as const, next: "Ad order marked paid", lobCards: 0 };
}

export const savePricing = authenticatedMutation({
  args: { tiers: v.array(v.object({ key: v.string(), spend: v.number(), fee: v.number() })), ohSpend: v.number(), ohFee: v.number(), closingSurcharge: v.number() },
  handler: async (ctx, a) => {
    await requireAdmin(ctx, ctx.userId);
    const cur = await getPricing(ctx);
    const ok = (n: number) => Number.isFinite(n) && n >= 0 && n <= 50000;
    if (![a.ohSpend, a.ohFee, a.closingSurcharge, ...a.tiers.flatMap(t => [t.spend, t.fee])].every(ok)) throw new Error("Prices look off");
    const tiers = cur.tiers.map(t => {
      const n = a.tiers.find(x => x.key === t.key);
      if (!n) return t;
      // Keep the channel split proportional to the new spend.
      const k = t.spend ? n.spend / t.spend : 1;
      const meta = Math.round(t.split.meta * k), google = Math.round(t.split.google * k);
      return { ...t, spend: n.spend, fee: n.fee, split: { meta, google, youtube: Math.max(0, n.spend - meta - google) } };
    });
    const value = JSON.stringify({ tiers, openHouse: { spend: a.ohSpend, fee: a.ohFee }, closingSurcharge: a.closingSurcharge });
    const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", PRICING_KEY)).first();
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("hubSettings", { key: PRICING_KEY, value });
    return null;
  },
});

// ---------- Mail + Meta draft (internal) ----------

export const orderInternal = internalQuery({
  args: { id: v.id("adOrders") },
  handler: async (ctx, { id }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    return o ? { o, l: await ctx.db.get(o.listingId) } : null;
  },
});

const orderRows = (o: Doc<"adOrders">): [string, string][] => [
  ["Listing", o.address],
  ["Agent", o.agentName],
  ["Package", `${TIER_NAME[o.tier] ?? o.tier}${o.openHouse ? " + open house" : ""}`],
  ["Ad spend", money(o.spend)],
  ["SpaceMatch fee", money(o.fee + o.surcharge)],
  ["Total", money(o.total)],
  ["Payment", o.payment === "ahead" ? "Pay ahead (Zelle or check)" : "From commission at closing"],
  ["Agent note", o.note ?? ""],
];

export const mailAdmins = internalAction({
  args: { id: v.id("adOrders") },
  handler: async (ctx, { id }) => {
    await syncRoster(ctx);
    const r = await ctx.runQuery(internal.adOrders.orderInternal, { id });
    if (!r) return;
    const html = shell(`Ad order: ${streetOf(r.o.address)}`, `<p style="margin:0 0 14px">${esc(r.o.agentName)} ordered listing ads and authorized the charge.</p>${table(orderRows(r.o))}`, {
      href: `${hubUrl()}/ad-orders`, label: "Approve or decline",
    });
    for (const to of ["michael@spacematchinc.com", "team@spacematchinc.com"]) {
      try {
        await sendMail(to, `🟡 Ad order to approve — ${streetOf(r.o.address)} (${r.o.agentName})`, html);
      } catch (e) {
        console.error("ad order mail", to, String(e));
      }
    }
  },
});

export const mailAgent = internalAction({
  args: { id: v.id("adOrders") },
  handler: async (ctx, { id }) => {
    await syncRoster(ctx);
    const r = await ctx.runQuery(internal.adOrders.orderInternal, { id });
    if (!r?.l) return;
    const ok = r.o.status === "approved";
    const how = r.o.payment === "ahead"
      ? "Please send payment by Zelle or check; an admin marks it paid."
      : "It comes out of your commission at closing. If this listing doesn't close, it carries to your next closing.";
    const html = shell(
      ok ? `Ads approved: ${streetOf(r.o.address)}` : `Ad order declined: ${streetOf(r.o.address)}`,
      `<p style="margin:0 0 14px">${ok ? `Your ${esc(TIER_NAME[r.o.tier] ?? r.o.tier)} package is approved. The ad kit (copy, YouTube script, campaign names, tracking links) is on the listing's <b>Ads &amp; web</b> tab. ${esc(how)}` : "An admin declined this order."}</p>${r.o.adminNote ? `<p style="margin:0 0 14px"><b>Note:</b> ${esc(r.o.adminNote)}</p>` : ""}${table(orderRows(r.o))}`,
      { href: `${hubUrl()}/listings/${r.o.listingId}`, label: "Open the listing" },
    );
    const to = new Set([r.o.agentEmail, r.o.orderedByEmail]);
    if (ok && r.o.payment === "closing") to.add("tc@spacematchinc.com"); // TC deducts on the commission sheet
    for (const t of to) {
      try {
        await sendMail(t, `${ok ? "✅ Ads approved" : "Ad order declined"} — ${streetOf(r.o.address)}`, html);
      } catch (e) {
        console.error("ad agent mail", t, String(e));
      }
    }
  },
});

export const patchDraft = internalMutation({
  args: { id: v.id("adOrders"), metaCampaignId: v.optional(v.string()), draftError: v.optional(v.string()) },
  handler: async (ctx, { id, ...p }) => {
    await syncRoster(ctx);
    await ctx.db.patch(id, { ...p, updatedAt: Date.now() });
  },
});

// Paused Meta campaign shell (HOUSING category) named "SM | street | Meta | Launch",
// so the listing's Meta card fills in automatically once an admin builds the ads and turns it on.
export const createMetaDraft = internalAction({
  args: { id: v.id("adOrders") },
  handler: async (ctx, { id }) => {
    await syncRoster(ctx);
    const r = await ctx.runQuery(internal.adOrders.orderInternal, { id });
    // Off unless ADKIT_META_DRAFTS=on: Meta create_campaign needs per-call approval on this workspace.
    if (!r || r.o.metaCampaignId || process.env.ADKIT_META_DRAFTS !== "on") return;
    const name = `SM | ${streetOf(r.o.address)} | Meta | Launch`;
    try {
      const res = await callIntegration<{ id?: string; error?: unknown }>("mcp_meta_ads_create_campaign", {
        ad_account_id: META_ACCOUNT, name, objective: "OUTCOME_TRAFFIC", status: "PAUSED", special_ad_categories: ["HOUSING"], is_adset_budget_sharing_enabled: false,
      });
      if (!res.id) throw new Error(JSON.stringify(res).slice(0, 300));
      await ctx.runMutation(internal.adOrders.patchDraft, { id, metaCampaignId: res.id, draftError: undefined });
    } catch (e) {
      console.error("meta draft", String(e));
      await ctx.runMutation(internal.adOrders.patchDraft, { id, draftError: String(e).slice(0, 300) });
    }
  },
});

declare const process: { env: Record<string, string | undefined> };

// Viktor test helper (dev): remove orders for a listing.
export const removeForListingInternal = internalMutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    await syncRoster(ctx);
    const rows = await ctx.db.query("adOrders").withIndex("by_listing", q => q.eq("listingId", listingId)).collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return rows.length;
  },
});

