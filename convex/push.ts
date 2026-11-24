"use node";
// Web Push for announcements (VAPID keys in env: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
import { v } from "convex/values";
import webpush from "web-push";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

export const announce = internalAction({
  args: { id: v.id("announcements") },
  handler: async (ctx, { id }): Promise<{ sent: number; total?: number }> => {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) { console.log("push: VAPID keys not set"); return { sent: 0 }; }
    webpush.setVapidDetails("mailto:team@spacematchinc.com", pub, priv);
    const { row, subs }: { row: Doc<"announcements"> | null; subs: Doc<"pushSubs">[] } = await ctx.runQuery(internal.announcements.forPush, { id });
    if (!row) return { sent: 0 };
    const payload = JSON.stringify({
      title: row.title || `SpaceMatch · ${row.authorName}`,
      body: row.body.slice(0, 180),
      url: "/announcements",
    });
    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await ctx.runMutation(internal.announcements.dropSub, { endpoint: s.endpoint });
        else console.error("push failed", code, String(e));
      }
    }
    return { sent, total: subs.length };
  },
});

// One person's devices (e.g. "your prospect just opened your Why SpaceMatch link").
export const toEmail = internalAction({
  args: { email: v.string(), title: v.string(), body: v.string(), url: v.string() },
  handler: async (ctx, a): Promise<{ sent: number }> => {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return { sent: 0 };
    webpush.setVapidDetails("mailto:team@spacematchinc.com", pub, priv);
    const subs: Doc<"pushSubs">[] = await ctx.runQuery(internal.whyLinks.subsFor, { email: a.email });
    const payload = JSON.stringify({ title: a.title.slice(0, 90), body: a.body.slice(0, 180), url: a.url });
    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await ctx.runMutation(internal.announcements.dropSub, { endpoint: s.endpoint });
        else console.error("push failed", code, String(e));
      }
    }
    return { sent };
  },
});
