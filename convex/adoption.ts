// Adoption scoreboard (Michael 2026-10-27): who opened the Hub and what they used, per
// Chicago week (Mon–Sun), plus a Monday email to Michael. Plain code, no AI.
// Signals: page pings (hubActivity), sign-ins (authSessions), token refreshes while the
// app is open (authRefreshTokens, kept for the 30-day session) and rows people created.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { QueryCtx } from "./_generated/server";
import { internalAction, internalQuery } from "./_generated/server";
import { AGENTS, OPS_EMAILS, REMOVED_EMAILS } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer, SHARED_EMAILS } from "./hubMe";
import { esc, hubUrl, sendMail, shell } from "./notify";

const TZ = "America/Chicago";
const DAY = 864e5;
export const REPORT_TO = "michael@spacematchinc.com";

// Page path → area label (kept in sync with src/lib/adoptionAreas.ts).
export const AREAS = [
  "Home", "CMA", "Forms", "Inbox", "Listings", "Vendors", "100% rentals", "Why SpaceMatch", "Mailers", "Seller lists",
  "Decks & guides", "Templates", "Playbooks", "Academy", "Growth", "B-roll", "My videos", "Reel Studio",
  "Ad orders", "Help", "Feedback", "Announcements", "Guide", "Muse coach", "Settings",
] as const;

// Things people did (rows they created) — label, table, email field, time field.
const ACTIONS = [
  { key: "cma", label: "CMAs requested", table: "cmaRequests", field: "submittedByEmail" },
  { key: "clientForms", label: "Client forms in", table: "formSubmissions", field: "agentEmail" },
  { key: "listings", label: "Listings added", table: "listings", field: "agentEmail" },
  { key: "numbers", label: "Weekly numbers", table: "listingMetrics", field: "enteredByEmail" },
  { key: "why", label: "Why links", table: "whyLinks", field: "agentEmail" },
  { key: "mailers", label: "Mailer campaigns", table: "mailCampaigns", field: "agentEmail" },
  { key: "help", label: "Help requests", table: "helpRequests", field: "fromEmail" },
  { key: "feedback", label: "Feedback", table: "feedback", field: "fromEmail" },
  { key: "adOrders", label: "Ad orders", table: "adOrders", field: "agentEmail" },
  { key: "videos", label: "Video briefs", table: "agentVideoBriefs", field: "agentEmail" },
  { key: "vendors", label: "Vendors added", table: "vendors", field: "addedByEmail" },
] as const;

// ── Chicago calendar helpers ──
function ctParts(t: number) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", weekday: "short", timeZoneName: "shortOffset" });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  const off = Number((p.timeZoneName ?? "GMT-6").replace("GMT", "") || "0");
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), wd, off };
}
export const ctDay = (t: number) => {
  const { y, m, d } = ctParts(t);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
// Midnight Chicago at the start of the given Chicago date (handles DST via a 2nd pass).
function ctMidnight(y: number, m: number, d: number) {
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0) - ctParts(Date.UTC(y, m - 1, d, 12)).off * 36e5;
  return guess;
}
// Monday 00:00 Chicago of the week containing t.
export function weekStartOf(t: number) {
  const { y, m, d, wd } = ctParts(t);
  const back = (wd + 6) % 7;
  const dt = new Date(Date.UTC(y, m - 1, d - back));
  return ctMidnight(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
const nextWeek = (ws: number) => weekStartOf(ws + 8 * DAY);
const fmtDay = (t: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" }).format(new Date(t));
const weekLabel = (ws: number, we: number) => `${fmtDay(ws)} – ${fmtDay(we - 1)}`;

// Hub went live Oct 17 2026 — no trend weeks before that week.
const HUB_LAUNCH = Date.UTC(2026, 9, 12, 5);
const isCompany = (e: string) => e.endsWith("@spacematchinc.com");

type Person = {
  email: string;
  name: string;
  role: "agent" | "ops" | "shared" | "other";
  everSignedIn: boolean;
  lastSeen: number | null;
  days: string[]; // Chicago days active this week
  areas: Record<string, number>;
  actions: Record<string, number>;
  actionTotal: number;
  status: "active" | "opened" | "away" | "never";
};

const OPS_NAMES: Record<string, string> = { "smm@spacematchinc.com": "Cris Castillo", "tc@spacematchinc.com": "Anthony Arpia" };

type Base = {
  emailOf: Map<string, string>;
  sessions: { _id: string; userId: string; _creationTime: number }[];
  tokens: { sessionId: string; _creationTime: number }[];
  accounts: { userId: string; provider: string; emailVerified?: string | null }[];
  activity: { email: string; day: string; area: string; count: number; firstAt: number; lastAt: number }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions: Record<string, any[]>;
};

// Read everything once (small tables), then slice by week in memory.
async function loadBase(ctx: QueryCtx, from: number): Promise<Base> {
  const users = await ctx.db.query("users").take(2000);
  const emailOf = new Map<string, string>();
  for (const u of users) {
    const e = (u.email ?? "").toLowerCase();
    if (e && !e.startsWith("space-session")) emailOf.set(u._id, e);
  }
  const actions: Base["actions"] = {};
  for (const a of ACTIONS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions[a.key] = await (ctx.db.query(a.table as any) as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withIndex("by_creation_time", (q: any) => q.gte("_creationTime", from))
      .take(5000);
  }
  return {
    emailOf,
    sessions: await ctx.db.query("authSessions").take(10000),
    tokens: await ctx.db.query("authRefreshTokens").take(20000),
    accounts: await ctx.db.query("authAccounts").take(2000),
    activity: await ctx.db.query("hubActivity").take(20000),
    actions,
  };
}

function buildWeek(base: Base, ws: number) {
  const we = nextWeek(ws);
  const now = Date.now();
  const { emailOf } = base;

  const people = new Map<string, Person>();
  const person = (email: string): Person | null => {
    const e = email.toLowerCase();
    if (!isCompany(e) || REMOVED_EMAILS.includes(e)) return null;
    let p = people.get(e);
    if (!p) {
      const agent = AGENTS.find(a => a.email.toLowerCase() === e);
      const shared = SHARED_EMAILS.includes(e);
      p = {
        email: e,
        name: agent?.name ?? OPS_NAMES[e] ?? (shared ? "Shared team login (team@)" : e.split("@")[0]),
        role: agent ? "agent" : OPS_EMAILS.includes(e) ? "ops" : shared ? "shared" : "other",
        everSignedIn: false, lastSeen: null, days: [], areas: {}, actions: {}, actionTotal: 0, status: "never",
      };
      people.set(e, p);
    }
    return p;
  };
  for (const a of AGENTS) person(a.email);
  for (const e of OPS_EMAILS) person(e);

  const seen = (p: Person | null, t: number) => {
    if (!p) return;
    p.everSignedIn = true;
    p.lastSeen = Math.max(p.lastSeen ?? 0, t);
    if (t >= ws && t < we) {
      const d = ctDay(t);
      if (!p.days.includes(d)) p.days.push(d);
    }
  };

  // Sign-ins + app-open token refreshes (sessions live 30 days).
  const { sessions, tokens, accounts } = base;
  const sessUser = new Map<string, string>();
  for (const s of sessions) {
    sessUser.set(s._id, s.userId);
    const e = emailOf.get(s.userId);
    if (e) seen(person(e), s._creationTime);
  }
  for (const t of tokens) {
    const uid = sessUser.get(t.sessionId);
    const e = uid ? emailOf.get(uid) : undefined;
    if (e) seen(person(e), t._creationTime);
  }
  // Ever signed in (older accounts whose sessions expired).
  for (const a of accounts) {
    const e = emailOf.get(a.userId);
    const p = e ? person(e) : null;
    if (p && (a.emailVerified || a.provider !== "password")) p.everSignedIn = true;
  }

  // Page pings.
  const all = base.activity;
  for (const r of all) {
    const p = person(r.email);
    if (!p) continue;
    p.everSignedIn = true;
    p.lastSeen = Math.max(p.lastSeen ?? 0, r.lastAt);
    if (r.lastAt >= ws && r.firstAt < we) {
      if (!p.days.includes(r.day)) p.days.push(r.day);
      p.areas[r.area] = (p.areas[r.area] ?? 0) + r.count;
    }
  }

  // Things done this week.
  for (const a of ACTIONS) {
    for (const r of base.actions[a.key]) {
      let e: string = r[a.field] ?? "";
      if (!e && a.table === "cmaRequests" && r.userId) e = emailOf.get(r.userId) ?? "";
      if (!e || e === "auto") continue;
      const p = person(e);
      if (!p) continue;
      if (r._creationTime < ws || r._creationTime >= we) {
        if (a.key !== "clientForms") seen(p, r._creationTime); // still proves they've used the Hub
        continue;
      }
      p.actions[a.key] = (p.actions[a.key] ?? 0) + 1;
      p.actionTotal += 1;
      // Client forms are the client's action — don't count them as the agent being in the Hub.
      if (a.key !== "clientForms") seen(p, r._creationTime);
    }
  }

  for (const p of people.values()) {
    p.days.sort();
    const inHub = p.days.length > 0;
    const did = p.actionTotal - (p.actions.clientForms ?? 0) > 0;
    p.status = did ? "active" : inHub ? "opened" : p.everSignedIn ? "away" : "never";
  }

  const rank = { active: 0, opened: 1, away: 2, never: 3 } as const;
  const rows = [...people.values()]
    .filter(p => p.role !== "other" || p.days.length || p.actionTotal)
    .sort((a, b) => rank[a.status] - rank[b.status] || b.days.length - a.days.length || b.actionTotal - a.actionTotal || a.name.localeCompare(b.name));

  const team = rows.filter(p => p.role === "agent");
  const byArea: Record<string, number> = {};
  const areaPeople: Record<string, number> = {};
  const byAction: Record<string, number> = {};
  for (const p of rows) {
    for (const [k, n] of Object.entries(p.areas)) { byArea[k] = (byArea[k] ?? 0) + n; areaPeople[k] = (areaPeople[k] ?? 0) + 1; }
    for (const [k, n] of Object.entries(p.actions)) byAction[k] = (byAction[k] ?? 0) + n;
  }
  return {
    weekStart: ws,
    weekEnd: we,
    label: weekLabel(ws, we),
    inProgress: now < we,
    trackingSince: all.length ? Math.min(...all.map(r => r.firstAt)) : null,
    rows,
    totals: {
      agents: team.length,
      inHub: team.filter(p => p.days.length).length,
      didSomething: team.filter(p => p.status === "active").length,
      neverSignedIn: team.filter(p => p.status === "never").length,
      byArea,
      areaPeople,
      byAction,
    },
  };
}

function trend(base: Base, ws: number, weeks: number) {
  const out: { weekStart: number; label: string; inHub: number; didSomething: number }[] = [];
  let w = ws;
  const starts: number[] = [];
  for (let i = 0; i < weeks; i++) { starts.unshift(w); w = weekStartOf(w - 3 * DAY); }
  for (const s of starts.filter(x => x >= HUB_LAUNCH || x === ws)) {
    const b = buildWeek(base, s);
    out.push({ weekStart: s, label: fmtDay(s), inHub: b.totals.inHub, didSomething: b.totals.didSomething });
  }
  return out;
}

export const ACTION_META = ACTIONS.map(a => ({ key: a.key, label: a.label }));

// ── App-facing ──
const AREA_SET = new Set<string>(AREAS);

export const ping = authenticatedMutation({
  args: { area: v.string() },
  handler: async (ctx, { area }) => {
    if (!AREA_SET.has(area)) return;
    const me = await hubViewer(ctx, ctx.userId);
    if (!me.email || !isCompany(me.email)) return;
    const now = Date.now();
    const day = ctDay(now);
    const row = await ctx.db
      .query("hubActivity")
      .withIndex("by_email_day_area", q => q.eq("email", me.email).eq("day", day).eq("area", area))
      .unique();
    if (row) await ctx.db.patch(row._id, { count: row.count + 1, lastAt: now });
    else await ctx.db.insert("hubActivity", { email: me.email, day, area, count: 1, firstAt: now, lastAt: now });
  },
});

export const scoreboard = authenticatedQuery({
  args: { weekStart: v.optional(v.number()) },
  handler: async (ctx, { weekStart }) => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!me.isAdmin) return null;
    const current = weekStartOf(Date.now());
    const ws = weekStart ? weekStartOf(weekStart + 3 * DAY) : current;
    const base = await loadBase(ctx, weekStartOf(ws - 6 * 7 * DAY));
    const week = buildWeek(base, ws);
    return {
      ...week,
      current,
      prevWeek: weekStartOf(ws - 3 * DAY),
      nextWeekStart: ws < current ? nextWeek(ws) : null,
      trend: trend(base, ws, 6),
      areas: AREAS,
      actionMeta: ACTION_META,
    };
  },
});

// ── Viktor / cron ──
export const weekInternal = internalQuery({
  args: { weekStart: v.optional(v.number()), lastFull: v.optional(v.boolean()) },
  handler: async (ctx, { weekStart, lastFull }): Promise<WeekReport> => {
    await syncRoster(ctx);
    const current = weekStartOf(Date.now());
    const ws = weekStart ? weekStartOf(weekStart + 3 * DAY) : lastFull ? weekStartOf(current - 3 * DAY) : current;
    const base = await loadBase(ctx, weekStartOf(ws - 4 * 7 * DAY));
    return { ...buildWeek(base, ws), trend: trend(base, ws, 4) };
  },
});

const STATUS_TXT = { active: "Used it", opened: "Looked only", away: "Not this week", never: "Never signed in" } as const;

type WeekReport = ReturnType<typeof buildWeek> & { trend: ReturnType<typeof trend> };
type MailResult = { sentTo: string; label: string; totals: { inHub: number; didSomething: number; agents: number } };

export const mondayEmail = internalAction({
  args: { to: v.optional(v.string()) },
  handler: async (ctx, { to }): Promise<MailResult> => {
    await syncRoster(ctx);
    const w: WeekReport = await ctx.runQuery(internal.adoption.weekInternal, { lastFull: true });
    const t = w.totals;
    const label = (k: string) => ACTION_META.find(a => a.key === k)?.label ?? k;
    const agents = w.rows.filter(r => r.role === "agent" || r.role === "ops");
    const line = (r: (typeof agents)[number]) => {
      const areas = Object.entries(r.areas).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 5).join(", ");
      const did = Object.entries(r.actions).map(([k, n]) => `${n} ${label(k).toLowerCase()}`).join(", ");
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:14px;color:#0A0A0A"><b>${esc(r.name)}</b><br><span style="color:#6b665d;font-size:12px">${STATUS_TXT[r.status]}</span></td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:14px;text-align:center">${r.days.length || "–"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#3d3a35">${esc(areas || "–")}${did ? `<br><span style="color:#9C7434">${esc(did)}</span>` : ""}</td>
      </tr>`;
    };
    const used = agents.filter(r => r.status === "active" || r.status === "opened");
    const away = agents.filter(r => r.status === "away").map(r => r.name);
    const never = agents.filter(r => r.status === "never").map(r => r.name);
    const topAreas = Object.entries(t.areaPeople).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k} (${n})`).join(", ");
    const trendTxt = w.trend.map(x => `${x.label}: ${x.inHub}`).join(" · ");
    const shared = w.rows.find(r => r.role === "shared");
    const body = `
      <p style="font-size:15px;color:#0A0A0A;margin:0 0 6px"><b>${t.inHub} of ${t.agents}</b> agents opened the Hub · <b>${t.didSomething}</b> did something in it · <b>${t.neverSignedIn}</b> have never signed in.</p>
      <p style="font-size:13px;color:#6b665d;margin:0 0 14px">Most used: ${esc(topAreas || "nothing tracked yet")}<br>Agents in the Hub by week: ${esc(trendTxt)}</p>
      ${used.length ? `<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px">
        <tr><th style="text-align:left;padding:8px 10px;font-size:12px;color:#6b665d">Person</th><th style="padding:8px 10px;font-size:12px;color:#6b665d">Days</th><th style="text-align:left;padding:8px 10px;font-size:12px;color:#6b665d">Used / did</th></tr>
        ${used.map(line).join("")}</table>` : `<p style="font-size:14px">Nobody used the Hub this week.</p>`}
      ${away.length ? `<p style="font-size:13px;color:#3d3a35;margin:14px 0 0"><b>Not in the Hub this week (${away.length}):</b> ${esc(away.join(", "))}</p>` : ""}
      ${never.length ? `<p style="font-size:13px;color:#3d3a35;margin:8px 0 0"><b>Never signed in (${never.length}):</b> ${esc(never.join(", "))}</p>` : ""}
      ${shared && shared.days.length ? `<p style="font-size:12px;color:#6b665d;margin:8px 0 0">The shared team@ login was used on ${shared.days.length} day(s) — that activity isn't credited to anyone.</p>` : ""}`;
    await sendMail(
      to ?? REPORT_TO,
      `Hub adoption, ${w.label}: ${t.inHub}/${t.agents} agents in, ${t.didSomething} used it`,
      shell(`Hub adoption · ${w.label}`, body, { href: `${hubUrl()}/adoption`, label: "Open the scoreboard" }),
    );
    return { sentTo: to ?? REPORT_TO, label: w.label, totals: { inHub: t.inHub, didSomething: t.didSomething, agents: t.agents } };
  },
});
