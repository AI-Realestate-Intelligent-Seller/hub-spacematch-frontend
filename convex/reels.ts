// Instagram Reel views for the seller page, pulled from @spacematchchicago.
// A listing's Reel is found by the Reel link on the listing, or else by the
// street (e.g. "2147 W Thomas") appearing in a Reel caption. Plain code, no AI.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { callIntegration } from "./gateway";
import { weekOf } from "./launchSteps";

const IG_USER_ID = "27605413282454450";
const LIVE = ["Preparing", "Coming soon", "Active", "Under contract"];

type Media = { id: string; caption?: string; media_product_type?: string; permalink?: string; timestamp?: string };

export const shortcode = (url?: string) => url?.match(/instagram\.com\/(?:[\w.]+\/)?(?:reels?|p)\/([\w-]+)/i)?.[1];

/** "2147 W Thomas St" → regex matching "2147 W Thomas", "2147 West Thomas", "2147 Thomas". */
export function streetRegex(address: string): RegExp | null {
  const m = address.toLowerCase().match(/^\s*(\d+[a-z]?)\s+(?:(n|s|e|w|north|south|east|west)\.?\s+)?([a-z0-9']+)/);
  if (!m || m[3].length < 3) return null;
  const dir = "(?:(?:n|s|e|w|north|south|east|west)\\.?\\s+)?";
  return new RegExp(`\\b${m[1]}\\s+${dir}${m[3].replace(/'/g, "'?")}\\b`, "i");
}

export function matchReel(l: Pick<Doc<"listings">, "address" | "links">, media: Media[]): { m: Media; by: string } | null {
  const reels = media.filter(x => x.media_product_type === "REELS");
  const code = shortcode(l.links?.reel);
  if (code) {
    const hit = media.find(x => shortcode(x.permalink) === code);
    return hit ? { m: hit, by: "link" } : null; // agent's link wins; never guess past it
  }
  const re = streetRegex(l.address);
  if (!re) return null;
  const hit = reels.find(x => re.test(x.caption ?? "")); // newest first
  return hit ? { m: hit, by: "caption" } : null;
}

export const candidates = internalQuery({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query("listings").collect();
    return rows.filter(l => LIVE.includes(l.status)).map(l => ({ _id: l._id, address: l.address, links: l.links ?? {} }));
  },
});

export const save = internalMutation({
  args: { listingId: v.id("listings"), mediaId: v.string(), permalink: v.string(), views: v.number(), matchedBy: v.string() },
  handler: async (ctx, a) => {
    const l = await ctx.db.get(a.listingId);
    if (!l) return null;
    const now = Date.now();
    await ctx.db.patch(l._id, {
      reelAuto: { mediaId: a.mediaId, permalink: a.permalink, views: a.views, matchedBy: l.reelAuto?.mediaId === a.mediaId ? l.reelAuto.matchedBy : a.matchedBy, checkedAt: now },
      ...(l.links?.reel ? {} : { links: { ...(l.links ?? {}), reel: a.permalink } }),
    });
    // Reel views are a running total, so this week's row carries the latest total.
    const wk = weekOf(now);
    const cur = await ctx.db.query("listingMetrics").withIndex("by_listing_week", q => q.eq("listingId", l._id).eq("weekOf", wk)).first();
    if (cur?.reelViews === a.views && cur.auto?.includes("reel")) return null;
    const auto = Array.from(new Set([...(cur?.auto ?? []), "reel"]));
    if (cur) await ctx.db.patch(cur._id, { reelViews: a.views, auto, updatedAt: now });
    else await ctx.db.insert("listingMetrics", { listingId: l._id, weekOf: wk, reelViews: a.views, auto, enteredByEmail: "auto", updatedAt: now });
    return null;
  },
});

export const refresh = internalAction({
  args: { listingId: v.optional(v.id("listings")) },
  handler: async (ctx, { listingId }): Promise<Record<string, number>> => {
    const all = await ctx.runQuery(internal.reels.candidates, {});
    const list = listingId ? all.filter(l => l._id === listingId) : all;
    const tally = { listings: list.length, matched: 0, unmatched: 0 };
    if (!list.length) return tally;
    const res = await callIntegration<{ data?: { data?: Media[] }; error?: unknown }>("mcp_composio_instagram_get_ig_user_media", {
      ig_user_id: IG_USER_ID, limit: 60, fields: "id,caption,media_product_type,permalink,timestamp",
    });
    const media = res.data?.data ?? [];
    if (!media.length) throw new Error(`Instagram returned no posts: ${JSON.stringify(res.error ?? res).slice(0, 200)}`);
    for (const l of list) {
      const hit = matchReel(l as never, media);
      if (!hit) { tally.unmatched++; continue; }
      const ins = await callIntegration<{ data?: { data?: { name: string; values?: { value: number }[] }[] } }>("mcp_composio_instagram_get_ig_media_insights", {
        ig_media_id: hit.m.id, metric: ["views"],
      });
      const views = ins.data?.data?.find(x => x.name === "views")?.values?.[0]?.value;
      if (typeof views !== "number") throw new Error(`No views for Instagram media ${hit.m.id}`);
      await ctx.runMutation(internal.reels.save, { listingId: l._id, mediaId: hit.m.id, permalink: hit.m.permalink ?? "", views, matchedBy: hit.by });
      tally.matched++;
    }
    console.log("reels refresh", JSON.stringify(tally));
    return tally;
  },
});
