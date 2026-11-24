import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { agentByEmail, isAdminEmail } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";


async function me(ctx: QueryCtx, userId: Doc<"users">["_id"]) {
  const user = await ctx.db.get(userId);
  const email = (user?.email ?? "").toLowerCase();
  return { email, name: agentByEmail(email)?.name ?? user?.name ?? email, isAdmin: isAdminEmail(email) };
}

const fields = {
  name: v.string(),
  company: v.optional(v.string()),
  category: v.string(),
  subcategory: v.optional(v.string()),
  description: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  website: v.optional(v.string()),
  address: v.optional(v.string()),
  areas: v.optional(v.string()),
  languages: v.optional(v.string()),
  perk: v.optional(v.string()),
  private: v.boolean(),
};

const trimAll = (a: Record<string, unknown>) => {
  const o: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(a)) o[k] = typeof val === "string" ? val.trim().slice(0, 2000) || undefined : val;
  return o;
};

export const list = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const viewer = await me(ctx, ctx.userId);
    const all = await ctx.db.query("vendors").collect();
    const reviews = await ctx.db.query("vendorReviews").collect();
    const visible = all.filter(
      x => (viewer.isAdmin || !x.hidden) && (!x.private || x.addedByEmail === viewer.email || viewer.isAdmin),
    );
    return {
      viewer,
      vendors: visible.map(x => {
        const rs = reviews.filter(r => r.vendorId === x._id);
        return {
          ...x,
          ratingCount: rs.length,
          rating: rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : null,
          myRating: rs.find(r => r.userEmail === viewer.email)?.rating ?? null,
          notes: rs.filter(r => r.note).map(r => ({ by: r.userName, note: r.note!, rating: r.rating })),
        };
      }),
    };
  },
});

export const add = authenticatedMutation({
  args: fields,
  handler: async (ctx, args) => {
    const viewer = await me(ctx, ctx.userId);
    if (!args.name.trim()) throw new Error("Name is required");
    if (!args.phone?.trim() && !args.email?.trim() && !args.website?.trim()) {
      throw new Error("Add a phone, email or website so agents can reach them");
    }
    return await ctx.db.insert("vendors", {
      ...(trimAll(args) as typeof args),
      name: args.name.trim(),
      category: args.category,
      private: args.private,
      preferred: false,
      hidden: false,
      addedByEmail: viewer.email,
      addedByName: viewer.name,
      source: "agent",
    });
  },
});

export const update = authenticatedMutation({
  args: { id: v.id("vendors"), ...fields },
  handler: async (ctx, { id, ...args }) => {
    const viewer = await me(ctx, ctx.userId);
    const x = await ctx.db.get(id);
    if (!x) throw new Error("Not found");
    if (!viewer.isAdmin && x.addedByEmail !== viewer.email) throw new Error("Only the person who added this vendor (or Michael) can edit it");
    await ctx.db.patch(id, { ...(trimAll(args) as typeof args), name: args.name.trim(), private: args.private });
    return null;
  },
});

export const moderate = authenticatedMutation({
  args: {
    id: v.id("vendors"),
    preferred: v.optional(v.boolean()),
    hidden: v.optional(v.boolean()),
    onWebsite: v.optional(v.boolean()),
    remove: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, preferred, hidden, onWebsite, remove }) => {
    const viewer = await me(ctx, ctx.userId);
    const x = await ctx.db.get(id);
    if (!x) throw new Error("Not found");
    const own = x.addedByEmail === viewer.email;
    if (remove) {
      if (!viewer.isAdmin && !own) throw new Error("Only admins can remove other agents' vendors");
      for (const r of await ctx.db.query("vendorReviews").withIndex("by_vendor", q => q.eq("vendorId", id)).collect()) {
        await ctx.db.delete(r._id);
      }
      await ctx.db.delete(id);
      return null;
    }
    if (!viewer.isAdmin) throw new Error("Only admins can mark Preferred or hide vendors");
    await ctx.db.patch(id, {
      ...(preferred !== undefined ? { preferred } : {}),
      ...(hidden !== undefined ? { hidden } : {}),
      ...(onWebsite !== undefined ? { onWebsite } : {}),
    });
    return null;
  },
});

export const rate = authenticatedMutation({
  args: { id: v.id("vendors"), rating: v.number(), note: v.optional(v.string()) },
  handler: async (ctx, { id, rating, note }) => {
    const viewer = await me(ctx, ctx.userId);
    const r = Math.max(1, Math.min(5, Math.round(rating)));
    const existing = (await ctx.db.query("vendorReviews").withIndex("by_vendor", q => q.eq("vendorId", id)).collect()).find(
      x => x.userEmail === viewer.email,
    );
    const n = note?.trim().slice(0, 500) || undefined;
    if (existing) await ctx.db.patch(existing._id, { rating: r, note: n ?? existing.note });
    else await ctx.db.insert("vendorReviews", { vendorId: id, userEmail: viewer.email, userName: viewer.name, rating: r, note: n });
    return null;
  },
});

// Seed / harvest import (run by Viktor with run_app_function). Skips names already present.
export const importMany = internalMutation({
  args: {
    vendors: v.array(v.object({ ...fields, preferred: v.optional(v.boolean()), source: v.optional(v.string()) })),
    updateExisting: v.optional(v.boolean()),
  },
  handler: async (ctx, { vendors, updateExisting }) => {
    await syncRoster(ctx);
    const byName = new Map((await ctx.db.query("vendors").collect()).map(x => [x.name.toLowerCase(), x]));
    let added = 0;
    let updated = 0;
    for (const x of vendors) {
      const cur = byName.get(x.name.toLowerCase());
      if (cur) {
        if (updateExisting) {
          const patch: Record<string, unknown> = {};
          for (const [k, val] of Object.entries(x)) if (val !== undefined && k !== "source" && k !== "private") patch[k] = val;
          if (x.preferred === false) delete patch.preferred;
          await ctx.db.patch(cur._id, patch);
          updated++;
        }
        continue;
      }
      await ctx.db.insert("vendors", {
        ...x,
        preferred: x.preferred ?? false,
        hidden: false,
        addedByEmail: "team@spacematchinc.com",
        addedByName: "SpaceMatch",
        source: x.source ?? "seed",
      });
      byName.set(x.name.toLowerCase(), x as never);
      added++;
    }
    return { added, updated };
  },
});

// Public "Trusted Local Pros" list for spacematchinc.com (served by http.ts GET /public/pros).
// Only non-private, non-hidden vendors not switched off by an admin. Never exposes perks/referral terms,
// descriptions (written for agents), internal notes, ratings or who added the vendor.
export const publicPros = internalQuery({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const all = await ctx.db.query("vendors").collect();
    return all
      .filter(x => !x.private && !x.hidden && x.onWebsite !== false)
      .map(x => ({
        // No phone/email/website here: visitors unlock a pro's contact info with their own
        // name + email/phone via POST /public/pro-contact (proIntro.ts), which logs a lead.
        id: x._id, name: x.name, company: x.company, category: x.category, subcategory: x.subcategory,
        areas: x.areas, languages: x.languages, preferred: x.preferred,
        hasContact: !!(x.phone || x.email || x.website),
      }))
      .sort((a, b) => a.category.localeCompare(b.category) || Number(b.preferred) - Number(a.preferred) || a.name.localeCompare(b.name));
  },
});
