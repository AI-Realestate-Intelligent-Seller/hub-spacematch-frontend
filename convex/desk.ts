// Lead Desk data: queue, booking, agent replies, outcomes, agent hours (Michael 2026-10-27).
// Access: admins (Michael, team@, Brandon, Sergio) + ops (Cris smm@, Anthony tc@).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { AGENTS, agentByEmail } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { DEFAULT_HOURS, LEAD_TYPES, MEETING_KINDS, OUTCOMES, ctParts, fmtWhen, kindLabel, normPhone, outcomeLabel } from "./deskDefs";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer, type HubViewer } from "./hubMe";

const clean = (s: string | undefined, max = 2000) => (s ?? "").trim().slice(0, max);
const OPEN = ["booked", "accepted"];

async function deskUser(ctx: QueryCtx, userId: Id<"users">): Promise<HubViewer> {
  const me = await hubViewer(ctx, userId);
  if (!me.isAdmin && !me.isOps) throw new Error("The Lead Desk is for admins and ops only");
  return me;
}

const newToken = () => {
  const a = "abcdefghijkmnpqrstuvwxyz23456789";
  let t = "";
  for (let i = 0; i < 24; i++) t += a[Math.floor(Math.random() * a.length)];
  return t;
};

const leadArgs = {
  source: v.string(),
  leadType: v.string(),
  name: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  language: v.optional(v.string()),
  details: v.record(v.string(), v.string()),
  rating: v.optional(v.string()),
  notes: v.optional(v.string()),
  rawText: v.optional(v.string()),
};

function cleanLead(a: { source: string; leadType: string; name: string; phone?: string; email?: string; language?: string; details: Record<string, string>; rating?: string; notes?: string; rawText?: string }) {
  const name = clean(a.name, 120);
  if (!name) throw new Error("Add the lead's name");
  if (!LEAD_TYPES.some(t => t.id === a.leadType)) throw new Error("Pick a lead type");
  const email = clean(a.email, 200).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That email doesn't look right");
  const details: Record<string, string> = {};
  for (const [k, val] of Object.entries(a.details)) if (clean(val)) details[k.slice(0, 40)] = clean(val, 600);
  return {
    source: clean(a.source, 80) || "Other",
    leadType: a.leadType,
    name,
    phone: clean(a.phone, 40) || undefined,
    email: email || undefined,
    language: clean(a.language, 40) || undefined,
    details,
    rating: a.rating || undefined,
    notes: clean(a.notes, 3000) || undefined,
    rawText: a.rawText ? clean(a.rawText, 3000) : undefined,
  };
}

function log(l: Doc<"deskLeads">, by: string, text: string) {
  return [...l.history, { at: Date.now(), by, text }].slice(-60);
}

// ── Staff board ───────────────────────────────────────────────────────
export const board = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await deskUser(ctx, ctx.userId);
    const rows = await ctx.db.query("deskLeads").withIndex("by_created").order("desc").take(600);
    const prefs = await ctx.db.query("deskAgents").collect();
    const agents = AGENTS.map(a => {
      const p = prefs.find(x => x.email === a.email.toLowerCase());
      const mine = rows.filter(r => r.agentEmail === a.email.toLowerCase() && r.bookedAt);
      return {
        name: a.name,
        email: a.email.toLowerCase(),
        phone: a.phone,
        hours: (p?.hours as typeof DEFAULT_HOURS | undefined) ?? DEFAULT_HOURS,
        hoursSet: !!p?.hours,
        languages: p?.languages ?? [],
        areas: p?.areas ?? "",
        specialties: p?.specialties ?? [],
        active: p?.active ?? true,
        lastBookedAt: Math.max(0, ...mine.map(r => r.bookedAt ?? 0)),
        booked30: mine.filter(r => (r.bookedAt ?? 0) > Date.now() - 30 * 864e5).length,
      };
    });
    return { me: { email: me.email, name: me.name, isAdmin: me.isAdmin }, rows, agents };
  },
});

export const create = authenticatedMutation({
  args: { ...leadArgs },
  handler: async (ctx, a) => {
    const me = await deskUser(ctx, ctx.userId);
    const lead = cleanLead(a);
    const id = await ctx.db.insert("deskLeads", {
      ...lead,
      stage: "to_vet",
      history: [{ at: Date.now(), by: me.name, text: `Added (${lead.source})` }],
      createdAt: Date.now(),
      createdBy: me.email,
    });
    return id;
  },
});

export const update = authenticatedMutation({
  args: { id: v.id("deskLeads"), ...leadArgs },
  handler: async (ctx, { id, ...a }) => {
    const me = await deskUser(ctx, ctx.userId);
    const l = await ctx.db.get(id);
    if (!l) throw new Error("Lead not found");
    const lead = cleanLead({ ...a, rawText: a.rawText ?? l.rawText });
    await ctx.db.patch(id, { ...lead, history: log(l, me.name, "Edited details") });
    return null;
  },
});

export const book = authenticatedMutation({
  args: {
    id: v.id("deskLeads"),
    agentEmail: v.string(),
    apptStart: v.number(),
    apptMinutes: v.number(),
    apptKind: v.string(),
    apptLocation: v.optional(v.string()),
    textClient: v.boolean(),
  },
  handler: async (ctx, a) => {
    const me = await deskUser(ctx, ctx.userId);
    const l = await ctx.db.get(a.id);
    if (!l) throw new Error("Lead not found");
    const agent = agentByEmail(a.agentEmail);
    if (!agent) throw new Error("Pick an agent");
    if (!l.phone && !l.email) throw new Error("Add a phone or email before booking");
    if ((l.details.listedNow ?? "").startsWith("Yes")) throw new Error("This home is listed with another agent. We can't solicit it.");
    if (!MEETING_KINDS.some(k => k.id === a.apptKind)) throw new Error("Pick a meeting type");
    if (a.apptStart < Date.now() - 5 * 60000) throw new Error("That time is in the past");
    if (a.apptMinutes < 15 || a.apptMinutes > 240) throw new Error("Length must be 15 min to 4 h");
    const clash = (await ctx.db.query("deskLeads").withIndex("by_agent", q => q.eq("agentEmail", agent.email.toLowerCase())).collect()).find(
      r => r._id !== l._id && OPEN.includes(r.stage) && r.apptStart && r.apptStart < a.apptStart + a.apptMinutes * 60000 && r.apptStart + (r.apptMinutes ?? 60) * 60000 > a.apptStart,
    );
    if (clash) throw new Error(`${agent.name.split(" ")[0]} already has a Lead Desk appointment then (${clash.name})`);
    const prevEventId = l.calendarEventId;
    const seq = (l.bookSeq ?? 0) + 1;
    const rebook = !!l.bookedAt;
    await ctx.db.patch(a.id, {
      stage: "booked",
      agentEmail: agent.email.toLowerCase(),
      agentName: agent.name,
      apptStart: a.apptStart,
      apptMinutes: a.apptMinutes,
      apptKind: a.apptKind,
      apptLocation: clean(a.apptLocation, 300) || undefined,
      textClient: a.textClient && !!l.phone,
      token: l.token ?? newToken(),
      bookedByEmail: me.email,
      bookedByName: me.name,
      bookedAt: Date.now(),
      bookSeq: seq,
      respondedAt: undefined,
      declineReason: undefined,
      escalatedAt: undefined,
      outcome: undefined,
      outcomeAt: undefined,
      outcomeAskedAt: undefined,
      calendarEventId: undefined,
      calendarLink: undefined,
      calendarError: undefined,
      texts: {},
      history: log(l, me.name, `${rebook ? "Rebooked" : "Booked"} with ${agent.name}: ${kindLabel(a.apptKind)}, ${fmtWhen(a.apptStart)}`),
    });
    await ctx.scheduler.runAfter(0, internal.deskActions.onBooked, { id: a.id, seq, prevEventId, rebook });
    return null;
  },
});

export const cancelBooking = authenticatedMutation({
  args: { id: v.id("deskLeads"), reason: v.optional(v.string()) },
  handler: async (ctx, { id, reason }) => {
    const me = await deskUser(ctx, ctx.userId);
    const l = await ctx.db.get(id);
    if (!l?.bookedAt) throw new Error("Nothing booked");
    await ctx.db.patch(id, {
      stage: "to_vet",
      bookSeq: (l.bookSeq ?? 0) + 1,
      calendarEventId: undefined,
      calendarLink: undefined,
      history: log(l, me.name, `Cancelled the booking with ${l.agentName}${reason ? `: ${clean(reason, 200)}` : ""}`),
    });
    await ctx.scheduler.runAfter(0, internal.deskActions.onCancelled, { id, eventId: l.calendarEventId, agentEmail: l.agentEmail ?? "", reason: clean(reason, 200) });
    return null;
  },
});

export const close = authenticatedMutation({
  args: { id: v.id("deskLeads"), reason: v.string() },
  handler: async (ctx, { id, reason }) => {
    const me = await deskUser(ctx, ctx.userId);
    const l = await ctx.db.get(id);
    if (!l) throw new Error("Lead not found");
    if (OPEN.includes(l.stage)) throw new Error("Cancel the booking first");
    await ctx.db.patch(id, { stage: "closed", closeReason: clean(reason, 200), history: log(l, me.name, `Closed: ${clean(reason, 200)}`) });
    return null;
  },
});

export const reopen = authenticatedMutation({
  args: { id: v.id("deskLeads") },
  handler: async (ctx, { id }) => {
    const me = await deskUser(ctx, ctx.userId);
    const l = await ctx.db.get(id);
    if (!l) throw new Error("Lead not found");
    await ctx.db.patch(id, { stage: "to_vet", closeReason: undefined, history: log(l, me.name, "Reopened") });
    return null;
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id("deskLeads") },
  handler: async (ctx, { id }) => {
    const me = await deskUser(ctx, ctx.userId);
    const l = await ctx.db.get(id);
    if (!l) return null;
    if (!me.isAdmin) throw new Error("Only admins can delete. Close it instead.");
    if (OPEN.includes(l.stage)) throw new Error("Cancel the booking first");
    await ctx.db.delete(id);
    return null;
  },
});

// Staff can set an outcome for the agent too.
export const staffOutcome = authenticatedMutation({
  args: { id: v.id("deskLeads"), outcome: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { id, outcome, note }) => {
    const me = await deskUser(ctx, ctx.userId);
    await applyOutcome(ctx, id, outcome, note, `${me.name} (ops)`);
    return null;
  },
});

// ── Agent side ────────────────────────────────────────────────────────
async function applyResponse(ctx: MutationCtx, l: Doc<"deskLeads">, action: "accept" | "decline", reason: string | undefined, by: string) {
  if (!OPEN.includes(l.stage) && l.stage !== "needs_agent") throw new Error("This appointment isn't open anymore");
  if (action === "accept") {
    if (l.stage === "accepted") return;
    if (l.stage === "needs_agent") throw new Error("You already said you can't make it. Ops is reassigning it.");
    await ctx.db.patch(l._id, { stage: "accepted", respondedAt: Date.now(), history: log(l, by, "Accepted") });
    await ctx.scheduler.runAfter(0, internal.deskActions.onAccepted, { id: l._id, seq: l.bookSeq ?? 0 });
  } else {
    if (l.stage === "needs_agent") return;
    const r = clean(reason, 300) || "No reason given";
    await ctx.db.patch(l._id, {
      stage: "needs_agent",
      respondedAt: Date.now(),
      declineReason: r,
      bookSeq: (l.bookSeq ?? 0) + 1,
      calendarEventId: undefined,
      calendarLink: undefined,
      history: log(l, by, `Can't make it: ${r}`),
    });
    await ctx.scheduler.runAfter(0, internal.deskActions.onDeclined, { id: l._id, eventId: l.calendarEventId });
  }
}

async function applyOutcome(ctx: MutationCtx, id: Id<"deskLeads">, outcome: string, note: string | undefined, by: string) {
  const l = await ctx.db.get(id);
  if (!l?.bookedAt) throw new Error("Not found");
  if (!OUTCOMES.some(o => o.id === outcome)) throw new Error("Pick an outcome");
  const n = clean(note, 1000) || undefined;
  const resched = outcome === "rescheduled";
  await ctx.db.patch(id, {
    stage: resched ? "needs_agent" : "done",
    outcome,
    outcomeNote: n,
    outcomeAt: Date.now(),
    ...(resched ? { declineReason: `Rescheduled${n ? `: ${n}` : ""}`, bookSeq: (l.bookSeq ?? 0) + 1 } : {}),
    history: log(l, by, `Outcome: ${outcomeLabel(outcome)}${n ? ` · ${n}` : ""}`),
  });
  await ctx.scheduler.runAfter(0, internal.deskActions.onOutcome, { id, by });
}

export const myAppointments = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    const rows = me.email
      ? await ctx.db.query("deskLeads").withIndex("by_agent", q => q.eq("agentEmail", me.email)).collect()
      : [];
    const p = await ctx.db.query("deskAgents").withIndex("by_email", q => q.eq("email", me.email)).unique();
    return {
      isAgent: !!agentByEmail(me.email),
      isDesk: me.isAdmin || me.isOps,
      rows: rows.filter(r => r.bookedAt && (r.stage !== "done" || (r.outcomeAt ?? 0) > Date.now() - 30 * 864e5)).sort((a, b) => (a.apptStart ?? 0) - (b.apptStart ?? 0)),
      profile: {
        hours: (p?.hours as typeof DEFAULT_HOURS | undefined) ?? DEFAULT_HOURS,
        hoursSet: !!p?.hours,
        languages: p?.languages ?? [],
        areas: p?.areas ?? "",
        specialties: p?.specialties ?? [],
      },
    };
  },
});

export const respond = authenticatedMutation({
  args: { id: v.id("deskLeads"), action: v.union(v.literal("accept"), v.literal("decline")), reason: v.optional(v.string()) },
  handler: async (ctx, { id, action, reason }) => {
    const me = await hubViewer(ctx, ctx.userId);
    const l = await ctx.db.get(id);
    if (!l || (l.agentEmail !== me.email && !me.isAdmin && !me.isOps)) throw new Error("Not found");
    await applyResponse(ctx, l, action, reason, me.name);
    return null;
  },
});

export const myOutcome = authenticatedMutation({
  args: { id: v.id("deskLeads"), outcome: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { id, outcome, note }) => {
    const me = await hubViewer(ctx, ctx.userId);
    const l = await ctx.db.get(id);
    if (!l || l.agentEmail !== me.email) throw new Error("Not found");
    await applyOutcome(ctx, id, outcome, note, me.name);
    return null;
  },
});

const hoursV = v.record(v.string(), v.union(v.array(v.number()), v.null()));

async function saveProfile(ctx: MutationCtx, email: string, by: string, p: { hours?: Record<string, number[] | null>; languages?: string[]; areas?: string; specialties?: string[]; active?: boolean }) {
  if (p.hours) {
    for (const [d, h] of Object.entries(p.hours)) {
      if (h && (h.length !== 2 || h[0] < 0 || h[1] > 1440 || h[0] >= h[1])) throw new Error(`Check the hours for ${d}`);
    }
  }
  const row = await ctx.db.query("deskAgents").withIndex("by_email", q => q.eq("email", email)).unique();
  const next = {
    hours: p.hours ?? row?.hours,
    languages: (p.languages ?? row?.languages ?? []).slice(0, 10),
    areas: clean(p.areas ?? row?.areas, 500),
    specialties: (p.specialties ?? row?.specialties ?? []).slice(0, 10),
    active: p.active ?? row?.active ?? true,
    updatedAt: Date.now(),
    updatedBy: by,
  };
  if (row) await ctx.db.patch(row._id, next);
  else await ctx.db.insert("deskAgents", { email, ...next });
}

export const saveMyProfile = authenticatedMutation({
  args: { hours: v.optional(hoursV), languages: v.optional(v.array(v.string())), areas: v.optional(v.string()), specialties: v.optional(v.array(v.string())) },
  handler: async (ctx, a) => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!agentByEmail(me.email)) throw new Error("Sign in with your own @spacematchinc.com login to set your hours");
    await saveProfile(ctx, me.email, me.email, a);
    return null;
  },
});

export const saveAgentProfile = authenticatedMutation({
  args: { email: v.string(), hours: v.optional(hoursV), languages: v.optional(v.array(v.string())), areas: v.optional(v.string()), specialties: v.optional(v.array(v.string())), active: v.optional(v.boolean()) },
  handler: async (ctx, { email, ...a }) => {
    const me = await deskUser(ctx, ctx.userId);
    if (!agentByEmail(email)) throw new Error("Unknown agent");
    await saveProfile(ctx, email.toLowerCase(), me.email, a);
    return null;
  },
});

// ── One-tap agent page (/a/:token, no login: the link only goes to the agent) ──
export const byToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await syncRoster(ctx);
    if (token.length !== 24) return null;
    const l = await ctx.db.query("deskLeads").withIndex("by_token", q => q.eq("token", token)).unique();
    if (!l?.bookedAt) return null;
    return {
      name: l.name,
      phone: l.phone,
      email: l.email,
      leadType: l.leadType,
      source: l.source,
      language: l.language,
      rating: l.rating,
      details: l.details,
      notes: l.notes,
      stage: l.stage,
      agentName: l.agentName,
      apptStart: l.apptStart,
      apptMinutes: l.apptMinutes,
      apptKind: l.apptKind,
      apptLocation: l.apptLocation,
      outcome: l.outcome,
      bookedByName: l.bookedByName,
      calendarLink: l.calendarLink,
    };
  },
});

export const respondByToken = mutation({
  args: { token: v.string(), action: v.union(v.literal("accept"), v.literal("decline")), reason: v.optional(v.string()) },
  handler: async (ctx, { token, action, reason }) => {
    await syncRoster(ctx);
    const l = token.length === 24 ? await ctx.db.query("deskLeads").withIndex("by_token", q => q.eq("token", token)).unique() : null;
    if (!l) throw new Error("This link is no longer valid");
    await applyResponse(ctx, l, action, reason, l.agentName ?? "Agent");
    return null;
  },
});

export const outcomeByToken = mutation({
  args: { token: v.string(), outcome: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { token, outcome, note }) => {
    await syncRoster(ctx);
    const l = token.length === 24 ? await ctx.db.query("deskLeads").withIndex("by_token", q => q.eq("token", token)).unique() : null;
    if (!l) throw new Error("This link is no longer valid");
    if (!["accepted", "booked"].includes(l.stage)) throw new Error("Already logged. Thanks!");
    await applyOutcome(ctx, l._id, outcome, note, l.agentName ?? "Agent");
    return null;
  },
});

// ── Internal (actions, cron, intake) ──────────────────────────────────
export const getLead = internalQuery({ args: { id: v.id("deskLeads") }, handler: async (ctx, { id }) => ctx.db.get(id) });

export const viewerInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await syncRoster(ctx);
    const me = await hubViewer(ctx, userId);
    const prefs = await ctx.db.query("deskAgents").collect();
    return { allowed: me.isAdmin || me.isOps, inactive: prefs.filter(p => !p.active).map(p => p.email) };
  },
});

export const patchInternal = internalMutation({
  args: {
    id: v.id("deskLeads"),
    seq: v.optional(v.number()),
    set: v.object({
      calendarEventId: v.optional(v.string()),
      calendarLink: v.optional(v.string()),
      calendarError: v.optional(v.string()),
      loftyLeadId: v.optional(v.string()),
      loftyError: v.optional(v.string()),
      textError: v.optional(v.string()),
      escalatedAt: v.optional(v.number()),
      outcomeAskedAt: v.optional(v.number()),
    }),
    textSent: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { id, seq, set, textSent, note }) => {
    await syncRoster(ctx);
    const l = await ctx.db.get(id);
    if (!l) return false;
    if (seq !== undefined && (l.bookSeq ?? 0) !== seq) return false; // stale job
    const patch: Partial<Doc<"deskLeads">> = { ...set };
    if (textSent) patch.texts = { ...(l.texts ?? {}), [textSent]: Date.now() };
    if (note) patch.history = log(l, "Hub", note);
    await ctx.db.patch(id, patch);
    return true;
  },
});

/** Every 10 min: escalations (30 min unanswered), client reminders, outcome asks. */
export const tick = internalMutation({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const now = Date.now();
    const hh = ctParts(now).hh;
    const daytime = hh >= 8 && hh < 21;
    const open = [
      ...(await ctx.db.query("deskLeads").withIndex("by_stage", q => q.eq("stage", "booked")).collect()),
      ...(await ctx.db.query("deskLeads").withIndex("by_stage", q => q.eq("stage", "accepted")).collect()),
    ];
    for (const l of open) {
      const seq = l.bookSeq ?? 0;
      const start = l.apptStart ?? 0;
      const end = start + (l.apptMinutes ?? 60) * 60000;
      // 1) Agent hasn't answered in 30 min (counted from 8am if booked overnight).
      if (l.stage === "booked" && !l.escalatedAt && daytime && now - Math.max(l.bookedAt ?? now, morningOf(l.bookedAt ?? now)) >= 30 * 60000) {
        await ctx.db.patch(l._id, { escalatedAt: now });
        await ctx.scheduler.runAfter(0, internal.deskActions.escalate, { id: l._id, seq });
      }
      // 2) Client reminders (only once the agent accepted).
      if (l.stage === "accepted" && l.textClient && l.phone) {
        const sent = l.texts ?? {};
        if (!sent.r24 && start - now <= 24 * 36e5 && start - now > 20 * 36e5 && (l.bookedAt ?? 0) < start - 26 * 36e5) {
          await ctx.db.patch(l._id, { texts: { ...sent, r24: now } });
          await ctx.scheduler.runAfter(0, internal.deskActions.clientText, { id: l._id, seq, which: "r24" });
        } else if (!sent.r2 && start - now <= 2 * 36e5 && start - now > 60 * 60000 && (l.bookedAt ?? 0) < start - 3 * 36e5) {
          await ctx.db.patch(l._id, { texts: { ...sent, r2: now } });
          await ctx.scheduler.runAfter(0, internal.deskActions.clientText, { id: l._id, seq, which: "r2" });
        }
      }
      // 3) Ask the agent how it went: 1 h after the end, then next morning at 9.
      if (!l.outcome && now > end + 36e5) {
        if (!l.outcomeAskedAt && daytime) {
          await ctx.db.patch(l._id, { outcomeAskedAt: now });
          await ctx.scheduler.runAfter(0, internal.deskActions.askOutcome, { id: l._id, reminder: false });
        } else if (l.outcomeAskedAt && now - l.outcomeAskedAt > 12 * 36e5 && hh === 9 && !(l.texts ?? {}).outcomeNudge) {
          await ctx.db.patch(l._id, { texts: { ...(l.texts ?? {}), outcomeNudge: now } });
          await ctx.scheduler.runAfter(0, internal.deskActions.askOutcome, { id: l._id, reminder: true });
        }
      }
    }
  },
});

function morningOf(t: number) {
  const p = ctParts(t);
  if (p.hh >= 8 && p.hh < 21) return t;
  // Booked at night → the clock starts at 8am the next (or same) morning.
  const addDay = p.hh >= 21 ? 1 : 0;
  const guess = Date.UTC(p.y, p.m - 1, p.d + addDay, 8, 0) - p.off * 36e5;
  return guess;
}

/** Auto-intake from lead emails (Peak Presence YouTube leads + bookings). Dedupe by sourceRef. */
export const ingest = internalMutation({
  args: {
    items: v.array(v.object({ sourceRef: v.string(), source: v.string(), leadType: v.string(), name: v.string(), phone: v.optional(v.string()), email: v.optional(v.string()), address: v.optional(v.string()), notes: v.optional(v.string()), rawText: v.string(), at: v.number() })),
  },
  handler: async (ctx, { items }) => {
    await syncRoster(ctx);
    let added = 0;
    const recent = await ctx.db.query("deskLeads").withIndex("by_created").order("desc").take(500);
    for (const it of items.sort((a, b) => a.at - b.at)) {
      const dup = await ctx.db.query("deskLeads").withIndex("by_sourceRef", q => q.eq("sourceRef", it.sourceRef)).first();
      if (dup || recent.some(r => r.mergedRefs?.includes(it.sourceRef))) continue;
      // Same phone already on the desk (e.g. a Peak Presence lead + their booking email) → merge.
      const ph = normPhone(it.phone);
      const same = ph ? recent.find(r => normPhone(r.phone) === ph) : undefined;
      if (same) {
        await ctx.db.patch(same._id, {
          name: same.name.includes(" ") || !it.name.includes(" ") ? same.name : it.name,
          email: same.email ?? it.email,
          details: it.address && !same.details.address ? { ...same.details, address: it.address } : same.details,
          notes: it.notes ? [same.notes, it.notes].filter(Boolean).join("\n") : same.notes,
          history: log(same, "Hub", `Another ${it.source} email came in${it.notes ? `: ${it.notes}` : ""}`),
        });
        await ctx.db.patch(same._id, { mergedRefs: [...(same.mergedRefs ?? []), it.sourceRef].slice(-20) });
        same.mergedRefs = [...(same.mergedRefs ?? []), it.sourceRef];
        continue;
      }
      const newId = await ctx.db.insert("deskLeads", {
        stage: "to_vet",
        source: it.source,
        sourceRef: it.sourceRef,
        rawText: it.rawText.slice(0, 3000),
        leadType: it.leadType,
        name: it.name.slice(0, 120) || "Unknown",
        phone: it.phone,
        email: it.email,
        details: it.address ? { address: it.address } : {},
        notes: it.notes,
        history: [{ at: Date.now(), by: "Hub", text: `Came in by email (${it.source})` }],
        createdAt: it.at,
        createdBy: "auto",
      });
      const row = await ctx.db.get(newId);
      if (row) recent.unshift(row);
      added++;
    }
    return { added };
  },
});

/** Ops/test cleanup (run_app_function). */
export const removeInternal = internalMutation({
  args: { ids: v.array(v.id("deskLeads")) },
  handler: async (ctx, { ids }) => {
    await syncRoster(ctx);
    for (const id of ids) await ctx.db.delete(id);
    return ids.length;
  },
});

export const recentInternal = internalQuery({
  args: {},
  handler: async ctx => (await ctx.db.query("deskLeads").withIndex("by_created").order("desc").take(30)).map(l => ({ id: l._id, token: l.token, stage: l.stage, name: l.name, source: l.source, agent: l.agentName, appt: l.apptStart ? fmtWhen(l.apptStart) : null, cal: l.calendarEventId ?? l.calendarError, lofty: l.loftyLeadId ?? l.loftyError, texts: l.texts, textError: l.textError })),
});


export const recentInternalFull = internalQuery({
  args: {},
  handler: async ctx => ctx.db.query("deskLeads").withIndex("by_created").order("desc").take(50),
});

/** Home tile numbers: staff see the desk queue; agents see their pending appointments. */
export const homeCounts = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    const isDesk = me.isAdmin || me.isOps;
    const now = Date.now();
    const mine = me.email ? await ctx.db.query("deskLeads").withIndex("by_agent", q => q.eq("agentEmail", me.email)).collect() : [];
    const pending = mine.filter(r => r.stage === "booked").length;
    const upcoming = mine.filter(r => (r.stage === "booked" || r.stage === "accepted") && (r.apptStart ?? 0) > now).sort((a, b) => (a.apptStart ?? 0) - (b.apptStart ?? 0));
    const outcomeDue = mine.filter(r => (r.stage === "booked" || r.stage === "accepted") && (r.apptStart ?? 0) + (r.apptMinutes ?? 60) * 60000 < now).length;
    let desk: { toVet: number; rebook: number; waiting: number; followup: number } | null = null;
    if (isDesk) {
      const st = async (s: string) => ctx.db.query("deskLeads").withIndex("by_stage", q => q.eq("stage", s)).collect();
      const open = [...(await st("booked")), ...(await st("accepted"))];
      desk = {
        toVet: (await st("to_vet")).length,
        rebook: (await st("needs_agent")).length,
        waiting: open.filter(r => r.stage === "booked").length,
        followup: open.filter(r => (r.apptStart ?? 0) + (r.apptMinutes ?? 60) * 60000 < now).length,
      };
    }
    return { isDesk, pending, outcomeDue, next: upcoming[0] ? { name: upcoming[0].name, at: upcoming[0].apptStart ?? 0 } : null, desk };
  },
});

/** One-off: seed known languages/areas (Michael's routing rules: Spanish → Matthew, Korean → Sein, North Shore round-robin). */
export const seedProfilesInternal = internalMutation({
  args: { rows: v.array(v.object({ email: v.string(), languages: v.optional(v.array(v.string())), areas: v.optional(v.string()) })) },
  handler: async (ctx, { rows }) => {
    await syncRoster(ctx);
    for (const r of rows) {
      const existing = await ctx.db.query("deskAgents").withIndex("by_email", q => q.eq("email", r.email)).unique();
      if (existing) continue;
      await saveProfile(ctx, r.email, "viktor-seed", { languages: r.languages, areas: r.areas });
    }
    return rows.length;
  },
});
