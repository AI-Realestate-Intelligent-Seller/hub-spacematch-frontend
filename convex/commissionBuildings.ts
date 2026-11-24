// 100% commission rentals: Chicago rental buildings that pay the tenant's agent a full month's rent or more.
// Any signed-in agent can add a building; staff (admins + ops) put the Verified stamp on it.
// Second list, "Doesn't pay" (status "no_pay"): buildings that pay no broker commission, pay under a full
// month, or did not pay an agent on a deal. Same rules: agents add with how they know, the office confirms.
// Nothing here is AI: it is a plain directory. Seed rows come from the management companies' own
// broker pages (see importMany) and carry the page they were checked against.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { OPS_EMAILS } from "./agentsData";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { hubUrl, sendMail, shell, table } from "./notify";

export const MIN_PCT = 100;
export const MAX_PCT = 400;
export const VERIFY_HOW = [
  "Building's own broker page",
  "Broker email or flyer from the building",
  "Called the leasing office",
  "We were paid this on a deal",
] as const;
// "Doesn't pay" list: how the office confirmed it.
export const CONFIRM_HOW = [
  "Building's own website or broker page",
  "Email from the building",
  "Called the leasing office",
  "Happened on one of our deals",
] as const;
export const NO_PAY_REASONS = ["none", "under", "unpaid"] as const;
type NoPayReason = (typeof NO_PAY_REASONS)[number];
const listName = (noPay: boolean) => (noPay ? "the list under Doesn't pay" : "the list");

async function me(ctx: QueryCtx, userId: Doc<"users">["_id"]) {
  const h = await hubViewer(ctx, userId);
  return { email: h.email, name: h.name, isAdmin: h.isAdmin, canVerify: h.isAdmin || h.isOps };
}

const SUFFIX: Record<string, string> = {
  street: "st", avenue: "ave", av: "ave", road: "rd", drive: "dr", place: "pl", court: "ct", boulevard: "blvd",
  parkway: "pkwy", terrace: "ter", lane: "ln", north: "n", south: "s", east: "e", west: "w",
};
// "1212 S. Michigan Avenue, Chicago" and "1212 s michigan ave" are the same building.
export function buildingKey(address: string): string {
  return address
    .toLowerCase()
    .split(",")[0]
    .replace(/[.#]/g, "")
    .replace(/\b(apt|unit|suite|ste)\b.*$/, "")
    .split(/\s+/)
    .filter(Boolean)
    .map(w => SUFFIX[w] ?? w)
    .join(" ");
}

const text = (max: number) => (s?: string) => s?.trim().slice(0, max) || undefined;
const short = text(160);
const long = text(1500);
const link = (s?: string) => {
  const u = s?.trim();
  if (!u) return undefined;
  const full = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  return full.slice(0, 400);
};

const fields = {
  name: v.string(),
  address: v.string(),
  neighborhood: v.optional(v.string()),
  manager: v.optional(v.string()),
  commissionPct: v.number(),
  status: v.optional(v.union(v.literal("pays"), v.literal("no_pay"))),
  noPayReason: v.optional(v.union(v.literal("none"), v.literal("under"), v.literal("unpaid"))),
  bonus: v.optional(v.string()),
  keyRule: v.optional(v.string()),
  terms: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  brokerUrl: v.optional(v.string()),
  website: v.optional(v.string()),
  sourceNote: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  offerEnds: v.optional(v.string()),
};
type Fields = {
  name: string; address: string; neighborhood?: string; manager?: string; commissionPct: number; bonus?: string;
  status?: "pays" | "no_pay"; noPayReason?: NoPayReason;
  keyRule?: string; terms?: string; phone?: string; email?: string; brokerUrl?: string; website?: string;
  sourceNote?: string; sourceUrl?: string; offerEnds?: string;
};

function clean(a: Fields) {
  const name = a.name.trim().slice(0, 120);
  const address = a.address.trim().replace(/\s+/g, " ").slice(0, 200);
  if (!address) throw new Error("Add the building's street address");
  if (!/\d/.test(address)) throw new Error("The address needs a street number");
  const noPay = a.status === "no_pay";
  const reason: NoPayReason | undefined = noPay ? a.noPayReason ?? "none" : undefined;
  let pct = Math.round(a.commissionPct);
  if (noPay) {
    // Only "pays less than a full month" carries a percent; the other two reasons are 0.
    if (reason !== "under") pct = 0;
    else if (!Number.isFinite(pct) || pct < 1 || pct >= MIN_PCT) throw new Error("Enter what it pays as a percent of one month's rent, from 1 to 99. If it pays 100% or more, add it to the 100% list");
  } else {
    if (!Number.isFinite(pct) || pct < MIN_PCT) throw new Error("This list is only for buildings paying 100% of a month's rent or more. If it pays less, add it under Doesn't pay");
    if (pct > MAX_PCT) throw new Error(`${pct}% looks too high. Enter the percent of one month's rent (100 = a full month)`);
  }
  const offerEnds = a.offerEnds && /^\d{4}-\d{2}-\d{2}$/.test(a.offerEnds) ? a.offerEnds : undefined;
  return {
    name: name || address.split(",")[0],
    address,
    addressKey: buildingKey(address),
    neighborhood: short(a.neighborhood),
    manager: short(a.manager),
    commissionPct: pct,
    status: noPay ? ("no_pay" as const) : ("pays" as const),
    noPayReason: reason,
    bonus: noPay ? undefined : short(a.bonus),
    keyRule: short(a.keyRule),
    terms: long(a.terms),
    phone: short(a.phone),
    email: short(a.email),
    brokerUrl: link(a.brokerUrl),
    website: link(a.website),
    sourceNote: text(400)(a.sourceNote),
    sourceUrl: link(a.sourceUrl),
    offerEnds: noPay ? undefined : offerEnds,
  };
}

export const list = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const viewer = await me(ctx, ctx.userId);
    const all = await ctx.db.query("commissionBuildings").collect();
    return {
      viewer,
      verifyHow: VERIFY_HOW,
      confirmHow: CONFIRM_HOW,
      buildings: all.filter(b => viewer.canVerify || !b.hidden),
    };
  },
});

export const add = authenticatedMutation({
  args: { ...fields, verify: v.optional(v.boolean()), verifiedHow: v.optional(v.string()) },
  handler: async (ctx, { verify, verifiedHow, ...args }) => {
    const viewer = await me(ctx, ctx.userId);
    const row = clean(args);
    if (!row.sourceNote && !row.sourceUrl) throw new Error("Tell the team how you know: a link, a broker email, a call or a deal you closed there");
    const dup = await ctx.db.query("commissionBuildings").withIndex("by_key", q => q.eq("addressKey", row.addressKey)).first();
    if (dup) throw new Error(`${dup.name} at ${dup.address.split(",")[0]} is already on ${listName(dup.status === "no_pay")}`);
    const stamp = !!verify && viewer.canVerify;
    const id = await ctx.db.insert("commissionBuildings", {
      ...row,
      verified: stamp,
      ...(stamp
        ? { verifiedAt: Date.now(), verifiedByName: viewer.name, verifiedByEmail: viewer.email, verifiedHow: short(verifiedHow) }
        : {}),
      hidden: false,
      addedByEmail: viewer.email,
      addedByName: viewer.name,
      createdAt: Date.now(),
    });
    if (!stamp) await ctx.scheduler.runAfter(0, internal.commissionBuildings.notifyStaff, { id, kind: "added" });
    return id;
  },
});

export const update = authenticatedMutation({
  args: { id: v.id("commissionBuildings"), ...fields },
  handler: async (ctx, { id, ...args }) => {
    const viewer = await me(ctx, ctx.userId);
    const b = await ctx.db.get(id);
    if (!b) throw new Error("Not found");
    const own = b.addedByEmail === viewer.email;
    if (!viewer.canVerify && !own) throw new Error("Only the agent who added it or the office can edit this. Use Report a change instead");
    if (!viewer.canVerify && b.verified) throw new Error("This one is verified. Use Report a change and the office will update it");
    const row = clean({ ...args, status: args.status ?? b.status ?? "pays", noPayReason: args.noPayReason ?? b.noPayReason });
    // Moving a building between the two lists is the office's call, and the old stamp no longer says what was checked.
    const moved = row.status !== (b.status ?? "pays");
    if (moved && !viewer.canVerify) throw new Error("Only the office can move a building to the other list. Use Report a change instead");
    if (row.addressKey !== b.addressKey) {
      const dup = await ctx.db.query("commissionBuildings").withIndex("by_key", q => q.eq("addressKey", row.addressKey)).first();
      if (dup) throw new Error(`${dup.name} is already on the list at that address`);
    }
    // patch() keeps a field when the value is undefined, so cleared inputs are written as explicit removals.
    await ctx.db.replace(id, {
      ...row,
      verified: moved ? false : b.verified,
      verifiedAt: moved ? undefined : b.verifiedAt,
      verifiedByName: moved ? undefined : b.verifiedByName,
      verifiedByEmail: moved ? undefined : b.verifiedByEmail,
      verifiedHow: moved ? undefined : b.verifiedHow,
      flagNote: b.flagNote,
      flaggedByName: b.flaggedByName,
      flaggedAt: b.flaggedAt,
      hidden: b.hidden,
      addedByEmail: b.addedByEmail,
      addedByName: b.addedByName,
      createdAt: b.createdAt,
    });
    return null;
  },
});

// Staff only: put the stamp on (with how it was confirmed) or take it off. Stamping clears any open report.
export const verify = authenticatedMutation({
  args: { id: v.id("commissionBuildings"), verified: v.boolean(), how: v.optional(v.string()) },
  handler: async (ctx, { id, verified, how }) => {
    const viewer = await me(ctx, ctx.userId);
    if (!viewer.canVerify) throw new Error("Only Michael, Brandon, Sergio, Cris or Anthony can verify a building");
    const b = await ctx.db.get(id);
    if (!b) throw new Error("Not found");
    if (verified) {
      const h = short(how);
      if (!h) throw new Error("Say how you confirmed it");
      await ctx.db.patch(id, {
        verified: true, verifiedAt: Date.now(), verifiedByName: viewer.name, verifiedByEmail: viewer.email, verifiedHow: h,
        flagNote: undefined, flaggedByName: undefined, flaggedAt: undefined,
      });
    } else {
      await ctx.db.patch(id, { verified: false, verifiedAt: undefined, verifiedByName: undefined, verifiedByEmail: undefined, verifiedHow: undefined });
    }
    return null;
  },
});

// Any agent: "this changed" (commission dropped, promo ended, building sold). Everyone sees the note until staff re-check.
export const report = authenticatedMutation({
  args: { id: v.id("commissionBuildings"), note: v.string() },
  handler: async (ctx, { id, note }) => {
    const viewer = await me(ctx, ctx.userId);
    const b = await ctx.db.get(id);
    if (!b) throw new Error("Not found");
    const n = note.trim().slice(0, 400);
    if (n.length < 4) throw new Error("Say what changed");
    await ctx.db.patch(id, { flagNote: n, flaggedByName: viewer.name, flaggedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.commissionBuildings.notifyStaff, { id, kind: "reported" });
    return null;
  },
});

export const moderate = authenticatedMutation({
  args: { id: v.id("commissionBuildings"), hidden: v.optional(v.boolean()), clearReport: v.optional(v.boolean()), remove: v.optional(v.boolean()) },
  handler: async (ctx, { id, hidden, clearReport, remove }) => {
    const viewer = await me(ctx, ctx.userId);
    const b = await ctx.db.get(id);
    if (!b) throw new Error("Not found");
    if (remove) {
      const ownUnverified = b.addedByEmail === viewer.email && !b.verified;
      if (!viewer.canVerify && !ownUnverified) throw new Error("Only the office can remove this building");
      await ctx.db.delete(id);
      return null;
    }
    if (!viewer.canVerify) throw new Error("Only the office can do that");
    await ctx.db.patch(id, {
      ...(hidden !== undefined ? { hidden } : {}),
      ...(clearReport ? { flagNote: undefined, flaggedByName: undefined, flaggedAt: undefined } : {}),
    });
    return null;
  },
});

export const forMail = internalQuery({
  args: { id: v.id("commissionBuildings") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

// One short email to Cris + Anthony when a building needs their stamp or an agent reports a change.
export const notifyStaff = internalAction({
  args: { id: v.id("commissionBuildings"), kind: v.union(v.literal("added"), v.literal("reported")) },
  handler: async (ctx, { id, kind }) => {
    const b = await ctx.runQuery(internal.commissionBuildings.forMail, { id });
    if (!b) return;
    const added = kind === "added";
    const noPay = b.status === "no_pay";
    const pays = noPay
      ? b.noPayReason === "under" ? `Pays ${b.commissionPct}% of one month's rent (under a full month)` : b.noPayReason === "unpaid" ? "Didn't pay on a deal" : "No broker commission"
      : `${b.commissionPct}% of one month's rent${b.bonus ? ` + ${b.bonus}` : ""}`;
    const title = added
      ? noPay ? `${b.addedByName} added a building that doesn't pay` : `${b.addedByName} added a 100% commission building`
      : `${b.flaggedByName ?? "An agent"} reported a change at ${b.name}`;
    const html = shell(
      title,
      `<p style="color:#3d3a35;font-size:15px">${added
        ? noPay
          ? "Confirm it with the building (their website, an email or a call), then tap Confirm so agents see the stamp."
          : "Confirm it with the building (broker page, flyer or a call), then tap Verify so agents see the stamp."
        : "Re-check it with the building. Stamp it again if nothing changed, or edit, move or remove it."}</p>` +
        table([
          ["Building", `${b.name} · ${b.address}`],
          ["List", noPay ? "Doesn't pay" : "Pays 100% or more"],
          ["Commission", pays],
          ["Managed by", b.manager ?? ""],
          [added ? "How they know" : "What changed", (added ? [b.sourceNote, b.sourceUrl].filter(Boolean).join(" · ") : b.flagNote) ?? ""],
        ]),
      { href: `${hubUrl()}/commission-rentals?b=${id}${noPay ? "&list=nopay" : ""}`, label: "Open the building" },
    );
    for (const to of OPS_EMAILS) {
      try {
        await sendMail(to, title, html);
      } catch (e) {
        console.error("commission building mail", String(e));
      }
    }
  },
});

// Seed / bulk import (run by Viktor with run_app_function). Skips addresses already listed.
// Rows are only stamped Verified when verifiedHow + sourceUrl say what they were checked against.
export const importMany = internalMutation({
  args: {
    buildings: v.array(v.object({ ...fields, verifiedHow: v.optional(v.string()), checkedAt: v.optional(v.number()) })),
    addedByName: v.optional(v.string()),
  },
  handler: async (ctx, { buildings, addedByName }) => {
    let added = 0;
    let skipped = 0;
    for (const { verifiedHow, checkedAt, ...raw } of buildings) {
      const row = clean(raw);
      const dup = await ctx.db.query("commissionBuildings").withIndex("by_key", q => q.eq("addressKey", row.addressKey)).first();
      if (dup) { skipped++; continue; }
      const stamp = !!verifiedHow && !!row.sourceUrl;
      await ctx.db.insert("commissionBuildings", {
        ...row,
        verified: stamp,
        ...(stamp ? { verifiedAt: checkedAt ?? Date.now(), verifiedByName: "SpaceMatch office", verifiedByEmail: "team@spacematchinc.com", verifiedHow } : {}),
        hidden: false,
        addedByEmail: "team@spacematchinc.com",
        addedByName: addedByName ?? "SpaceMatch office",
        createdAt: Date.now(),
      });
      added++;
    }
    return { added, skipped };
  },
});

// e2e cleanup on dev: removes rows a test added (name starts with "E2E ").
export const removeTestRows = internalMutation({
  args: {},
  handler: async ctx => {
    let n = 0;
    for (const b of await ctx.db.query("commissionBuildings").collect()) {
      if (b.name.startsWith("E2E ")) { await ctx.db.delete(b._id); n++; }
    }
    return n;
  },
});
