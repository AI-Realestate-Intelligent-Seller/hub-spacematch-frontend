// YouTube Short views for the seller page, pulled from @spacematchinc.
// A listing's video is found by the YouTube link on the listing, or else by the
// street (e.g. "2147 W Thomas") appearing in a recent upload's title. Plain code, no AI.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { callIntegration } from "./gateway";
import { weekOf } from "./launchSteps";
import { streetRegex } from "./reels";

const UPLOADS = "UUg4SCyhsx-9tsHUBrHNuxsA";
const LIVE = ["Preparing", "Coming soon", "Active", "Under contract"];

type Item = { snippet?: { title?: string; resourceId?: { videoId?: string } }; contentDetails?: { videoId?: string; videoPublishedAt?: string } };
type Video = { id: string; snippet?: { title?: string }; statistics?: { viewCount?: string } };

export const videoId = (url?: string) =>
  url?.match(/(?:youtube\.com\/(?:shorts\/|watch\?(?:.*&)?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i)?.[1];

export function matchVideo(l: { address: string; links: { youtube?: string } }, items: { id: string; title: string }[]): { id: string; by: string } | null {
  const id = videoId(l.links.youtube);
  if (id) return { id, by: "link" }; // agent's link wins; never guess past it
  const re = streetRegex(l.address);
  if (!re) return null;
  const hit = items.find(x => re.test(x.title)); // newest first
  return hit ? { id: hit.id, by: "title" } : null;
}

export const candidates = internalQuery({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query("listings").collect();
    return rows.filter(l => LIVE.includes(l.status)).map(l => ({ _id: l._id, address: l.address, links: { youtube: l.links?.youtube } }));
  },
});

export const save = internalMutation({
  args: { listingId: v.id("listings"), videoId: v.string(), title: v.string(), views: v.number(), matchedBy: v.string() },
  handler: async (ctx, a) => {
    const l = await ctx.db.get(a.listingId);
    if (!l) return null;
    const now = Date.now();
    const url = `https://www.youtube.com/shorts/${a.videoId}`;
    await ctx.db.patch(l._id, {
      ytAuto: { videoId: a.videoId, url, title: a.title, views: a.views, matchedBy: a.matchedBy, checkedAt: now },
      ...(l.links?.youtube ? {} : { links: { ...(l.links ?? {}), youtube: url } }),
    });
    const wk = weekOf(now);
    const cur = await ctx.db.query("listingMetrics").withIndex("by_listing_week", q => q.eq("listingId", l._id).eq("weekOf", wk)).first();
    if (cur?.youtubeViews === a.views && cur.auto?.includes("youtube")) return null;
    const auto = Array.from(new Set([...(cur?.auto ?? []), "youtube"]));
    if (cur) await ctx.db.patch(cur._id, { youtubeViews: a.views, auto, updatedAt: now });
    else await ctx.db.insert("listingMetrics", { listingId: l._id, weekOf: wk, youtubeViews: a.views, auto, enteredByEmail: "auto", updatedAt: now });
    return null;
  },
});

export const refresh = internalAction({
  args: { listingId: v.optional(v.id("listings")) },
  handler: async (ctx, { listingId }): Promise<Record<string, number>> => {
    const all = await ctx.runQuery(internal.youtube.candidates, {});
    const list = listingId ? all.filter(l => l._id === listingId) : all;
    const tally = { listings: list.length, matched: 0, unmatched: 0 };
    if (!list.length) return tally;
    const pl = await callIntegration<{ data?: { items?: Item[] }; error?: unknown }>("mcp_composio_youtube_list_playlist_items", {
      playlistId: UPLOADS, part: "snippet,contentDetails", maxResults: 50,
    });
    const items = (pl.data?.items ?? [])
      .map(i => ({ id: i.contentDetails?.videoId ?? i.snippet?.resourceId?.videoId ?? "", title: i.snippet?.title ?? "", at: i.contentDetails?.videoPublishedAt ?? "" }))
      .filter(i => i.id)
      .sort((a, b) => b.at.localeCompare(a.at));
    if (!items.length) throw new Error(`YouTube returned no uploads: ${JSON.stringify(pl.error ?? pl).slice(0, 200)}`);
    const hits = list.map(l => ({ l, hit: matchVideo(l, items) }));
    const ids = Array.from(new Set(hits.flatMap(h => (h.hit ? [h.hit.id] : []))));
    if (!ids.length) { tally.unmatched = list.length; return tally; }
    const det = await callIntegration<{ data?: { items?: Video[] } }>("mcp_composio_youtube_get_video_details_batch", { id: ids, parts: ["snippet", "statistics"] });
    const byId = new Map((det.data?.items ?? []).map(x => [x.id, x]));
    for (const { l, hit } of hits) {
      const vd = hit && byId.get(hit.id);
      const views = vd?.statistics?.viewCount != null ? Number(vd.statistics.viewCount) : NaN;
      if (!hit || !vd || !Number.isFinite(views)) { tally.unmatched++; continue; }
      await ctx.runMutation(internal.youtube.save, { listingId: l._id, videoId: hit.id, title: vd.snippet?.title ?? "", views, matchedBy: hit.by });
      tally.matched++;
    }
    console.log("youtube refresh", JSON.stringify(tally));
    return tally;
  },
});
