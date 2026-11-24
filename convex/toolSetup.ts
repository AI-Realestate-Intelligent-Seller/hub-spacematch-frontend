// One-time "Set up your tools" checklist on Home, ticks stored per user in hubSettings.
import { v } from "convex/values";
import { authenticatedMutation, authenticatedQuery } from "./functions";

const key = (userId: string) => `toolsetup:${userId}`;

export const mine = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", key(ctx.userId))).unique();
    return row ? (JSON.parse(row.value) as string[]) : [];
  },
});

export const toggle = authenticatedMutation({
  args: { tool: v.string(), done: v.boolean() },
  handler: async (ctx, { tool, done }) => {
    const k = key(ctx.userId);
    const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", k)).unique();
    const cur = new Set(row ? (JSON.parse(row.value) as string[]) : []);
    if (done) cur.add(tool.slice(0, 60)); else cur.delete(tool);
    const value = JSON.stringify([...cur].slice(0, 30));
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("hubSettings", { key: k, value });
    return null;
  },
});
