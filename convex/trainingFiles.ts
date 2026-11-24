// Academy training files (Michael 2026-11-19: "add this into the agent hub as training"). Private PDFs that
// name real clients and deal numbers, so they are NOT in public/ (prod URL is public): stored in Convex
// storage, url handed out only to signed-in roster agents, staff and the shared team login (not guests).
// Upload: run_app_function uploadUrl -> POST the PDF -> setFile {file, storageId}.
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";

const key = (file: string) => `trainingFile:${file}`;

export const urls = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const viewer = await hubViewer(ctx, ctx.userId);
    if (!viewer.agentName && !viewer.isStaff && !viewer.isShared) return {};
    const rows = await ctx.db
      .query("hubSettings")
      .withIndex("by_key", q => q.gte("key", "trainingFile:").lt("key", "trainingFile;"))
      .collect();
    const out: Record<string, string | null> = {};
    for (const r of rows) {
      if (!r.key.startsWith("trainingFile:")) continue;
      const { storageId } = JSON.parse(r.value) as { storageId: string };
      out[r.key.slice("trainingFile:".length)] = await ctx.storage.getUrl(storageId as never);
    }
    return out;
  },
});

export const uploadUrl = internalMutation({ args: {}, handler: ctx => ctx.storage.generateUploadUrl() });

export const setFile = internalMutation({
  args: { file: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, a) => {
    const old = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", key(a.file))).unique();
    const value = JSON.stringify({ storageId: a.storageId, updatedAt: Date.now() });
    if (old) {
      const prev = (JSON.parse(old.value) as { storageId: string }).storageId;
      if (prev !== a.storageId) await ctx.storage.delete(prev as never);
      await ctx.db.patch(old._id, { value });
    } else await ctx.db.insert("hubSettings", { key: key(a.file), value });
    return a.file;
  },
});

export const list = internalQuery({
  args: {},
  handler: async ctx =>
    (await ctx.db.query("hubSettings").collect()).filter(r => r.key.startsWith("trainingFile:")).map(r => r.key),
});
