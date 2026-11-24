// Seller lists (Michael 2026-10-31, DM thread 1793462607.768969): agents order owner lists for up to 3 ZIPs
// (owner-occupied, owned N+ years, no LLC/corporate, trusts optional, nothing on the market), ranked by
// Realist Sell Score, each home tagged with a suggested mailer design. Flow:
//   agent orders → queued → Viktor's /hub/seller-lists cron pulls Realist (Michael's connectMLS) → delivered
//   → the run's credits are reconciled → price = $5 per ZIP (Michael 2026-11-01), first list free per agent
//   → agent pays by Zelle (memo SL-####) → Michael confirms. An unpaid list blocks the next order.
// Each cron run fills ONE order, so the run's credits = that order's cost.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { AGENTS, agentByEmail, isAdminEmail } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { esc, hubUrl, sendMail, shell, table } from "./notify";
import { CREDIT_USD, PAYMENT_ALERT_EMAIL, PAYMENT_CONFIRMERS, ZELLE_TO } from "./reelDefs";
import { copyAddressFor } from "./agentCopy";
import { LOB_CARD_PRICE, MAIL_TOPS, SERIES_DROPS, SERIES_GAP_DAYS } from "./lobDefs";
import { startDrop } from "./mailOrders";

export const MAX_ZIPS = 3;
export const MAX_BUILDINGS = 10; // street addresses per building order (they must sit in at most MAX_ZIPS ZIPs)
export const PRICE_PER_ZIP = 5; // Michael 2026-11-01: flat $5 per ZIP (was 2× Viktor's credit cost, $1 min)
export const MAX_OPEN_ORDERS = 2; // lists waiting or being pulled, per agent
const SEQ_KEY = "sellerLists:seq";
const YEARS = [5, 7, 10, 15, 20];
const TYPES = ["half", "both", "sfr", "condo"]; // half = 50/50 houses + condos (Michael 2026-11-01)
const TOPS = [200, 400, 800, 0]; // 0 = everyone (Realist returns up to ~3,000 per ZIP per date slice; the worker splits)
// MRED covers northern Illinois: 600xx–619xx.
const ZIP_RE = /^6[01]\d{3}$/;

export const STATUS_LABEL: Record<string, string> = {
  queued: "In line",
  pulling: "Viktor is pulling your list",
  delivered: "Ready",
  needs_info: "Question for you",
  failed: "Couldn't pull it",
  cancelled: "Cancelled",
};

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const priceFor = (zipCount: number) => PRICE_PER_ZIP * Math.max(1, zipCount);

async function viewer(ctx: QueryCtx, userId: Id<"users">) {
  const me = await hubViewer(ctx, userId);
  return { ...me, canConfirm: PAYMENT_CONFIRMERS.includes(me.email) };
}

async function nextCode(ctx: MutationCtx) {
  const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", SEQ_KEY)).first();
  const n = (row ? Number(row.value) || 1000 : 1000) + 1;
  if (row) await ctx.db.patch(row._id, { value: String(n) });
  else await ctx.db.insert("hubSettings", { key: SEQ_KEY, value: String(n) });
  return `SL-${n}`;
}

async function ordersOf(ctx: QueryCtx, agentEmail: string) {
  return ctx.db.query("sellerListOrders").withIndex("by_agent", q => q.eq("agentEmail", agentEmail)).collect();
}

// First list free: the agent has no order that wasn't cancelled or failed.
async function firstIsFree(ctx: QueryCtx, agentEmail: string) {
  return !(await ordersOf(ctx, agentEmail)).some(o => o.status !== "cancelled" && o.status !== "failed");
}

async function queueAhead(ctx: QueryCtx, o: Doc<"sellerListOrders">) {
  const queued = await ctx.db.query("sellerListOrders").withIndex("by_status", q => q.eq("status", "queued")).collect();
  const pulling = await ctx.db.query("sellerListOrders").withIndex("by_status", q => q.eq("status", "pulling")).collect();
  return pulling.length + queued.filter(x => x._id !== o._id && x.createdAt < o.createdAt).length;
}

async function withUrls(ctx: QueryCtx, o: Doc<"sellerListOrders">) {
  const files = await Promise.all(o.files.map(async f => ({ ...f, url: await ctx.storage.getUrl(f.storageId) })));
  return { ...o, files, statusLabel: STATUS_LABEL[o.status] ?? o.status, queueAhead: o.status === "queued" ? await queueAhead(ctx, o) : null };
}

function cleanZips(raw: string[]) {
  const zips = [...new Set(raw.map(z => String(z).trim()).filter(Boolean))];
  if (!zips.length) throw new Error("Add at least one ZIP code");
  if (zips.length > MAX_ZIPS) throw new Error(`Up to ${MAX_ZIPS} ZIP codes per list. Place another order for more.`);
  const bad = zips.filter(z => !ZIP_RE.test(z));
  if (bad.length) throw new Error(`${bad.join(", ")} ${bad.length > 1 ? "aren't" : "isn't"} a northern Illinois ZIP (MRED covers 600xx–619xx)`);
  return zips;
}

// A building order: street addresses with a number, each with its ZIP. One building can use several street numbers,
// so each number is its own entry. Duplicates (same text + ZIP) are dropped.
function cleanBuildings(raw: { address: string; zip: string }[]) {
  const seen = new Set<string>();
  const out: { address: string; zip: string }[] = [];
  for (const b of raw) {
    const address = b.address.trim().replace(/\s+/g, " ").split(",")[0].slice(0, 120);
    const zip = b.zip.trim();
    if (!address && !zip) continue;
    if (!/^\d+[A-Za-z]?\s+\S/.test(address)) throw new Error(`"${address || "(blank)"}" needs a street number and street name, like 2800 N Lake Shore Dr`);
    if (!ZIP_RE.test(zip)) throw new Error(`Add the ZIP code for ${address} (northern Illinois, 600xx–619xx)`);
    const key = `${address.toLowerCase()}|${zip}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ address, zip });
  }
  if (!out.length) throw new Error("Add at least one building address");
  if (out.length > MAX_BUILDINGS) throw new Error(`Up to ${MAX_BUILDINGS} building addresses per order. Place another order for more.`);
  if (new Set(out.map(b => b.zip)).size > MAX_ZIPS) throw new Error(`The buildings in one order can sit in up to ${MAX_ZIPS} ZIP codes. Place another order for the rest.`);
  return out;
}

// "ZIP 60614, 60657", "2800 N Lake Shore Dr" or "3 buildings": what an order covers, for emails and pushes.
export const areaOf = (o: { zips: string[]; buildings?: { address: string }[] }) =>
  o.buildings?.length ? (o.buildings.length === 1 ? o.buildings[0].address : `${o.buildings.length} buildings`) : `ZIP ${o.zips.join(", ")}`;

// ---------- agent side ----------

export const config = authenticatedQuery({
  args: { as: v.optional(v.string()) },
  handler: async (ctx, { as }) => {
    const me = await viewer(ctx, ctx.userId);
    const email = as && me.isStaff ? as : me.email;
    const mine = await ordersOf(ctx, email);
    const toConfirm = me.canConfirm
      ? (await ctx.db.query("sellerListOrders").withIndex("by_status", q => q.eq("status", "delivered")).collect()).filter(o => o.payment?.status === "sent").length
      : 0;
    return {
      isAdmin: isAdminEmail(me.email),
      isStaff: me.isStaff,
      canConfirm: me.canConfirm,
      toConfirm,
      zelleTo: ZELLE_TO,
      firstFree: !mine.some(o => o.status !== "cancelled" && o.status !== "failed"),
      unpaid: mine.filter(o => o.payment?.status === "awaiting").map(o => ({ id: o._id, code: o.payment!.code, amount: o.payment!.amount })),
      open: mine.filter(o => o.status === "queued" || o.status === "pulling").length,
      maxOpen: MAX_OPEN_ORDERS,
      agents: me.isStaff ? AGENTS.map(a => ({ name: a.name, email: a.email })) : [],
      creditUsd: CREDIT_USD,
      pricePerZip: PRICE_PER_ZIP,
      cardPrice: LOB_CARD_PRICE,
      mailTops: MAIL_TOPS,
      seriesDrops: SERIES_DROPS,
      gapDays: SERIES_GAP_DAYS,
    };
  },
});

export const place = authenticatedMutation({
  args: {
    zips: v.array(v.string()),
    // Building order: street addresses (each with its ZIP) instead of whole ZIPs. Everyone who passes the filters is listed.
    buildings: v.optional(v.array(v.object({ address: v.string(), zip: v.string() }))),
    years: v.number(),
    types: v.string(),
    top: v.number(),
    skipTrusts: v.boolean(),
    as: v.optional(v.string()),
    // "Mail it for me" (Michael 2026-11-02): we also build, proof and mail the cards. Omitted = just the list.
    mail: v.optional(v.union(v.literal("once"), v.literal("series"))),
  },
  handler: async (ctx, a) => {
    const me = await viewer(ctx, ctx.userId);
    const forAgent = a.as && me.isStaff ? agentByEmail(a.as) : agentByEmail(me.email);
    const agentEmail = forAgent?.email ?? me.email;
    const agentName = forAgent?.name ?? me.name;
    const buildings = a.buildings?.length ? cleanBuildings(a.buildings) : undefined;
    const zips = buildings ? [...new Set(buildings.map(b => b.zip))] : cleanZips(a.zips);
    // A building order may take every owner (years 0), is condos/townhomes only and lists everyone who passes.
    if (!(YEARS.includes(a.years) || (buildings && a.years === 0))) throw new Error("Pick how long they've owned the home");
    const types = buildings ? "condo" : a.types;
    const top = buildings ? 0 : a.top;
    if (!TYPES.includes(types)) throw new Error("Pick a home type");
    if (!TOPS.includes(top)) throw new Error("Pick a list size");
    if (a.mail && !buildings && !MAIL_TOPS.includes(top)) throw new Error("Pick how many homes to mail per ZIP (200, 400 or 800)");
    if (a.mail && !(await copyAddressFor(ctx, agentEmail))) throw new Error("Add the address where your own copy of each card should go");
    const mine = await ordersOf(ctx, agentEmail);
    const unpaid = mine.find(o => o.payment?.status === "awaiting");
    if (unpaid) throw new Error(`Pay for list ${unpaid.payment!.code} (${money(unpaid.payment!.amount)}) first, then order the next one.`);
    if (mine.filter(o => o.status === "queued" || o.status === "pulling").length >= MAX_OPEN_ORDERS)
      throw new Error(`You already have ${MAX_OPEN_ORDERS} lists in line. Order more once one is ready.`);
    const now = Date.now();
    const free = await firstIsFree(ctx, agentEmail);
    const id = await ctx.db.insert("sellerListOrders", {
      agentEmail, agentName, orderedByEmail: me.email, code: await nextCode(ctx),
      zips, ...(buildings ? { buildings } : {}), filters: { years: a.years, types, top, skipTrusts: a.skipTrusts },
      status: "queued", free, files: [], costRuns: [], costCredits: 0,
      ...(a.mail ? { mail: { mode: a.mail, drops: [] } } : {}),
      queuedAt: now, createdAt: now, updatedAt: now,
    });
    if (free) await ctx.scheduler.runAfter(0, internal.sellerLists.notify, { id, kind: "free" });
    return id;
  },
});

async function ownOrder(ctx: QueryCtx, userId: Id<"users">, id: Id<"sellerListOrders">) {
  const me = await viewer(ctx, userId);
  const o = await ctx.db.get(id);
  if (!o || !(me.isStaff || o.agentEmail === me.email || o.orderedByEmail === me.email)) throw new Error("List not found");
  return { me, o };
}

export const mine = authenticatedQuery({
  args: { as: v.optional(v.string()) },
  handler: async (ctx, { as }) => {
    const me = await viewer(ctx, ctx.userId);
    const email = as && me.isStaff ? as : me.email;
    const rows = await ctx.db.query("sellerListOrders").withIndex("by_agent", q => q.eq("agentEmail", email)).order("desc").take(50);
    // Credit cost stays out of the agent view; they see the price.
    return Promise.all(rows.map(async o => ({ ...(await withUrls(ctx, o)), costRuns: [], costCredits: 0 })));
  },
});

// The CSV for /mailers?list=<id>&group=<design> (one tap from a suggested-mailer group into a new mailing).
export const csvFor = authenticatedQuery({
  args: { id: v.id("sellerListOrders") },
  handler: async (ctx, { id }) => {
    const { o } = await ownOrder(ctx, ctx.userId, id);
    const f = o.files.find(x => x.kind === "csv");
    if (!f) return null;
    return { url: await ctx.storage.getUrl(f.storageId), name: f.name, agentName: o.agentName, zips: o.zips, buildings: o.buildings ?? null, code: o.code };
  },
});

export const cancel = authenticatedMutation({
  args: { id: v.id("sellerListOrders") },
  handler: async (ctx, { id }) => {
    const { o } = await ownOrder(ctx, ctx.userId, id);
    if (o.status !== "queued") throw new Error("Only lists still in line can be cancelled");
    await ctx.db.patch(id, { status: "cancelled", updatedAt: Date.now() });
    return null;
  },
});

export const answer = authenticatedMutation({
  args: { id: v.id("sellerListOrders"), text: v.string() },
  handler: async (ctx, { id, text }) => {
    const { o } = await ownOrder(ctx, ctx.userId, id);
    if (o.status !== "needs_info") throw new Error("No open question on this list");
    await ctx.db.patch(id, { answer: text.trim().slice(0, 1500), status: "queued", queuedAt: Date.now(), updatedAt: Date.now() });
    return null;
  },
});

export const markSent = authenticatedMutation({
  args: { id: v.id("sellerListOrders") },
  handler: async (ctx, { id }) => {
    const { o } = await ownOrder(ctx, ctx.userId, id);
    if (o.payment?.status !== "awaiting") throw new Error("Nothing waiting for payment on this list");
    await ctx.db.patch(id, { payment: { ...o.payment, status: "sent", sentAt: Date.now(), note: undefined }, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.sellerLists.notify, { id, kind: "sent" });
    return null;
  },
});

// ---------- Michael / admin ----------

export const queue = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await viewer(ctx, ctx.userId);
    if (!me.isStaff) throw new Error("Staff only");
    const rows = await ctx.db.query("sellerListOrders").withIndex("by_created").order("desc").take(300);
    const orders = await Promise.all(rows.map(o => withUrls(ctx, o)));
    const revenue = rows.reduce((s, o) => s + (o.mail
      ? o.mail.drops.filter(d => d.payment === "paid").reduce((t, d) => t + d.amount, 0)
      : o.payment?.status === "confirmed" ? o.payment.amount : 0), 0);
    const credits = rows.reduce((s, o) => s + o.costCredits, 0);
    const owed = rows.filter(o => o.payment && (o.payment.status === "awaiting" || o.payment.status === "sent")).reduce((s, o) => s + (o.payment?.amount ?? 0), 0);
    return {
      orders: orders.map(o => ({ ...o, costUsd: o.costCredits * CREDIT_USD })),
      totals: { orders: rows.filter(o => o.status === "delivered").length, homes: rows.reduce((s, o) => s + (o.homes ?? 0), 0), revenue, credits, cost: credits * CREDIT_USD, owed },
      canConfirm: me.canConfirm,
    };
  },
});

export const confirmPayment = authenticatedMutation({
  args: { id: v.id("sellerListOrders"), received: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, { id, received, note }) => {
    const me = await viewer(ctx, ctx.userId);
    if (!me.canConfirm) throw new Error("Only Michael confirms Zelle payments");
    const o = await ctx.db.get(id);
    if (!o?.payment || (o.payment.status !== "sent" && o.payment.status !== "awaiting")) throw new Error("That payment is already handled");
    const now = Date.now();
    await ctx.db.patch(id, {
      payment: received
        ? { ...o.payment, status: "confirmed", confirmedAt: now, confirmedBy: me.email, note: undefined }
        : { ...o.payment, status: "awaiting", note: note?.trim() || `Michael couldn't find a Zelle with memo ${o.payment.code} yet. Check it went to ${ZELLE_TO}, then tap "I sent it" again.` },
      updatedAt: now,
    });
    if (!received) await ctx.scheduler.runAfter(0, internal.sellerLists.notify, { id, kind: "rejected" });
    else if (o.mail) await startDrop(ctx, id, "paid", me.name || me.email);
    return null;
  },
});

// Ops: Michael told Viktor in Slack that a Zelle arrived. Same effect as his Received button
// (mail orders start mailing through Lob). `by` is recorded on the payment.
export const confirmPaymentInternal = internalMutation({
  args: { id: v.id("sellerListOrders"), by: v.string() },
  handler: async (ctx, { id, by }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    if (!o?.payment || (o.payment.status !== "sent" && o.payment.status !== "awaiting")) throw new Error("That payment is already handled");
    const now = Date.now();
    await ctx.db.patch(id, { payment: { ...o.payment, status: "confirmed", confirmedAt: now, confirmedBy: by, note: undefined }, updatedAt: now });
    const started = o.mail ? await startDrop(ctx, id, "paid", by) : false;
    return { code: o.code, started };
  },
});

// Pay by card (convex/cardPay.ts): what this order owes, and what happens once Stripe says it's paid
// (the same effect as Michael's Received: "Mail it for me" orders start mailing through Lob).
export async function cardPayable(ctx: QueryCtx, userId: Id<"users">, id: string) {
  const lid = ctx.db.normalizeId("sellerListOrders", id);
  if (!lid) throw new Error("List not found");
  const { o } = await ownOrder(ctx, userId, lid);
  const p = o.payment;
  if (p?.status === "sent") throw new Error("You already told us you sent this by Zelle. Michael is confirming it.");
  if (!p || p.status !== "awaiting") throw new Error("Nothing is waiting for payment on this order");
  const d = o.mail?.drops.find(x => x.code === p.code);
  return {
    code: p.code, amount: p.amount, agentEmail: o.agentEmail, agentName: o.agentName, backPath: "/seller-lists?tab=mine",
    label: d ? `${d.cards} postcards, printed and mailed (${areaOf(o)})` : `Seller list (${areaOf(o)})`,
  };
}

export async function cardSettle(ctx: MutationCtx, id: string, code: string, by: string) {
  const lid = ctx.db.normalizeId("sellerListOrders", id);
  const o = lid ? await ctx.db.get(lid) : null;
  if (!lid || !o?.payment || o.payment.code !== code || (o.payment.status !== "awaiting" && o.payment.status !== "sent")) return { ok: false as const };
  const now = Date.now();
  await ctx.db.patch(lid, { payment: { ...o.payment, status: "confirmed", confirmedAt: now, confirmedBy: by, method: "card", note: undefined }, updatedAt: now });
  const started = o.mail ? await startDrop(ctx, lid, "paid", by) : false;
  const cards = o.mail?.drops.find(x => x.code === code)?.cards ?? 0;
  return { ok: true as const, next: started ? `Lob started mailing the ${cards} cards` : "List marked paid", lobCards: started ? cards : 0 };
}

// Michael can waive a list's charge (e.g. a failed or tiny pull).
export const waive = authenticatedMutation({
  args: { id: v.id("sellerListOrders") },
  handler: async (ctx, { id }) => {
    const me = await viewer(ctx, ctx.userId);
    if (!me.canConfirm) throw new Error("Only Michael can waive a charge");
    const o = await ctx.db.get(id);
    if (!o?.payment || o.payment.status === "confirmed") throw new Error("Nothing to waive");
    await ctx.db.patch(id, { payment: { ...o.payment, status: "waived", confirmedAt: Date.now(), confirmedBy: me.email }, updatedAt: Date.now() });
    // "Mail it for me": waiving (or Michael's own "Mail it now") starts the Lob mailing too.
    if (o.mail) await startDrop(ctx, id, "waived", me.name || me.email);
    return null;
  },
});

export const adminCancel = authenticatedMutation({
  args: { id: v.id("sellerListOrders"), note: v.optional(v.string()) },
  handler: async (ctx, { id, note }) => {
    const me = await viewer(ctx, ctx.userId);
    if (!me.isStaff) throw new Error("Staff only");
    await ctx.db.patch(id, { status: "cancelled", statusNote: note?.trim() || "Cancelled by SpaceMatch", updatedAt: Date.now() });
    return null;
  },
});

// ---------- notifications ----------

export const forNotify = internalQuery({ args: { id: v.id("sellerListOrders") }, handler: async (ctx, { id }) => ctx.db.get(id) });

export const notify = internalAction({
  args: { id: v.id("sellerListOrders"), kind: v.string() },
  handler: async (ctx, { id, kind }) => {
    await syncRoster(ctx);
    const o: Doc<"sellerListOrders"> | null = await ctx.runQuery(internal.sellerLists.forNotify, { id });
    if (!o) return;
    const base = hubUrl();
    const zips = o.zips.join(", ");
    const area = areaOf(o);
    const push = (email: string, title: string, body: string, url: string) => ctx.runAction(internal.push.toEmail, { email, title, body, url }).catch(() => null);
    const mail = (to: string, subject: string, html: string) => sendMail(to, subject, html).catch(e => console.error("seller list mail", e));
    const p = o.payment;
    if (kind === "free") {
      await push(PAYMENT_ALERT_EMAIL, `Free first seller list: ${o.agentName}`, `${area} · in line, no charge`, "/seller-lists?tab=orders");
    } else if (kind === "delivered") {
      await mail(o.agentEmail, `Your seller list for ${o.buildings?.length ? area : zips} is ready`, shell(
        "Your seller list is ready",
        `<p style="color:#333;font-size:15px">${o.homes ?? 0} homes, ranked by how likely they are to sell, each with a suggested postcard. Open it in the Hub to download it or turn a group into a mailing in one tap.</p>${o.viktorNote ? `<p style="color:#555;font-size:14px">${esc(o.viktorNote)}</p>` : ""}`,
        { href: `${base}/seller-lists`, label: "Open my list" },
      ));
      await push(o.agentEmail, "Your seller list is ready", `${area} · ${o.homes ?? 0} homes`, "/seller-lists");
    } else if (kind === "billed" && p) {
      await mail(o.agentEmail, `Your seller list ${p.code}: ${money(p.amount)} by Zelle`, shell(
        `${money(p.amount)} for your seller list`,
        `<p style="color:#333;font-size:15px">Send it by Zelle to <b>${esc(ZELLE_TO)}</b> with memo <b>${esc(p.code)}</b>, then tap "I sent it" in the Hub. Your next list unlocks once it's paid.</p>${table([["List", area], ["Homes", String(o.homes ?? 0)], ["Amount", money(p.amount)], ["Memo", p.code]])}`,
        { href: `${base}/seller-lists`, label: "Pay in the Hub" },
      ));
    } else if (kind === "sent" && p) {
      await mail(PAYMENT_ALERT_EMAIL, `Zelle to confirm: ${money(p.amount)} from ${o.agentName} (${p.code})`, shell(
        `${o.agentName} says they sent ${money(p.amount)}`,
        `<p style="color:#333;font-size:15px">Check your Zelle at ${esc(ZELLE_TO)} for memo <b>${esc(p.code)}</b>, then tap Received in the Hub.${o.mail ? " Lob starts mailing the cards as soon as you do." : ""}</p>${table([["Agent", o.agentName], ["For", o.mail ? `Mail it for me · ${area} · ${o.mail.drops.find(d => d.code === p.code)?.cards ?? "?"} cards` : `Seller list · ZIP ${zips}`], ["Amount", money(p.amount)], ["Memo", p.code]])}`,
        { href: `${base}/seller-lists?tab=orders`, label: "Confirm in the Hub" },
      ));
      await push(PAYMENT_ALERT_EMAIL, `Zelle to confirm: ${money(p.amount)}`, `${o.agentName} · seller list ${p.code}`, "/seller-lists?tab=orders");
    } else if (kind === "rejected" && p) {
      await mail(o.agentEmail, `We couldn't find your Zelle yet (${p.code})`, shell("Payment not found yet", `<p style="color:#333;font-size:15px">${esc(p.note ?? "")}</p>`, { href: `${base}/seller-lists`, label: "Open Seller lists" }));
    } else if (kind === "needs_info") {
      await mail(o.agentEmail, "Quick question about your seller list", shell("Viktor has a question", `<p style="color:#333;font-size:15px">${esc(o.question ?? "")}</p>`, { href: `${base}/seller-lists`, label: "Answer in the Hub" }));
      await push(o.agentEmail, "Question about your seller list", (o.question ?? "").slice(0, 120), "/seller-lists");
    } else if (kind === "failed") {
      await mail(o.agentEmail, "We couldn't pull your seller list", shell("Your list didn't go through", `<p style="color:#333;font-size:15px">${esc(o.statusNote ?? "")} There's no charge. Try again later or ask Michael.</p>`, { href: `${base}/seller-lists`, label: "Open Seller lists" }));
      await mail(PAYMENT_ALERT_EMAIL, `Seller list ${o.code} failed (${o.agentName})`, shell("A seller list failed", `<p style="color:#333;font-size:15px">${esc(o.statusNote ?? "")}</p>${table([["Agent", o.agentName], ["ZIPs", zips], ["List", o.code]])}<p style="color:#555;font-size:14px">Usually the MLS login. Ask Viktor in Slack to look at it.</p>`, { href: `${base}/seller-lists?tab=orders`, label: "Open orders" }));
    }
  },
});

// ---------- Viktor worker (run_app_function prod from the /hub/seller-lists cron) ----------

export const pendingCount = internalQuery({
  args: {},
  handler: async ctx => (await ctx.db.query("sellerListOrders").withIndex("by_status", q => q.eq("status", "queued")).take(50)).length,
});

export const nextQueued = internalQuery({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const rows = await ctx.db.query("sellerListOrders").withIndex("by_status", q => q.eq("status", "queued")).collect();
    return rows.sort((a, b) => (a.queuedAt ?? a.createdAt) - (b.queuedAt ?? b.createdAt))[0] ?? null;
  },
});

export const getInternal = internalQuery({ args: { id: v.id("sellerListOrders") }, handler: async (ctx, { id }) => ctx.db.get(id) });

export const listInternal = internalQuery({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    await syncRoster(ctx);
    const rows = status
      ? await ctx.db.query("sellerListOrders").withIndex("by_status", q => q.eq("status", status)).collect()
      : await ctx.db.query("sellerListOrders").withIndex("by_created").order("desc").take(100);
    return rows.map(o => ({ _id: o._id, code: o.code, agentName: o.agentName, zips: o.zips, buildings: o.buildings ?? null, status: o.status, homes: o.homes, costCredits: o.costCredits, costFinal: !!o.costFinal, payment: o.payment ?? null, free: o.free }));
  },
});

export const workerStatus = internalMutation({
  args: {
    id: v.id("sellerListOrders"),
    status: v.union(v.literal("pulling"), v.literal("queued"), v.literal("needs_info"), v.literal("failed")),
    note: v.optional(v.string()),
    question: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, note, question }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("List not found");
    const now = Date.now();
    if (status === "pulling") {
      if (o.status !== "queued") throw new Error(`List is ${o.status}, not queued`);
      await ctx.db.patch(id, { status, statusNote: note ?? "Pulling public records", pickedUpAt: now, updatedAt: now });
    } else if (status === "needs_info") {
      if (!question) throw new Error("question required");
      await ctx.db.patch(id, { status, question, answer: undefined, statusNote: note, updatedAt: now });
      await ctx.scheduler.runAfter(0, internal.sellerLists.notify, { id, kind: "needs_info" });
    } else if (status === "failed") {
      await ctx.db.patch(id, { status, statusNote: note ?? "The records search didn't go through.", updatedAt: now });
      await ctx.scheduler.runAfter(0, internal.sellerLists.notify, { id, kind: "failed" });
    } else {
      await ctx.db.patch(id, { status, statusNote: note, queuedAt: now, updatedAt: now });
    }
    return null;
  },
});

export const workerNote = internalMutation({
  args: { id: v.id("sellerListOrders"), note: v.string() },
  handler: async (ctx, { id, note }) => {
    await syncRoster(ctx);
    await ctx.db.patch(id, { statusNote: note.slice(0, 200), updatedAt: Date.now() });
    return null;
  },
});

export const uploadUrl = internalMutation({ args: {}, handler: async ctx => ctx.storage.generateUploadUrl() });

export const addFile = internalMutation({
  args: { id: v.id("sellerListOrders"), kind: v.string(), name: v.string(), storageId: v.id("_storage"), size: v.number() },
  handler: async (ctx, { id, kind, name, storageId, size }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("List not found");
    if (o.status !== "pulling") throw new Error("Set status pulling first");
    for (const f of o.files.filter(x => x.kind === kind)) await ctx.storage.delete(f.storageId).catch(() => null);
    await ctx.db.patch(id, { files: [...o.files.filter(x => x.kind !== kind), { kind, name, storageId, size }], updatedAt: Date.now() });
    return null;
  },
});

export const deliver = internalMutation({
  args: { id: v.id("sellerListOrders"), summary: v.any(), note: v.optional(v.string()) },
  handler: async (ctx, { id, summary, note }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("List not found");
    if (!o.files.some(f => f.kind === "csv") || !o.files.some(f => f.kind === "xlsx")) throw new Error("Upload the csv and xlsx first");
    const now = Date.now();
    await ctx.db.patch(id, { status: "delivered", summary, homes: Number(summary?.total) || 0, viktorNote: note, statusNote: undefined, deliveredAt: now, updatedAt: now });
    if (o.mail) {
      // Done-for-you: build the cards right away; the agent's email comes when the proofs are ready.
      const listAmount = o.free ? 0 : priceFor(o.zips.length);
      const drop = { n: 1, status: "building", code: o.code, campaignIds: [], cards: 0, listAmount, cardAmount: 0, amount: listAmount };
      await ctx.db.patch(id, { mail: { ...o.mail, drops: [drop] } });
      await ctx.scheduler.runAfter(0, internal.mailOrders.buildDrop, { orderId: id, n: 1 });
    } else await ctx.scheduler.runAfter(0, internal.sellerLists.notify, { id, kind: "delivered" });
    return null;
  },
});

export const addCost = internalMutation({
  args: { id: v.id("sellerListOrders"), credits: v.number(), note: v.optional(v.string()), threadId: v.optional(v.string()) },
  handler: async (ctx, { id, credits, note, threadId }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("List not found");
    await ctx.db.patch(id, { costRuns: [...o.costRuns, { credits, note, threadId, at: Date.now() }], costCredits: o.costCredits + credits });
    return null;
  },
});

// The run is over and its credits are in: freeze the price ($5 per ZIP, first list free); credits are tracked as our cost and bill by Zelle.
export const finalizeCost = internalMutation({
  args: { id: v.id("sellerListOrders") },
  handler: async (ctx, { id }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("List not found");
    if (o.costFinal) return { price: o.price ?? 0, already: true };
    if (o.status !== "delivered") {
      await ctx.db.patch(id, { costFinal: true, price: 0 });
      return { price: 0, already: false };
    }
    const price = o.free ? 0 : priceFor(o.zips.length);
    const now = Date.now();
    if (o.mail) {
      // The list price is part of card 1's single Zelle (mailOrders), so no separate bill here.
      await ctx.db.patch(id, { costFinal: true, price, updatedAt: now });
      return { price, already: false };
    }
    if (!price) {
      await ctx.db.patch(id, { costFinal: true, price: 0, updatedAt: now });
      return { price: 0, already: false };
    }
    await ctx.db.patch(id, { costFinal: true, price, payment: { code: o.code, amount: price, status: "awaiting", createdAt: now }, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.sellerLists.notify, { id, kind: "billed" });
    return { price, already: false };
  },
});

// e2e only (dev): a paid copy of a delivered list (shares its files; delete both together).
export const e2eCloneInternal = internalMutation({
  args: { id: v.id("sellerListOrders") },
  handler: async (ctx, { id }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("List not found");
    const { _id, _creationTime, ...rest } = o;
    return await ctx.db.insert("sellerListOrders", { ...rest, code: `${o.code}-E2E`, free: false, costRuns: [], costCredits: 0, costFinal: undefined, price: undefined, payment: undefined, createdAt: Date.now() });
  },
});

export const removeInternal = internalMutation({
  args: { ids: v.array(v.id("sellerListOrders")) },
  handler: async (ctx, { ids }) => {
    await syncRoster(ctx);
    for (const id of ids) {
      const o = await ctx.db.get(id);
      if (!o) continue;
      await ctx.db.delete(id);
      const others = await ctx.db.query("sellerListOrders").withIndex("by_agent", q => q.eq("agentEmail", o.agentEmail)).collect();
      const inUse = new Set(others.flatMap(x => x.files.map(f => f.storageId)));
      for (const f of o.files) if (!inUse.has(f.storageId)) await ctx.storage.delete(f.storageId).catch(() => null);
    }
    return null;
  },
});
