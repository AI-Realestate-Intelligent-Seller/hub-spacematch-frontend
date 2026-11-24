// Dev-only helpers for scripts/test-card-pay.ts. Every function refuses to run unless STRIPE_MOCK=1,
// which is set on the dev deployment only (never on prod).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { openSession } from "./cardPay";

declare const process: { env: Record<string, string | undefined> };
const guard = () => { if (process.env.STRIPE_MOCK !== "1") throw new Error("Dev only"); };
const AGENT = { agentEmail: "eduardo@spacematchinc.com", agentName: "Eduardo E2E Card" };
const kindV = v.union(v.literal("list"), v.literal("lob"), v.literal("reel"), v.literal("ad"));

export const reset = internalMutation({
  args: { config: v.optional(v.boolean()) },
  handler: async (ctx, { config }) => {
    guard();
    for (const r of await ctx.db.query("cardPayments").collect()) await ctx.db.delete(r._id);
    if (config) for (const r of await ctx.db.query("stripeConfig").collect()) await ctx.db.delete(r._id);
    for (const o of await ctx.db.query("sellerListOrders").collect()) if (o.agentName === AGENT.agentName) await ctx.db.delete(o._id);
    for (const o of await ctx.db.query("reelOrders").collect()) if (o.agentName === AGENT.agentName) await ctx.db.delete(o._id);
    for (const o of await ctx.db.query("mailCampaigns").collect()) if (o.agentName === AGENT.agentName) await ctx.db.delete(o._id);
    for (const o of await ctx.db.query("adOrders").collect()) if (o.agentName === AGENT.agentName) await ctx.db.delete(o._id);
    return null;
  },
});

// One unpaid order of each kind for the test agent.
export const seed = internalMutation({
  args: {},
  handler: async ctx => {
    guard();
    const now = Date.now();
    const list = await ctx.db.insert("sellerListOrders", {
      ...AGENT, orderedByEmail: AGENT.agentEmail, code: "SL-E2E1", zips: ["60614", "60657"], filters: { years: 10, types: "sfr", top: 200, skipTrusts: true },
      status: "delivered", free: false, homes: 120, files: [],
      summary: { total: 120, designs: { sold: 120 }, zips: [{ zip: "60614", city: "Chicago", clean: 300, inList: 60, houses: 40, condos: 20, triedToSell: 3, designs: { sold: 60 } }, { zip: "60657", city: "Chicago", clean: 280, inList: 60, houses: 30, condos: 30, triedToSell: 2, designs: { sold: 60 } }] }, costRuns: [], costCredits: 0, costFinal: true, price: 10,
      payment: { code: "SL-E2E1", amount: 10, status: "awaiting", createdAt: now }, deliveredAt: now, createdAt: now, updatedAt: now,
    });
    const reel = await ctx.db.insert("reelOrders", {
      ...AGENT, orderedByEmail: AGENT.agentEmail, tier: "signature", price: 25, revisionsIncluded: 2, options: {}, clips: [], status: "awaiting_payment",
      payments: [{ kind: "order", amount: 25, code: "RS-E2E1", status: "awaiting", createdAt: now }], revisions: [], version: 0, outputs: [], costRuns: [], costCredits: 0,
      createdAt: now, updatedAt: now,
    });
    const lob = await ctx.db.insert("mailCampaigns", {
      ...AGENT, name: "E2E card mailing", design: "sold", createdByEmail: AGENT.agentEmail, households: 0, status: "draft", scans: 0, scannedHouseholds: 0, leads: 0, createdAt: now,
      lobStatus: "requested", lobRequestedAt: now, lobRequestedBy: AGENT.agentName, lobAmount: 46.4, lobMemo: "MAIL-E2E01",
    });
    const listing = await ctx.db.query("listings").first();
    const ad = listing
      ? await ctx.db.insert("adOrders", {
          ...AGENT, listingId: listing._id, address: "123 E2E Card St, Chicago, IL 60614", tier: "essential", openHouse: false, payment: "ahead", spend: 100, fee: 50, surcharge: 0, total: 150,
          status: "approved", paymentStatus: "unpaid", authorizedAt: now, orderedByEmail: AGENT.agentEmail, createdAt: now, updatedAt: now,
        })
      : null;
    return { list, reel, lob, ad };
  },
});

export const e2eUser = internalQuery({
  args: {},
  handler: async ctx => {
    guard();
    const users = await ctx.db.query("users").collect();
    return users.find(u => (u.email ?? "").startsWith("space-session-"))?._id ?? null;
  },
});

// Server-side "agent pays by card": open the (mock) session as the e2e user, then run the same check
// Stripe's return page triggers.
export const pay = internalAction({
  args: { kind: kindV, id: v.string() },
  handler: async (ctx, { kind, id }): Promise<{ status: string }> => {
    guard();
    const userId: Id<"users"> | null = await ctx.runQuery(internal.cardPayE2e.e2eUser, {});
    if (!userId) throw new Error("no e2e user yet: run a UI test first");
    const s = await openSession(ctx, userId, kind, id);
    if (!s.sessionId) throw new Error("reused an open session");
    return { status: await ctx.runAction(internal.cardPay.check, { sessionId: s.sessionId }) };
  },
});

export const state = internalQuery({
  args: { list: v.id("sellerListOrders"), reel: v.id("reelOrders"), lob: v.id("mailCampaigns"), ad: v.optional(v.id("adOrders")) },
  handler: async (ctx, a) => {
    guard();
    const [l, r, c, ad] = [await ctx.db.get(a.list), await ctx.db.get(a.reel), await ctx.db.get(a.lob), a.ad ? await ctx.db.get(a.ad) : null];
    return {
      list: l?.payment ?? null,
      reel: r ? { status: r.status, payment: r.payments[0] } : null,
      lob: c ? { lobStatus: c.lobStatus, lobPayment: c.lobPayment, lobApprovedBy: c.lobApprovedBy } : null,
      ad: ad ? { paymentStatus: ad.paymentStatus, paymentNote: ad.paymentNote } : null,
      payments: (await ctx.db.query("cardPayments").collect()).map(p => ({ kind: p.kind, code: p.code, amount: p.amount, fee: p.fee, total: p.total, status: p.status, note: p.note })),
    };
  },
});
