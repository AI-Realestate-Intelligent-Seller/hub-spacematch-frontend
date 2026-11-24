// "Today" from Lofty, per agent (Michael 2026-10-18): new leads assigned, follow-ups due,
// appointments/showings, hot leads gone quiet. Lofty's team key only exposes tasks per lead,
// so we read tasks for the agent's active pipeline + newly assigned leads. Code only, no AI.
// Refreshed by cron 3x/day and on demand (max once per 10 min per agent).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { AGENTS } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { lofty, loftyMembers, matchMember } from "./lofty";

const HOT_STAGES = ["Connected Qualifying", "Appointment Set", "Active Client", "Under Contract"];
const QUIET_STAGES = new Set(["Connected Qualifying", "Appointment Set", "Active Client"]);
const NEW_LEAD_HOURS = 72;
const QUIET_DAYS = 14;
const OVERDUE_WINDOW_DAYS = 30;
const MAX_LEADS = 320;
const REFRESH_COOLDOWN_MS = 10 * 60_000;

export type TodayLead = { leadId: string; name: string; phone?: string; email?: string; source?: string; stage?: string; at?: number };
export type TodayTask = { id: string; leadId: string; name: string; phone?: string; what: string; type: string; at: number; overdue: boolean };
export type TodayData = {
  newLeads: TodayLead[];
  followUps: TodayTask[];
  appointments: TodayTask[];
  quiet: TodayLead[];
  quietCount: number;
  olderOverdue: number;
  activeLeads: number;
};

// Lofty v1 times look like "2026-10-02T17:19:56GMT"; v2 are ISO with offset.
const t = (s?: string | null): number | undefined => {
  if (!s) return undefined;
  const ms = Date.parse(s.replace(/GMT$/, "Z").replace(/C[DS]T$/, ""));
  return Number.isFinite(ms) ? ms : undefined;
};

function chicagoDayEnd(now: number): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }).formatToParts(new Date(now));
  const g = (k: string) => Number(parts.find(p => p.type === k)?.value ?? 0) % 24;
  const msSinceMidnight = ((g("hour") * 60 + g("minute")) * 60 + g("second")) * 1000;
  return now - msSinceMidnight + 86_400_000 - 1;
}

const leadName = (l: any) => `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() || (l.emails?.[0] ?? "Lead");
const toLead = (l: any): TodayLead => ({
  leadId: String(l.leadId),
  name: leadName(l),
  phone: l.phones?.[0] || undefined,
  email: l.emails?.[0] || undefined,
  source: l.source || undefined,
  stage: l.stage || undefined,
  at: t(l.assignTime) ?? t(l.createTime),
});

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export async function buildToday(userId: number, now = Date.now()): Promise<TodayData> {
  const dayEnd = chicagoDayEnd(now);
  const recent = await lofty("get", `/v1.0/leads?assignedUserId=${userId}&limit=100`);
  const recentLeads: any[] = (recent?.leads ?? []).filter((l: any) => l.stage !== "Deleted");
  const newLeads = recentLeads
    .map(toLead)
    .filter(l => (l.at ?? 0) >= now - NEW_LEAD_HOURS * 3_600_000)
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0));

  const hot: any[] = [];
  for (const stage of HOT_STAGES) {
    const b = await lofty("get", `/v1.0/leads?assignedUserId=${userId}&stage=${encodeURIComponent(stage)}&limit=100`);
    hot.push(...(b?.leads ?? []));
  }

  const byId = new Map<string, any>();
  for (const l of [...recentLeads.filter(l => newLeads.some(n => n.leadId === String(l.leadId))), ...hot]) byId.set(String(l.leadId), l);
  const leads = [...byId.values()].slice(0, MAX_LEADS);

  const followUps: TodayTask[] = [];
  const appointments: TodayTask[] = [];
  let olderOverdue = 0;
  await pool(leads, 6, async l => {
    let tasks: any[] = [];
    try {
      tasks = (await lofty("get", `/v2.0/tasks?leadId=${l.leadId}`))?.tasks ?? [];
    } catch (e) {
      console.warn("tasks", l.leadId, String(e).slice(0, 120));
      return;
    }
    for (const x of tasks) {
      if (x.finishFlag) continue;
      if (x.assignedUserId && x.assignedUserId !== userId) continue;
      const at = t(x.startAt) ?? t(x.endAt); // Lofty puts the due time in endAt when there is no start
      if (!at || at > Date.UTC(2100, 0, 1)) continue;
      const isAppt = /appointment|showing/i.test(x.type ?? "") || /\bshowing|\btour\b/i.test(x.content ?? "");
      const task: TodayTask = {
        id: String(x.id),
        leadId: String(l.leadId),
        name: leadName(l),
        phone: l.phones?.[0] || undefined,
        what: (x.content ?? "").split("\n")[0].trim().slice(0, 120) || x.type || "Task",
        type: x.type ?? "Task",
        at,
        overdue: at < now,
      };
      if (isAppt) {
        if (at >= now - 3 * 3_600_000 && at <= dayEnd + 2 * 86_400_000) appointments.push(task);
      } else if (at <= dayEnd) {
        if (at >= now - OVERDUE_WINDOW_DAYS * 86_400_000) followUps.push(task);
        else olderOverdue++;
      }
    }
  });
  followUps.sort((a, b) => a.at - b.at);
  appointments.sort((a, b) => a.at - b.at);

  const quietAll = hot
    .filter(l => QUIET_STAGES.has(l.stage))
    .filter(l => (t(l.lastTouch) ?? 0) < now - QUIET_DAYS * 86_400_000)
    .map(l => ({ ...toLead(l), at: t(l.lastTouch) }))
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0));

  return {
    newLeads: newLeads.slice(0, 15),
    followUps: followUps.slice(0, 25),
    appointments: appointments.slice(0, 15),
    quiet: quietAll.slice(0, 5),
    quietCount: quietAll.length,
    olderOverdue,
    activeLeads: hot.length,
  };
}

export const save = internalMutation({
  args: { agentEmail: v.string(), agentName: v.string(), loftyUserId: v.optional(v.number()), data: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, a) => {
    await syncRoster(ctx);
    const row = await ctx.db.query("loftyToday").withIndex("by_email", q => q.eq("agentEmail", a.agentEmail)).unique();
    const patch = {
      agentName: a.agentName,
      loftyUserId: a.loftyUserId,
      refreshing: false,
      ...(a.data !== undefined ? { data: a.data, updatedAt: Date.now(), error: undefined } : { error: a.error }),
    };
    if (row) await ctx.db.patch(row._id, patch);
    else await ctx.db.insert("loftyToday", { agentEmail: a.agentEmail, updatedAt: a.data ? Date.now() : 0, ...patch });
  },
});

export const refreshAgent = internalAction({
  args: { agentEmail: v.string(), agentName: v.string(), loftyUserId: v.optional(v.number()) },
  handler: async (ctx, a) => {
    await syncRoster(ctx);
    try {
      const id = a.loftyUserId ?? matchMember(await loftyMembers(), a.agentEmail, a.agentName);
      if (!id) {
        await ctx.runMutation(internal.hubToday.save, { ...a, error: "Not found in Lofty — ask Atom to add you." });
        return;
      }
      const data = await buildToday(id);
      await ctx.runMutation(internal.hubToday.save, { ...a, loftyUserId: id, data: JSON.stringify(data) });
    } catch (e) {
      console.error("hubToday", a.agentName, String(e));
      await ctx.runMutation(internal.hubToday.save, { ...a, error: "Lofty didn't answer. Showing the last update." });
    }
  },
});

export const refreshAll = internalAction({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const members = await loftyMembers();
    for (const [i, a] of AGENTS.entries()) {
      const id = matchMember(members, a.email, a.name);
      await ctx.scheduler.runAfter(i * 8000, internal.hubToday.refreshAgent, { agentEmail: a.email, agentName: a.name, loftyUserId: id });
    }
  },
});

function targetAgent(v: Awaited<ReturnType<typeof hubViewer>>, agentName?: string) {
  if (agentName && v.isStaff) return AGENTS.find(a => a.name === agentName) ?? null;
  if (v.agentName) return AGENTS.find(a => a.name === v.agentName) ?? null;
  if (v.isAdmin) return AGENTS.find(a => a.name === "Michael Kang") ?? null;
  return null;
}

export const mine = authenticatedQuery({
  args: { agentName: v.optional(v.string()) },
  handler: async (ctx, { agentName }) => {
    const viewer = await hubViewer(ctx, ctx.userId);
    const agent = targetAgent(viewer, agentName);
    if (!agent) return { agentName: null, data: null, updatedAt: 0, refreshing: false, error: null };
    const row = await ctx.db.query("loftyToday").withIndex("by_email", q => q.eq("agentEmail", agent.email)).unique();
    return {
      agentName: agent.name,
      data: row?.data ? (JSON.parse(row.data) as TodayData) : null,
      updatedAt: row?.updatedAt ?? 0,
      refreshing: !!row?.refreshing && Date.now() - (row?.requestedAt ?? 0) < 5 * 60_000,
      error: row?.error ?? null,
    };
  },
});

export const requestRefresh = authenticatedMutation({
  args: { agentName: v.optional(v.string()) },
  handler: async (ctx, { agentName }) => {
    const viewer = await hubViewer(ctx, ctx.userId);
    const agent = targetAgent(viewer, agentName);
    if (!agent) throw new Error("Sign in with your own @spacematchinc.com email to see your Lofty day.");
    const row = await ctx.db.query("loftyToday").withIndex("by_email", q => q.eq("agentEmail", agent.email)).unique();
    const now = Date.now();
    if (row && (now - (row.requestedAt ?? 0) < REFRESH_COOLDOWN_MS || now - row.updatedAt < REFRESH_COOLDOWN_MS)) {
      return { started: false };
    }
    if (row) await ctx.db.patch(row._id, { refreshing: true, requestedAt: now });
    else await ctx.db.insert("loftyToday", { agentEmail: agent.email, agentName: agent.name, updatedAt: 0, refreshing: true, requestedAt: now });
    await ctx.scheduler.runAfter(0, internal.hubToday.refreshAgent, { agentEmail: agent.email, agentName: agent.name, loftyUserId: row?.loftyUserId });
    return { started: true };
  },
});

// Read-only checks from the sandbox.
export const peek = internalQuery({
  args: { agentEmail: v.string() },
  handler: async (ctx, { agentEmail }) => ctx.db.query("loftyToday").withIndex("by_email", q => q.eq("agentEmail", agentEmail)).unique(),
});
export const preview = internalAction({
  args: { agentEmail: v.string() },
  handler: async (ctx, { agentEmail }) => {
    await syncRoster(ctx);
    const a = AGENTS.find(x => x.email === agentEmail);
    if (!a) return null;
    const id = matchMember(await loftyMembers(), a.email, a.name);
    return id ? await buildToday(id) : null;
  },
});
