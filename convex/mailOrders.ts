// "Mail it for me" (Michael 2026-11-02, DM 1793462607.768969: "make this a done for you system", "go B").
// The agent orders ZIPs + list size once; everything else happens here:
//   list delivered (sellerLists.deliver) → buildDrop: one mailing per suggested card, agent-branded, unique QR per home
//   → free Lob TEST proof of each card (lobSend.proof) → afterProof: drop "ready", ONE Zelle (list $5/ZIP + cards × $1.16)
//   → agent taps "I sent it" → Michael taps Received (or Waive / "Mail it now" on his own) → startDrop → Lob mails
//   → afterSend: one email for the whole drop; series → next card to the same homes in 4 weeks (3 drops, billed per drop).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { cleanRows, detectColumns } from "../src/lib/mailerList";
import { AGENTS } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { copyAddressFor } from "./agentCopy";
import { copyLine, startLobSend } from "./lob";
import { LOB_CARD_PRICE, LOB_FREE_MONTHLY, SERIES_DROPS, SERIES_GAP_DAYS, lobAmount } from "./lobDefs";
import { DESIGN_IDS, DESIGN_TITLES, clip, codeTaken, newCode } from "./mailers";
import { esc, hubUrl, sendMail, shell, table } from "./notify";
import { PAYMENT_ALERT_EMAIL, PAYMENT_CONFIRMERS, ZELLE_TO } from "./reelDefs";

declare const process: { env: Record<string, string | undefined> };

type Order = Doc<"sellerListOrders">;
type Drop = NonNullable<Order["mail"]>["drops"][number];

// Same order as SEQUENCE in src/lib/mailerBuilder.ts (kept here so Convex doesn't bundle the PDF builder).
const SEQUENCE = ["value", "staging", "market", "launch", "netsheet", "team", "buyers", "spring"];
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortTitle = (d: string) => (DESIGN_TITLES[d] ?? d).split(/[.?(]/)[0].trim();
const chicagoMonthNum = (t: number) => Number(new Date(t).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "numeric" }));
const chicagoMonth = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }).slice(0, 7);
const dayLabel = (t: number) => new Date(t).toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric" });

// Next card for the same homes: next in SEQUENCE, spring card only Dec–Feb.
export function nextDesign(d: string, at: number) {
  const winter = [12, 1, 2].includes(chicagoMonthNum(at));
  let i = SEQUENCE.indexOf(d);
  for (let k = 0; k < SEQUENCE.length; k++) {
    i = (i + 1) % SEQUENCE.length;
    if (SEQUENCE[i] === "spring" && !winter) continue;
    return SEQUENCE[i];
  }
  return "value";
}

export const currentDrop = (o: Order) => {
  const ds = o.mail?.drops ?? [];
  return ds.find(d => !["mailed", "stopped"].includes(d.status)) ?? ds[ds.length - 1];
};

async function setDrop(ctx: MutationCtx, o: Order, n: number, patch: Partial<Drop>, extra: Partial<Order> = {}) {
  if (!o.mail) throw new Error("Not a mail order");
  const drops = o.mail.drops.map(d => (d.n === n ? { ...d, ...patch } : d));
  await ctx.db.patch(o._id, { mail: { ...o.mail, drops }, updatedAt: Date.now(), ...extra });
}

function isOwn(o: Order) {
  return PAYMENT_CONFIRMERS.includes(o.agentEmail.toLowerCase());
}

// ── Build a drop ────────────────────────────────────────────────────────────

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const out: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(c => c.trim())) out.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim())) out.push(row);
  const headers = (out.shift() ?? []).map(h => h.replace(/^\uFEFF/, "").trim());
  return { headers, rows: out.map(r => Object.fromEntries(headers.map((h, k) => [h, (r[k] ?? "").trim()]))) };
}

type Home = { nameLine: string; who: string; mailAddr: string; mailCity: string; mailState: string; mailZip: string; propAddr: string; propShort: string };

export const buildDrop = internalAction({
  args: { orderId: v.id("sellerListOrders"), n: v.number() },
  handler: async (ctx, { orderId, n }) => {
    await syncRoster(ctx);
    const claimed: boolean = await ctx.runMutation(internal.mailOrders.claimBuild, { orderId, n });
    if (!claimed) return;
    try {
      const o = (await ctx.runQuery(internal.sellerLists.getInternal, { id: orderId }))!;
      const groups = new Map<string, Home[]>();
      if (n === 1) {
        const f = o.files.find(x => x.kind === "csv");
        const blob = f ? await ctx.storage.get(f.storageId) : null;
        if (!blob) throw new Error("The list file is missing");
        const { headers, rows } = parseCsv(await blob.text());
        const map = detectColumns(headers);
        const byDesign = new Map<string, Record<string, string>[]>();
        for (const r of rows) {
          const d = DESIGN_IDS.includes(r["Design Id"] as never) ? r["Design Id"] : "value";
          byDesign.set(d, [...(byDesign.get(d) ?? []), r]);
        }
        for (const [d, rs] of byDesign) {
          const { households } = cleanRows(rs, { map, lastFirst: false, skipCorporate: true, skipTrusts: o.filters.skipTrusts, ownerOccOnly: false });
          if (households.length) groups.set(d, households);
        }
      } else {
        const prev: { design: string; homes: Home[] }[] = await ctx.runQuery(internal.mailOrders.prevHomes, { orderId, n: n - 1 });
        for (const g of prev) {
          const d = nextDesign(g.design, Date.now());
          groups.set(d, [...(groups.get(d) ?? []), ...g.homes]);
        }
      }
      const total = [...groups.values()].reduce((s, h) => s + h.length, 0);
      if (!total) throw new Error(n === 1 ? "No mailable homes came back on this list" : "Every home already replied or was refused by Lob");
      const campaignIds: Id<"mailCampaigns">[] = [];
      for (const [design, homes] of groups) {
        const campaignId: Id<"mailCampaigns"> = await ctx.runMutation(internal.mailOrders.addCampaign, { orderId, n, design });
        for (let i = 0; i < homes.length; i += 250) await ctx.runMutation(internal.mailOrders.addHomes, { campaignId, rows: homes.slice(i, i + 250) });
        campaignIds.push(campaignId);
      }
      await ctx.runMutation(internal.mailOrders.dropBuilt, { orderId, n, campaignIds });
    } catch (e) {
      await ctx.runMutation(internal.mailOrders.dropFailed, { orderId, n, error: String((e as Error).message ?? e).slice(0, 300) });
    }
  },
});

export const claimBuild = internalMutation({
  args: { orderId: v.id("sellerListOrders"), n: v.number() },
  handler: async (ctx, { orderId, n }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(orderId);
    const d = o?.mail?.drops.find(x => x.n === n);
    if (!o || !d || o.status === "cancelled") return false;
    if (d.status === "scheduled" && o.mail!.stopped) { await setDrop(ctx, o, n, { status: "stopped" }); return false; }
    if (d.status !== "scheduled" && d.status !== "building") return false;
    if (d.campaignIds.length) return false; // already built
    await setDrop(ctx, o, n, { status: "building" });
    return true;
  },
});

export const prevHomes = internalQuery({
  args: { orderId: v.id("sellerListOrders"), n: v.number() },
  handler: async (ctx, { orderId, n }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(orderId);
    const d = o?.mail?.drops.find(x => x.n === n);
    if (!d) return [];
    const out: { design: string; homes: Home[] }[] = [];
    for (const id of d.campaignIds) {
      const c = await ctx.db.get(id);
      if (!c) continue;
      const hs = await ctx.db.query("mailHouseholds").withIndex("by_campaign", q => q.eq("campaignId", id)).collect();
      // Skip homes Lob refused and homes that already replied (the agent is working those directly).
      const homes = hs.filter(h => !h.leadAt && !(h.lobError && !h.lobId)).map(h => ({
        nameLine: h.nameLine, who: h.who, mailAddr: h.mailAddr, mailCity: h.mailCity, mailState: h.mailState, mailZip: h.mailZip, propAddr: h.propAddr, propShort: h.propShort,
      }));
      if (homes.length) out.push({ design: c.design, homes });
    }
    return out;
  },
});

export const addCampaign = internalMutation({
  args: { orderId: v.id("sellerListOrders"), n: v.number(), design: v.string() },
  handler: async (ctx, { orderId, n, design }) => {
    await syncRoster(ctx);
    const o = (await ctx.db.get(orderId))!;
    const agent = AGENTS.find(a => a.email.toLowerCase() === o.agentEmail.toLowerCase());
    return await ctx.db.insert("mailCampaigns", {
      name: clip(`ZIP ${o.zips.join(", ")} · card ${n} · ${shortTitle(design)}`, 80),
      design,
      agentEmail: o.agentEmail.toLowerCase(),
      agentName: agent?.name ?? o.agentName,
      createdByEmail: o.orderedByEmail,
      households: 0,
      status: "draft",
      scans: 0,
      scannedHouseholds: 0,
      leads: 0,
      createdAt: Date.now(),
      orderId,
      drop: n,
    });
  },
});

const homeIn = v.object({
  nameLine: v.string(), who: v.string(), mailAddr: v.string(), mailCity: v.string(), mailState: v.string(), mailZip: v.string(), propAddr: v.string(), propShort: v.string(),
});

export const addHomes = internalMutation({
  args: { campaignId: v.id("mailCampaigns"), rows: v.array(homeIn) },
  handler: async (ctx, { campaignId, rows }) => {
    await syncRoster(ctx);
    const c = (await ctx.db.get(campaignId))!;
    for (const r of rows) {
      let code = newCode();
      while (await codeTaken(ctx, code)) code = newCode();
      await ctx.db.insert("mailHouseholds", {
        campaignId, code,
        nameLine: clip(r.nameLine, 80), who: clip(r.who, 60), mailAddr: clip(r.mailAddr, 120), mailCity: clip(r.mailCity, 60),
        mailState: clip(r.mailState, 4), mailZip: clip(r.mailZip, 10), propAddr: clip(r.propAddr, 160), propShort: clip(r.propShort, 80),
        scans: 0,
      });
    }
    await ctx.db.patch(campaignId, { households: c.households + rows.length });
  },
});

export const dropBuilt = internalMutation({
  args: { orderId: v.id("sellerListOrders"), n: v.number(), campaignIds: v.array(v.id("mailCampaigns")) },
  handler: async (ctx, { orderId, n, campaignIds }) => {
    await syncRoster(ctx);
    const o = (await ctx.db.get(orderId))!;
    const d = o.mail!.drops.find(x => x.n === n)!;
    // +1 card per design = the agent's own copy, billed like any other card (Michael 2026-11-12).
    const copy = (await copyAddressFor(ctx, o.agentEmail)) ? 1 : 0;
    let cards = 0;
    for (const id of campaignIds) {
      const c = (await ctx.db.get(id))!;
      cards += c.households + copy;
      await ctx.db.patch(id, { lobStatus: "proofing", lobError: undefined, lobAmount: lobAmount(c.households + copy), lobMemo: d.code });
      await ctx.scheduler.runAfter(0, internal.lobSend.proof, { campaignId: id });
    }
    const copies = copy * campaignIds.length;
    const cardAmount = lobAmount(cards);
    await setDrop(ctx, o, n, { status: "proofing", campaignIds, cards, copies, cardAmount, amount: Math.round((d.listAmount + cardAmount) * 100) / 100, error: undefined });
  },
});

export const dropFailed = internalMutation({
  args: { orderId: v.id("sellerListOrders"), n: v.number(), error: v.string() },
  handler: async (ctx, { orderId, n, error }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(orderId);
    if (!o?.mail) return;
    await setDrop(ctx, o, n, { status: "failed", error });
    await ctx.scheduler.runAfter(0, internal.mailOrders.notify, { orderId, n, kind: "failed" });
  },
});

// Called by lob.proofDone for each card's proof. When every proof is back, the drop is ready to pay.
export const afterProof = internalMutation({
  args: { orderId: v.id("sellerListOrders") },
  handler: async (ctx, { orderId }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(orderId);
    const d = o?.mail?.drops.find(x => x.status === "proofing");
    if (!o || !d) return;
    for (const id of d.campaignIds) if ((await ctx.db.get(id))?.lobStatus === "proofing") return;
    const now = Date.now();
    await setDrop(ctx, o, d.n, { status: "ready", readyAt: now }, {
      payment: { code: d.code, amount: d.amount, status: "awaiting", createdAt: now },
    });
    await ctx.scheduler.runAfter(0, internal.mailOrders.notify, { orderId, n: d.n, kind: "ready" });
  },
});

// Payment confirmed (sellerLists.confirmPayment / waive) → Lob mails every card in the drop.
export async function startDrop(ctx: MutationCtx, orderId: Id<"sellerListOrders">, payment: "paid" | "waived", by: string) {
  const o = await ctx.db.get(orderId);
  const d = o?.mail?.drops.find(x => x.status === "ready" || x.status === "failed");
  if (!o || !d) return false;
  for (const id of d.campaignIds) {
    const c = await ctx.db.get(id);
    if (!c || c.lobStatus === "sending" || c.lobStatus === "sent") continue;
    await startLobSend(ctx, { ...c, lobAmount: c.lobAmount ?? lobAmount(c.households) }, payment, by, d.code);
  }
  await setDrop(ctx, o, d.n, { status: "mailing", approvedAt: Date.now(), payment: d.payment ?? payment, error: undefined });
  return true;
}

// Called by lob.finish for each card. When all are done: one email, and the series' next drop is scheduled.
export const afterSend = internalMutation({
  args: { orderId: v.id("sellerListOrders") },
  handler: async (ctx, { orderId }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(orderId);
    const d = o?.mail?.drops.find(x => x.status === "mailing");
    if (!o || !d) return;
    const cs: Doc<"mailCampaigns">[] = [];
    for (const id of d.campaignIds) { const c = await ctx.db.get(id); if (c) cs.push(c); }
    if (cs.some(c => c.lobStatus === "sending")) return;
    const sent = cs.reduce((s, c) => s + (c.lobSent ?? 0), 0);
    const refused = cs.reduce((s, c) => s + (c.lobFailed ?? 0), 0);
    const expected = cs.map(c => c.lobExpected).filter(Boolean).sort().pop();
    const failed = cs.find(c => c.lobStatus === "failed");
    const now = Date.now();
    if (failed) {
      await setDrop(ctx, o, d.n, { status: "failed", sent, refused, expected, error: failed.lobError ?? "Lob stopped the mailing" });
      await ctx.scheduler.runAfter(0, internal.mailOrders.notify, { orderId, n: d.n, kind: "failed" });
      return;
    }
    await setDrop(ctx, o, d.n, { status: "mailed", mailedAt: now, sent, refused, expected });
    const fresh = (await ctx.db.get(orderId))!;
    if (fresh.mail!.mode === "series" && !fresh.mail!.stopped && d.n < SERIES_DROPS && !fresh.mail!.drops.some(x => x.n === d.n + 1)) {
      const at = now + SERIES_GAP_DAYS * 86400000;
      const next: Drop = { n: d.n + 1, status: "scheduled", code: `${o.code}-${d.n + 1}`, campaignIds: [], cards: 0, listAmount: 0, cardAmount: 0, amount: 0, scheduledFor: at };
      await ctx.db.patch(orderId, { mail: { ...fresh.mail!, drops: [...fresh.mail!.drops, next] } });
      await ctx.scheduler.runAt(at, internal.mailOrders.buildDrop, { orderId, n: d.n + 1 });
    }
    await ctx.scheduler.runAfter(0, internal.mailOrders.notify, { orderId, n: d.n, kind: "mailed" });
  },
});

// ── Agent + Michael actions ─────────────────────────────────────────────────

async function own(ctx: QueryCtx, userId: Id<"users">, id: Id<"sellerListOrders">) {
  const w = await hubViewer(ctx, userId);
  const o = await ctx.db.get(id);
  if (!o || !(w.isStaff || o.agentEmail === w.email || o.orderedByEmail === w.email)) throw new Error("Order not found");
  return { w, o, canConfirm: PAYMENT_CONFIRMERS.includes(w.email) };
}

// Everything the order card shows: each drop with its cards (proof images, progress, scans, replies).
export const forOrder = authenticatedQuery({
  args: { id: v.id("sellerListOrders") },
  handler: async (ctx, { id }) => {
    const { o } = await own(ctx, ctx.userId, id);
    if (!o.mail) return null;
    const drops = await Promise.all(o.mail.drops.map(async d => ({
      ...d,
      campaigns: (await Promise.all(d.campaignIds.map(cid => ctx.db.get(cid)))).filter(Boolean).map(c => ({
        _id: c!._id, name: c!.name, design: c!.design, title: DESIGN_TITLES[c!.design] ?? c!.design, households: c!.households,
        lobStatus: c!.lobStatus, lobProofUrl: c!.lobProofUrl, lobProofThumbs: c!.lobProofThumbs, lobSent: c!.lobSent ?? 0, lobFailed: c!.lobFailed ?? 0,
        lobMode: c!.lobMode, lobError: c!.lobError, scannedHouseholds: c!.scannedHouseholds, leads: c!.leads,
        copyLobId: c!.copyLobId, copyTo: c!.copyTo, copyError: c!.copyError,
      })),
    })));
    return { mode: o.mail.mode, stopped: !!o.mail.stopped, drops, own: isOwn(o), price: LOB_CARD_PRICE, seriesDrops: SERIES_DROPS, gapDays: SERIES_GAP_DAYS };
  },
});

// Stop future cards of a series (and skip a later card that's waiting for payment).
export const stopSeries = authenticatedMutation({
  args: { id: v.id("sellerListOrders") },
  handler: async (ctx, { id }) => {
    const { o } = await own(ctx, ctx.userId, id);
    if (!o.mail) throw new Error("Not a mailing order");
    const drops = o.mail.drops.map(d => (d.status === "scheduled" || (d.n > 1 && (d.status === "ready" || d.status === "building" || d.status === "proofing")) ? { ...d, status: "stopped" } : d));
    const skippedUnpaid = o.mail.drops.some(d => d.n > 1 && d.status === "ready") && o.payment?.status !== "confirmed";
    await ctx.db.patch(id, { mail: { ...o.mail, stopped: true, drops }, ...(skippedUnpaid ? { payment: undefined } : {}), updatedAt: Date.now() });
    return null;
  },
});

// Don't mail card 1 after all (before paying). The list itself is still billed unless it was the free one.
export const cancelMailing = authenticatedMutation({
  args: { id: v.id("sellerListOrders") },
  handler: async (ctx, { id }) => {
    const { o } = await own(ctx, ctx.userId, id);
    const d = o.mail?.drops.find(x => x.n === 1);
    if (!o.mail || !d || !["building", "proofing", "ready", "failed"].includes(d.status) || o.payment?.status === "confirmed" || o.payment?.status === "sent")
      throw new Error("This mailing can't be cancelled now");
    const now = Date.now();
    await ctx.db.patch(id, {
      mail: { ...o.mail, stopped: true, drops: o.mail.drops.map(x => (x.n === 1 ? { ...x, status: "stopped" } : x)) },
      payment: d.listAmount > 0 ? { code: o.code, amount: d.listAmount, status: "awaiting", createdAt: now, note: "Mailing cancelled: only the list is billed." } : undefined,
      updatedAt: now,
    });
    return null;
  },
});

// Michael: retry a drop Lob stopped (e.g. account review, billing) once it's fixed.
export const retryDrop = authenticatedMutation({
  args: { id: v.id("sellerListOrders") },
  handler: async (ctx, { id }) => {
    const { o, w, canConfirm } = await own(ctx, ctx.userId, id);
    if (!canConfirm) throw new Error("Only Michael can retry a mailing");
    const d = o.mail?.drops.find(x => x.status === "failed");
    if (!d) throw new Error("Nothing to retry");
    if (!d.campaignIds.length) {
      // The build itself failed: rebuild.
      await setDrop(ctx, o, d.n, { status: "building", error: undefined });
      await ctx.scheduler.runAfter(0, internal.mailOrders.buildDrop, { orderId: id, n: d.n });
      return null;
    }
    if (!d.approvedAt) {
      // Proofs were built but payment never started: back to ready.
      await setDrop(ctx, o, d.n, { status: "ready", error: undefined });
      return null;
    }
    await startDrop(ctx, id, (d.payment as "paid" | "waived") ?? "paid", w.name || w.email);
    return null;
  },
});

// Lob's free plan = 500 cards a month: the admin view warns before Michael confirms a bigger drop.
export const lobMonth = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const month = chicagoMonth(Date.now());
    let cards = 0;
    for (const c of await ctx.db.query("mailCampaigns").order("desc").take(500)) {
      if (c.lobMode === "live" && c.lobApprovedAt && chicagoMonth(c.lobApprovedAt) === month) cards += (c.lobSent ?? 0) + (c.copyLobId ? 1 : 0);
    }
    return { cards, freeMonthly: LOB_FREE_MONTHLY, mode: process.env.LOB_API_KEY_LIVE ? "live" : "test" };
  },
});

// ── Emails ──────────────────────────────────────────────────────────────────

export const forNotify = internalQuery({
  args: { orderId: v.id("sellerListOrders"), n: v.number() },
  handler: async (ctx, { orderId, n }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(orderId);
    const d = o?.mail?.drops.find(x => x.n === n);
    if (!o || !d) return null;
    const cs = (await Promise.all(d.campaignIds.map(id => ctx.db.get(id)))).filter(Boolean) as Doc<"mailCampaigns">[];
    const next = o.mail!.drops.find(x => x.n === n + 1 && x.status === "scheduled");
    return { o, d, cards: cs.map(c => ({ design: c.design, households: c.households, mode: c.lobMode, thumb: c.lobProofThumbs?.[0], copy: copyLine(c) })), next: next?.scheduledFor ?? null };
  },
});

export const notify = internalAction({
  args: { orderId: v.id("sellerListOrders"), n: v.number(), kind: v.union(v.literal("ready"), v.literal("mailed"), v.literal("failed")) },
  handler: async (ctx, { orderId, n, kind }) => {
    await syncRoster(ctx);
    const x = await ctx.runQuery(internal.mailOrders.forNotify, { orderId, n });
    if (!x) return;
    const { o, d, cards, next } = x;
    const link = { href: `${hubUrl()}/seller-lists?tab=mine`, label: "Open my mailing" };
    const zips = o.zips.join(", ");
    const send = async (to: string, subject: string, html: string) => { try { await sendMail(to, subject, html); } catch (e) { console.error("mailOrders.notify", to, String(e)); } };
    const push = (email: string, title: string, body: string) => ctx.runAction(internal.push.toEmail, { email, title, body, url: "/seller-lists?tab=mine" }).catch(() => null);
    const cardRows: [string, string][] = cards.map(c => [shortTitle(c.design), `${c.households} cards`]);
    const own = PAYMENT_CONFIRMERS.includes(o.agentEmail.toLowerCase());
    if (kind === "ready") {
      const imgs = cards.filter(c => c.thumb).slice(0, 4).map(c => `<img src="${esc(c.thumb!)}" alt="" style="width:100%;max-width:520px;border-radius:8px;border:1px solid #ebe5da;margin:0 0 10px">`).join("");
      const rows: [string, string][] = [["ZIPs", zips], ...cardRows, ...(d.listAmount ? [["List", money(d.listAmount)] as [string, string]] : []), ["Cards", `${d.cards} × ${money(LOB_CARD_PRICE)} = ${money(d.cardAmount)}${d.copies ? ` (incl. ${d.copies === 1 ? "1 copy" : `${d.copies} copies`} mailed to you)` : ""}`], ["Total", money(d.amount)], ["Zelle memo", d.code]];
      await send(o.agentEmail, `Your ${d.cards} postcards are ready${n > 1 ? ` (card ${n})` : ""}: ${money(d.amount)} to mail`, shell(
        n > 1 ? `Card ${n} for ZIP ${zips} is ready` : "Your postcards are ready",
        `<p style="color:#333;font-size:15px">${n > 1 ? "The next card in your series is built for the same homes (minus anyone who replied). " : ""}Each home gets its own card with your photo and its own QR code. ${own ? "Tap “Mail it now” in the Hub when you're ready." : `To mail them, Zelle <b>${money(d.amount)}</b> to <b>${esc(ZELLE_TO)}</b> with memo <b>${esc(d.code)}</b>, then tap “I sent it” in the Hub. Lob prints and mails them as soon as Michael confirms.`}</p>${imgs}${table(rows)}`,
        link,
      ));
      await push(o.agentEmail, "Your postcards are ready", `${d.cards} cards · ${money(d.amount)} · ZIP ${zips}`);
      return;
    }
    const test = cards.some(c => c.mode && c.mode !== "live");
    const to = [...new Set([o.agentEmail, PAYMENT_ALERT_EMAIL])];
    if (kind === "mailed") {
      const rows: [string, string][] = [["ZIPs", zips], ...cardRows, ["Accepted by Lob", String(d.sent ?? 0)], ["Refused (not charged)", String(d.refused ?? 0)], ["Expected in mailboxes", d.expected ?? "—"], ...cards.map(c => [`Your copy${cards.length > 1 ? ` · ${shortTitle(c.design)}` : ""}`, c.copy] as [string, string]), ...(next ? [["Next card", `${dayLabel(next)} (you'll get the proof and total first)`] as [string, string]] : [])];
      const html = shell(
        test ? `Test run done: card ${n} for ZIP ${zips}` : `Your postcards are on their way (card ${n})`,
        `<p style="color:#333;font-size:15px">${test ? "Test mode: Lob rendered the cards but printed and mailed nothing." : `Lob accepted ${d.sent ?? 0} cards. They print within 1–2 business days and go out by USPS Marketing Mail.`} Scans and replies show up in the Hub, and replies go to your inbox and Lofty (tag “Mailer”). Call within the hour.</p>${table(rows)}`,
        link,
      );
      for (const t of to) await send(t, `${test ? "🧪 Test" : "📮 Mailed"} · ${o.agentName} · ${d.sent ?? 0} cards · ZIP ${zips}`, html);
      return;
    }
    const html = shell(
      `Mailing stopped: card ${n} for ZIP ${zips}`,
      `<p style="color:#333;font-size:15px">${esc(d.error ?? "Something went wrong.")} ${(d.sent ?? 0) ? `${d.sent} cards were already accepted and will mail.` : "Nothing was mailed and nobody was charged for unmailed cards."} Michael can tap Retry in the Hub once it's fixed.</p>${table([["Agent", o.agentName], ["Order", o.code], ...cardRows])}`,
      { href: `${hubUrl()}/seller-lists?tab=orders`, label: "Open orders" },
    );
    for (const t of to) await send(t, `⚠️ Mailing stopped · ${o.agentName} · ${o.code}`, html);
  },
});

// e2e cleanup (dev): delete mail orders with their mailings and homes.
export const removeOrderInternal = internalMutation({
  args: { ids: v.array(v.id("sellerListOrders")) },
  handler: async (ctx, { ids }) => {
    await syncRoster(ctx);
    for (const id of ids) {
      const cs = await ctx.db.query("mailCampaigns").withIndex("by_order", q => q.eq("orderId", id)).collect();
      for (const c of cs) {
        for (const h of await ctx.db.query("mailHouseholds").withIndex("by_campaign", q => q.eq("campaignId", c._id)).collect()) await ctx.db.delete(h._id);
        await ctx.db.delete(c._id);
      }
    }
    for (const id of ids) {
      const o = await ctx.db.get(id);
      if (!o) continue;
      await ctx.db.delete(id);
      const others = await ctx.db.query("sellerListOrders").withIndex("by_agent", q => q.eq("agentEmail", o.agentEmail)).collect();
      const inUse = new Set(others.flatMap(x => x.files.map(f => f.storageId)));
      for (const f of o.files) if (!inUse.has(f.storageId)) await ctx.storage.delete(f.storageId).catch(() => null);
    }
  },
});
