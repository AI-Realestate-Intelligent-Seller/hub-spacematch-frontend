// 90-day Growth Playbook progress: each person checks items off; staff see who's doing it.
import { v } from "convex/values";
import { AGENTS } from "./agentsData";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { GROWTH_ITEM_IDS, GROWTH_LEVELS } from "./growthDefs";
import { hubViewer } from "./hubMe";

export const mine = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const row = await ctx.db.query("growthProgress").withIndex("by_user", q => q.eq("userId", ctx.userId)).unique();
    return { done: row?.done ?? [], level: row?.level ?? 1, startedAt: row?.startedAt ?? null, total: GROWTH_ITEM_IDS.length };
  },
});

export const toggle = authenticatedMutation({
  args: { itemId: v.string(), done: v.boolean() },
  handler: async (ctx, { itemId, done }) => {
    if (!GROWTH_ITEM_IDS.includes(itemId)) throw new Error("Unknown item");
    const viewer = await hubViewer(ctx, ctx.userId);
    if (viewer.isShared) throw new Error("Sign in with your own email so your progress is yours.");
    const row = await ctx.db.query("growthProgress").withIndex("by_user", q => q.eq("userId", ctx.userId)).unique();
    const now = Date.now();
    if (!row) {
      await ctx.db.insert("growthProgress", { userId: ctx.userId, email: viewer.email, name: viewer.name, done: done ? [itemId] : [], startedAt: now, updatedAt: now });
      return null;
    }
    const set = new Set(row.done);
    if (done) set.add(itemId);
    else set.delete(itemId);
    await ctx.db.patch(row._id, { done: [...set], name: viewer.name, updatedAt: now });
    return null;
  },
});

export const setLevel = authenticatedMutation({
  args: { level: v.number() },
  handler: async (ctx, { level }) => {
    const row = await ctx.db.query("growthProgress").withIndex("by_user", q => q.eq("userId", ctx.userId)).unique();
    if (row) await ctx.db.patch(row._id, { level });
    return null;
  },
});

// Staff view: every agent with % per level and last activity (agents with no progress included).
export const team = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const viewer = await hubViewer(ctx, ctx.userId);
    if (!viewer.isStaff) return null;
    const rows = await ctx.db.query("growthProgress").collect();
    const byEmail = new Map(rows.map(r => [r.email, r]));
    const levelIds = GROWTH_LEVELS.map(l => ({ id: l.id, title: l.title, ids: new Set(l.weeks.flatMap(w => w.items.map(i => i.id))) }));
    const summarize = (name: string, email: string) => {
      const r = byEmail.get(email);
      const done = new Set(r?.done ?? []);
      return {
        name,
        email,
        done: done.size,
        total: GROWTH_ITEM_IDS.length,
        levels: levelIds.map(l => ({ title: l.title, done: [...l.ids].filter(i => done.has(i)).length, total: l.ids.size })),
        startedAt: r?.startedAt ?? null,
        updatedAt: r?.updatedAt ?? null,
      };
    };
    const list = AGENTS.map(a => summarize(a.name, a.email.toLowerCase()));
    for (const r of rows) if (!AGENTS.some(a => a.email.toLowerCase() === r.email)) list.push(summarize(r.name, r.email));
    return list.sort((a, b) => b.done - a.done || (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || a.name.localeCompare(b.name));
  },
});
