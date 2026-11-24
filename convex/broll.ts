// B-Roll Library (Michael 2026-10-24): team B-roll clips agents can preview + download in /broll.
// Files are uploaded by Viktor via run_app_function (uploadUrl -> POST -> register); metadata is static in src/lib/broll.ts.
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { authenticatedQuery } from "./functions";

export const list = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query("brollClips").collect();
    return Promise.all(rows.map(async r => ({ cid: r.cid, size: r.size, url: await ctx.storage.getUrl(r.storageId) })));
  },
});

export const uploadUrl = internalMutation({ args: {}, handler: ctx => ctx.storage.generateUploadUrl() });

export const register = internalMutation({
  args: { cid: v.string(), storageId: v.id("_storage"), size: v.number() },
  handler: async (ctx, a) => {
    const old = await ctx.db.query("brollClips").withIndex("by_cid", q => q.eq("cid", a.cid)).unique();
    if (old) {
      if (old.storageId !== a.storageId) await ctx.storage.delete(old.storageId);
      await ctx.db.patch(old._id, { storageId: a.storageId, size: a.size, updatedAt: Date.now() });
    } else await ctx.db.insert("brollClips", { ...a, updatedAt: Date.now() });
    return a.cid;
  },
});

export const have = internalQuery({
  args: {},
  handler: async ctx => (await ctx.db.query("brollClips").collect()).map(r => ({ cid: r.cid, size: r.size })),
});

export const remove = internalMutation({
  args: { cid: v.string() },
  handler: async (ctx, a) => {
    const old = await ctx.db.query("brollClips").withIndex("by_cid", q => q.eq("cid", a.cid)).unique();
    if (old) { await ctx.storage.delete(old.storageId); await ctx.db.delete(old._id); }
  },
});
