// Lob print + mail for seller mailers (Michael 2026-11-01). Flow:
// 1. Agent taps "See Lob proof" → lobSend.proof renders card #1 with the TEST key (free, nothing printed).
// 2. Agent taps "Request mailing" → Michael is emailed; the agent pays the postage by Zelle.
// 3. Michael taps "Payment received, mail it" (or "Mail without charge") → lobSend.send mails the
//    cards in batches with LOB_API_KEY_LIVE (TEST key when the live key isn't set, e.g. dev).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { copyAddressFor } from "./agentCopy";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { LOB_CARD_PRICE, LOB_FREE_MONTHLY, lobAmount } from "./lobDefs";
import { DESIGN_TITLES, ownCampaign } from "./mailers";
import { esc, hubUrl, sendMail, shell, table } from "./notify";
import { PAYMENT_ALERT_EMAIL, PAYMENT_CONFIRMERS, ZELLE_TO } from "./reelDefs";

declare const process: { env: Record<string, string | undefined> };

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const chicagoMonth = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }).slice(0, 7);
export const lobMode = () => (process.env.LOB_API_KEY_LIVE ? "live" : "test") as "live" | "test";

export const info = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const w = await hubViewer(ctx, ctx.userId);
    const month = chicagoMonth(Date.now());
    let monthCards = 0;
    for (const c of await ctx.db.query("mailCampaigns").order("desc").take(400)) {
      if (c.lobMode === "live" && c.lobApprovedAt && chicagoMonth(c.lobApprovedAt) === month) monthCards += (c.lobSent ?? 0) + (c.copyLobId ? 1 : 0);
    }
    return {
      canConfirm: PAYMENT_CONFIRMERS.includes(w.email),
      mode: lobMode(),
      price: LOB_CARD_PRICE,
      freeMonthly: LOB_FREE_MONTHLY,
      monthCards,
      zelleTo: ZELLE_TO,
    };
  },
});

export const proof = authenticatedMutation({
  args: { campaignId: v.id("mailCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const { c } = await ownCampaign(ctx, ctx.userId, campaignId);
    if (!c.households) throw new Error("Add the mailing list first");
    if (c.lobStatus && c.lobStatus !== "proof") throw new Error("This mailing is already with Lob");
    await ctx.db.patch(campaignId, { lobStatus: "proofing", lobError: undefined });
    await ctx.scheduler.runAfter(0, internal.lobSend.proof, { campaignId });
  },
});

export const request = authenticatedMutation({
  args: { campaignId: v.id("mailCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const { c, w } = await ownCampaign(ctx, ctx.userId, campaignId);
    if (c.lobStatus !== "proof") throw new Error("Look at the Lob proof first");
    if (c.status === "mailed") throw new Error("This mailing is already marked as mailed");
    if (!(await copyAddressFor(ctx, c.agentEmail))) throw new Error("Add the address where your own copy should go first");
    const memo = `MAIL-${String(campaignId).slice(-5).toUpperCase()}`;
    await ctx.db.patch(campaignId, {
      lobStatus: "requested", lobRequestedAt: Date.now(), lobRequestedBy: w.name || w.email,
      lobAmount: lobAmount(c.households + 1), lobMemo: memo, // +1 = the agent's own copy
    });
    if (!PAYMENT_CONFIRMERS.includes(w.email)) await ctx.scheduler.runAfter(0, internal.lob.notify, { campaignId, kind: "requested" });
  },
});

export const cancel = authenticatedMutation({
  args: { campaignId: v.id("mailCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const { c } = await ownCampaign(ctx, ctx.userId, campaignId);
    if (c.lobStatus !== "requested") throw new Error("Only a mailing that's waiting for payment can be cancelled");
    await ctx.db.patch(campaignId, { lobStatus: "proof", lobRequestedAt: undefined, lobRequestedBy: undefined, lobAmount: undefined, lobMemo: undefined });
  },
});

// Starts (or retries) Lob mailing for one campaign. Shared by approve and "Mail it for me" (mailOrders.ts).
export async function startLobSend(ctx: MutationCtx, c: Doc<"mailCampaigns">, payment: "paid" | "waived", by: string, memo?: string) {
  if (c.lobStatus === "failed") {
    // Retry: give the cards Lob refused another try.
    const hs = await ctx.db.query("mailHouseholds").withIndex("by_campaign", q => q.eq("campaignId", c._id)).collect();
    for (const h of hs) if (!h.lobId && h.lobError) await ctx.db.patch(h._id, { lobError: undefined });
  }
  const copy = (await copyAddressFor(ctx, c.agentEmail)) ? 1 : 0;
  const run = (c.lobRun ?? 0) + 1;
  await ctx.db.patch(c._id, {
    lobStatus: "sending", lobPayment: c.lobPayment ?? payment, lobApprovedAt: Date.now(), lobApprovedBy: by,
    lobAmount: c.lobAmount ?? lobAmount(c.households + copy), lobMemo: c.lobMemo ?? memo, lobMode: lobMode(), lobRun: run, lobError: undefined,
    lobSent: c.lobSent ?? 0, lobFailed: 0, copyError: undefined,
  });
  await ctx.scheduler.runAfter(0, internal.lobSend.send, { campaignId: c._id, run });
}

// Michael only: the Zelle arrived (or he waives it) → start mailing. Also retries a failed run.
export const approve = authenticatedMutation({
  args: { campaignId: v.id("mailCampaigns"), payment: v.union(v.literal("paid"), v.literal("waived")) },
  handler: async (ctx, { campaignId, payment }) => {
    const w = await hubViewer(ctx, ctx.userId);
    if (!PAYMENT_CONFIRMERS.includes(w.email)) throw new Error("Only Michael can approve a Lob mailing");
    const c = await ctx.db.get(campaignId);
    if (!c) throw new Error("This mailing no longer exists");
    if (!c.lobStatus || !["proof", "requested", "failed"].includes(c.lobStatus)) throw new Error("This mailing can't be sent right now");
    await startLobSend(ctx, c, payment, w.name || w.email);
  },
});

// Pay by card (convex/cardPay.ts) for an own-list mailing the agent requested. "Mail it for me"
// cards are paid on their order (sellerLists.cardPayable), never here.
export async function cardPayable(ctx: QueryCtx, userId: Id<"users">, id: string) {
  const cid = ctx.db.normalizeId("mailCampaigns", id);
  if (!cid) throw new Error("This mailing no longer exists");
  const { c } = await ownCampaign(ctx, userId, cid);
  if (c.orderId || c.lobStatus !== "requested" || !c.lobAmount || !c.lobMemo) throw new Error("This mailing isn't waiting for payment");
  return {
    code: c.lobMemo, amount: c.lobAmount, agentEmail: c.agentEmail, agentName: c.agentName, backPath: `/mailers?open=${cid}`,
    label: `${c.households} postcards, printed and mailed (${c.name})`,
  };
}

export async function cardSettle(ctx: MutationCtx, id: string, code: string, by: string) {
  const cid = ctx.db.normalizeId("mailCampaigns", id);
  const c = cid ? await ctx.db.get(cid) : null;
  if (!c || c.lobStatus !== "requested" || c.lobMemo !== code) return { ok: false as const };
  await startLobSend(ctx, c, "paid", by);
  return { ok: true as const, next: `Lob started mailing the ${c.households} cards`, lobCards: c.households };
}

// ── Internal (lobSend.ts) ───────────────────────────────────────────────────

export const forSend = internalQuery({
  args: { campaignId: v.id("mailCampaigns"), limit: v.number() },
  handler: async (ctx, { campaignId, limit }) => {
    const c = await ctx.db.get(campaignId);
    if (!c) return null;
    const hs = await ctx.db.query("mailHouseholds").withIndex("by_campaign", q => q.eq("campaignId", campaignId)).collect();
    const pending = hs.filter(h => !h.lobId && !h.lobError);
    return {
      c, pending: pending.slice(0, limit), remaining: pending.length, first: hs[0] ?? null,
      sample: hs.find(h => h.lobId) ?? hs[0] ?? null, // the agent's copy shows what this home got
      copyTo: await copyAddressFor(ctx, c.agentEmail),
    };
  },
});

export const proofDone = internalMutation({
  args: { campaignId: v.id("mailCampaigns"), url: v.optional(v.string()), thumbs: v.optional(v.array(v.string())), error: v.optional(v.string()) },
  handler: async (ctx, { campaignId, url, thumbs, error }) => {
    const c = await ctx.db.get(campaignId);
    if (!c || c.lobStatus !== "proofing") return;
    if (error) await ctx.db.patch(campaignId, { lobStatus: undefined, lobError: error });
    else await ctx.db.patch(campaignId, { lobStatus: "proof", lobProofUrl: url, lobProofThumbs: thumbs, lobProofAt: Date.now(), lobError: undefined });
    if (c.orderId) await ctx.scheduler.runAfter(0, internal.mailOrders.afterProof, { orderId: c.orderId });
  },
});

export const record = internalMutation({
  args: {
    campaignId: v.id("mailCampaigns"),
    run: v.number(),
    results: v.array(v.object({ id: v.id("mailHouseholds"), lobId: v.optional(v.string()), error: v.optional(v.string()), expected: v.optional(v.string()) })),
  },
  handler: async (ctx, { campaignId, run, results }) => {
    const c = await ctx.db.get(campaignId);
    if (!c) return;
    let sent = 0, failed = 0, expected = c.lobExpected;
    for (const r of results) {
      if (r.lobId) { await ctx.db.patch(r.id, { lobId: r.lobId, lobError: undefined }); sent++; if (r.expected && (!expected || r.expected > expected)) expected = r.expected; }
      else if (r.error) { await ctx.db.patch(r.id, { lobError: r.error.slice(0, 300) }); failed++; }
    }
    await ctx.db.patch(campaignId, {
      lobSent: (c.lobSent ?? 0) + sent,
      lobFailed: (c.lobRun === run ? c.lobFailed ?? 0 : 0) + failed,
      lobExpected: expected,
    });
  },
});

// The agent's own copy (lobSend.send, after the last home).
export const copyDone = internalMutation({
  args: { campaignId: v.id("mailCampaigns"), run: v.number(), lobId: v.optional(v.string()), to: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, { campaignId, run, lobId, to, error }) => {
    const c = await ctx.db.get(campaignId);
    if (!c || c.lobRun !== run) return;
    await ctx.db.patch(campaignId, lobId ? { copyLobId: lobId, copyTo: to, copyError: undefined } : { copyTo: to, copyError: (error ?? "Lob refused the copy").slice(0, 300) });
  },
});

export const copyLine = (c: Doc<"mailCampaigns">) =>
  c.copyLobId ? `Mailed to ${c.copyTo ?? "your address"}` : c.copyError ? `Not mailed: ${c.copyError}` : "No address on file";

export const finish = internalMutation({
  args: { campaignId: v.id("mailCampaigns"), run: v.number(), error: v.optional(v.string()) },
  handler: async (ctx, { campaignId, run, error }) => {
    const c = await ctx.db.get(campaignId);
    if (!c || c.lobRun !== run || c.lobStatus !== "sending") return;
    const sent = c.lobSent ?? 0;
    if (error || sent === 0) {
      await ctx.db.patch(campaignId, { lobStatus: "failed", lobError: error ?? "Lob didn't accept any cards. Check the addresses in the list." });
      // "Mail it for me" mailings report once per order (mailOrders.afterSend), not once per design.
      if (c.orderId) await ctx.scheduler.runAfter(0, internal.mailOrders.afterSend, { orderId: c.orderId });
      else await ctx.scheduler.runAfter(0, internal.lob.notify, { campaignId, kind: "failed" });
      return;
    }
    const patch: Partial<Doc<"mailCampaigns">> = { lobStatus: "sent", lobDoneAt: Date.now(), lobError: undefined };
    if (c.lobMode === "live") {
      patch.status = "mailed";
      patch.mailedOn = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
      if (c.cost === undefined) patch.cost = lobAmount(sent + (c.copyLobId ? 1 : 0));
    }
    await ctx.db.patch(campaignId, patch);
    if (c.orderId) await ctx.scheduler.runAfter(0, internal.mailOrders.afterSend, { orderId: c.orderId });
    else await ctx.scheduler.runAfter(0, internal.lob.notify, { campaignId, kind: "sent" });
  },
});

export const campaign = internalQuery({
  args: { campaignId: v.id("mailCampaigns") },
  handler: async (ctx, { campaignId }) => await ctx.db.get(campaignId),
});

export const notify = internalAction({
  args: { campaignId: v.id("mailCampaigns"), kind: v.union(v.literal("requested"), v.literal("sent"), v.literal("failed")) },
  handler: async (ctx, { campaignId, kind }) => {
    const c = await ctx.runQuery(internal.lob.campaign, { campaignId });
    if (!c) return;
    const link = { href: `${hubUrl()}/mailers?open=${campaignId}`, label: "Open the mailing" };
    const rows: [string, string][] = [
      ["Agent", c.agentName], ["Mailing", c.name], ["Design", DESIGN_TITLES[c.design] ?? c.design], ["Cards", String(c.households)],
    ];
    const send = async (to: string, subject: string, html: string) => {
      try { await sendMail(to, subject, html); } catch (e) { console.error("lob.notify", to, String(e)); }
    };
    if (kind === "requested") {
      await send(PAYMENT_ALERT_EMAIL, `📮 Lob mailing to approve · ${c.agentName} · ${c.households} cards · ${money(c.lobAmount ?? 0)}`, shell(
        `Lob mailing request: ${c.name}`,
        `<p style="margin:0 0 14px;color:#3A3833">${esc(c.lobRequestedBy ?? c.agentName)} wants Lob to print and mail this mailing. Check your Zelle at ${esc(ZELLE_TO)} for memo <b>${esc(c.lobMemo ?? "")}</b>, then tap “Payment received, mail it” in the Hub. Nothing is mailed until you do.</p>${table([...rows, ["Amount", money(c.lobAmount ?? 0)], ["Memo", c.lobMemo ?? ""]])}`,
        link,
      ));
      return;
    }
    const to = [...new Set([c.agentEmail, PAYMENT_ALERT_EMAIL])];
    const test = c.lobMode !== "live";
    const html = kind === "sent"
      ? shell(
          test ? `Lob TEST run done: ${c.name}` : `Your postcards are on their way: ${c.name}`,
          `<p style="margin:0 0 14px;color:#3A3833">${test ? "Test mode: Lob rendered the cards but printed and mailed nothing." : `Lob accepted ${c.lobSent ?? 0} cards. They print and mail within 1 to 2 business days by USPS Marketing Mail.`}${c.lobFailed ? ` ${c.lobFailed} addresses were refused by Lob; they're marked in the Hub.` : ""}</p>${table([...rows, ["Accepted", String(c.lobSent ?? 0)], ["Refused", String(c.lobFailed ?? 0)], ["Your copy", copyLine(c)], ["Expected delivery", c.lobExpected ?? "—"]])}`,
          link,
        )
      : shell(
          `Lob mailing stopped: ${c.name}`,
          `<p style="margin:0 0 14px;color:#3A3833">${esc(c.lobError ?? "Lob refused the mailing.")} ${c.lobSent ? `${c.lobSent} cards were already accepted and will mail.` : "Nothing was mailed."} Michael can tap Retry in the Hub once it's fixed.</p>${table(rows)}`,
          link,
        );
    const subject = kind === "sent" ? `${test ? "🧪 Lob test" : "📮 Mailed"} · ${c.name} · ${c.lobSent ?? 0} cards` : `⚠️ Lob mailing stopped · ${c.name}`;
    for (const t of to) await send(t, subject, html);
  },
});

// e2e cleanup (run with `bunx convex run lob:removeInternal`): deletes test mailings and their homes.
export const removeInternal = internalMutation({
  args: { ids: v.array(v.id("mailCampaigns")) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      const hs = await ctx.db.query("mailHouseholds").withIndex("by_campaign", q => q.eq("campaignId", id)).collect();
      for (const h of hs) await ctx.db.delete(h._id);
      if (await ctx.db.get(id)) await ctx.db.delete(id);
    }
  },
});
