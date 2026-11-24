// Instagram/Facebook (Meta Ads) and Google Ads cards fill in by themselves.
// A campaign belongs to a listing when its name contains the listing's street
// ("SM | 2147 W Thomas | Meta | Launch"), or matches the campaign name/ID the
// agent typed on the card. Lifetime numbers; spend/budget stay agent-only.
// Plain code, no AI. Lofty has no ads API, so its card stays typed in.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { callIntegration } from "./gateway";
import { streetRegex } from "./reels";

const META_ACCOUNT = "act_1658554918209535";
const GOOGLE_CUSTOMER = "3515024496";
const LIVE = ["Preparing", "Coming soon", "Active", "Under contract"];

export type Campaign = {
  id: string; name: string; status: string; // running | paused | scheduled | ended
  start?: string; end?: string; reach: number; clicks: number; leads: number; spend: number;
};

const day = (s?: string) => (s ? s.slice(0, 10) : undefined);
const today = () => new Date().toISOString().slice(0, 10);

async function metaCampaigns(): Promise<Campaign[]> {
  type MC = { id: string; name: string; effective_status?: string; start_time?: string; stop_time?: string };
  const list: MC[] = [];
  let after: string | undefined;
  for (let i = 0; i < 5; i++) {
    const r = await callIntegration<{ data?: MC[]; paging?: { cursors?: { after?: string }; has_more?: boolean; next?: string } }>("mcp_meta_ads_list_campaigns", { ad_account_id: META_ACCOUNT, limit: 100, ...(after ? { after } : {}) });
    list.push(...(r.data ?? []));
    after = r.paging?.cursors?.after;
    if (!(r.paging?.has_more || r.paging?.next) || !after) break;
  }
  type MI = { campaign_id: string; reach?: string; inline_link_clicks?: string; spend?: string; actions?: { action_type: string; value: string }[] };
  const ins = await callIntegration<{ data?: MI[] }>("mcp_meta_ads_get_insights", {
    object_id: META_ACCOUNT, level: "campaign", date_preset: "maximum", limit: 500,
    fields: "campaign_id,reach,inline_link_clicks,spend,actions",
  });
  const byId = new Map((ins.data ?? []).map(x => [x.campaign_id, x]));
  return list.map(c => {
    const m = byId.get(c.id);
    const act = (t: string) => Number(m?.actions?.find(a => a.action_type === t)?.value ?? 0);
    const es = (c.effective_status ?? "").toUpperCase();
    const end = day(c.stop_time), start = day(c.start_time);
    const status = end && end < today() ? "ended" : start && start > today() ? "scheduled"
      : ["ACTIVE", "IN_PROCESS", "WITH_ISSUES"].includes(es) ? "running" : es === "PENDING_REVIEW" ? "scheduled" : "paused";
    return {
      id: c.id, name: c.name, status, start, end,
      reach: Number(m?.reach ?? 0), clicks: Number(m?.inline_link_clicks ?? 0),
      leads: act("lead") || act("onsite_conversion.lead_grouped"), spend: Number(m?.spend ?? 0),
    };
  });
}

async function googleCampaigns(): Promise<Campaign[]> {
  type GR = { campaign: { id: string; name: string; status: string; startDateTime?: string; endDateTime?: string }; metrics?: { impressions?: string; clicks?: string; conversions?: number; costMicros?: string } };
  const r = await callIntegration<{ results?: GR[] }>("mcp_google_ads_run_gaql_query", {
    customer_id: GOOGLE_CUSTOMER,
    query: "SELECT campaign.id, campaign.name, campaign.status, campaign.start_date_time, campaign.end_date_time, metrics.impressions, metrics.clicks, metrics.conversions, metrics.cost_micros FROM campaign WHERE campaign.status != 'REMOVED'",
  });
  return (r.results ?? []).map(x => {
    const start = day(x.campaign.startDateTime), end = day(x.campaign.endDateTime);
    const status = end && end < today() ? "ended" : start && start > today() ? "scheduled" : x.campaign.status === "ENABLED" ? "running" : "paused";
    return {
      id: x.campaign.id, name: x.campaign.name, status, start, end,
      reach: Number(x.metrics?.impressions ?? 0), clicks: Number(x.metrics?.clicks ?? 0),
      leads: Math.round(Number(x.metrics?.conversions ?? 0)), spend: Number(x.metrics?.costMicros ?? 0) / 1e6,
    };
  });
}

/** Campaigns for one listing: the agent's campaign name/ID wins, else the street in the name. */
export function matchCampaigns(address: string, ref: string | undefined, all: Campaign[]): Campaign[] {
  const r = (ref ?? "").trim().toLowerCase();
  if (r) return all.filter(c => c.id === r || c.name.toLowerCase().includes(r));
  const re = streetRegex(address);
  return re ? all.filter(c => re.test(c.name)) : [];
}

export function combine(cs: Campaign[]) {
  const rank = ["running", "scheduled", "paused", "ended"];
  const status = rank.find(s => cs.some(c => c.status === s)) ?? "paused";
  const starts = cs.map(c => c.start).filter(Boolean).sort() as string[];
  const ends = cs.map(c => c.end).filter(Boolean).sort() as string[];
  const sum = (k: "reach" | "clicks" | "leads" | "spend") => cs.reduce((a, c) => a + c[k], 0);
  return {
    status, startDate: starts[0], endDate: cs.every(c => c.end) ? ends[ends.length - 1] : undefined,
    reach: sum("reach"), clicks: sum("clicks"), leads: sum("leads"), spend: Math.round(sum("spend") * 100) / 100,
    campaigns: JSON.stringify(cs.map(c => ({ id: c.id, name: c.name, status: c.status }))),
  };
}

export const candidates = internalQuery({
  args: { listingId: v.optional(v.id("listings")) },
  handler: async (ctx, { listingId }) => {
    const rows = listingId ? [await ctx.db.get(listingId)].filter(x => x !== null) : await ctx.db.query("listings").collect();
    const out = [];
    for (const l of rows) {
      if (!LIVE.includes(l.status)) continue;
      const ads = await ctx.db.query("listingAds").withIndex("by_listing", q => q.eq("listingId", l._id)).collect();
      out.push({
        _id: l._id, address: l.address,
        refs: { meta: ads.find(a => a.channel === "meta")?.campaignRef, google: ads.find(a => a.channel === "google")?.campaignRef },
      });
    }
    return out;
  },
});

const autoRow = v.object({
  status: v.string(), startDate: v.optional(v.string()), endDate: v.optional(v.string()),
  reach: v.number(), clicks: v.number(), leads: v.number(), spend: v.number(), campaigns: v.string(),
});

export const saveAuto = internalMutation({
  args: { listingId: v.id("listings"), channel: v.union(v.literal("meta"), v.literal("google")), data: v.optional(autoRow), error: v.optional(v.string()) },
  handler: async (ctx, { listingId, channel, data, error }) => {
    const cur = (await ctx.db.query("listingAds").withIndex("by_listing", q => q.eq("listingId", listingId)).collect()).find(r => r.channel === channel);
    const source = channel === "meta" ? "meta" : "google_ads";
    if (error) {
      // Keep the last good numbers; show the error on auto cards only.
      if (cur && cur.source === source) await ctx.db.patch(cur._id, { error: error.slice(0, 300) });
      return null;
    }
    if (!data) {
      // No campaign matches (any more): an auto card goes back to typed-in.
      if (cur && cur.source === source) await ctx.db.patch(cur._id, { source: "manual", campaigns: undefined, error: undefined });
      return null;
    }
    const same = cur && cur.source === source && cur.status === data.status && cur.reach === data.reach && cur.clicks === data.clicks && cur.leads === data.leads && cur.spend === data.spend && cur.campaigns === data.campaigns && !cur.error;
    if (same) return null;
    const row = {
      listingId, channel, source, ...data, error: undefined,
      // Agent-owned fields survive.
      campaignRef: cur?.campaignRef, adLink: cur?.adLink, note: cur?.note, budget: cur?.budget,
      updatedByEmail: "auto", updatedAt: Date.now(),
    };
    if (cur) await ctx.db.replace(cur._id, row);
    else await ctx.db.insert("listingAds", row);
    await ctx.db.patch(listingId, { updatedAt: Date.now() });
    return null;
  },
});

export const saveStatus = internalMutation({
  args: { value: v.string() },
  handler: async (ctx, { value }) => {
    const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", "ads:lastSync")).unique();
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("hubSettings", { key: "ads:lastSync", value });
  },
});

export const refresh = internalAction({
  args: { listingId: v.optional(v.id("listings")) },
  handler: async (ctx, { listingId }): Promise<Record<string, unknown>> => {
    const list = await ctx.runQuery(internal.paidAds.candidates, { listingId });
    const tally: Record<string, number> = { listings: list.length, meta: 0, google: 0 };
    const errors: string[] = [];
    if (!list.length) return { tally, errors };
    const sources = { meta: metaCampaigns, google: googleCampaigns } as const;
    for (const ch of ["meta", "google"] as const) {
      let all: Campaign[];
      try { all = await sources[ch](); } catch (e) {
        const msg = `${ch === "meta" ? "Meta Ads" : "Google Ads"}: ${e instanceof Error ? e.message : String(e)}`;
        errors.push(msg);
        for (const l of list) await ctx.runMutation(internal.paidAds.saveAuto, { listingId: l._id as Id<"listings">, channel: ch, error: msg });
        continue;
      }
      for (const l of list) {
        const hits = matchCampaigns(l.address, l.refs[ch], all);
        await ctx.runMutation(internal.paidAds.saveAuto, { listingId: l._id as Id<"listings">, channel: ch, data: hits.length ? combine(hits) : undefined });
        if (hits.length) tally[ch]++;
      }
    }
    if (!listingId) await ctx.runMutation(internal.paidAds.saveStatus, { value: JSON.stringify({ at: Date.now(), tally, errors }) });
    console.log("paid ads refresh", JSON.stringify({ tally, errors }));
    return { tally, errors };
  },
});

// Sandbox check: which campaigns would match an address (nothing saved).
export const preview = internalAction({
  args: { address: v.string(), ref: v.optional(v.string()) },
  handler: async (_ctx, { address, ref }) => {
    const [m, g] = await Promise.all([metaCampaigns(), googleCampaigns()]);
    return { metaTotal: m.length, googleTotal: g.length, meta: matchCampaigns(address, ref, m), google: matchCampaigns(address, ref, g), sampleMeta: m[0], sampleGoogle: g[0] };
  },
});
