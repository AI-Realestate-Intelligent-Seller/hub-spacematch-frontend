// Pay by card (Michael 2026-11-10, Angel Zhang's Hub idea): a "Pay by card" button next to Zelle on
// seller lists / Mail it for me, own-list Lob mailings, Reels and pay-ahead ad orders.
//   agent taps Pay by card → Stripe Checkout Session for the order's exact amount (+3% card fee when
//   Michael chose "agent pays") → agent pays on Stripe's page → back on /pay/return the Hub ASKS STRIPE
//   whether that session is paid (never trusts the browser) → the order is settled exactly as if Michael
//   had tapped Received (mailings start, Reels queue). Scheduled re-checks cover a closed tab; no webhook.
// The Stripe key is pasted by Michael in Settings and stored in stripeConfig; no function returns it.
// Dev only: STRIPE_MOCK=1 fakes Stripe (never set on prod).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type ActionCtx, type MutationCtx, type QueryCtx } from "./_generated/server";
import { cardPayable as adPayable, cardSettle as adSettle } from "./adOrders";
import { CARD_FEE_PCT, cardFee, cents, type CardKind } from "./cardDefs";
import { authenticatedAction, authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { cardPayable as lobPayable, cardSettle as lobSettle } from "./lob";
import { LOB_FREE_MONTHLY } from "./lobDefs";
import { esc, hubUrl, sendMail, shell, table } from "./notify";
import { PAYMENT_ALERT_EMAIL, PAYMENT_CONFIRMERS } from "./reelDefs";
import { cardPayable as reelPayable, cardSettle as reelSettle } from "./reelOrders";
import { cardPayable as listPayable, cardSettle as listSettle } from "./sellerLists";

declare const process: { env: Record<string, string | undefined> };

const BY = "Card (Stripe)";
const SESSION_MIN = 35; // Stripe's minimum is 30 minutes
const RECHECK_S = [45, 60, 120, 240, 480, 600, 720]; // ≈ 38 min of re-checks, past the session's expiry
const kindV = v.union(v.literal("list"), v.literal("lob"), v.literal("reel"), v.literal("ad"));
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const mock = () => process.env.STRIPE_MOCK === "1";
const hint = (k: string) => `••••${k.slice(-4)}`;
const usable = (cfg: Doc<"stripeConfig"> | null): cfg is Doc<"stripeConfig"> => !!cfg && (cfg.mode === "live" || mock());
const chicagoMonth = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }).slice(0, 7);

const PAYABLE: Record<CardKind, (ctx: QueryCtx, userId: Id<"users">, id: string) => Promise<{ code: string; amount: number; label: string; agentEmail: string; agentName: string; backPath: string }>> =
  { list: listPayable, lob: lobPayable, reel: reelPayable, ad: adPayable };
const SETTLE: Record<CardKind, (ctx: MutationCtx, id: string, code: string, by: string) => Promise<{ ok: true; next: string; lobCards: number } | { ok: false }>> =
  { list: listSettle, lob: lobSettle, reel: reelSettle, ad: adSettle };

// ── Stripe ──────────────────────────────────────────────────────────────────
type Session = { id: string; url?: string | null; status?: string; payment_status?: string; amount_total?: number; livemode?: boolean };

class StripeError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

function mockStripe(method: string, path: string, params?: Record<string, string>): Session {
  if (method === "POST" && path === "/checkout/sessions") {
    const total = Object.entries(params ?? {}).filter(([k]) => k.endsWith("[unit_amount]")).reduce((s, [, x]) => s + Number(x), 0);
    const id = `cs_test_mock_${total}_${Math.random().toString(36).slice(2, 10)}`;
    return { id, url: (params?.success_url ?? "").replace("{CHECKOUT_SESSION_ID}", id), status: "open", payment_status: "unpaid", amount_total: total };
  }
  const id = path.split("/")[3] ?? "";
  if (path.endsWith("/expire")) return { id, status: "expired", payment_status: "unpaid" };
  return { id, status: "complete", payment_status: "paid", amount_total: Number(id.split("_")[3]) };
}

async function stripe(key: string, method: "GET" | "POST", path: string, params?: Record<string, string>): Promise<Session> {
  if (mock()) return mockStripe(method, path, params);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & Session;
  if (!res.ok) throw new StripeError(res.status, json.error?.message ?? `Stripe answered ${res.status}`);
  return json;
}

// The one place a Checkout Session is described: real orders and the Settings connection check both use it.
function sessionParams(a: { code: string; label: string; amount: number; fee: number; agentEmail: string; agentName: string; kind: string; refId: string; backPath: string }) {
  const hub = hubUrl();
  const p: Record<string, string> = {
    mode: "payment",
    "payment_method_types[0]": "card",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(cents(a.amount)),
    "line_items[0][price_data][product_data][name]": a.label.slice(0, 200),
    "line_items[0][price_data][product_data][description]": `SpaceMatch Agent Hub order ${a.code}`,
    success_url: `${hub}/pay/return?s={CHECKOUT_SESSION_ID}`,
    cancel_url: `${hub}${a.backPath}`,
    client_reference_id: a.code,
    expires_at: String(Math.floor(Date.now() / 1000) + SESSION_MIN * 60),
    "metadata[code]": a.code,
    "metadata[kind]": a.kind,
    "metadata[ref]": a.refId,
    "metadata[agent]": a.agentName.slice(0, 100),
    "payment_intent_data[description]": `${a.code} · ${a.agentName} · ${a.label}`.slice(0, 300),
    "payment_intent_data[metadata][code]": a.code,
  };
  if (a.fee > 0) {
    p["line_items[1][quantity]"] = "1";
    p["line_items[1][price_data][currency]"] = "usd";
    p["line_items[1][price_data][unit_amount]"] = String(cents(a.fee));
    p["line_items[1][price_data][product_data][name]"] = `Card fee (${CARD_FEE_PCT}%)`;
  }
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.agentEmail)) p.customer_email = a.agentEmail;
  return p;
}

const friendly = (e: unknown) => {
  if (e instanceof StripeError) {
    if (e.status === 401) return "Stripe didn't accept that key. Copy it again from Stripe › Developers › API keys.";
    if (e.status === 403 || /permission/i.test(e.message)) return `That key isn't allowed to create payments. In Stripe, set "Checkout Sessions" to Write on the key. (Stripe said: ${e.message})`;
    return `Stripe said: ${e.message}`;
  }
  return e instanceof Error ? e.message : String(e);
};

// ── What the pages read ─────────────────────────────────────────────────────
export const info = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    const cfg = await ctx.db.query("stripeConfig").first();
    const on = usable(cfg);
    const canManage = PAYMENT_CONFIRMERS.includes(me.email);
    const recent = canManage ? await ctx.db.query("cardPayments").withIndex("by_created").order("desc").take(40) : [];
    return {
      enabled: on,
      feePct: on && cfg.feeMode === "agent" ? CARD_FEE_PCT : 0,
      canManage,
      admin: !canManage ? null : {
        connected: !!cfg,
        keyHint: cfg ? hint(cfg.apiKey) : "",
        mode: cfg?.mode ?? "",
        feeMode: cfg?.feeMode ?? "",
        savedBy: cfg?.savedBy ?? "",
        savedAt: cfg?.savedAt ?? 0,
        hiddenTestKey: !!cfg && !on,
        feePct: CARD_FEE_PCT,
        payments: recent.filter(r => r.status === "paid" || r.status === "problem").slice(0, 12)
          .map(r => ({ id: r._id, code: r.code, agentName: r.agentName, label: r.label, amount: r.amount, fee: r.fee, total: r.total, status: r.status, note: r.note ?? "", at: r.paidAt ?? r.createdAt })),
      },
    };
  },
});

// ── Michael: connect / change / remove the Stripe key ───────────────────────
export const manager = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await hubViewer(ctx, userId);
    return { ok: PAYMENT_CONFIRMERS.includes(me.email), name: me.name || me.email };
  },
});

export const saveConfig = internalMutation({
  args: { apiKey: v.string(), mode: v.string(), feeMode: v.string(), savedBy: v.string() },
  handler: async (ctx, a) => {
    for (const row of await ctx.db.query("stripeConfig").collect()) await ctx.db.delete(row._id);
    await ctx.db.insert("stripeConfig", { ...a, savedAt: Date.now() });
  },
});

// Checks the key with Stripe before saving it: creates a $1.00 Checkout Session exactly the way an
// order would, then expires it. Nobody is charged.
export const connect = authenticatedAction({
  args: { apiKey: v.string(), feeMode: v.union(v.literal("agent"), v.literal("absorb")) },
  handler: async (ctx, { apiKey, feeMode }): Promise<{ mode: string }> => {
    const who = await ctx.runQuery(internal.cardPay.manager, { userId: ctx.userId });
    if (!who.ok) throw new Error("Only Michael can connect Stripe");
    const key = apiKey.trim();
    if (/^pk_/.test(key)) throw new Error("That's the publishable key (starts with pk_). Use the secret key instead: on the same Stripe page tap “Create a secret key”. It starts with sk_live_ or rk_live_.");
    const m = /^(rk|sk)_(live|test)_[A-Za-z0-9]{10,}$/.exec(key);
    if (!m) throw new Error("That doesn't look like a Stripe secret key. It starts with sk_live_ or rk_live_.");
    try {
      const s = await stripe(key, "POST", "/checkout/sessions", sessionParams({
        code: "HUB-CHECK", label: "SpaceMatch Hub connection check (not a real order)", amount: 1, fee: feeMode === "agent" ? 0.03 : 0,
        agentEmail: "", agentName: who.name, kind: "check", refId: "check", backPath: "/settings",
      }));
      if (!s.id || !s.url) throw new Error("Stripe didn't return a payment page for the test. Try again.");
      await stripe(key, "POST", `/checkout/sessions/${s.id}/expire`).catch(() => null);
    } catch (e) {
      throw new Error(friendly(e));
    }
    await ctx.runMutation(internal.cardPay.saveConfig, { apiKey: key, mode: m[2], feeMode, savedBy: who.name });
    return { mode: m[2] };
  },
});

export const setFee = authenticatedMutation({
  args: { feeMode: v.union(v.literal("agent"), v.literal("absorb")) },
  handler: async (ctx, { feeMode }) => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!PAYMENT_CONFIRMERS.includes(me.email)) throw new Error("Only Michael can change this");
    const cfg = await ctx.db.query("stripeConfig").first();
    if (!cfg) throw new Error("Connect Stripe first");
    await ctx.db.patch(cfg._id, { feeMode });
    return null;
  },
});

export const disconnect = authenticatedMutation({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!PAYMENT_CONFIRMERS.includes(me.email)) throw new Error("Only Michael can change this");
    for (const row of await ctx.db.query("stripeConfig").collect()) await ctx.db.delete(row._id);
    return null;
  },
});

// ── Agent: pay an order by card ─────────────────────────────────────────────
export const prepare = internalQuery({
  args: { userId: v.id("users"), kind: kindV, id: v.string() },
  handler: async (ctx, { userId, kind, id }) => {
    const cfg = await ctx.db.query("stripeConfig").first();
    if (!usable(cfg)) throw new Error("Card payments aren't turned on yet. Pay by Zelle, or ask Michael.");
    const p = await PAYABLE[kind](ctx, userId, id);
    const fee = cfg.feeMode === "agent" ? cardFee(p.amount, CARD_FEE_PCT) : 0;
    const total = Math.round((p.amount + fee) * 100) / 100;
    if (total < 0.5) throw new Error("That's under Stripe's 50¢ minimum. Pay by Zelle.");
    const open = (await ctx.db.query("cardPayments").withIndex("by_ref", q => q.eq("kind", kind).eq("refId", id)).collect())
      .find(r => r.status === "open" && r.code === p.code && r.total === total && r.expiresAt > Date.now() + 5 * 60000);
    return { ...p, fee, total, key: cfg.apiKey, mode: cfg.mode, reuseUrl: open?.url ?? null };
  },
});

export const record = internalMutation({
  args: {
    kind: kindV, refId: v.string(), code: v.string(), label: v.string(), amount: v.number(), fee: v.number(), total: v.number(),
    userId: v.id("users"), agentEmail: v.string(), agentName: v.string(), backPath: v.string(), sessionId: v.string(), url: v.string(), mode: v.string(),
  },
  handler: async (ctx, a) => {
    const now = Date.now();
    await ctx.db.insert("cardPayments", { ...a, status: "open", checks: 0, createdAt: now, expiresAt: now + SESSION_MIN * 60000 });
    await ctx.scheduler.runAfter(RECHECK_S[0] * 1000, internal.cardPay.check, { sessionId: a.sessionId });
  },
});

// Opens (or reuses) the Stripe payment page for one order. Shared by `start` and the dev e2e helper.
export async function openSession(ctx: ActionCtx, userId: Id<"users">, kind: CardKind, id: string): Promise<{ url: string; sessionId: string | null }> {
  const p = await ctx.runQuery(internal.cardPay.prepare, { userId, kind, id });
  if (p.reuseUrl) return { url: p.reuseUrl, sessionId: null };
  let s: Session;
  try {
    s = await stripe(p.key, "POST", "/checkout/sessions", sessionParams({ ...p, kind, refId: id }));
  } catch (e) {
    console.error("cardPay.start", kind, p.code, e instanceof Error ? e.message : String(e));
    throw new Error(`The card page couldn't open (${e instanceof StripeError ? e.message : "Stripe didn't answer"}). Pay by Zelle, or try again in a minute.`);
  }
  if (!s.id || !s.url) throw new Error("The card page couldn't open. Pay by Zelle, or try again in a minute.");
  await ctx.runMutation(internal.cardPay.record, {
    kind, refId: id, code: p.code, label: p.label, amount: p.amount, fee: p.fee, total: p.total, userId,
    agentEmail: p.agentEmail, agentName: p.agentName, backPath: p.backPath, sessionId: s.id, url: s.url, mode: p.mode,
  });
  return { url: s.url, sessionId: s.id };
}

export const start = authenticatedAction({
  args: { kind: kindV, id: v.string() },
  handler: async (ctx, { kind, id }): Promise<{ url: string }> => ({ url: (await openSession(ctx, ctx.userId, kind, id)).url }),
});

// ── Did Stripe get paid? ────────────────────────────────────────────────────
export const forCheck = internalQuery({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const row = await ctx.db.query("cardPayments").withIndex("by_session", q => q.eq("sessionId", sessionId)).unique();
    const cfg = await ctx.db.query("stripeConfig").first();
    return { row, key: cfg?.apiKey ?? null };
  },
});

export const settle = internalMutation({
  args: { sessionId: v.string(), state: v.union(v.literal("paid"), v.literal("expired"), v.literal("open"), v.literal("mismatch")), amountTotal: v.optional(v.number()) },
  handler: async (ctx, { sessionId, state, amountTotal }) => {
    const row = await ctx.db.query("cardPayments").withIndex("by_session", q => q.eq("sessionId", sessionId)).unique();
    if (!row || row.status !== "open") return row?.status ?? "missing";
    const now = Date.now();
    if (state === "open") {
      const n = row.checks + 1;
      await ctx.db.patch(row._id, { checks: n });
      if (n < RECHECK_S.length) await ctx.scheduler.runAfter(RECHECK_S[n] * 1000, internal.cardPay.check, { sessionId });
      else await ctx.db.patch(row._id, { status: "expired" });
      return "open";
    }
    if (state === "expired") {
      await ctx.db.patch(row._id, { status: "expired" });
      return "expired";
    }
    if (state === "mismatch") {
      await ctx.db.patch(row._id, { status: "problem", paidAt: now, note: `Stripe charged ${money((amountTotal ?? 0) / 100)} but the order total was ${money(row.total)}. Nothing was started. Check it in Stripe.` });
      await ctx.scheduler.runAfter(0, internal.cardPay.notify, { id: row._id });
      return "problem";
    }
    const r = await SETTLE[row.kind as CardKind](ctx, row.refId, row.code, BY);
    if (!r.ok) {
      await ctx.db.patch(row._id, { status: "problem", paidAt: now, note: "The card was charged, but this order was already paid or cancelled. Refund it in Stripe." });
      await ctx.scheduler.runAfter(0, internal.cardPay.notify, { id: row._id });
      return "problem";
    }
    let note = r.next;
    if (r.lobCards > 0 && process.env.LOB_API_KEY_LIVE) {
      const month = chicagoMonth(now);
      let used = 0;
      for (const c of await ctx.db.query("mailCampaigns").order("desc").take(500)) {
        if (c.lobMode === "live" && c.lobApprovedAt && chicagoMonth(c.lobApprovedAt) === month) used += c.lobSent ?? 0;
      }
      if (used + r.lobCards > LOB_FREE_MONTHLY) note += `. Heads up: that makes ${used + r.lobCards} cards this month, over Lob's ${LOB_FREE_MONTHLY}-card free plan, so Lob may stop part of it until the plan is upgraded (then tap Retry on the order)`;
    }
    await ctx.db.patch(row._id, { status: "paid", paidAt: now, note });
    await ctx.scheduler.runAfter(0, internal.cardPay.notify, { id: row._id });
    return "paid";
  },
});

export const check = internalAction({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }): Promise<string> => {
    const { row, key } = await ctx.runQuery(internal.cardPay.forCheck, { sessionId });
    if (!row) return "missing";
    if (row.status !== "open") return row.status;
    if (!key) return "open"; // key removed: leave it; a re-connect and a later check settles it
    let s: Session;
    try {
      s = await stripe(key, "GET", `/checkout/sessions/${sessionId}`);
    } catch (e) {
      console.error("cardPay.check", row.code, e instanceof Error ? e.message : String(e));
      return await ctx.runMutation(internal.cardPay.settle, { sessionId, state: "open" });
    }
    if (s.payment_status === "paid") {
      const state = s.amount_total === cents(row.total) ? "paid" : "mismatch";
      return await ctx.runMutation(internal.cardPay.settle, { sessionId, state, amountTotal: s.amount_total });
    }
    if (s.status === "expired" || Date.now() > row.expiresAt + 2 * 60000) return await ctx.runMutation(internal.cardPay.settle, { sessionId, state: "expired" });
    return "open";
  },
});

export const mineBySession = internalQuery({
  args: { userId: v.id("users"), sessionId: v.string() },
  handler: async (ctx, { userId, sessionId }) => {
    const me = await hubViewer(ctx, userId);
    const row = await ctx.db.query("cardPayments").withIndex("by_session", q => q.eq("sessionId", sessionId)).unique();
    if (!row || !(row.userId === userId || row.agentEmail === me.email || me.isStaff)) return null;
    return { status: row.status, code: row.code, label: row.label, amount: row.amount, fee: row.fee, total: row.total, backPath: row.backPath, kind: row.kind, note: row.note ?? "" };
  },
});

// /pay/return: Stripe sent the agent back. Ask Stripe right now instead of waiting for the next re-check.
export const returned = authenticatedAction({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }): Promise<{ status: string; code: string; label: string; amount: number; fee: number; total: number; backPath: string; kind: string; note: string } | null> => {
    const before = await ctx.runQuery(internal.cardPay.mineBySession, { userId: ctx.userId, sessionId });
    if (!before) return null;
    if (before.status === "open") await ctx.runAction(internal.cardPay.check, { sessionId });
    return await ctx.runQuery(internal.cardPay.mineBySession, { userId: ctx.userId, sessionId });
  },
});

// ── Email Michael when a card payment lands (or needs a refund) ─────────────
export const forNotify = internalQuery({ args: { id: v.id("cardPayments") }, handler: async (ctx, { id }) => ctx.db.get(id) });

export const notify = internalAction({
  args: { id: v.id("cardPayments") },
  handler: async (ctx, { id }) => {
    const r = await ctx.runQuery(internal.cardPay.forNotify, { id });
    if (!r) return;
    const bad = r.status === "problem";
    const rows: [string, string][] = [
      ["Agent", r.agentName], ["Order", r.code], ["For", r.label], ["Order amount", money(r.amount)],
      ["Card fee", r.fee > 0 ? `${money(r.fee)} (paid by the agent)` : "Stripe's fee comes out of your payout"],
      ["Charged to the card", money(r.total)], [bad ? "Needs you" : "What happened", r.note ?? ""],
    ];
    const html = shell(
      bad ? "A card payment needs a look" : "Paid by card",
      `<p style="color:#333;font-size:15px">${bad ? "Stripe took the payment, but the Hub didn't start anything for it." : `${esc(r.agentName)} paid by card. Stripe confirmed it, so the Hub handled it the same way as your Received button. Nothing for you to do.`}</p>${table(rows)}`,
      { href: `${hubUrl()}${r.backPath}`, label: "Open in the Hub" },
    );
    try {
      await sendMail(PAYMENT_ALERT_EMAIL, `${bad ? "⚠️ Card payment needs a look" : "💳 Paid by card"} · ${r.agentName} · ${money(r.total)} · ${r.code}`, html);
    } catch (e) {
      console.error("cardPay.notify", String(e));
    }
  },
});

// ── Ops / e2e (no key ever returned) ────────────────────────────────────────
export const statusInternal = internalQuery({
  args: {},
  handler: async ctx => {
    const cfg = await ctx.db.query("stripeConfig").first();
    const rows = await ctx.db.query("cardPayments").withIndex("by_created").order("desc").take(25);
    return {
      config: cfg ? { mode: cfg.mode, feeMode: cfg.feeMode, keyHint: hint(cfg.apiKey), savedBy: cfg.savedBy, savedAt: cfg.savedAt } : null,
      payments: rows.map(r => ({ code: r.code, kind: r.kind, agentName: r.agentName, total: r.total, fee: r.fee, status: r.status, note: r.note ?? "", createdAt: r.createdAt, paidAt: r.paidAt ?? null })),
    };
  },
});
