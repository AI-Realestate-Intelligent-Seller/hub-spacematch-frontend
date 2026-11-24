// Growth Score (Michael 2026-11-02, option B): checks each agent's real presence and scores it
// against the playbook (growthScoreDefs.ts). Plain code, no AI. Sources:
//  - Instagram: public profile data (last 12 posts, bio, pro account). The Facebook connection
//    has no Instagram permission, so Business Discovery is not available (tested 2026-11-02).
//  - YouTube: public channel page + RSS feed (no API quota).
//  - Google: Business Profiles where the agent added team@spacematchinc.com as Manager.
//  - Lofty: new leads contacted (30d) + overdue follow-ups / quiet clients from loftyToday.
//  - Profile links: agent-entered, fetched to catch dead links.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { AGENTS } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { callIntegration } from "./gateway";
import {
  igHandle,
  PROFILES,
  type ProfileKey,
  type Score,
  type Signals,
  score,
  ytHandle,
} from "./growthScoreDefs";
import { hubViewer } from "./hubMe";
import { lofty, loftyMembers, matchMember } from "./lofty";
import { esc, hubUrl, sendMail, shell } from "./notify";

const GBP_ACCOUNT = "105562916373328601072";
// Michael's own businesses on the same Google account: never matched to an agent.
const NOT_AGENTS = [
  "locations/17477362330895195273",
  "locations/13004868833880445383",
  "locations/15058544361773015475",
  "locations/12584003276266425149",
];
const DAY = 864e5;
const REPORT_TO = "michael@spacematchinc.com";

const agentOf = (email: string) =>
  AGENTS.find(a => a.email.toLowerCase() === email.toLowerCase()) ?? null;
const monthKey = (t: number) =>
  new Date(t)
    .toLocaleDateString("en-CA", { timeZone: "America/Chicago" })
    .slice(0, 7);

async function rowFor(ctx: QueryCtx | MutationCtx, email: string) {
  return await ctx.db
    .query("growthPresence")
    .withIndex("by_email", q => q.eq("email", email.toLowerCase()))
    .unique();
}

async function levelFor(ctx: QueryCtx, email: string): Promise<number> {
  const rows = await ctx.db.query("growthProgress").collect();
  return rows.find(r => r.email === email.toLowerCase())?.level ?? 1;
}

function card(r: Doc<"growthPresence"> | null, name: string, email: string) {
  return {
    name,
    email,
    niche: r?.niche ?? "",
    instagram: r?.instagram ?? "",
    youtube: r?.youtube ?? "",
    links: (r?.links ?? {}) as Partial<Record<ProfileKey, string>>,
    zillowReviews: r?.zillowReviews ?? null,
    zillowVerified: r?.zillowVerified ?? false,
    gbpTitle: r?.gbpTitle ?? null,
    gbpClickedAt: r?.gbpClickedAt ?? null,
    score: r?.score ? (JSON.parse(r.score) as ReturnType<typeof score>) : null,
    signals: r?.signals ? (JSON.parse(r.signals) as Signals) : null,
    history: r?.history ?? [],
    checkedAt: r?.checkedAt ?? null,
    checking: r?.checking ?? false,
  };
}

// Whose card: your own; staff may open anyone's.
export const myCard = authenticatedQuery({
  args: { agentEmail: v.optional(v.string()) },
  handler: async (ctx, { agentEmail }) => {
    const viewer = await hubViewer(ctx, ctx.userId);
    let email = viewer.email;
    if (agentEmail && agentEmail.toLowerCase() !== viewer.email) {
      if (!viewer.isStaff) return null;
      email = agentEmail.toLowerCase();
    }
    const agent = agentOf(email);
    if (!agent)
      return {
        none: true as const,
        isShared: viewer.isShared,
        isStaff: viewer.isStaff,
      };
    const r = await rowFor(ctx, email);
    return {
      none: false as const,
      isSelf: email === viewer.email,
      isStaff: viewer.isStaff,
      ...card(r, agent.name, agent.email.toLowerCase()),
    };
  },
});

// Staff ranking (agents never see each other's scores, per proposal).
export const team = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const viewer = await hubViewer(ctx, ctx.userId);
    if (!viewer.isStaff) return null;
    const rows = await ctx.db.query("growthPresence").collect();
    const byEmail = new Map(rows.map(r => [r.email, r]));
    const list = AGENTS.map(a => {
      const r = byEmail.get(a.email.toLowerCase()) ?? null;
      const s = r?.score
        ? (JSON.parse(r.score) as ReturnType<typeof score>)
        : null;
      return {
        name: a.name,
        email: a.email.toLowerCase(),
        total: s?.total ?? null,
        color: s?.color ?? null,
        parts:
          s?.parts.map(p => ({ key: p.key, got: p.got, max: p.max })) ?? [],
        topFix: s?.fixes[0]?.title ?? null,
        setUp: !!(r?.niche || r?.instagram || r?.links),
        gbp: !!r?.gbpLocation,
        zillowReviews: r?.zillowReviews ?? null,
        zillowVerified: r?.zillowVerified ?? false,
        checkedAt: r?.checkedAt ?? null,
        prev:
          r?.history && r.history.length > 1
            ? r.history[r.history.length - 2].total
            : null,
      };
    });
    const st = await ctx.db
      .query("growthTeamState")
      .withIndex("by_key", q => q.eq("key", "gbp"))
      .unique();
    const gbp = st
      ? (JSON.parse(st.data) as {
          unmatched: { id: string; title: string }[];
          invites: number;
        })
      : { unmatched: [], invites: 0 };
    return {
      list: list.sort(
        (a, b) =>
          (b.total ?? -1) - (a.total ?? -1) || a.name.localeCompare(b.name),
      ),
      gbp,
    };
  },
});

const clean = (s: string | undefined, max: number) =>
  (s ?? "").trim().slice(0, max);

export const saveProfile = authenticatedMutation({
  args: {
    agentEmail: v.optional(v.string()),
    niche: v.optional(v.string()),
    instagram: v.optional(v.string()),
    youtube: v.optional(v.string()),
    links: v.optional(v.record(v.string(), v.string())),
    zillowReviews: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, a) => {
    const viewer = await hubViewer(ctx, ctx.userId);
    if (viewer.isShared && !(a.agentEmail && viewer.isStaff))
      throw new Error("Sign in with your own email so the score is yours.");
    const email = (
      a.agentEmail && viewer.isStaff ? a.agentEmail : viewer.email
    ).toLowerCase();
    const agent = agentOf(email);
    if (!agent) throw new Error("Growth Scores are for SpaceMatch agents.");
    const links: Record<string, string> = {};
    for (const p of PROFILES) {
      const u = clean(a.links?.[p.key], 300);
      if (!u) continue;
      const url = /^https?:\/\//i.test(u) ? u : `https://${u}`;
      if (!p.domain.test(url))
        throw new Error(`${p.label}: that link isn't a ${p.label} address.`);
      links[p.key] = url;
    }
    const z = a.zillowReviews;
    if (z != null && (!Number.isFinite(z) || z < 0 || z > 5000))
      throw new Error("Zillow reviews: enter a number.");
    const r = await rowFor(ctx, email);
    const patch = {
      name: agent.name,
      niche: clean(a.niche, 200),
      instagram: igHandle(a.instagram),
      youtube: ytHandle(a.youtube),
      links,
      zillowReviews: z ?? undefined,
      ...(r && r.zillowReviews !== (z ?? undefined)
        ? { zillowVerified: false }
        : {}),
      updatedAt: Date.now(),
    };
    if (r) await ctx.db.patch(r._id, patch);
    else await ctx.db.insert("growthPresence", { email, ...patch });
    await queueCheck(ctx, email, true);
    return null;
  },
});

async function queueCheck(ctx: MutationCtx, email: string, force = false) {
  const r = await rowFor(ctx, email);
  if (!r) return false;
  const now = Date.now();
  if (!force && r.requestedAt && now - r.requestedAt < 10 * 60_000)
    return false;
  await ctx.db.patch(r._id, { checking: true, requestedAt: now });
  await ctx.scheduler.runAfter(0, internal.growthScore.checkAgent, { email });
  return true;
}

export const recheck = authenticatedMutation({
  args: { agentEmail: v.optional(v.string()) },
  handler: async (ctx, { agentEmail }) => {
    const viewer = await hubViewer(ctx, ctx.userId);
    const email = (
      agentEmail && viewer.isStaff ? agentEmail : viewer.email
    ).toLowerCase();
    const agent = agentOf(email);
    if (!agent) throw new Error("Growth Scores are for SpaceMatch agents.");
    if (!(await rowFor(ctx, email)))
      await ctx.db.insert("growthPresence", {
        email,
        name: agent.name,
        updatedAt: Date.now(),
      });
    const ok = await queueCheck(ctx, email);
    if (!ok)
      throw new Error("Checked a few minutes ago. Try again in 10 minutes.");
    return null;
  },
});

// Agent tapped "I added team@ as Manager": remember it so staff know to accept the invite.
export const gbpInvited = authenticatedMutation({
  args: {},
  handler: async ctx => {
    const viewer = await hubViewer(ctx, ctx.userId);
    const agent = agentOf(viewer.email);
    if (!agent) return null;
    const r = await rowFor(ctx, viewer.email);
    const now = Date.now();
    if (r) await ctx.db.patch(r._id, { gbpClickedAt: now });
    else
      await ctx.db.insert("growthPresence", {
        email: viewer.email,
        name: agent.name,
        gbpClickedAt: now,
        updatedAt: now,
      });
    return null;
  },
});

// Staff: match a Business Profile to an agent, or verify a Zillow count.
export const staffSet = authenticatedMutation({
  args: {
    agentEmail: v.string(),
    gbpLocation: v.optional(v.string()),
    zillowVerified: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    const viewer = await hubViewer(ctx, ctx.userId);
    if (!viewer.isStaff) throw new Error("Staff only.");
    const email = a.agentEmail.toLowerCase();
    const agent = agentOf(email);
    if (!agent) throw new Error("Unknown agent.");
    let r = await rowFor(ctx, email);
    if (!r) {
      const id = await ctx.db.insert("growthPresence", {
        email,
        name: agent.name,
        updatedAt: Date.now(),
      });
      r = (await ctx.db.get(id))!;
    }
    const patch: Partial<Doc<"growthPresence">> = {};
    if (a.zillowVerified !== undefined) patch.zillowVerified = a.zillowVerified;
    if (a.gbpLocation !== undefined) {
      const st = await ctx.db
        .query("growthTeamState")
        .withIndex("by_key", q => q.eq("key", "gbp"))
        .unique();
      const all = st
        ? (
            JSON.parse(st.data) as {
              all: { id: string; title: string; reviewUri?: string }[];
            }
          ).all
        : [];
      const loc = all.find(l => l.id === a.gbpLocation);
      if (a.gbpLocation && !loc)
        throw new Error("That Business Profile isn't visible to team@ yet.");
      patch.gbpLocation = a.gbpLocation || undefined;
      patch.gbpTitle = loc?.title;
      patch.gbpReviewUri = loc?.reviewUri;
    }
    await ctx.db.patch(r._id, patch);
    if (a.gbpLocation !== undefined) await queueCheck(ctx, email, true);
    return null;
  },
});

// ---------------------------------------------------------------- checks

export const forCheck = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await syncRoster(ctx);
    const r = await rowFor(ctx, email);
    const today = await ctx.db
      .query("loftyToday")
      .withIndex("by_email", q =>
        q.eq("agentEmail", agentOf(email)?.email ?? email),
      )
      .unique();
    const all = await ctx.db.query("growthPresence").collect();
    const st = await ctx.db
      .query("growthTeamState")
      .withIndex("by_key", q => q.eq("key", "gbp"))
      .unique();
    return {
      row: r,
      level: await levelFor(ctx, email),
      today:
        today?.data && today.updatedAt > Date.now() - 3 * DAY
          ? today.data
          : null,
      loftyUserId: today?.loftyUserId ?? null,
      takenGbp: all
        .filter(x => x.email !== email && x.gbpLocation)
        .map(x => x.gbpLocation!),
      gbpAll: st
        ? (
            JSON.parse(st.data) as {
              all: { id: string; title: string; reviewUri?: string }[];
            }
          ).all
        : [],
    };
  },
});

export const saveCheck = internalMutation({
  args: {
    email: v.string(),
    signals: v.string(),
    score: v.string(),
    total: v.number(),
    gbp: v.optional(
      v.object({
        id: v.string(),
        title: v.string(),
        reviewUri: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, a) => {
    await syncRoster(ctx);
    const r = await rowFor(ctx, a.email);
    if (!r) return null;
    const now = Date.now();
    const m = monthKey(now);
    const hist = (r.history ?? []).filter(h => h.month !== m);
    hist.push({ month: m, total: a.total });
    await ctx.db.patch(r._id, {
      signals: a.signals,
      score: a.score,
      total: a.total,
      history: hist.slice(-12),
      checkedAt: now,
      checking: false,
      ...(a.gbp
        ? {
            gbpLocation: a.gbp.id,
            gbpTitle: a.gbp.title,
            gbpReviewUri: a.gbp.reviewUri,
          }
        : {}),
    });
    return null;
  },
});

export const checkFailed = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await syncRoster(ctx);
    const r = await rowFor(ctx, email);
    if (r) await ctx.db.patch(r._id, { checking: false });
    return null;
  },
});

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function timedFetch(url: string, init: RequestInit = {}, ms = 12_000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: c.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

/** Instagram via the public profile embed (last 6 posts with dates + post count).
 * Instagram's JSON endpoints answer 401 from server IPs; the embed page doesn't (tested 2026-11-02).
 * Returns null-able errors by throwing; caller keeps the last good result. */
export async function checkInstagram(
  handle: string,
  now = Date.now(),
): Promise<Signals["instagram"]> {
  if (!handle) return { ok: false, reason: "no_handle" };
  const res = await timedFetch(
    `https://www.instagram.com/${encodeURIComponent(handle)}/embed/`,
    { headers: { "User-Agent": "Mozilla/5.0" } },
  );
  if (res.status === 404) return { ok: false, reason: "not_found" };
  if (!res.ok) throw new Error(`Instagram ${res.status}`);
  let t = await res.text();
  for (let i = 0; i < 4 && t.includes('\\"'); i++)
    t = t.replace(/\\\\/g, "\\").replace(/\\"/g, '"');
  const user = t.match(/"context":\{"username":"([^"]+)"/)?.[1];
  if (!user) return { ok: false, reason: "not_found" }; // embed of a missing account has no profile context
  if (/"is_private":true/.test(t)) return { ok: false, reason: "private" };
  const postsCount = Number(t.match(/"posts_count":(\d+)/)?.[1] ?? NaN);
  const nodes = t
    .split('"shortcode_media":')
    .slice(1)
    .map(c => ({
      at: Number(c.match(/"taken_at_timestamp":(\d{10})/)?.[1] ?? 0) * 1000,
      video:
        c.match(/"is_video":(true|false)/)?.[1] === "true" ||
        /^\{"__typename":"GraphVideo"/.test(c),
    }))
    .filter(n => n.at > 0);
  const times = nodes.map(n => n.at).sort((a, b) => b - a);
  const cut = now - 28 * DAY;
  let posts28 = times.filter(x => x >= cut).length;
  let videos28 = nodes.filter(n => n.at >= cut && n.video).length;
  // Only the newest few are visible: if all fall inside 28 days, extrapolate the pace.
  if (times.length >= 4 && times[times.length - 1] >= cut) {
    const f = Math.min(
      (28 * DAY) / Math.max(now - times[times.length - 1], DAY),
      8,
    );
    posts28 = Math.round(times.length * f);
    videos28 = Math.round(videos28 * f);
  }
  return {
    ok: true,
    username: user,
    postsCount: Number.isFinite(postsCount) ? postsCount : null,
    posts28,
    videos28,
    lastPostAt: times[0] ?? null,
  };
}

/** YouTube channel via its public page + RSS (no API quota). */
export async function checkYouTube(
  handle: string,
  now = Date.now(),
): Promise<Signals["youtube"]> {
  if (!handle) return { ok: false, reason: "no_handle" };
  let channelId = handle.startsWith("UC")
    ? handle
    : handle.match(/channel\/(UC[\w-]{22})/)?.[1];
  if (!channelId) {
    const res = await timedFetch(
      `https://www.youtube.com/${handle.startsWith("@") ? handle : `@${handle}`}`,
      { headers: { "User-Agent": UA, "Accept-Language": "en-US" } },
    );
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) throw new Error(`YouTube ${res.status}`);
    const html = await res.text();
    channelId =
      html.match(/"externalId":"(UC[\w-]{22})"/)?.[1] ??
      html.match(/channel\/(UC[\w-]{22})/)?.[1];
    if (!channelId) return { ok: false, reason: "not_found" };
  }
  const feed = await timedFetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
  );
  if (feed.status === 404) return { ok: false, reason: "not_found" };
  if (!feed.ok) throw new Error(`YouTube feed ${feed.status}`);
  const xml = await feed.text();
  const entries = xml.split("<entry>").slice(1);
  const times = entries
    .map(e => Date.parse(e.match(/<published>([^<]+)/)?.[1] ?? ""))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  return {
    ok: true,
    channelId,
    uploads28: times.filter(t => t >= now - 28 * DAY).length,
    lastUploadAt: times[0] ?? null,
  };
}

async function checkLinks(
  links: Partial<Record<ProfileKey, string>>,
): Promise<Signals["links"]> {
  const out: Signals["links"] = {};
  await Promise.all(
    Object.entries(links).map(async ([k, url]) => {
      if (!url) return;
      try {
        const res = await timedFetch(
          url,
          { headers: { "User-Agent": UA } },
          10_000,
        );
        out[k as ProfileKey] =
          res.status === 404 || res.status === 410
            ? "broken"
            : res.ok
              ? "live"
              : "entered"; // 403/429 = site blocks bots
      } catch {
        out[k as ProfileKey] = "entered";
      }
    }),
  );
  return out;
}

type Gbp = { status_code: number; body: any };

async function gbpGet(url: string): Promise<any> {
  const r = await callIntegration<Gbp>("mcp_pd_google_my_business_proxy_get", {
    url,
  });
  if (r.status_code >= 300)
    throw new Error(
      `Google ${r.status_code}: ${JSON.stringify(r.body).slice(0, 200)}`,
    );
  return typeof r.body === "string" ? JSON.parse(r.body) : r.body;
}

async function checkGoogle(
  location: string,
  now = Date.now(),
): Promise<{ rating: number; total: number; new30: number }> {
  const b = await gbpGet(
    `https://mybusiness.googleapis.com/v4/accounts/${GBP_ACCOUNT}/${location}/reviews?pageSize=50&orderBy=updateTime%20desc`,
  );
  const reviews: { createTime?: string }[] = b?.reviews ?? [];
  return {
    rating: Number(b?.averageRating ?? 0),
    total: Number(b?.totalReviewCount ?? 0),
    new30: reviews.filter(x => Date.parse(x.createTime ?? "") >= now - 30 * DAY)
      .length,
  };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Business Profile the agent manages: stored match, else a title with their first + last name. */
function matchGbp(
  name: string,
  all: { id: string; title: string; reviewUri?: string }[],
  taken: string[],
) {
  const [first, ...rest] = norm(name).split(" ");
  const last = rest[rest.length - 1] ?? "";
  return (
    all.find(
      l =>
        !taken.includes(l.id) &&
        !NOT_AGENTS.includes(l.id) &&
        norm(l.title).includes(first) &&
        (!last || norm(l.title).includes(last)),
    ) ?? null
  );
}

async function checkLofty(
  userId: number | null,
  email: string,
  name: string,
  today: string | null,
  now = Date.now(),
): Promise<Signals["lofty"]> {
  const id = userId ?? matchMember(await loftyMembers(), email, name);
  if (!id) return null;
  const body = await lofty("get", `/v1.0/leads?assignedUserId=${id}&limit=100`);
  const t = (s?: string | null) =>
    s ? Date.parse(s.replace(/GMT$/, "Z")) : NaN;
  const recent = ((body?.leads ?? []) as any[]).filter(
    l => l.stage !== "Deleted" && !/csv|import/i.test(l.source ?? ""),
  );
  const fresh = recent.filter(l => {
    const at = t(l.assignTime) || t(l.createTime);
    return at >= now - 30 * DAY && at <= now - DAY; // give every lead 24h before it counts
  });
  const touched = fresh.filter(
    l => t(l.lastTouch) > (t(l.assignTime) || t(l.createTime)),
  );
  let overdue = 0;
  let quiet = 0;
  if (today) {
    const d = JSON.parse(today) as {
      followUps?: { overdue?: boolean }[];
      olderOverdue?: number;
      quietCount?: number;
    };
    overdue =
      (d.followUps ?? []).filter(f => f.overdue).length + (d.olderOverdue ?? 0);
    quiet = d.quietCount ?? 0;
  }
  return { leads30: fresh.length, touched30: touched.length, overdue, quiet };
}

export const checkAgent = internalAction({
  args: { email: v.string() },
  handler: async (
    ctx,
    { email },
  ): Promise<{ total: number; measured: number; notes: string[] } | null> => {
    await syncRoster(ctx);
    const agent = agentOf(email);
    const d = await ctx.runQuery(internal.growthScore.forCheck, { email });
    if (!agent || !d.row) return null;
    const r = d.row;
    const prev: Signals | null = r.signals ? JSON.parse(r.signals) : null;
    const notes: string[] = [];
    const now = Date.now();
    const keep = <K extends keyof Signals>(
      k: K,
      label: string,
      e: unknown,
    ): Signals[K] | null => {
      console.warn("growth check", email, label, String(e).slice(0, 200));
      notes.push(`${label} didn't answer, showing the last result`);
      return prev ? (prev[k] as Signals[K]) : null;
    };

    const [instagram, youtube, links] = await Promise.all([
      checkInstagram(r.instagram ?? "", now).catch(
        e => keep("instagram", "Instagram", e) as Signals["instagram"],
      ),
      checkYouTube(r.youtube ?? "", now).catch(
        e => keep("youtube", "YouTube", e) as Signals["youtube"],
      ),
      checkLinks((r.links ?? {}) as Partial<Record<ProfileKey, string>>),
    ]);

    let google: Signals["google"] = { ok: false, reason: "not_connected" };
    let gbpMatch: { id: string; title: string; reviewUri?: string } | undefined;
    const loc = r.gbpLocation
      ? {
          id: r.gbpLocation,
          title: r.gbpTitle ?? "",
          reviewUri: r.gbpReviewUri,
        }
      : matchGbp(agent.name, d.gbpAll, d.takenGbp);
    if (loc) {
      try {
        const g = await checkGoogle(loc.id, now);
        google = { ok: true, title: loc.title, reviewUri: loc.reviewUri, ...g };
        if (!r.gbpLocation)
          gbpMatch = {
            id: loc.id,
            title: loc.title,
            ...(loc.reviewUri ? { reviewUri: loc.reviewUri } : {}),
          };
      } catch (e) {
        google = keep("google", "Google", e) as Signals["google"];
      }
    }

    let loftyS: Signals["lofty"] = null;
    try {
      loftyS = await checkLofty(
        d.loftyUserId,
        agent.email,
        agent.name,
        d.today,
        now,
      );
      if (!loftyS) notes.push("Not found in Lofty");
    } catch (e) {
      loftyS = keep("lofty", "Lofty", e) as Signals["lofty"];
    }

    // Auto-checked profiles count as live.
    if (instagram && instagram.ok) links.instagram = "live";
    if (youtube && youtube.ok) links.youtube = "live";
    if (google && google.ok) links.google = "live";

    const signals: Signals = {
      checkedAt: now,
      instagram,
      youtube,
      google,
      lofty: loftyS,
      links,
      notes,
    };
    const s = score(
      {
        niche: r.niche,
        instagram: r.instagram,
        youtube: r.youtube,
        links: r.links as Partial<Record<ProfileKey, string>>,
        zillowReviews: r.zillowReviews,
        zillowVerified: r.zillowVerified,
      },
      signals,
      d.level,
    );
    await ctx.runMutation(internal.growthScore.saveCheck, {
      email,
      signals: JSON.stringify(signals),
      score: JSON.stringify(s),
      total: s.total,
      gbp: gbpMatch,
    });
    return { total: s.total, measured: s.measured, notes };
  },
});

export const saveTeamState = internalMutation({
  args: { data: v.string() },
  handler: async (ctx, { data }) => {
    await syncRoster(ctx);
    const st = await ctx.db
      .query("growthTeamState")
      .withIndex("by_key", q => q.eq("key", "gbp"))
      .unique();
    if (st) await ctx.db.patch(st._id, { data, updatedAt: Date.now() });
    else
      await ctx.db.insert("growthTeamState", {
        key: "gbp",
        data,
        updatedAt: Date.now(),
      });
    return null;
  },
});

export const takenGbp = internalQuery({
  args: {},
  handler: async ctx =>
    (await ctx.db.query("growthPresence").collect())
      .filter(r => r.gbpLocation)
      .map(r => r.gbpLocation!),
});

/** Business Profiles team@ can see + pending Manager invites. One call each (0.35 cr). */
export const refreshGbp = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ locations: number; unmatched: number; invites: number }> => {
    await syncRoster(ctx);
    const locs = await gbpGet(
      `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${GBP_ACCOUNT}/locations?readMask=name,title,metadata&pageSize=100`,
    );
    const all = ((locs?.locations ?? []) as any[]).map(l => ({
      id: String(l.name),
      title: String(l.title ?? ""),
      reviewUri: l.metadata?.newReviewUri as string | undefined,
    }));
    let invites = 0;
    try {
      const inv = await gbpGet(
        `https://mybusinessaccountmanagement.googleapis.com/v1/accounts/${GBP_ACCOUNT}/invitations`,
      );
      invites = (inv?.invitations ?? []).length;
    } catch (e) {
      console.warn("gbp invitations", String(e).slice(0, 200));
    }
    const taken: string[] = await ctx.runQuery(
      internal.growthScore.takenGbp,
      {},
    );
    const unmatched = all
      .filter(l => !NOT_AGENTS.includes(l.id) && !taken.includes(l.id))
      .map(l => ({ id: l.id, title: l.title }));
    await ctx.runMutation(internal.growthScore.saveTeamState, {
      data: JSON.stringify({ all, unmatched, invites }),
    });
    return { locations: all.length, unmatched: unmatched.length, invites };
  },
});

export const ensureRows = internalMutation({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const now = Date.now();
    for (const a of AGENTS) {
      const r = await rowFor(ctx, a.email);
      if (r) await ctx.db.patch(r._id, { checking: true, requestedAt: now });
      else
        await ctx.db.insert("growthPresence", {
          email: a.email.toLowerCase(),
          name: a.name,
          checking: true,
          requestedAt: now,
          updatedAt: now,
        });
    }
    return AGENTS.map(a => a.email.toLowerCase());
  },
});

/** Weekly (Mondays) + on demand: Google list once, then every agent, spaced out. */
export const checkAll = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    await syncRoster(ctx);
    try {
      await ctx.runAction(internal.growthScore.refreshGbp, {});
    } catch (e) {
      console.error("growth gbp", String(e).slice(0, 300));
    }
    const emails: string[] = await ctx.runMutation(
      internal.growthScore.ensureRows,
      {},
    );
    // Await each schedule: un-awaited scheduler calls in an action are dropped.
    for (const [i, email] of emails.entries()) {
      await ctx.scheduler.runAfter(i * 6000, internal.growthScore.checkAgent, {
        email,
      });
    }
    return emails.length;
  },
});

// ---------------------------------------------------------------- monthly email

type MailRow = {
  name: string;
  total: number | null;
  color: "red" | "yellow" | "green" | null;
  fix: string;
  prev: number | null;
  setUp: boolean;
};

export const allForMail = internalQuery({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const rows = await ctx.db.query("growthPresence").collect();
    const st = await ctx.db
      .query("growthTeamState")
      .withIndex("by_key", q => q.eq("key", "gbp"))
      .unique();
    return {
      rows: AGENTS.map(a => {
        const r = rows.find(x => x.email === a.email.toLowerCase());
        const s = r?.score
          ? (JSON.parse(r.score) as ReturnType<typeof score>)
          : null;
        const prev =
          r?.history && r.history.length > 1
            ? r.history[r.history.length - 2].total
            : null;
        return {
          name: a.name,
          total: s?.total ?? null,
          color: s?.color ?? null,
          fix: s?.fixes[0]?.title ?? "",
          prev,
          setUp: !!(r?.niche || r?.instagram),
        };
      }),
      invites: st
        ? ((JSON.parse(st.data) as { invites?: number }).invites ?? 0)
        : 0,
    };
  },
});

/** First Monday of the month (cron runs every Monday; skips unless day ≤ 7). */
export const monthlyEmail = internalAction({
  args: {
    to: v.optional(v.string()),
    force: v.optional(v.boolean()),
    agentCards: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { to, force, agentCards },
  ): Promise<{ skipped?: boolean; sent?: string; agents?: number }> => {
    await syncRoster(ctx);
    const day = Number(
      new Date().toLocaleDateString("en-US", {
        timeZone: "America/Chicago",
        day: "numeric",
      }),
    );
    if (!force && day > 7) return { skipped: true };
    const { rows, invites }: { rows: MailRow[]; invites: number } =
      await ctx.runQuery(internal.growthScore.allForMail, {});
    const scored = rows
      .filter(r => r.total !== null)
      .sort((a, b) => b.total! - a.total!);
    const notSetUp = rows.filter(r => !r.setUp).map(r => r.name);
    const dot = {
      red: "#c0392b",
      yellow: "#b7950b",
      green: "#1e8449",
    } as const;
    const line = (r: (typeof scored)[number]) => `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:14px"><b>${esc(r.name)}</b></td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:15px;text-align:center;color:${dot[r.color!]}"><b>${r.total}</b>${r.prev !== null ? `<br><span style="font-size:11px;color:#6b665d">${r.total! - r.prev >= 0 ? "+" : ""}${r.total! - r.prev} vs last</span>` : ""}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#3d3a35">${esc(r.fix)}</td></tr>`;
    const avg = scored.length
      ? Math.round(scored.reduce((a, r) => a + r.total!, 0) / scored.length)
      : 0;
    const body = `
      <p style="font-size:15px;margin:0 0 6px">Team average <b>${avg}</b> · ${scored.filter(r => r.color === "green").length} green, ${scored.filter(r => r.color === "yellow").length} yellow, ${scored.filter(r => r.color === "red").length} red.</p>
      <p style="font-size:13px;color:#6b665d;margin:0 0 14px">Checked from their real Instagram, YouTube, Google reviews, profile links and Lofty. Followers are not scored.</p>
      <table style="width:100%;border-collapse:collapse;background:#fff"><tr><th style="text-align:left;padding:8px 10px;font-size:12px;color:#6b665d">Agent</th><th style="padding:8px 10px;font-size:12px;color:#6b665d">Score</th><th style="text-align:left;padding:8px 10px;font-size:12px;color:#6b665d">#1 fix</th></tr>${scored.map(line).join("")}</table>
      ${notSetUp.length ? `<p style="font-size:13px;margin:14px 0 0"><b>Haven't filled in My profiles (${notSetUp.length}):</b> ${esc(notSetUp.join(", "))}</p>` : ""}
      ${invites ? `<p style="font-size:13px;margin:8px 0 0"><b>${invites} Google Business Profile invite(s)</b> waiting in team@spacematchinc.com. Open the email “invited you to manage” and tap Accept.</p>` : ""}`;
    const month = new Date().toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      month: "long",
      year: "numeric",
    });
    await sendMail(
      to ?? REPORT_TO,
      `Agent Growth Scores, ${month}: team average ${avg}`,
      shell(`Growth Scores · ${month}`, body, {
        href: `${hubUrl()}/growth`,
        label: "Open the scores",
      }),
    );
    // Each agent also gets their own card (Michael approved 2026-11-02). Skipped when
    // a test address is given unless agentCards is set explicitly.
    if (agentCards ?? !to)
      await ctx.scheduler.runAfter(
        60_000,
        internal.growthScore.agentCardEmails,
        {},
      );
    return { sent: to ?? REPORT_TO, agents: scored.length };
  },
});

// ---------------------------------------------------------------- agent card emails

type AgentMailRow = {
  name: string;
  email: string;
  setUp: boolean;
  score: Score | null;
  prev: number | null;
};

export const agentsForMail = internalQuery({
  args: { only: v.optional(v.string()) },
  handler: async (ctx, { only }): Promise<AgentMailRow[]> => {
    await syncRoster(ctx);
    const rows = await ctx.db.query("growthPresence").collect();
    return AGENTS.filter(
      a => !only || a.email.toLowerCase() === only.toLowerCase(),
    ).map(a => {
      const r = rows.find(x => x.email === a.email.toLowerCase());
      return {
        name: a.name,
        email: a.email.toLowerCase(),
        setUp: !!(r?.niche || r?.instagram),
        score: r?.score ? (JSON.parse(r.score) as Score) : null,
        prev:
          r?.history && r.history.length > 1
            ? r.history[r.history.length - 2].total
            : null,
      };
    });
  },
});

const COLOR_HEX = {
  red: "#c0392b",
  yellow: "#b7950b",
  green: "#1e8449",
} as const;

function agentCardHtml(r: AgentMailRow, month: string) {
  const first = esc(r.name.split(" ")[0]);
  const url = `${hubUrl()}/growth`;
  if (!r.score || !r.setUp) {
    return {
      subject: `Your Growth Score is waiting: 3 minutes to set up`,
      html: shell(
        `${first}, your Growth Score is empty`,
        `<p style="font-size:15px;line-height:1.5;margin:0 0 10px">The Hub now scores your online presence against the 90-day plan: Instagram, YouTube, Google reviews, profile links and Lofty follow-up. You get a score out of 100 and your top 3 fixes.</p>
        <p style="font-size:15px;line-height:1.5;margin:0 0 10px">Yours is blank because <b>My profiles</b> isn't filled in yet. It takes about 3 minutes: your niche sentence, Instagram and YouTube handles, profile links and Zillow review count.</p>
        <p style="font-size:13px;color:#6b665d;margin:0">Only you and the team leads can see your card.</p>`,
        { href: url, label: "Fill in My profiles" },
      ),
    };
  }
  const s = r.score;
  const delta =
    r.prev !== null
      ? `<span style="font-size:13px;color:#6b665d"> · ${s.total - r.prev >= 0 ? "+" : ""}${s.total - r.prev} vs last month</span>`
      : "";
  const partial =
    s.measured < 100
      ? `<p style="font-size:12px;color:#6b665d;margin:4px 0 0">Based on ${s.measured} of 100 points; some sources couldn't be checked this time.</p>`
      : "";
  const parts = s.parts
    .map(p => {
      const pct = p.got === null ? 0 : Math.round((p.got / p.max) * 100);
      const bar =
        p.got === null
          ? "#d6d1c8"
          : pct >= 70
            ? COLOR_HEX.green
            : pct >= 40
              ? COLOR_HEX.yellow
              : COLOR_HEX.red;
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;width:38%;vertical-align:top"><b>${p.key}</b> · ${esc(p.label)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;vertical-align:top">
          <div style="background:#eee;border-radius:4px;height:8px;width:100%"><div style="background:${bar};border-radius:4px;height:8px;width:${pct}%"></div></div>
          <div style="font-size:12px;color:#6b665d;margin-top:4px">${p.got === null ? "Not checked" : `${Math.round(p.got)}/${p.max}`}${p.detail[0] ? ` · ${esc(p.detail[0])}` : ""}</div>
        </td></tr>`;
    })
    .join("");
  const fixes = s.fixes
    .slice(0, 3)
    .map((f, i) => {
      const link = f.playbookItem
        ? `${url}#growth-item-${f.playbookItem}`
        : f.hubLink
          ? `${hubUrl()}${f.hubLink.to}`
          : url;
      const label = f.playbookItem
        ? "Open the playbook step"
        : (f.hubLink?.label ?? "Open the Hub");
      return `<div style="background:#fff;border-radius:10px;padding:14px 16px;margin:0 0 10px">
        <div style="font-size:15px;margin:0 0 4px"><b>${i + 1}. ${esc(f.title)}</b> <span style="color:${COLOR_HEX.green};font-size:13px;font-weight:700">+${Math.round(f.lost)} pts</span></div>
        <div style="font-size:13px;color:#3d3a35;margin:0 0 6px">${esc(f.why)}</div>
        <ol style="font-size:13px;color:#3d3a35;margin:0 0 6px;padding-left:18px">${f.steps
          .slice(0, 4)
          .map(x => `<li style="margin:0 0 2px">${esc(x)}</li>`)
          .join("")}</ol>
        <a href="${link}" style="font-size:13px;color:#9C7434;font-weight:700">${esc(label)} →</a>
      </div>`;
    })
    .join("");
  return {
    subject: `Your Growth Score for ${month}: ${s.total}/100`,
    html: shell(
      `${first}, your Growth Score: ${s.total}`,
      `<p style="font-size:30px;margin:0;color:${COLOR_HEX[s.color]}"><b>${s.total}</b><span style="font-size:15px;color:#6b665d">/100</span>${delta}</p>
      ${partial}
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px;margin:14px 0 18px">${parts}</table>
      ${fixes ? `<p style="font-size:15px;margin:0 0 8px"><b>Your top fixes this month</b></p>${fixes}` : `<p style="font-size:15px">No fixes this month. Keep the pace.</p>`}
      <p style="font-size:12px;color:#6b665d;margin:12px 0 0">Checked from your real Instagram, YouTube, Google reviews, profile links and Lofty. Followers aren't scored. Only you and the team leads see your card.</p>`,
      { href: url, label: "Open my score card" },
    ),
  };
}

/** Each agent's own card. `only` = send to a single agent (testing); `to` redirects mail. */
export const agentCardEmails = internalAction({
  args: { only: v.optional(v.string()), to: v.optional(v.string()) },
  handler: async (
    ctx,
    { only, to },
  ): Promise<{ sent: number; failed: string[] }> => {
    await syncRoster(ctx);
    const rows: AgentMailRow[] = await ctx.runQuery(
      internal.growthScore.agentsForMail,
      { only },
    );
    const month = new Date().toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      month: "long",
    });
    let sent = 0;
    const failed: string[] = [];
    for (const r of rows) {
      const { subject, html } = agentCardHtml(r, month);
      try {
        await sendMail(to ?? r.email, subject, html);
        sent++;
      } catch (e) {
        failed.push(r.email);
        console.error("growth agent card", r.email, String(e).slice(0, 200));
      }
      await new Promise(res => setTimeout(res, 1500));
    }
    return { sent, failed };
  },
});

// Ops/testing: set profile fields for an agent from the CLI (internal only).
export const adminSetProfile = internalMutation({
  args: {
    email: v.string(),
    niche: v.optional(v.string()),
    instagram: v.optional(v.string()),
    youtube: v.optional(v.string()),
    links: v.optional(v.record(v.string(), v.string())),
    zillowReviews: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    await syncRoster(ctx);
    const agent = agentOf(a.email);
    if (!agent) throw new Error("Unknown agent");
    const { email, ...rest } = a;
    const r = await rowFor(ctx, email);
    const patch = {
      ...rest,
      instagram: igHandle(rest.instagram),
      youtube: ytHandle(rest.youtube),
      updatedAt: Date.now(),
    };
    if (r) await ctx.db.patch(r._id, patch);
    else
      await ctx.db.insert("growthPresence", {
        email: email.toLowerCase(),
        name: agent.name,
        ...patch,
      });
    return null;
  },
});

export const testSources = internalAction({
  args: { instagram: v.string(), youtube: v.string() },
  handler: async (_ctx, a): Promise<string> =>
    JSON.stringify({
      ig: await checkInstagram(igHandle(a.instagram)),
      yt: await checkYouTube(ytHandle(a.youtube)),
    }),
});
