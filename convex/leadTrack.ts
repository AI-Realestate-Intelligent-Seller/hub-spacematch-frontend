// New Leads tracker: data + staff actions (Michael 2026-11-08). Access: canNewLeads = Michael, Cristina, Anthony only (2026-11-09).
// Sync + texts live in leadTrackActions.ts. Next-step rules: leadTrackDefs.ts.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { AUTO_CMA_DAILY_CAP, CALL_RESULTS, kindOf, nextStep, wantsValue } from "./leadTrackDefs";
import { AGENTS } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";

export const WINDOW_DAYS = 14;
const META_KEY = "leadTrack:sync";

async function staff(ctx: QueryCtx, userId: Id<"users">) {
  const me = await hubViewer(ctx, userId);
  if (!me.canNewLeads) throw new Error("New Leads is for Michael, Cristina and Anthony only");
  return me;
}

const commV = v.object({ at: v.number(), kind: v.string(), status: v.optional(v.string()), text: v.optional(v.string()), by: v.optional(v.string()) });
type Comm = Doc<"trackedLeads">["comms"][number];

const asTrack = (r: Doc<"trackedLeads">) => ({
  createdAt: r.createdAt,
  name: r.name,
  phone: r.phone,
  stage: r.stage,
  cannotText: r.cannotText,
  handled: r.handled,
  comms: r.comms as never,
});

async function cmaInfo(ctx: QueryCtx, id: Id<"cmaRequests">) {
  const c = await ctx.db.get(id);
  if (!c) return null;
  return {
    id: c._id,
    status: c.status,
    statusNote: c.statusNote ?? null,
    address: [c.street, c.city].filter(Boolean).join(", "),
    valueLow: c.valueLow ?? null,
    valueHigh: c.valueHigh ?? null,
    listPrice: c.agentListPrice ?? c.listPrice ?? null,
    pdfUrl: c.pdfStorageId ? await ctx.storage.getUrl(c.pdfStorageId) : null,
    xlsxUrl: c.workbookStorageId ? await ctx.storage.getUrl(c.workbookStorageId) : null,
  };
}

export const board = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await staff(ctx, ctx.userId);
    const since = Date.now() - WINDOW_DAYS * 864e5;
    const rows = await ctx.db.query("trackedLeads").withIndex("by_created", q => q.gt("createdAt", since)).order("desc").take(400);
    const meta = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", META_KEY)).first();
    const desk = await ctx.db.query("deskLeads").withIndex("by_created").order("desc").take(300);
    const deskBy = new Map(desk.filter(d => d.loftyLeadId).map(d => [d.loftyLeadId!, d._id]));
    return {
      me: { name: me.name, isAdmin: me.isAdmin },
      sync: meta ? (JSON.parse(meta.value) as { at: number; ok: boolean; error?: string; leads?: number }) : null,
      rows: await Promise.all(rows.map(async r => ({ ...r, deskId: deskBy.get(r.loftyLeadId) ?? null, cma: r.cmaRequestId ? await cmaInfo(ctx, r.cmaRequestId) : null }))),
    };
  },
});

/** Home tile: how many new leads need a person right now. */
export const homeCount = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!me.canNewLeads) return null;
    const now = Date.now();
    const rows = await ctx.db.query("trackedLeads").withIndex("by_created", q => q.gt("createdAt", now - 7 * 864e5)).collect();
    const steps = rows.map(r => nextStep(asTrack(r), now));
    return {
      today: rows.filter(r => r.createdAt > now - 864e5).length,
      urgent: steps.filter(s => s.tone === "red").length,
      todo: steps.filter(s => s.tone === "amber").length,
    };
  },
});

function addHistory(r: Doc<"trackedLeads">, by: string, text: string) {
  return [...r.history, { at: Date.now(), by, text }].slice(-40);
}

export const logCall = authenticatedMutation({
  args: { id: v.id("trackedLeads"), result: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { id, result, note }) => {
    const me = await staff(ctx, ctx.userId);
    if (!(CALL_RESULTS as readonly string[]).includes(result)) throw new Error("Pick a call result");
    const r = await ctx.db.get(id);
    if (!r) throw new Error("Lead not found");
    const clean = (note ?? "").trim().slice(0, 1000);
    const text = `${result}${clean ? `: ${clean}` : ""}`;
    await ctx.db.patch(id, {
      comms: [...r.comms, { at: Date.now(), kind: "hub_call", status: result, text: clean || undefined, by: me.name }],
      history: addHistory(r, me.name, `Logged a call: ${text}`),
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.leadTrackActions.loftyNote, { loftyLeadId: r.loftyLeadId, content: `Call logged in the Hub by ${me.name}: ${text}` });
  },
});

export const setHandled = authenticatedMutation({
  args: { id: v.id("trackedLeads"), handled: v.union(v.literal("done"), v.literal("not_lead"), v.literal("")) },
  handler: async (ctx, { id, handled }) => {
    const me = await staff(ctx, ctx.userId);
    const r = await ctx.db.get(id);
    if (!r) throw new Error("Lead not found");
    await ctx.db.patch(id, {
      handled: handled || undefined,
      handledBy: handled ? me.name : undefined,
      history: addHistory(r, me.name, handled === "done" ? "Marked handled" : handled === "not_lead" ? "Marked not a real lead" : "Reopened"),
      updatedAt: Date.now(),
    });
  },
});

/** Put the lead on the Lead Desk ("To vet") to book an agent; returns the desk id. */
export const toDesk = authenticatedMutation({
  args: { id: v.id("trackedLeads") },
  handler: async (ctx, { id }): Promise<Id<"deskLeads">> => {
    const me = await staff(ctx, ctx.userId);
    const r = await ctx.db.get(id);
    if (!r) throw new Error("Lead not found");
    const existing = (await ctx.db.query("deskLeads").withIndex("by_created").order("desc").take(300)).find(d => d.loftyLeadId === r.loftyLeadId);
    if (existing) return existing._id;
    const t = r.leadTypes;
    const leadType = t.includes(1) || t.includes(8) ? (t.includes(2) ? "both" : "seller") : t.includes(5) ? "renter" : "buyer";
    const deskId = await ctx.db.insert("deskLeads", {
      stage: "to_vet",
      source: r.source.slice(0, 80),
      sourceRef: `lofty:${r.loftyLeadId}`,
      leadType,
      name: r.name,
      phone: r.phone,
      email: r.email,
      details: r.street ? { address: r.street } : {},
      loftyLeadId: r.loftyLeadId,
      history: [{ at: Date.now(), by: me.name, text: "Sent from New Leads" }],
      createdAt: Date.now(),
      createdBy: me.email,
    });
    await ctx.db.patch(id, { history: addHistory(r, me.name, "Sent to the Lead Desk to book an agent"), updatedAt: Date.now() });
    return deskId;
  },
});

/** Seller leads only: a buyer asking "how much is 123 Main" must not trigger a CMA. */
function isSellerSide(l: { leadTypes: number[]; source: string }) {
  const k = kindOf(l.source);
  return l.leadTypes.includes(1) || k === "yt_seller" || k === "seller_list";
}

/** Staff button: start a CMA for this lead now (same path as the auto one). */
export const orderCma = authenticatedMutation({
  args: { id: v.id("trackedLeads") },
  handler: async (ctx, { id }) => {
    const me = await staff(ctx, ctx.userId);
    const r = await ctx.db.get(id);
    if (!r) throw new Error("Lead not found");
    if (r.cmaRequestId) throw new Error("A CMA is already started for this lead");
    await ctx.db.patch(id, { cmaAuto: undefined, history: addHistory(r, me.name, "Ordered a CMA"), updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.leadTrackActions.autoCma, { id, reply: "", by: me.name });
  },
});

// ── internal (sync + actions) ─────────────────────────────────────────
function chicagoDayStart(now = Date.now()) {
  const d = new Date(now - 6 * 3600e3);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + 6 * 3600e3;
}

/** Create the CMA request (worker cron builds it) and link it to the lead. */
export const createAutoCma = internalMutation({
  args: {
    id: v.id("trackedLeads"),
    reply: v.string(),
    by: v.string(),
    street: v.string(),
    city: v.string(),
    state: v.string(),
    zip: v.string(),
  },
  handler: async (ctx, a): Promise<{ ok: true; cmaId: Id<"cmaRequests"> } | { ok: false; reason: string }> => {
    await syncRoster(ctx);
    const r = await ctx.db.get(a.id);
    if (!r) return { ok: false, reason: "gone" };
    if (r.cmaRequestId) return { ok: false, reason: "exists" };
    if (!a.street.trim()) {
      await ctx.db.patch(a.id, { cmaAuto: "no_address", history: addHistory(r, "Hub", "Asked for a value, but Lofty has no address: get it on the call, then tap Order CMA"), updatedAt: Date.now() });
      return { ok: false, reason: "no_address" };
    }
    const today = await ctx.db.query("cmaRequests").withIndex("by_creation_time", q => q.gte("_creationTime", chicagoDayStart())).collect();
    if (today.filter(x => x.submittedByEmail === "new-leads").length >= AUTO_CMA_DAILY_CAP) {
      await ctx.db.patch(a.id, { cmaAuto: "daily_cap", history: addHistory(r, "Hub", `Daily auto-CMA limit (${AUTO_CMA_DAILY_CAP}) reached: tap Order CMA tomorrow or file one on /new`), updatedAt: Date.now() });
      return { ok: false, reason: "daily_cap" };
    }
    let owner = null;
    for (const e of ["team@spacematchinc.com", "michael@spacematchinc.com"]) {
      owner = await ctx.db.query("users").withIndex("email", q => q.eq("email", e)).first();
      if (owner) break;
    }
    owner ??= await ctx.db.query("users").first();
    const michael = AGENTS.find(x => x.name === "Michael Kang")!;
    if (!owner) return { ok: false, reason: "no_owner" };
    const missing = [!a.city.trim() && "city", !a.zip.trim() && "ZIP"].filter(Boolean).join(" and ");
    const cmaId = await ctx.db.insert("cmaRequests", {
      reportType: "sale",
      kind: "residential",
      agentName: michael.name,
      agentEmail: michael.email,
      agentPhone: michael.phone,
      clientName: r.name,
      clientEmail: r.email,
      clientPhone: r.phone,
      street: a.street.trim(),
      city: a.city.trim(),
      state: a.state.trim() || "IL",
      zip: a.zip.trim(),
      propertyType: "Single-family",
      condition: "Average / well maintained",
      upgrades: [],
      purpose: "Pricing check for a seller",
      branding: "SpaceMatch · a team of Real Broker",
      schools: "Include assigned schools",
      notes: [
        `AUTO from New Leads (${a.by === "auto" ? "lead asked for a value / more info" : `ordered by ${a.by}`}). Lofty lead ${r.loftyLeadId}, source ${r.source}.`,
        a.reply && `Their text: "${a.reply.slice(0, 300)}"`,
        missing && `The Lofty lead has no ${missing}: look it up (county / MLS). If the street matches more than one town, set needs_info.`,
        "Property type and condition are defaults (not from the seller): use MLS/county facts. For the team only: never send it to the lead.",
      ].filter(Boolean).join("\n"),
      userId: owner._id,
      submittedByEmail: "new-leads",
      status: "submitted",
      statusNote: "Started automatically from New Leads.",
    });
    await ctx.db.patch(a.id, { cmaRequestId: cmaId, cmaAuto: undefined, history: addHistory(r, a.by === "auto" ? "Hub" : a.by, `CMA started for ${a.street}${a.city ? `, ${a.city}` : ""}`), updatedAt: Date.now() });
    return { ok: true, cmaId };
  },
});

/** Worker marked a CMA ready → tell the team if it came from New Leads. */
export const byCmaInternal = internalQuery({
  args: { cmaId: v.id("cmaRequests") },
  handler: async (ctx, { cmaId }) => ctx.db.query("trackedLeads").withIndex("by_cma", q => q.eq("cmaRequestId", cmaId)).first(),
});

export const forSync = internalQuery({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const rows = await ctx.db.query("trackedLeads").withIndex("by_created", q => q.gt("createdAt", Date.now() - 30 * 864e5)).collect();
    return rows.map(r => ({ loftyLeadId: r.loftyLeadId, textCount: r.textCount, comms: r.comms }));
  },
});

export const getInternal = internalQuery({ args: { id: v.id("trackedLeads") }, handler: async (ctx, { id }) => ctx.db.get(id) });

export const upsert = internalMutation({
  args: {
    leads: v.array(
      v.object({
        loftyLeadId: v.string(),
        name: v.string(),
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
        source: v.string(),
        kind: v.string(),
        leadTypes: v.array(v.number()),
        stage: v.string(),
        agentName: v.optional(v.string()),
        street: v.optional(v.string()),
        tags: v.array(v.string()),
        cannotText: v.boolean(),
        createdAt: v.number(),
        comms: v.optional(v.array(commV)), // Lofty-side comms (replaces the old Lofty-side list)
        textCount: v.optional(v.number()),
      }),
    ),
    meta: v.object({ ok: v.boolean(), error: v.optional(v.string()), leads: v.number() }),
  },
  handler: async (ctx, { leads, meta }) => {
    await syncRoster(ctx);
    const now = Date.now();
    const alerts: { id: Id<"trackedLeads">; name: string; text: string; source: string }[] = [];
    const valueAsks: { id: Id<"trackedLeads">; text: string }[] = [];
    for (const l of leads) {
      const old = await ctx.db.query("trackedLeads").withIndex("by_lofty", q => q.eq("loftyLeadId", l.loftyLeadId)).first();
      const { comms: lc, textCount, ...base } = l;
      const hubSide: Comm[] = (old?.comms ?? []).filter(c => c.kind.startsWith("hub_"));
      const loftySide: Comm[] = lc ?? (old?.comms ?? []).filter(c => !c.kind.startsWith("hub_"));
      const comms = [...loftySide, ...hubSide].sort((a, b) => a.at - b.at).slice(-60);
      const lastReply = Math.max(0, ...comms.filter(c => c.kind === "text_in" || c.kind === "call_in").map(c => c.at));
      if (!old) {
        const id = await ctx.db.insert("trackedLeads", { ...base, comms, textCount: textCount ?? 0, history: [], alertedReplyAt: lastReply || undefined, updatedAt: now });
        // Brand-new lead that already asked for a value in the last 30 min → auto CMA too.
        const ask = comms.filter(c => c.kind === "text_in" && c.at > now - 30 * 60000 && wantsValue(c.text)).pop();
        if (ask && isSellerSide(base)) valueAsks.push({ id, text: ask.text ?? "" });
        continue;
      }
      let alertedReplyAt = old.alertedReplyAt;
      if (lastReply > (old.alertedReplyAt ?? 0)) {
        const fresh = comms.filter(c => c.kind === "text_in" && c.at > (old.alertedReplyAt ?? 0));
        const reply = comms.filter(c => c.kind === "text_in").pop();
        const ask = fresh.filter(c => wantsValue(c.text)).pop();
        const step = nextStep({ ...base, comms: comms as never, handled: old.handled }, now);
        if (ask && !old.cmaRequestId && !old.cmaAuto && old.handled !== "not_lead" && isSellerSide(base)) valueAsks.push({ id: old._id, text: ask.text ?? "" });
        else if (step.id === "replied") alerts.push({ id: old._id, name: l.name, text: reply?.text ?? "(call)", source: l.source });
        alertedReplyAt = lastReply;
      }
      await ctx.db.patch(old._id, { ...base, comms, textCount: textCount ?? old.textCount, alertedReplyAt, updatedAt: now });
    }
    const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", META_KEY)).first();
    const value = JSON.stringify({ at: now, ...meta });
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("hubSettings", { key: META_KEY, value });
    for (const a of alerts) await ctx.scheduler.runAfter(0, internal.leadTrackActions.replyAlert, a);
    for (const a of valueAsks) await ctx.scheduler.runAfter(0, internal.leadTrackActions.autoCma, { id: a.id, reply: a.text, by: "auto" });
    return { alerts: alerts.length, valueAsks: valueAsks.length };
  },
});

export const addHubComm = internalMutation({
  args: { id: v.id("trackedLeads"), comm: commV, note: v.string() },
  handler: async (ctx, { id, comm, note }) => {
    await syncRoster(ctx);
    const r = await ctx.db.get(id);
    if (!r) return;
    await ctx.db.patch(id, { comms: [...r.comms, comm], history: addHistory(r, comm.by ?? "Hub", note), updatedAt: Date.now() });
  },
});

export const viewerInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await syncRoster(ctx);
    const me = await hubViewer(ctx, userId);
    return { allowed: me.canNewLeads, name: me.name, email: me.email };
  },
});

export const lastSyncInternal = internalQuery({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const meta = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", META_KEY)).first();
    return meta ? (JSON.parse(meta.value).at as number) : 0;
  },
});

/** Test cleanup (run_app_function / bunx convex run). */
export const removeInternal = internalMutation({
  args: { loftyLeadIds: v.array(v.string()) },
  handler: async (ctx, { loftyLeadIds }) => {
    await syncRoster(ctx);
    for (const id of loftyLeadIds) {
      const r = await ctx.db.query("trackedLeads").withIndex("by_lofty", q => q.eq("loftyLeadId", id)).first();
      if (r?.cmaRequestId) await ctx.db.delete(r.cmaRequestId);
      if (r) await ctx.db.delete(r._id);
    }
  },
});

/** e2e helper: CMA request id linked to a tracked lead. */
export const byCmaLofty = internalQuery({
  args: { loftyLeadId: v.string() },
  handler: async (ctx, { loftyLeadId }) =>
    (await ctx.db.query("trackedLeads").withIndex("by_lofty", q => q.eq("loftyLeadId", loftyLeadId)).first())?.cmaRequestId ?? null,
});
