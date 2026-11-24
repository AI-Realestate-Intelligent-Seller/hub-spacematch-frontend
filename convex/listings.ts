// Seller Launch Portal. Agents manage listings in the Hub; sellers open a
// private /s/:token link (no login) that updates live. No AI anywhere here.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { AGENTS, OPS_EMAILS, agentByEmail, isAdminEmail } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { formatFreeAddress, formatPrice } from "./address";
import { LAUNCH_STEPS, LISTING_STATUSES, addressKey, weekOf } from "./launchSteps";
import type { ParsedShowing } from "./showingtimeParse";
import { adsSummary, publicAds } from "./listingAds";
import { publicSuggestions } from "./suggestions";

const LEADER_EMAILS = ["brandon@spacematchinc.com", "sergio.monjane@spacematchinc.com"];
const clean = (s: string | undefined | null, max = 500) => (s ?? "").trim().slice(0, max);
const opt = (s: string | undefined | null, max = 500) => clean(s, max) || undefined;

async function who(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  const email = (user?.email ?? "").toLowerCase();
  const staff = isAdminEmail(email) || OPS_EMAILS.includes(email) || LEADER_EMAILS.includes(email);
  return { email, name: agentByEmail(email)?.name ?? user?.name ?? email, staff };
}

export async function mine(ctx: QueryCtx, userId: Id<"users">, id: Id<"listings">) {
  const me = await who(ctx, userId);
  const l = await ctx.db.get(id);
  if (!l || !(me.staff || l.agentEmail === me.email)) throw new Error("Listing not found");
  return { me, l };
}

function newToken(): string {
  const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => a[b % a.length]).join("");
}

const touch = (ctx: MutationCtx, id: Id<"listings">) => ctx.db.patch(id, { updatedAt: Date.now() });

export async function openHouseSignins(ctx: QueryCtx, l: Doc<"listings">) {
  const rows = await ctx.db.query("formSubmissions").order("desc").take(1500);
  return rows.filter(r => r.formId === "open-house-signin" && r.propertyAddress && addressKey(r.propertyAddress) === l.addressKey && r._creationTime >= l.createdAt - 14 * 864e5);
}

// ---------- Agent side ----------

export const list = authenticatedQuery({
  args: { scope: v.optional(v.union(v.literal("mine"), v.literal("all"))) },
  handler: async (ctx, { scope }) => {
    const me = await who(ctx, ctx.userId);
    const rows =
      me.staff && scope !== "mine"
        ? await ctx.db.query("listings").order("desc").take(300)
        : await ctx.db.query("listings").withIndex("by_agent", q => q.eq("agentEmail", me.email)).order("desc").take(300);
    const out = [];
    for (const l of rows) {
      const ev = await ctx.db.query("listingEvents").withIndex("by_listing", q => q.eq("listingId", l._id)).collect();
      const wk = await ctx.db.query("listingMetrics").withIndex("by_listing_week", q => q.eq("listingId", l._id).eq("weekOf", weekOf(Date.now()))).first();
      out.push({
        _id: l._id, address: formatFreeAddress(l.address), status: l.status, agentName: l.agentName, sellerName: l.sellerName, photoUrl: l.photoUrl,
        stepsDone: l.steps.filter(s => s.done).length, stepsTotal: l.steps.length,
        pending: ev.filter(e => e.status === "pending").length,
        showings: ev.filter(e => e.kind === "showing").length - ev.filter(e => e.kind === "cancelled").length,
        numbersThisWeek: !!wk && wk.enteredByEmail !== "auto", adsRunning: (await adsSummary(ctx, l._id)).running, sellerLastSeenAt: l.sellerLastSeenAt, updatedAt: l.updatedAt,
      });
    }
    return { rows: out, me: { email: me.email, staff: me.staff } };
  },
});

export const get = authenticatedQuery({
  args: { id: v.id("listings") },
  handler: async (ctx, { id }) => {
    const { me, l } = await mine(ctx, ctx.userId, id);
    const events = await ctx.db.query("listingEvents").withIndex("by_listing", q => q.eq("listingId", id)).order("desc").collect();
    const metrics = await ctx.db.query("listingMetrics").withIndex("by_listing_week", q => q.eq("listingId", id)).collect();
    const oh = await openHouseSignins(ctx, l);
    return {
      listing: l,
      events,
      metrics: metrics.sort((a, b) => a.weekOf.localeCompare(b.weekOf)),
      openHouse: oh.map(r => ({ _id: r._id, name: r.contactName, at: r._creationTime, status: r.status })),
      thisWeek: weekOf(Date.now()),
      me: { email: me.email, staff: me.staff },
    };
  },
});

export const create = authenticatedMutation({
  args: {
    address: v.string(),
    mlsNumber: v.optional(v.string()),
    price: v.optional(v.string()),
    sellerName: v.string(),
    sellerEmail: v.optional(v.string()),
    sellerPhone: v.optional(v.string()),
    agentName: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const me = await who(ctx, ctx.userId);
    const address = clean(a.address, 200);
    const sellerName = clean(a.sellerName, 120);
    if (!address) throw new Error("Add the property address");
    if (!sellerName) throw new Error("Add the seller's name");
    const sellerEmail = opt(a.sellerEmail, 200)?.toLowerCase();
    if (sellerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sellerEmail)) throw new Error("That seller email doesn't look right");
    // Agents not yet in the roster still get a listing under their own login.
    let agent: { name: string; email: string } | undefined = agentByEmail(me.email) ?? { name: me.name || me.email, email: me.email };
    if (a.agentName && a.agentName !== agent.name) {
      if (!me.staff) throw new Error("Only admins or ops can create a listing for another agent");
      agent = AGENTS.find(x => x.name === a.agentName);
    }
    if (!agent?.email) throw new Error("Pick the listing agent");
    const now = Date.now();
    const id = await ctx.db.insert("listings", {
      address: formatFreeAddress(address),
      addressKey: addressKey(address),
      mlsNumber: opt(a.mlsNumber, 20)?.replace(/\D/g, "") || undefined,
      price: formatPrice(opt(a.price, 40)) || undefined,
      status: "Preparing",
      agentEmail: agent.email.toLowerCase(),
      agentName: agent.name,
      sellerName,
      sellerEmail,
      sellerPhone: opt(a.sellerPhone, 40),
      token: newToken(),
      steps: LAUNCH_STEPS.map(s => ({ key: s.key, done: false })),
      links: {},
      weeklyEmail: false,
      createdAt: now,
      updatedAt: now,
    });
    // Pick up Zillow reports / an Instagram Reel that already mention this address.
    await ctx.scheduler.runAfter(0, internal.zillow.rollupListing, { listingId: id });
    await ctx.scheduler.runAfter(0, internal.reels.refresh, { listingId: id });
    await ctx.scheduler.runAfter(0, internal.paidAds.refresh, { listingId: id });
    await ctx.scheduler.runAfter(0, internal.youtube.refresh, { listingId: id });
    // Seller → Lofty contact (find by email/phone, else create under the agent).
    if (sellerEmail || a.sellerPhone) await ctx.scheduler.runAfter(0, internal.lofty.syncListingSeller, { id });
    // Neighborhood & marketing plan builds by itself for every new listing (~150 credits).
    await ctx.scheduler.runAfter(0, internal.listingPlans.autoQueue, { listingId: id, email: me.email });
    return id;
  },
});

export const update = authenticatedMutation({
  args: {
    id: v.id("listings"),
    address: v.optional(v.string()),
    mlsNumber: v.optional(v.string()),
    price: v.optional(v.string()),
    status: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    sellerName: v.optional(v.string()),
    sellerEmail: v.optional(v.string()),
    sellerPhone: v.optional(v.string()),
    liveDate: v.optional(v.string()),
    weeklyEmail: v.optional(v.boolean()),
    links: v.optional(v.object({ zillow: v.optional(v.string()), website: v.optional(v.string()), reel: v.optional(v.string()), tour: v.optional(v.string()), youtube: v.optional(v.string()), tiktok: v.optional(v.string()), facebook: v.optional(v.string()) })),
  },
  handler: async (ctx, { id, ...a }) => {
    const { l } = await mine(ctx, ctx.userId, id);
    const p: Partial<Doc<"listings">> = { updatedAt: Date.now() };
    if (a.address !== undefined) { const raw = clean(a.address, 200) || l.address; p.address = formatFreeAddress(raw); p.addressKey = addressKey(raw); }
    if (a.mlsNumber !== undefined) p.mlsNumber = a.mlsNumber.replace(/\D/g, "") || undefined;
    if (a.price !== undefined) {
      const np = formatPrice(opt(a.price, 40)) || undefined;
      if (np && l.price && np !== l.price) {
        await ctx.db.insert("listingEvents", { listingId: id, kind: "price", status: "published", title: `Price updated to ${np}`, source: "agent", createdAt: Date.now() });
      }
      p.price = np;
    }
    if (a.status !== undefined) {
      if (!(LISTING_STATUSES as readonly string[]).includes(a.status)) throw new Error("Unknown status");
      p.status = a.status;
    }
    if (a.photoUrl !== undefined) {
      const u = clean(a.photoUrl, 600);
      if (u && !/^https:\/\//.test(u)) throw new Error("Photo link must start with https://");
      p.photoUrl = u || undefined;
    }
    if (a.sellerName !== undefined) p.sellerName = clean(a.sellerName, 120) || l.sellerName;
    if (a.sellerEmail !== undefined) p.sellerEmail = opt(a.sellerEmail, 200)?.toLowerCase();
    if (a.sellerPhone !== undefined) p.sellerPhone = opt(a.sellerPhone, 40);
    if (a.liveDate !== undefined) p.liveDate = /^\d{4}-\d{2}-\d{2}$/.test(a.liveDate) ? a.liveDate : undefined;
    if (a.weeklyEmail !== undefined) {
      if (a.weeklyEmail && !(p.sellerEmail ?? l.sellerEmail)) throw new Error("Add the seller's email first");
      p.weeklyEmail = a.weeklyEmail;
    }
    if (a.links) {
      const links: Record<string, string | undefined> = {};
      for (const [k, val] of Object.entries(a.links)) {
        const u = clean(val, 600);
        if (u && !/^https?:\/\//.test(u)) throw new Error("Links must start with https://");
        links[k] = u || undefined;
      }
      p.links = { ...(l.links ?? {}), ...links };
    }
    await ctx.db.patch(id, p);
    // New website link / MLS # / address → re-match Google Analytics pages.
    if ((p.links && p.links.website !== l.links?.website) || (p.mlsNumber !== undefined && p.mlsNumber !== l.mlsNumber) || (p.addressKey && p.addressKey !== l.addressKey)) {
      await ctx.scheduler.runAfter(0, internal.listingAds.refreshWeb, { listingId: id });
    }
    if ((p.addressKey && p.addressKey !== l.addressKey) || (p.liveDate !== undefined && p.liveDate !== l.liveDate)) {
      await ctx.scheduler.runAfter(0, internal.zillow.rollupListing, { listingId: id });
    }
    if ((p.links && p.links.reel !== l.links?.reel) || (p.addressKey && p.addressKey !== l.addressKey)) {
      if (p.links && !p.links.reel && l.reelAuto) await ctx.db.patch(id, { reelAuto: undefined });
      await ctx.scheduler.runAfter(0, internal.reels.refresh, { listingId: id });
    }
    if ((p.links && p.links.youtube !== l.links?.youtube) || (p.addressKey && p.addressKey !== l.addressKey)) {
      if (p.links && !p.links.youtube && l.ytAuto) await ctx.db.patch(id, { ytAuto: undefined });
      await ctx.scheduler.runAfter(0, internal.youtube.refresh, { listingId: id });
    }
    if ((p.addressKey && p.addressKey !== l.addressKey) || (p.status && p.status !== l.status)) {
      await ctx.scheduler.runAfter(0, internal.paidAds.refresh, { listingId: id });
    }
    // Seller email/phone added or changed and not linked to Lofty yet → link now.
    const contactChanged = (p.sellerEmail !== undefined && p.sellerEmail !== l.sellerEmail) || (p.sellerPhone !== undefined && p.sellerPhone !== l.sellerPhone);
    // A changed contact means a different person, so drop any old link and look up again.
    if (contactChanged && (p.sellerEmail ?? l.sellerEmail ?? p.sellerPhone ?? l.sellerPhone)) {
      if (l.loftyLeadId) await ctx.db.patch(id, { loftyLeadId: undefined, loftyError: undefined });
      await ctx.scheduler.runAfter(0, internal.lofty.syncListingSeller, { id });
    }
    return null;
  },
});

/** "Link to Lofty" / "Try again" button on the listing page. */
export const linkLofty = authenticatedMutation({
  args: { id: v.id("listings") },
  handler: async (ctx, { id }) => {
    const { l } = await mine(ctx, ctx.userId, id);
    if (!l.sellerEmail && !l.sellerPhone) throw new Error("Add the seller's email or phone first");
    await ctx.db.patch(id, { loftyError: undefined, loftyAt: undefined });
    await ctx.scheduler.runAfter(0, internal.lofty.syncListingSeller, { id, force: !!l.loftyLeadId });
    return null;
  },
});

/** Split a listing address into form fields ("2147 W Thomas St #2, Chicago, IL 60622"). */
export function splitListingAddress(address: string) {
  const s = (address ?? "").trim();
  const zip = s.match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1] ?? "";
  let rest = zip ? s.replace(/[,\s]*\d{5}(?:-\d{4})?\s*$/, "") : s;
  const st = rest.match(/[,\s]+([A-Za-z]{2})\.?\s*$/);
  const state = st && /^(il|in|wi|mi|ia|mo)$/i.test(st[1]) ? st[1].toUpperCase() : "IL";
  if (st && /^(il|in|wi|mi|ia|mo)$/i.test(st[1])) rest = rest.slice(0, st.index);
  const parts = rest.split(",").map(x => x.trim()).filter(Boolean);
  let street = parts.shift() ?? "";
  let unit = "";
  const um = street.match(/\s*(?:#|\bunit\b|\bapt\.?\b|\bsuite\b)\s*([\w-]+)\s*$/i);
  if (um) { unit = um[1].toUpperCase(); street = street.slice(0, um.index).trim(); }
  return { street, unit, city: parts.join(" "), state, zip };
}

/** Listings for the "Pick a listing" box in CMA, Reel Studio and Seller lists. */
export const pickList = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await who(ctx, ctx.userId);
    const rows = me.staff
      ? await ctx.db.query("listings").order("desc").take(300)
      : await ctx.db.query("listings").withIndex("by_agent", q => q.eq("agentEmail", me.email)).order("desc").take(300);
    const rank: Record<string, number> = { Active: 0, "Coming soon": 1, Preparing: 2, "Under contract": 3, Closed: 4, Withdrawn: 5 };
    return rows
      .map(l => ({
        _id: l._id, address: formatFreeAddress(l.address), ...splitListingAddress(formatFreeAddress(l.address)),
        mlsNumber: l.mlsNumber ?? "", price: l.price ?? "", status: l.status, agentName: l.agentName, agentEmail: l.agentEmail,
        sellerName: l.sellerName, sellerEmail: l.sellerEmail ?? "", sellerPhone: l.sellerPhone ?? "", photoUrl: l.photoUrl ?? "",
        zillow: l.links?.zillow ?? "", website: l.links?.website ?? "",
      }))
      .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
  },
});

export const toggleStep = authenticatedMutation({
  args: { id: v.id("listings"), key: v.string(), done: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, { id, key, done, note }) => {
    const { l } = await mine(ctx, ctx.userId, id);
    const now = Date.now();
    const steps = l.steps.map(s => (s.key === key ? { key, done, doneAt: done ? now : undefined, note: note !== undefined ? opt(note, 300) : s.note } : s));
    const p: Partial<Doc<"listings">> = { steps, updatedAt: now };
    if (key === "comingSoon" && done && l.status === "Preparing") p.status = "Coming soon";
    if (key === "mls" && done) {
      if (!l.liveDate) p.liveDate = new Date(now - 5 * 36e5).toISOString().slice(0, 10); // Chicago date
      if (l.status === "Preparing" || l.status === "Coming soon") p.status = "Active";
    }
    await ctx.db.patch(id, p);
    return null;
  },
});

const num = v.optional(v.number());
export const saveMetrics = authenticatedMutation({
  args: {
    id: v.id("listings"), weekOf: v.string(), zillowViews: num, zillowSaves: num, mlsSaved: num, mlsMaybe: num, mlsNotInterested: num, adViews: num, adClicks: num, reelViews: num,
    tiktokViews: num, fbViews: num, youtubeViews: num, tiktokLink: v.optional(v.string()), facebookLink: v.optional(v.string()),
  },
  handler: async (ctx, { id, weekOf: wk, tiktokLink, facebookLink, ...n }) => {
    const { me, l } = await mine(ctx, ctx.userId, id);
    if (tiktokLink !== undefined || facebookLink !== undefined) {
      const links = { ...(l.links ?? {}) };
      for (const [k, raw] of [["tiktok", tiktokLink], ["facebook", facebookLink]] as const) {
        if (raw === undefined) continue;
        const u = clean(raw, 600);
        if (u && !/^https?:\/\//.test(u)) throw new Error("Links must start with https://");
        links[k] = u || undefined;
      }
      await ctx.db.patch(id, { links });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(wk)) throw new Error("Bad week");
    for (const val of Object.values(n)) if (val !== undefined && (val < 0 || val > 1e7 || !Number.isFinite(val))) throw new Error("Numbers look off");
    const cur = await ctx.db.query("listingMetrics").withIndex("by_listing_week", q => q.eq("listingId", id).eq("weekOf", wk)).first();
    // Numbers filled automatically (Zillow emails, Instagram) are kept as-is.
    const auto = cur?.auto ?? [];
    if (auto.includes("zillow")) { n.zillowViews = cur?.zillowViews; n.zillowSaves = cur?.zillowSaves; }
    if (auto.includes("reel")) n.reelViews = cur?.reelViews;
    if (auto.includes("youtube")) n.youtubeViews = cur?.youtubeViews;
    const row = { ...n, ...(auto.length ? { auto, zillowDays: cur?.zillowDays } : {}), enteredByEmail: me.email, updatedAt: Date.now() };
    if (cur) await ctx.db.replace(cur._id, { listingId: id, weekOf: wk, ...row });
    else await ctx.db.insert("listingMetrics", { listingId: id, weekOf: wk, ...row });
    await touch(ctx, id);
    return null;
  },
});

export const addEvent = authenticatedMutation({
  args: { id: v.id("listings"), kind: v.union(v.literal("update"), v.literal("offer"), v.literal("showing"), v.literal("feedback")), title: v.string(), body: v.optional(v.string()), when: v.optional(v.string()) },
  handler: async (ctx, { id, kind, title, body, when }) => {
    await mine(ctx, ctx.userId, id);
    const t = clean(title, 140);
    if (!t) throw new Error("Add a short title");
    await ctx.db.insert("listingEvents", { listingId: id, kind, status: "published", title: t, body: opt(body, 2000), when: opt(when, 80), source: "agent", createdAt: Date.now() });
    await touch(ctx, id);
    return null;
  },
});

export const setEventStatus = authenticatedMutation({
  args: { eventId: v.id("listingEvents"), status: v.union(v.literal("published"), v.literal("hidden"), v.literal("pending")), body: v.optional(v.string()) },
  handler: async (ctx, { eventId, status, body }) => {
    const e = await ctx.db.get(eventId);
    if (!e) throw new Error("Not found");
    await mine(ctx, ctx.userId, e.listingId);
    await ctx.db.patch(eventId, { status, ...(body !== undefined ? { body: opt(body, 2000) } : {}) });
    await touch(ctx, e.listingId);
    return null;
  },
});

export const removeEvent = authenticatedMutation({
  args: { eventId: v.id("listingEvents") },
  handler: async (ctx, { eventId }) => {
    const e = await ctx.db.get(eventId);
    if (!e) return null;
    await mine(ctx, ctx.userId, e.listingId);
    await ctx.db.delete(eventId);
    await touch(ctx, e.listingId);
    return null;
  },
});

// Agent pastes a ShowingTime email (fallback when the forward rule isn't set).
export const addParsedShowing = authenticatedMutation({
  args: { id: v.id("listings"), parsed: v.string() },
  handler: async (ctx, { id, parsed }) => {
    await mine(ctx, ctx.userId, id);
    const p = JSON.parse(parsed) as ParsedShowing;
    await insertShowingEvent(ctx, id, p, undefined);
    await touch(ctx, id);
    return null;
  },
});

export const rotateLink = authenticatedMutation({
  args: { id: v.id("listings") },
  handler: async (ctx, { id }) => {
    await mine(ctx, ctx.userId, id);
    await ctx.db.patch(id, { token: newToken(), updatedAt: Date.now() });
    return null;
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id("listings") },
  handler: async (ctx, { id }) => {
    await mine(ctx, ctx.userId, id);
    for (const e of await ctx.db.query("listingEvents").withIndex("by_listing", q => q.eq("listingId", id)).collect()) await ctx.db.delete(e._id);
    for (const m of await ctx.db.query("listingMetrics").withIndex("by_listing_week", q => q.eq("listingId", id)).collect()) await ctx.db.delete(m._id);
    for (const a of await ctx.db.query("listingAds").withIndex("by_listing", q => q.eq("listingId", id)).collect()) await ctx.db.delete(a._id);
    for (const s of await ctx.db.query("listingSuggestions").withIndex("by_listing", q => q.eq("listingId", id)).collect()) await ctx.db.delete(s._id);
    await ctx.db.delete(id);
    return null;
  },
});

export const unmatchedShowings = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await who(ctx, ctx.userId);
    if (!me.staff) return [];
    return await ctx.db.query("showingInbox").order("desc").take(50);
  },
});

export const assignUnmatched = authenticatedMutation({
  args: { inboxId: v.id("showingInbox"), listingId: v.id("listings") },
  handler: async (ctx, { inboxId, listingId }) => {
    const me = await who(ctx, ctx.userId);
    if (!me.staff) throw new Error("Only admins or ops");
    const row = await ctx.db.get(inboxId);
    if (!row) return null;
    await insertShowingEvent(ctx, listingId, JSON.parse(row.parsed) as ParsedShowing, row.externalId);
    await ctx.db.delete(inboxId);
    await touch(ctx, listingId);
    return null;
  },
});

// ---------- ShowingTime ingestion ----------

async function insertShowingEvent(ctx: MutationCtx, listingId: Id<"listings">, p: ParsedShowing, externalId: string | undefined) {
  if (p.kind === "feedback") {
    const parts = [p.interest && `Interest: ${p.interest}`, p.priceOpinion && `Price: ${p.priceOpinion}`, p.rating && `Rating: ${p.rating}/5`].filter(Boolean);
    await ctx.db.insert("listingEvents", {
      listingId, kind: "feedback", status: "pending", title: "Showing feedback",
      body: p.comments, interest: p.interest, priceOpinion: p.priceOpinion, rating: p.rating, when: p.when,
      agentOnly: [p.buyerAgent && `Buyer's agent: ${p.buyerAgent}`, parts.join(" · ")].filter(Boolean).join("\n") || undefined,
      source: externalId ? "showingtime" : "agent", externalId, createdAt: Date.now(),
    });
    return "feedback";
  }
  await ctx.db.insert("listingEvents", {
    listingId, kind: p.kind, status: "published", title: p.kind === "showing" ? "Showing scheduled" : "Showing cancelled",
    when: p.when, source: externalId ? "showingtime" : "agent", externalId, createdAt: Date.now(),
  });
  return p.kind;
}

export const ingestShowing = internalMutation({
  args: { externalId: v.string(), subject: v.string(), parsed: v.string() },
  handler: async (ctx, { externalId, subject, parsed }) => {
    await syncRoster(ctx);
    if (await ctx.db.query("listingEvents").withIndex("by_external", q => q.eq("externalId", externalId)).first()) return { status: "dup" };
    if (await ctx.db.query("showingInbox").withIndex("by_external", q => q.eq("externalId", externalId)).first()) return { status: "dup" };
    const p = JSON.parse(parsed) as ParsedShowing;
    let l: Doc<"listings"> | null = null;
    if (p.mls) l = await ctx.db.query("listings").withIndex("by_mls", q => q.eq("mlsNumber", p.mls)).first();
    if (!l && p.address) l = await ctx.db.query("listings").withIndex("by_addressKey", q => q.eq("addressKey", addressKey(p.address))).first();
    if (!l) {
      await ctx.db.insert("showingInbox", { externalId, subject: subject.slice(0, 200), address: p.address, mls: p.mls, parsed, createdAt: Date.now() });
      return { status: "unmatched" };
    }
    const kind = await insertShowingEvent(ctx, l._id, p, externalId);
    await touch(ctx, l._id);
    if (kind === "feedback") await ctx.scheduler.runAfter(0, internal.listingMail.feedbackToReview, { listingId: l._id });
    return { status: "matched", kind };
  },
});

// ---------- Seller side (public, token-gated) ----------

export const portal = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await syncRoster(ctx);
    if (token.length < 20) return null;
    const l = await ctx.db.query("listings").withIndex("by_token", q => q.eq("token", token)).first();
    if (!l) return null;
    const events = await ctx.db.query("listingEvents").withIndex("by_listing", q => q.eq("listingId", l._id)).order("desc").collect();
    const metrics = (await ctx.db.query("listingMetrics").withIndex("by_listing_week", q => q.eq("listingId", l._id)).collect()).sort((a, b) => a.weekOf.localeCompare(b.weekOf));
    const oh = await openHouseSignins(ctx, l);
    const agent = agentByEmail(l.agentEmail);
    const pub = events.filter(e => e.status === "published");
    const lastActivity = Math.max(l.updatedAt, ...events.map(e => e.createdAt), ...metrics.map(m => m.updatedAt));
    return {
      address: formatFreeAddress(l.address), price: formatPrice(l.price) || undefined, status: l.status, photoUrl: l.photoUrl, liveDate: l.liveDate, links: l.links ?? {},
      sellerFirstName: l.sellerName.split(/\s+/)[0],
      agent: { name: l.agentName, phone: agent?.phone, email: agent?.email },
      steps: l.steps.map(s => ({ key: s.key, done: s.done, doneAt: s.doneAt, note: s.note })),
      metrics: metrics.map(m => ({ weekOf: m.weekOf, zillowViews: m.zillowViews, zillowSaves: m.zillowSaves, mlsSaved: m.mlsSaved, mlsMaybe: m.mlsMaybe, mlsNotInterested: m.mlsNotInterested, adViews: m.adViews, adClicks: m.adClicks, reelViews: m.reelViews, tiktokViews: m.tiktokViews, fbViews: m.fbViews, youtubeViews: m.youtubeViews, auto: m.auto ?? [], updatedAt: m.updatedAt })),
      counts: {
        showings: events.filter(e => e.kind === "showing").length - events.filter(e => e.kind === "cancelled").length,
        feedback: pub.filter(e => e.kind === "feedback").length,
        openHouse: oh.length,
      },
      events: pub.filter(e => e.kind !== "cancelled").slice(0, 60).map(e => ({ _id: e._id, kind: e.kind, title: e.title, body: e.body, interest: e.interest, priceOpinion: e.priceOpinion, rating: e.rating, when: e.when, createdAt: e.createdAt })),
      ads: await publicAds(ctx, l._id),
      social: {
        reelCheckedAt: l.reelAuto?.checkedAt,
        youtubeCheckedAt: l.ytAuto?.checkedAt,
      },
      suggestions: await publicSuggestions(ctx, l._id),
      zillowTotals: l.zillowPage ? { views: l.zillowPage.views, saves: l.zillowPage.saves } : undefined,
      updatedAt: lastActivity,
    };
  },
});

export const seen = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await syncRoster(ctx);
    if (token.length < 20) return null;
    const l = await ctx.db.query("listings").withIndex("by_token", q => q.eq("token", token)).first();
    if (l && (!l.sellerLastSeenAt || Date.now() - l.sellerLastSeenAt > 10 * 60e3)) await ctx.db.patch(l._id, { sellerLastSeenAt: Date.now() });
    return null;
  },
});

// ---------- For scheduled mail ----------

export const forDigest = internalQuery({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const wk = weekOf(Date.now());
    const prev = weekOf(Date.now() - 7 * 864e5);
    const rows = (await ctx.db.query("listings").collect()).filter(l => l.status === "Active" || l.status === "Coming soon");
    const out = [];
    for (const l of rows) {
      const m = await ctx.db.query("listingMetrics").withIndex("by_listing_week", q => q.eq("listingId", l._id)).collect();
      const ev = await ctx.db.query("listingEvents").withIndex("by_listing", q => q.eq("listingId", l._id)).collect();
      const weekAgo = Date.now() - 7 * 864e5;
      out.push({
        _id: l._id, address: l.address, agentEmail: l.agentEmail, agentName: l.agentName, sellerName: l.sellerName,
        sellerEmail: l.sellerEmail, weeklyEmail: l.weeklyEmail, token: l.token,
        hasThisWeek: m.some(x => x.weekOf === wk && x.enteredByEmail !== "auto"), last: m.find(x => x.weekOf === prev) ?? m.sort((a, b) => b.weekOf.localeCompare(a.weekOf))[0],
        showings7: ev.filter(e => e.kind === "showing" && e.createdAt > weekAgo).length,
        feedback7: ev.filter(e => e.kind === "feedback" && e.status === "published" && e.createdAt > weekAgo).length,
        stepsDone: l.steps.filter(s => s.done).length, stepsTotal: l.steps.length,
      });
    }
    return out;
  },
});

export const forReviewMail = internalQuery({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }) => {
    await syncRoster(ctx);
    const l = await ctx.db.get(listingId);
    if (!l) return null;
    const pending = (await ctx.db.query("listingEvents").withIndex("by_listing", q => q.eq("listingId", listingId)).collect()).filter(e => e.status === "pending");
    return { address: l.address, agentEmail: l.agentEmail, pending: pending.length };
  },
});
