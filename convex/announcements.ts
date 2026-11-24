// Team announcements board. Leaders + ops post; every signed-in agent reads; new posts push to subscribed phones.
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { ADMIN_EMAILS, OPS_EMAILS, agentByEmail, isAdminEmail } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";

declare const process: { env: Record<string, string | undefined> };

export const POSTER_EMAILS = [...ADMIN_EMAILS, ...OPS_EMAILS, "brandon@spacematchinc.com", "sergio.monjane@spacematchinc.com"];

async function me(ctx: QueryCtx, userId: Doc<"users">["_id"]) {
  const user = await ctx.db.get(userId);
  const email = (user?.email ?? "").toLowerCase();
  return { email, name: agentByEmail(email)?.name ?? user?.name ?? email, canPost: POSTER_EMAILS.includes(email) };
}

export const list = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const viewer = await me(ctx, ctx.userId);
    const rows = await ctx.db.query("announcements").withIndex("by_created").order("desc").take(60);
    rows.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
    return { canPost: viewer.canPost, vapidKey: process.env.VAPID_PUBLIC_KEY ?? null, rows };
  },
});

const clean = (s?: string) => (s ?? "").trim().slice(0, 4000) || undefined;

export const post = authenticatedMutation({
  args: { title: v.optional(v.string()), body: v.string(), link: v.optional(v.string()), pinned: v.optional(v.boolean()), notify: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    const viewer = await me(ctx, ctx.userId);
    if (!viewer.canPost) throw new Error("Only team leaders and ops can post announcements.");
    const body = clean(a.body);
    if (!body) throw new Error("Write something first.");
    let link = clean(a.link);
    if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
    const id = await ctx.db.insert("announcements", {
      title: clean(a.title)?.slice(0, 140), body, link, pinned: a.pinned ?? false,
      authorEmail: viewer.email, authorName: viewer.name, createdAt: Date.now(),
    });
    if (a.notify !== false) await ctx.scheduler.runAfter(0, internal.push.announce, { id });
    return id;
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id("announcements") },
  handler: async (ctx, { id }) => {
    const viewer = await me(ctx, ctx.userId);
    const row = await ctx.db.get(id);
    if (!row) return;
    if (!isAdminEmail(viewer.email) && row.authorEmail !== viewer.email) throw new Error("Not allowed");
    await ctx.db.delete(id);
  },
});

export const setPinned = authenticatedMutation({
  args: { id: v.id("announcements"), pinned: v.boolean() },
  handler: async (ctx, { id, pinned }) => {
    const viewer = await me(ctx, ctx.userId);
    if (!viewer.canPost) throw new Error("Not allowed");
    await ctx.db.patch(id, { pinned });
  },
});

export const subscribe = authenticatedMutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string() },
  handler: async (ctx, a) => {
    const viewer = await me(ctx, ctx.userId);
    const cur = await ctx.db.query("pushSubs").withIndex("by_endpoint", q => q.eq("endpoint", a.endpoint)).first();
    if (cur) await ctx.db.patch(cur._id, { userEmail: viewer.email, p256dh: a.p256dh, auth: a.auth });
    else await ctx.db.insert("pushSubs", { ...a, userEmail: viewer.email, createdAt: Date.now() });
  },
});

export const unsubscribe = authenticatedMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const cur = await ctx.db.query("pushSubs").withIndex("by_endpoint", q => q.eq("endpoint", endpoint)).first();
    if (cur) await ctx.db.delete(cur._id);
  },
});

export const forPush = internalQuery({
  args: { id: v.id("announcements") },
  handler: async (ctx, { id }) => ({ row: await ctx.db.get(id), subs: await ctx.db.query("pushSubs").collect() }),
});

export const dropSub = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    await syncRoster(ctx);
    const cur = await ctx.db.query("pushSubs").withIndex("by_endpoint", q => q.eq("endpoint", endpoint)).first();
    if (cur) await ctx.db.delete(cur._id);
  },
});

export const subCount = internalQuery({ args: {}, handler: async ctx => (await ctx.db.query("pushSubs").collect()).length });

// Ops-side post (run via run_app_function when Michael approves an announcement in Slack).
export const postInternal = internalMutation({
  args: { title: v.optional(v.string()), body: v.string(), link: v.optional(v.string()), pinned: v.optional(v.boolean()), notify: v.optional(v.boolean()), authorEmail: v.string(), authorName: v.string() },
  handler: async (ctx, a) => {
    await syncRoster(ctx);
    const body = clean(a.body);
    if (!body) throw new Error("Empty body");
    const id = await ctx.db.insert("announcements", {
      title: clean(a.title)?.slice(0, 140), body, link: clean(a.link), pinned: a.pinned ?? false,
      authorEmail: a.authorEmail.toLowerCase(), authorName: a.authorName, createdAt: Date.now(),
    });
    if (a.notify !== false) await ctx.scheduler.runAfter(0, internal.push.announce, { id });
    return id;
  },
});
