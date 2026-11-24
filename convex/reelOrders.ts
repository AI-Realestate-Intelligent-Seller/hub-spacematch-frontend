// Reel Studio (Michael 2026-10-28). Flow:
//   agent orders (options + clips) → awaiting_payment (Zelle code shown) → agent taps "I sent it"
//   → payment_sent (Michael emailed + push) → Michael taps "Confirm received" → queued
//   → Viktor's /hub/reel-queue cron picks it up (editing) → uploads one file per format → delivered
//   → agent downloads, or asks for a revision (free ones first, then $4 each, same Zelle gate).
// Each cron run edits ONE order, so that run's credits = that order's cost (admin ledger).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { AGENTS, agentByEmail, isAdminEmail } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { esc, hubUrl, sendMail, shell, table } from "./notify";
import {
  CREDIT_USD,
  REEL_STAGES,
  CTAS,
  DEFAULT_OPTIONS,
  EXTRA_REVISION_PRICE,
  FREE_REELS,
  FORMATS,
  PALETTES,
  PAYMENT_ALERT_EMAIL,
  PAYMENT_CONFIRMERS,
  STATUS_LABEL,
  STYLES,
  MUSIC_TAKES,
  SAMPLE_MATCH,
  ZELLE_TO,
  brokerageLine,
  optionRows,
  styleOf,
  tierOf,
  type ReelOptions,
} from "./reelDefs";

const SEQ_KEY = "reels:seq";
const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

async function viewer(ctx: QueryCtx, userId: Id<"users">) {
  const me = await hubViewer(ctx, userId);
  return { ...me, isAdmin: isAdminEmail(me.email), canConfirm: PAYMENT_CONFIRMERS.includes(me.email) };
}

async function nextCode(ctx: MutationCtx) {
  const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", SEQ_KEY)).first();
  const n = (row ? Number(row.value) || 1000 : 1000) + 1;
  if (row) await ctx.db.patch(row._id, { value: String(n) });
  else await ctx.db.insert("hubSettings", { key: SEQ_KEY, value: String(n) });
  return `RS-${n}`;
}

const openPayment = (o: Doc<"reelOrders">) => o.payments.find(p => p.status === "awaiting" || p.status === "sent");
const paidTotal = (o: Doc<"reelOrders">) => o.payments.filter(p => p.status === "confirmed").reduce((s, p) => s + p.amount, 0);
const freeRevisionsLeft = (o: Doc<"reelOrders">) =>
  Math.max(0, o.revisionsIncluded - o.revisions.filter(r => !r.paid && r.kind !== "captions").length);

// Orders in front of this one: anything being edited + older queued orders.
async function queueAhead(ctx: QueryCtx, o: Doc<"reelOrders">) {
  const queued = await ctx.db.query("reelOrders").withIndex("by_status", q => q.eq("status", "queued")).collect();
  const editing = await ctx.db.query("reelOrders").withIndex("by_status", q => q.eq("status", "editing")).collect();
  const mine = o.queuedAt ?? o.createdAt;
  return editing.length + queued.filter(x => x._id !== o._id && (x.queuedAt ?? x.createdAt) < mine).length;
}

async function withUrls(ctx: QueryCtx, o: Doc<"reelOrders">) {
  const latest = o.outputs.filter(x => x.version === o.version);
  const outputs = await Promise.all(latest.map(async x => ({ ...x, url: await ctx.storage.getUrl(x.storageId) })));
  return {
    ...o,
    outputs,
    olderVersions: o.version > 1 ? o.version - 1 : 0,
    statusLabel: o.free && o.status === "queued" ? "Free · in line for editing" : (STATUS_LABEL[o.status] ?? o.status),
    tierName: tierOf(o.tier).name,
    openPayment: openPayment(o) ?? null,
    paid: paidTotal(o),
    freeRevisionsLeft: freeRevisionsLeft(o),
    queueAhead: o.status === "queued" ? await queueAhead(ctx, o) : null,
    sampleUrl: (o.options as ReelOptions).sample?.storageId ? await ctx.storage.getUrl((o.options as ReelOptions).sample!.storageId as Id<"_storage">) : null,
  };
}

function sanitizeOptions(raw: ReelOptions, tierKey: string): ReelOptions {
  const tier = tierOf(tierKey);
  const o = { ...DEFAULT_OPTIONS, ...raw };
  const hex = (s?: string) => (s && /^#[0-9a-fA-F]{6}$/.test(s) ? s : undefined);
  const formats = (o.formats ?? []).filter(f => FORMATS.some(x => x.key === f));
  if (!formats.length) throw new Error("Pick at least one format");
  if (!PALETTES.some(p => p.key === o.palette)) o.palette = "black_gold";
  return {
    purpose: String(o.purpose).slice(0, 40),
    title: o.title?.trim().slice(0, 120) || undefined,
    address: o.address?.trim().slice(0, 160) || undefined,
    style: STYLES.some(x => x.key === o.style) ? o.style : "clean",
    palette: o.palette,
    customBg: o.palette === "custom" ? hex(o.customBg) : undefined,
    customAccent: o.palette === "custom" ? hex(o.customAccent) : undefined,
    logo: !!o.logo,
    headshot: !!o.headshot,
    nameBar: !!o.nameBar,
    endCard: !!o.endCard,
    lengthSec: Math.min(tier.maxSeconds, Math.max(15, Number(o.lengthSec) || 30)),
    pace: String(o.pace).slice(0, 20),
    music: String(o.music).slice(0, 20),
    musicTake: o.musicTake === "b" ? "b" : "a",
    trendSound: o.music === "none_trending" ? o.trendSound?.trim().slice(0, 120) || undefined : undefined,
    captions: o.captions !== false,
    captionSpot: o.captionSpot === "high" || o.captionSpot === "mid" ? o.captionSpot : "low",
    cta: CTAS.some(c => c.key === o.cta) ? o.cta : "call",
    ctaText: o.cta === "custom" ? o.ctaText?.trim().slice(0, 80) || undefined : undefined,
    broll: tier.broll ? (o.broll ?? ["auto"]).slice(0, 7).map(String) : ["none"],
    formats,
    sample: cleanSample(o.sample),
    autoOrder: !!o.autoOrder || undefined,
  };
}

function cleanSample(s?: ReelOptions["sample"]): ReelOptions["sample"] {
  if (!s) return undefined;
  const link = s.link?.trim().slice(0, 500);
  const okLink = link && /^https?:\/\/\S+$/i.test(link) ? link : undefined;
  const storageId = typeof s.storageId === "string" && s.storageId.length < 80 ? s.storageId : undefined;
  if (link && !okLink) throw new Error("That sample link doesn't look right. Paste the full link (https://…).");
  if (!okLink && !storageId) return undefined;
  const match = (s.match ?? []).filter(m => SAMPLE_MATCH.some(x => x.key === m));
  return {
    link: okLink,
    storageId: okLink ? undefined : storageId,
    fileName: okLink ? undefined : s.fileName?.slice(0, 160),
    size: okLink ? undefined : Number(s.size) || undefined,
    match: match.length ? match : SAMPLE_MATCH.map(x => x.key),
  };
}

// ---------- agent side ----------

export const config = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await viewer(ctx, ctx.userId);
    const toConfirm = me.canConfirm
      ? (await ctx.db.query("reelOrders").withIndex("by_status", q => q.eq("status", "payment_sent")).collect()).length
      : 0;
    return {
      isAdmin: me.isAdmin,
      isStaff: me.isStaff,
      canConfirm: me.canConfirm,
      toConfirm,
      zelleTo: ZELLE_TO,
      myCell: agentByEmail(me.email)?.phone ?? null,
      agents: me.isStaff ? AGENTS.map(a => ({ name: a.name, email: a.email })) : [],
    };
  },
});

export const place = authenticatedMutation({
  args: {
    tier: v.string(),
    options: v.any(),
    clips: v.array(v.object({ id: v.string(), name: v.string(), link: v.string(), size: v.number(), role: v.optional(v.string()) })),
    notes: v.optional(v.string()),
    as: v.optional(v.string()), // staff ordering for an agent
  },
  handler: async (ctx, a) => {
    const me = await viewer(ctx, ctx.userId);
    const tier = tierOf(a.tier);
    const forAgent = a.as && me.isStaff ? agentByEmail(a.as) : agentByEmail(me.email);
    const agentEmail = forAgent?.email ?? me.email;
    const agentName = forAgent?.name ?? me.name;
    if (!a.clips.length) throw new Error("Pick at least one of your clips");
    if (a.clips.length > tier.maxClips) throw new Error(`${tier.name} takes up to ${tier.maxClips} clip${tier.maxClips > 1 ? "s" : ""}. Pick fewer or choose Signature.`);
    // Clips must come from this agent's own upload folder (cached Drive list).
    const cache = await ctx.db.query("agentVideoFiles").withIndex("by_agent", q => q.eq("agentEmail", agentEmail)).unique();
    const known = new Set((cache?.files ?? []).map(f => f.id));
    // Or uploaded straight from the phone on the Reel page (reelUploads, id "hub:<id>").
    const ups = await ctx.db.query("reelUploads").withIndex("by_agent", q => q.eq("agentEmail", agentEmail)).collect();
    for (const u of ups) known.add(`hub:${u._id}`);
    if (a.clips.some(c => !known.has(c.id))) throw new Error("One of those clips isn't in your upload folder anymore. Refresh and pick again.");
    const options = sanitizeOptions(a.options as ReelOptions, tier.key);
    if (options.sample?.storageId && !ctx.db.system.normalizeId("_storage", options.sample.storageId)) throw new Error("The sample video didn't finish uploading. Try again.");
    const now = Date.now();
    const free = (await freeLeft(ctx, agentEmail)) > 0;
    const base = {
      agentEmail, agentName, orderedByEmail: me.email,
      tier: tier.key, revisionsIncluded: tier.revisions,
      options, clips: a.clips.map(c => ({ ...c, role: options.autoOrder ? undefined : c.role?.slice(0, 30) })), notes: a.notes?.trim().slice(0, 1500) || undefined,
      revisions: [], version: 0, outputs: [], costRuns: [], costCredits: 0,
      createdAt: now, updatedAt: now,
    };
    if (free) {
      const id = await ctx.db.insert("reelOrders", { ...base, price: 0, free: true, status: "queued", queuedAt: now, payments: [] });
      await ctx.scheduler.runAfter(0, internal.reelOrders.notify, { id, kind: "free" });
      return id;
    }
    const code = await nextCode(ctx);
    return await ctx.db.insert("reelOrders", {
      ...base, price: tier.price,
      status: "awaiting_payment",
      payments: [{ kind: "order", amount: tier.price, code, status: "awaiting", createdAt: now }],
    });
  },
});

// Free Reels left for an agent: FREE_REELS minus their free orders that weren't cancelled (Michael 11-08: 5 free).
async function freeLeft(ctx: QueryCtx, agentEmail: string) {
  const rows = await ctx.db.query("reelOrders").withIndex("by_agent", q => q.eq("agentEmail", agentEmail)).collect();
  return Math.max(0, FREE_REELS - rows.filter(r => r.free && r.status !== "cancelled").length);
}

// Agent uploads a sample video to copy the style of.
export const sampleUploadUrl = authenticatedMutation({ args: {}, handler: async ctx => await ctx.storage.generateUploadUrl() });

// ---------- direct phone uploads (Michael 2026-11-08) ----------
// The browser cuts each clip into CLIP_PART_MB parts and posts every part to its own upload URL,
// so a 500 MB 4K clip never hits the 2-minute single-upload timeout. Worker joins them in order.
export const clipPartUrls = authenticatedMutation({
  args: { count: v.number() },
  handler: async (ctx, { count }) => {
    await viewer(ctx, ctx.userId);
    const n = Math.max(1, Math.min(40, Math.floor(count)));
    return await Promise.all(Array.from({ length: n }, () => ctx.storage.generateUploadUrl()));
  },
});

export const saveClipUpload = authenticatedMutation({
  args: { name: v.string(), size: v.number(), mimeType: v.string(), parts: v.array(v.string()), as: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const me = await viewer(ctx, ctx.userId);
    const forAgent = a.as && me.isStaff ? agentByEmail(a.as) : agentByEmail(me.email);
    const agentEmail = forAgent?.email ?? me.email;
    if (!a.parts.length || a.parts.length > 400) throw new Error("That upload didn't finish. Try again.");
    const parts = a.parts.map(p => ctx.db.system.normalizeId("_storage", p));
    if (parts.some(p => !p)) throw new Error("Part of that video didn't upload. Try again.");
    const id = await ctx.db.insert("reelUploads", {
      agentEmail, uploadedBy: me.email, name: a.name.slice(0, 200) || "Video", size: a.size,
      mimeType: a.mimeType.slice(0, 80) || "video/mp4", parts: parts as Id<"_storage">[], createdAt: Date.now(),
    });
    return `hub:${id}`;
  },
});

// Clips this agent uploaded on the Reel page that aren't in their Drive list yet.
export const myClipUploads = authenticatedQuery({
  args: { as: v.optional(v.string()) },
  handler: async (ctx, { as }) => {
    const me = await viewer(ctx, ctx.userId);
    const email = as && me.isStaff ? agentByEmail(as)?.email ?? as : me.email;
    const rows = await ctx.db.query("reelUploads").withIndex("by_agent", q => q.eq("agentEmail", email)).order("desc").take(60);
    return rows.filter(r => !r.driveFileId).map(r => ({
      id: `hub:${r._id}`, name: r.name, size: r.size, mimeType: r.mimeType, createdTime: new Date(r.createdAt).toISOString(), link: "hub",
    }));
  },
});

const OPEN_ORDER = ["awaiting_payment", "payment_sent", "queued", "editing", "needs_info", "revision_payment"];

export const removeClipUpload = authenticatedMutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const me = await viewer(ctx, ctx.userId);
    const uid = ctx.db.normalizeId("reelUploads", id.replace(/^hub:/, ""));
    const u = uid ? await ctx.db.get(uid) : null;
    if (!u) return null;
    if (u.agentEmail !== me.email && u.uploadedBy !== me.email && !me.isStaff) throw new Error("Not your video");
    const orders = await ctx.db.query("reelOrders").withIndex("by_agent", q => q.eq("agentEmail", u.agentEmail)).collect();
    if (orders.some(o => OPEN_ORDER.includes(o.status) && o.clips.some(c => c.id === `hub:${u._id}`))) {
      throw new Error("That video is in an open order, so it stays until the Reel is done.");
    }
    for (const p of u.parts) await ctx.storage.delete(p).catch(() => null);
    await ctx.db.delete(u._id);
    return null;
  },
});

export const freeReels = authenticatedQuery({
  args: { as: v.optional(v.string()) },
  handler: async (ctx, { as }) => {
    const me = await viewer(ctx, ctx.userId);
    const forAgent = as && me.isStaff ? agentByEmail(as) : agentByEmail(me.email);
    return { left: await freeLeft(ctx, forAgent?.email ?? me.email), total: FREE_REELS };
  },
});

async function ownOrder(ctx: QueryCtx, userId: Id<"users">, id: Id<"reelOrders">) {
  const me = await viewer(ctx, userId);
  const o = await ctx.db.get(id);
  if (!o || !(me.isAdmin || o.agentEmail === me.email || o.orderedByEmail === me.email)) throw new Error("Order not found");
  return { me, o };
}

export const markSent = authenticatedMutation({
  args: { id: v.id("reelOrders") },
  handler: async (ctx, { id }) => {
    const { o } = await ownOrder(ctx, ctx.userId, id);
    const p = o.payments.find(x => x.status === "awaiting");
    if (!p) throw new Error("Nothing waiting for payment on this order");
    const payments = o.payments.map(x => (x === p ? { ...x, status: "sent", sentAt: Date.now() } : x));
    await ctx.db.patch(id, { payments, status: "payment_sent", statusNote: undefined, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.reelOrders.notify, { id, kind: "sent" });
    return null;
  },
});

export const cancel = authenticatedMutation({
  args: { id: v.id("reelOrders") },
  handler: async (ctx, { id }) => {
    const { o } = await ownOrder(ctx, ctx.userId, id);
    if (o.status !== "awaiting_payment") throw new Error("Only orders you haven't paid for can be cancelled. Ask Michael.");
    await ctx.db.patch(id, { status: "cancelled", payments: o.payments.map(p => (p.status === "awaiting" ? { ...p, status: "rejected", note: "Cancelled" } : p)), updatedAt: Date.now() });
    return null;
  },
});

export const requestRevision = authenticatedMutation({
  args: { id: v.id("reelOrders"), note: v.string() },
  handler: async (ctx, { id, note }) => {
    const { o } = await ownOrder(ctx, ctx.userId, id);
    if (o.status !== "delivered" && o.status !== "done") throw new Error("You can ask for changes once the Reel is ready");
    const text = note.trim().slice(0, 1500);
    if (text.length < 3) throw new Error("Tell Viktor what to change");
    const now = Date.now();
    const n = o.revisions.length + 1;
    if (freeRevisionsLeft(o) > 0) {
      await ctx.db.patch(id, { revisions: [...o.revisions, { n, note: text, at: now, paid: false }], status: "queued", queuedAt: now, statusNote: undefined, updatedAt: now });
      return { needsPayment: false };
    }
    const code = await nextCode(ctx);
    await ctx.db.patch(id, {
      revisions: [...o.revisions, { n, note: text, at: now, paid: true }],
      payments: [...o.payments, { kind: "revision", amount: EXTRA_REVISION_PRICE, code, status: "awaiting", createdAt: now }],
      status: "revision_payment", statusNote: undefined, updatedAt: now,
    });
    return { needsPayment: true };
  },
});

export const answer = authenticatedMutation({
  args: { id: v.id("reelOrders"), text: v.string() },
  handler: async (ctx, { id, text }) => {
    const { o } = await ownOrder(ctx, ctx.userId, id);
    if (o.status !== "needs_info") throw new Error("No open question on this order");
    await ctx.db.patch(id, { answer: text.trim().slice(0, 1500), status: "queued", queuedAt: Date.now(), updatedAt: Date.now() });
    return null;
  },
});

// Agent fixes caption wording on a delivered Reel. Free; Viktor re-renders with the new text.
export const editCaptions = authenticatedMutation({
  args: { id: v.id("reelOrders"), edits: v.array(v.object({ i: v.number(), text: v.string() })) },
  handler: async (ctx, { id, edits }) => {
    const { o } = await ownOrder(ctx, ctx.userId, id);
    if (o.status !== "delivered" && o.status !== "done") throw new Error("You can edit captions once the Reel is ready");
    const lines = new Map((o.captionLines ?? []).map(l => [l.i, l.text]));
    const changed = edits
      .map(e => ({ i: e.i, text: e.text.replace(/\s+/g, " ").trim().slice(0, 200) }))
      .filter(e => lines.has(e.i) && lines.get(e.i) !== e.text);
    if (!changed.length) throw new Error("No caption changes to send");
    const now = Date.now();
    const note = changed.map(e => `Line ${e.i}: “${lines.get(e.i)}” → “${e.text}”`).join("\n").slice(0, 3000);
    await ctx.db.patch(id, {
      revisions: [...o.revisions, { n: o.revisions.length + 1, note, at: now, paid: false, kind: "captions", edits: changed }],
      status: "queued", queuedAt: now, statusNote: undefined, updatedAt: now,
    });
    return null;
  },
});

export const markDone = authenticatedMutation({
  args: { id: v.id("reelOrders") },
  handler: async (ctx, { id }) => {
    const { o } = await ownOrder(ctx, ctx.userId, id);
    if (o.status !== "delivered") throw new Error("Not ready yet");
    await ctx.db.patch(id, { status: "done", updatedAt: Date.now() });
    return null;
  },
});

export const mine = authenticatedQuery({
  args: { as: v.optional(v.string()) },
  handler: async (ctx, { as }) => {
    const me = await viewer(ctx, ctx.userId);
    const email = as && me.isStaff ? as : me.email;
    const rows = await ctx.db.query("reelOrders").withIndex("by_agent", q => q.eq("agentEmail", email)).order("desc").take(50);
    // Admin cost fields stay out of the agent view.
    return Promise.all(rows.map(async o => ({ ...(await withUrls(ctx, o)), costRuns: [], costCredits: 0 })));
  },
});

// ---------- Michael / admin side ----------

export const queue = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await viewer(ctx, ctx.userId);
    if (!me.isAdmin) throw new Error("Admins only");
    const rows = await ctx.db.query("reelOrders").withIndex("by_created").order("desc").take(300);
    const orders = await Promise.all(rows.map(o => withUrls(ctx, o)));
    const billed = rows.filter(o => paidTotal(o) > 0);
    const revenue = billed.reduce((s, o) => s + paidTotal(o), 0);
    const credits = rows.reduce((s, o) => s + o.costCredits, 0);
    const cost = credits * CREDIT_USD;
    const owedToConfirm = rows.flatMap(o => o.payments.filter(p => p.status === "sent")).reduce((s, p) => s + p.amount, 0);
    return {
      orders: orders.map(o => ({ ...o, costUsd: o.costCredits * CREDIT_USD })),
      totals: { revenue, credits, cost, profit: revenue - cost, margin: revenue ? (revenue - cost) / revenue : 0, orders: billed.length, owedToConfirm },
      canConfirm: me.canConfirm,
    };
  },
});

export const confirmPayment = authenticatedMutation({
  args: { id: v.id("reelOrders"), code: v.string(), received: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, { id, code, received, note }) => {
    const me = await viewer(ctx, ctx.userId);
    if (!me.canConfirm) throw new Error("Only Michael confirms Zelle payments");
    const o = await ctx.db.get(id);
    if (!o) throw new Error("Order not found");
    const p = o.payments.find(x => x.code === code && (x.status === "sent" || x.status === "awaiting"));
    if (!p) throw new Error("That payment is already handled");
    const now = Date.now();
    const payments = o.payments.map(x =>
      x === p ? { ...x, status: received ? "confirmed" : "awaiting", confirmedAt: received ? now : undefined, confirmedBy: received ? me.email : undefined, note: note?.trim() || (received ? undefined : "Not found yet") } : x,
    );
    if (received) {
      await ctx.db.patch(id, { payments, status: "queued", queuedAt: now, statusNote: undefined, updatedAt: now });
      await ctx.scheduler.runAfter(0, internal.reelOrders.notify, { id, kind: "confirmed" });
    } else {
      await ctx.db.patch(id, {
        payments,
        status: p.kind === "order" ? "awaiting_payment" : "revision_payment",
        statusNote: note?.trim() || `Michael couldn't find a Zelle with memo ${code} yet. Check it went to ${ZELLE_TO}, then tap "I sent it" again.`,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.reelOrders.notify, { id, kind: "rejected" });
    }
    return null;
  },
});

// Pay by card (convex/cardPay.ts): the open payment on this order, and what happens once Stripe says
// it's paid (the same effect as Michael's "Confirm received": the Reel goes in line for editing).
export async function cardPayable(ctx: QueryCtx, userId: Id<"users">, id: string) {
  const rid = ctx.db.normalizeId("reelOrders", id);
  if (!rid) throw new Error("Order not found");
  const { o } = await ownOrder(ctx, userId, rid);
  if (o.payments.some(x => x.status === "sent")) throw new Error("You already told us you sent this by Zelle. Michael is confirming it.");
  const p = o.payments.find(x => x.status === "awaiting");
  if (!p) throw new Error("Nothing is waiting for payment on this order");
  return {
    code: p.code, amount: p.amount, agentEmail: o.agentEmail, agentName: o.agentName, backPath: "/reels?tab=mine",
    label: p.kind === "revision" ? `Extra Reel revision (${tierOf(o.tier).name})` : tierOf(o.tier).name,
  };
}

export async function cardSettle(ctx: MutationCtx, id: string, code: string, by: string) {
  const rid = ctx.db.normalizeId("reelOrders", id);
  const o = rid ? await ctx.db.get(rid) : null;
  const p = o?.payments.find(x => x.code === code && (x.status === "sent" || x.status === "awaiting"));
  if (!rid || !o || !p || o.status === "cancelled") return { ok: false as const };
  const now = Date.now();
  const payments = o.payments.map(x => (x === p ? { ...x, status: "confirmed", confirmedAt: now, confirmedBy: by, method: "card", note: undefined } : x));
  await ctx.db.patch(rid, { payments, status: "queued", queuedAt: now, statusNote: undefined, updatedAt: now });
  await ctx.scheduler.runAfter(0, internal.reelOrders.notify, { id: rid, kind: "confirmed" });
  return { ok: true as const, next: "The Reel is in line for editing", lobCards: 0 };
}

export const adminCancel = authenticatedMutation({
  args: { id: v.id("reelOrders"), note: v.optional(v.string()) },
  handler: async (ctx, { id, note }) => {
    const me = await viewer(ctx, ctx.userId);
    if (!me.isAdmin) throw new Error("Admins only");
    const o = await ctx.db.get(id);
    if (!o) throw new Error("Order not found");
    await ctx.db.patch(id, { status: "cancelled", statusNote: note?.trim() || "Cancelled by SpaceMatch", updatedAt: Date.now() });
    return null;
  },
});

// ---------- notifications ----------

export const forNotify = internalQuery({
  args: { id: v.id("reelOrders") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const notify = internalAction({
  args: { id: v.id("reelOrders"), kind: v.string() },
  handler: async (ctx, { id, kind }) => {
    await syncRoster(ctx);
    const o: Doc<"reelOrders"> | null = await ctx.runQuery(internal.reelOrders.forNotify, { id });
    if (!o) return;
    const base = hubUrl();
    const tier = tierOf(o.tier).name;
    const last = o.payments[o.payments.length - 1];
    const sent = [...o.payments].reverse().find(p => p.status === "sent") ?? last;
    const push = (email: string, title: string, body: string, url: string) =>
      ctx.runAction(internal.push.toEmail, { email, title, body, url }).catch(() => null);
    const mail = (to: string, subject: string, html: string) => sendMail(to, subject, html).catch(e => console.error("reel mail", e));
    if (kind === "sent") {
      const what = sent.kind === "order" ? `${tier} order` : "extra revision";
      await mail(
        PAYMENT_ALERT_EMAIL,
        `Zelle to confirm: ${money(sent.amount)} from ${o.agentName} (${sent.code})`,
        shell(
          `${o.agentName} says they sent ${money(sent.amount)}`,
          `<p style="color:#333;font-size:15px">Check your Zelle at ${esc(ZELLE_TO)} for a payment with memo <b>${esc(sent.code)}</b>, then tap Confirm in the Hub. Viktor starts editing only after you confirm.</p>${table([
            ["Agent", o.agentName],
            ["For", what],
            ["Amount", money(sent.amount)],
            ["Memo code", sent.code],
          ])}`,
          { href: `${base}/reels?tab=orders`, label: "Confirm in the Hub" },
        ),
      );
      await push(PAYMENT_ALERT_EMAIL, `Zelle to confirm: ${money(sent.amount)}`, `${o.agentName} · memo ${sent.code}`, "/reels?tab=orders");
    } else if (kind === "confirmed") {
      await mail(
        o.agentEmail,
        `Payment received. Viktor is on your ${tier}`,
        shell(
          "Payment received",
          `<p style="color:#333;font-size:15px">Thanks! Your ${esc(tier)} is in line for editing. We'll email you when it's ready to download.</p>`,
          { href: `${base}/reels`, label: "Open Reel Studio" },
        ),
      );
    } else if (kind === "free") {
      const left: number = await ctx.runQuery(internal.reelOrders.freeLeftInternal, { agentEmail: o.agentEmail });
      const leftLine = left > 0 ? `You have ${left} free Reel${left === 1 ? "" : "s"} left after this one.` : "That was your last free one. After this, Reels are paid by Zelle.";
      await mail(
        o.agentEmail,
        `This Reel is on us. Viktor is on your ${tier}`,
        shell(
          "Your Reel is free",
          `<p style="color:#333;font-size:15px">No payment needed. Your ${esc(tier)} is in line for editing, and we'll email you when it's ready to download. ${esc(leftLine)}</p>`,
          { href: `${base}/reels`, label: "Open Reel Studio" },
        ),
      );
      await push(PAYMENT_ALERT_EMAIL, `Free Reel: ${o.agentName}`, `${tier} · in the queue, no payment · ${left} free left`, "/reels?tab=orders");
    } else if (kind === "rejected") {
      await mail(
        o.agentEmail,
        `We couldn't find your Zelle yet (${last.code})`,
        shell("Payment not found yet", `<p style="color:#333;font-size:15px">${esc(o.statusNote ?? "")}</p>`, { href: `${base}/reels`, label: "Open Reel Studio" }),
      );
    } else if (kind === "delivered") {
      await mail(
        o.agentEmail,
        `Your ${tier} is ready`,
        shell(
          "Your Reel is ready",
          `<p style="color:#333;font-size:15px">Download a file for each app you picked. Want something changed? Tap "Ask for changes".</p>${o.viktorNote ? `<p style="color:#555;font-size:14px">${esc(o.viktorNote)}</p>` : ""}`,
          { href: `${base}/reels`, label: "Watch & download" },
        ),
      );
      await push(o.agentEmail, "Your Reel is ready", tier, "/reels");
    } else if (kind === "needs_info") {
      await mail(
        o.agentEmail,
        "Quick question about your Reel",
        shell("Viktor has a question", `<p style="color:#333;font-size:15px">${esc(o.question ?? "")}</p>`, { href: `${base}/reels`, label: "Answer in the Hub" }),
      );
      await push(o.agentEmail, "Question about your Reel", (o.question ?? "").slice(0, 120), "/reels");
    }
  },
});

// ---------- Viktor worker (run_app_function prod from the /hub/reel-queue cron) ----------

export const pendingCount = internalQuery({
  args: {},
  handler: async ctx => (await ctx.db.query("reelOrders").withIndex("by_status", q => q.eq("status", "queued")).take(50)).length,
});

async function hubClipFiles(ctx: QueryCtx, o: Doc<"reelOrders">) {
  const out: { clipId: string; uploadId: string; name: string; size: number; mimeType: string; partUrls: (string | null)[]; driveFileId: string | null; driveLink: string | null }[] = [];
  for (const c of o.clips) {
    if (!c.id.startsWith("hub:")) continue;
    const uid = ctx.db.normalizeId("reelUploads", c.id.slice(4));
    const u = uid ? await ctx.db.get(uid) : null;
    if (!u) continue;
    out.push({
      clipId: c.id, uploadId: u._id, name: u.name, size: u.size, mimeType: u.mimeType,
      partUrls: await Promise.all(u.parts.map(p => ctx.storage.getUrl(p))),
      driveFileId: u.driveFileId ?? null, driveLink: u.driveLink ?? null,
    });
  }
  return out;
}

// preview = Apple's 30s preview clip (iTunes Search API), link = the full song on Apple Music. Added by reel_queue.py trends.
const sound = v.object({ title: v.string(), artist: v.string(), use: v.string(), reels: v.optional(v.string()), preview: v.optional(v.string()), link: v.optional(v.string()) });

async function latestTrends(ctx: QueryCtx) {
  return await ctx.db.query("reelTrends").withIndex("by_checked").order("desc").first();
}

async function trendFor(ctx: QueryCtx, purpose: string) {
  const t = await latestTrends(ctx);
  if (!t) return null;
  const pick = t.picks.find(p => p.purpose === purpose) ?? t.picks.find(p => p.purpose === "other") ?? null;
  return { checkedAt: t.checkedAt, ageDays: Math.floor((Date.now() - t.checkedAt) / 86_400_000), pick, signals: t.signals };
}

/** Agents see what "Trending now" means for their Reel type and when it was last checked. */
export const trends = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const t = await latestTrends(ctx);
    return t ? { checkedAt: t.checkedAt, picks: t.picks, sounds: t.sounds ?? [] } : null;
  },
});

/** Worker: reel_queue.py trends <file.json> after the weekly trend check. */
export const setTrends = internalMutation({
  args: { picks: v.array(v.object({ purpose: v.string(), name: v.string(), how: v.string() })), signals: v.array(v.string()), sounds: v.optional(v.array(sound)) },
  handler: async (ctx, a) => {
    await syncRoster(ctx);
    for (const old of await ctx.db.query("reelTrends").collect()) await ctx.db.delete(old._id);
    await ctx.db.insert("reelTrends", { checkedAt: Date.now(), picks: a.picks, signals: a.signals, sounds: a.sounds });
  },
});

async function brief(ctx: QueryCtx, o: Doc<"reelOrders">) {
  const agent = agentByEmail(o.agentEmail);
  const prev = await Promise.all(
    o.outputs.filter(x => x.version === o.version).map(async x => ({ format: x.format, url: await ctx.storage.getUrl(x.storageId) })),
  );
  return {
    ...o,
    tierName: tierOf(o.tier).name,
    agentPhone: agent?.phone ?? null,
    optionRows: optionRows(o.options as ReelOptions),
    // Caption position comes from the agent's captionSpot and never covers the face. y (1080x1920): upper ≈ 300-420,
    // middle ≈ 1050-1200 (just under the chin; the worker checks the face box and nudges down), lower ≈ 1400-1520.
    style: { ...styleOf((o.options as ReelOptions).style), position: ({ high: "upper", mid: "middle", low: "lower" } as const)[(o.options as ReelOptions).captionSpot ?? "low"] ?? "lower" },
    captionSpot: (o.options as ReelOptions).captionSpot ?? "low",
    // The exact take the agent heard: /work/data/reel_studio/music/lib/<music>_<take>.mp3 (none for none/none_trending).
    musicFile: MUSIC_TAKES[(o.options as ReelOptions).music] ? `${(o.options as ReelOptions).music}_${(o.options as ReelOptions).musicTake ?? "a"}.mp3` : null,
    // This week's trending format for this Reel type. Signature: always use it (or beat it) + creativity gate.
    trend: await trendFor(ctx, (o.options as ReelOptions).purpose),
    brokerageLine: brokerageLine(),
    officeLine: "(773) 985-7153",
    palette: PALETTES.find(p => p.key === (o.options as ReelOptions).palette) ?? null,
    formatsDetail: FORMATS.filter(f => (o.options as ReelOptions).formats.includes(f.key)),
    latestRevision: o.revisions[o.revisions.length - 1] ?? null,
    previousOutputs: prev,
    // Clips uploaded on the Reel page: download every part URL in order and join (cat) them.
    hubClips: await hubClipFiles(ctx, o),
    // Copy-a-sample: download from sampleUrl (uploaded file) or sample.link (IG/TikTok/YouTube). Match style only.
    sampleUrl: (o.options as ReelOptions).sample?.storageId
      ? await ctx.storage.getUrl((o.options as ReelOptions).sample!.storageId as Id<"_storage">)
      : null,
  };
}

export const nextQueued = internalQuery({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const rows = await ctx.db.query("reelOrders").withIndex("by_status", q => q.eq("status", "queued")).collect();
    const o = rows.sort((a, b) => (a.queuedAt ?? a.createdAt) - (b.queuedAt ?? b.createdAt))[0];
    return o ? brief(ctx, o) : null;
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("reelOrders") },
  handler: async (ctx, { id }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    return o ? brief(ctx, o) : null;
  },
});

export const listInternal = internalQuery({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    await syncRoster(ctx);
    const rows = status
      ? await ctx.db.query("reelOrders").withIndex("by_status", q => q.eq("status", status)).collect()
      : await ctx.db.query("reelOrders").withIndex("by_created").order("desc").take(100);
    return rows.map(o => ({ _id: o._id, agentName: o.agentName, tier: o.tier, status: o.status, version: o.version, paid: paidTotal(o), costCredits: o.costCredits, createdAt: o.createdAt }));
  },
});

export const workerStatus = internalMutation({
  args: {
    id: v.id("reelOrders"),
    status: v.union(v.literal("editing"), v.literal("needs_info"), v.literal("queued")),
    note: v.optional(v.string()),
    question: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, note, question }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("Order not found");
    const now = Date.now();
    if (status === "editing") {
      if (o.status !== "queued") throw new Error(`Order is ${o.status}, not queued`);
      await ctx.db.patch(id, { status, statusNote: note ?? "Viktor is editing your Reel", version: o.version + 1, pickedUpAt: now, stage: "clips", stageAt: now, updatedAt: now });
    } else if (status === "needs_info") {
      if (!question) throw new Error("question required");
      // The version bump from pickup is undone: nothing was delivered.
      await ctx.db.patch(id, { status, question, answer: undefined, statusNote: note, stage: undefined, stageAt: undefined, version: Math.max(0, o.version - (o.status === "editing" ? 1 : 0)), updatedAt: now });
      await ctx.scheduler.runAfter(0, internal.reelOrders.notify, { id, kind: "needs_info" });
    } else {
      await ctx.db.patch(id, { status, statusNote: note, stage: undefined, stageAt: undefined, version: Math.max(0, o.version - (o.status === "editing" ? 1 : 0)), queuedAt: now, updatedAt: now });
    }
    return null;
  },
});

// Worker progress for the live tracker (Michael 2026-10-29).
export const workerStage = internalMutation({
  args: { id: v.id("reelOrders"), stage: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { id, stage, note }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("Order not found");
    if (o.status !== "editing") throw new Error(`Order is ${o.status}, not editing`);
    if (!REEL_STAGES.some(s => s.key === stage)) throw new Error(`Unknown stage ${stage}`);
    await ctx.db.patch(id, { stage, stageAt: Date.now(), ...(note ? { statusNote: note.slice(0, 200) } : {}), updatedAt: Date.now() });
    return null;
  },
});

export const uploadUrl = internalMutation({
  args: {},
  handler: async ctx => ctx.storage.generateUploadUrl(),
});

export const addOutput = internalMutation({
  args: { id: v.id("reelOrders"), format: v.string(), storageId: v.id("_storage"), size: v.number(), seconds: v.optional(v.number()) },
  handler: async (ctx, { id, format, storageId, size, seconds }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("Order not found");
    if (o.status !== "editing") throw new Error("Set status editing first");
    const outputs = o.outputs.filter(x => !(x.version === o.version && x.format === format));
    await ctx.db.patch(id, { outputs: [...outputs, { version: o.version, format, storageId, size, seconds }], updatedAt: Date.now() });
    return null;
  },
});

export const setCaptions = internalMutation({
  args: { id: v.id("reelOrders"), lines: v.array(v.object({ i: v.number(), start: v.number(), end: v.number(), text: v.string() })) },
  handler: async (ctx, { id, lines }) => {
    await syncRoster(ctx);
    await ctx.db.patch(id, { captionLines: lines, updatedAt: Date.now() });
    return null;
  },
});

export const deliver = internalMutation({
  args: { id: v.id("reelOrders"), note: v.optional(v.string()) },
  handler: async (ctx, { id, note }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("Order not found");
    const formats = (o.options as ReelOptions).formats;
    const have = new Set(o.outputs.filter(x => x.version === o.version).map(x => x.format));
    const missing = formats.filter(f => !have.has(f));
    if (missing.length) throw new Error(`Missing formats: ${missing.join(", ")}`);
    const now = Date.now();
    await ctx.db.patch(id, { status: "delivered", viktorNote: note, statusNote: undefined, stage: undefined, stageAt: undefined, deliveredAt: now, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.reelOrders.notify, { id, kind: "delivered" });
    return null;
  },
});

export const addCost = internalMutation({
  args: { id: v.id("reelOrders"), credits: v.number(), note: v.optional(v.string()), threadId: v.optional(v.string()) },
  handler: async (ctx, { id, credits, note, threadId }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("Order not found");
    await ctx.db.patch(id, { costRuns: [...o.costRuns, { credits, note, threadId, at: Date.now() }], costCredits: o.costCredits + credits });
    return null;
  },
});

export const removeInternal = internalMutation({
  args: { ids: v.array(v.id("reelOrders")) },
  handler: async (ctx, { ids }) => {
    await syncRoster(ctx);
    for (const id of ids) {
      const o = await ctx.db.get(id);
      if (!o) continue;
      for (const x of o.outputs) await ctx.storage.delete(x.storageId).catch(() => null);
      await ctx.db.delete(id);
    }
    return null;
  },
});

// Worker copied a phone upload into the agent's Drive folder: keep the record, free the Hub storage.
export const clipUploadMirrored = internalMutation({
  args: { uploadId: v.id("reelUploads"), driveFileId: v.string(), driveLink: v.optional(v.string()) },
  handler: async (ctx, { uploadId, driveFileId, driveLink }) => {
    await syncRoster(ctx);
    const u = await ctx.db.get(uploadId);
    if (!u) return null;
    for (const p of u.parts) await ctx.storage.delete(p).catch(() => null);
    await ctx.db.patch(uploadId, { parts: [], driveFileId, driveLink });
    return null;
  },
});

// Daily: phone uploads never used in an order are removed after 30 days (Hub storage isn't the library).
export const cleanupClipUploads = internalMutation({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const cutoff = Date.now() - 30 * 86_400_000;
    const rows = (await ctx.db.query("reelUploads").collect()).filter(u => u.createdAt < cutoff && u.parts.length);
    let n = 0;
    for (const u of rows) {
      const orders = await ctx.db.query("reelOrders").withIndex("by_agent", q => q.eq("agentEmail", u.agentEmail)).collect();
      if (orders.some(o => o.status !== "cancelled" && o.clips.some(c => c.id === `hub:${u._id}`))) continue;
      for (const p of u.parts) await ctx.storage.delete(p).catch(() => null);
      await ctx.db.delete(u._id);
      n++;
    }
    return n;
  },
});

export const removeClipUploadInternal = internalMutation({
  args: { id: v.id("reelUploads") },
  handler: async (ctx, { id }) => {
    await syncRoster(ctx);
    const u = await ctx.db.get(id);
    if (!u) return null;
    for (const p of u.parts) await ctx.storage.delete(p).catch(() => null);
    await ctx.db.delete(id);
    return null;
  },
});

export const listClipUploadsInternal = internalQuery({
  args: {},
  handler: async ctx => (await ctx.db.query("reelUploads").collect()).map(u => ({ ...u, parts: u.parts.length })),
});

export const freeLeftInternal = internalQuery({
  args: { agentEmail: v.string() },
  handler: async (ctx, { agentEmail }) => await freeLeft(ctx, agentEmail),
});

// e2e helper (dev): copies of a free order so the test agent uses up their free Reels. Remove with removeInternal.
export const cloneFreeInternal = internalMutation({
  args: { id: v.id("reelOrders"), n: v.number() },
  handler: async (ctx, { id, n }) => {
    await syncRoster(ctx);
    const o = await ctx.db.get(id);
    if (!o) throw new Error("no order");
    const { _id, _creationTime, ...rest } = o;
    const ids = [];
    for (let i = 0; i < n; i++) ids.push(await ctx.db.insert("reelOrders", { ...rest, status: "done", outputs: [] }));
    return ids;
  },
});

// e2e helper (dev): ensure the test agent has a fake clip in the Drive cache.
export const seedClipInternal = internalMutation({
  args: { agentEmail: v.string() },
  handler: async (ctx, { agentEmail }) => {
    await syncRoster(ctx);
    const f = { id: "e2e-clip-1", name: "E2E test clip.mov", size: 12_000_000, mimeType: "video/quicktime", createdTime: "2026-10-28T12:00:00Z", link: "https://drive.google.com/file/d/e2e/view" };
    const row = await ctx.db.query("agentVideoFiles").withIndex("by_agent", q => q.eq("agentEmail", agentEmail)).unique();
    if (row) {
      await ctx.db.patch(row._id, { files: [f, ...row.files.filter(x => x.id !== f.id)], checkedAt: Date.now() });
    } else await ctx.db.insert("agentVideoFiles", { agentEmail, files: [f], checkedAt: Date.now() });
    return null;
  },
});
