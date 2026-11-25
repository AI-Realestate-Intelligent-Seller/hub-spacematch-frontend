import { AlertTriangle, ExternalLink, Loader2, Lock, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { PublicAd } from "../../../convex/listingAds";
import { FieldError, LoadError, Skeleton, errorBorder } from "./FormState";
import { apiErrorMessage, fieldErrors, useApiData } from "@/lib/apiData";
import { type AdChannel, type ListingAdRow, listingAdsApi } from "@/lib/listingsApi";

type Channel = "meta" | "google" | "lofty" | "website";

export const CHANNELS: Record<Channel, { name: string; icon: string; reach: string; clicks: string; leads: string; where: string }> = {
  meta: { name: "Instagram & Facebook ads", icon: "/tools/instagram.png", reach: "People reached", clicks: "Clicks", leads: "Leads", where: "Meta Ads Manager → your campaign → Reach, Link clicks, Leads." },
  google: { name: "Google ads", icon: "/tools/googleads.png", reach: "Impressions", clicks: "Clicks", leads: "Leads", where: "Google Ads → Campaigns → Impressions, Clicks, Conversions." },
  lofty: { name: "Lofty ads", icon: "/tools/lofty.png", reach: "People reached", clicks: "Clicks", leads: "Leads", where: "Lofty's ad report (in Lofty or the report email): reach, clicks, leads." },
  website: { name: "Listing web pages", icon: "/tools/spacematch.png", reach: "Visitors", clicks: "Contact clicks", leads: "Inquiries", where: "" },
};

const AUTO_FROM: Record<string, string> = { ga: "Google Analytics", meta: "Meta Ads", google_ads: "Google Ads" };

const STATUS: Record<string, { label: string; tone: string }> = {
  not_started: { label: "Not started", tone: "bg-stone-100 text-stone-600" },
  scheduled: { label: "Scheduled", tone: "bg-amber-100 text-amber-800" },
  running: { label: "Running", tone: "bg-emerald-100 text-emerald-800" },
  paused: { label: "Paused", tone: "bg-stone-200 text-stone-700" },
  ended: { label: "Ended", tone: "bg-stone-100 text-stone-500" },
};

const fmtN = (n?: number | null) => (n == null ? "–" : n.toLocaleString());
const fmtMoney = (n?: number | null) => (n == null ? "–" : Number.isInteger(n) ? `$${n.toLocaleString()}` : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const fmtDay = (d?: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");
const dates = (s?: string, e?: string) => (s && e ? `${fmtDay(s)} – ${fmtDay(e)}` : s ? `Started ${fmtDay(s)}` : e ? `Ends ${fmtDay(e)}` : "");
export const ago = (t?: number) => {
  if (!t) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 14 ? `${d}d ago` : new Date(t).toLocaleDateString();
};

function StatusPill({ s }: { s: string }) {
  const st = STATUS[s] ?? STATUS.not_started;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.tone}`}>
      {s === "running" && <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />}
      {st.label}
    </span>
  );
}

function Num({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-2xl leading-none text-[#0A0A0A]">{value}</div>
      <div className="mt-1 text-xs text-stone-500">{label}</div>
    </div>
  );
}

// ---------- Seller portal ----------

export function SellerAdCampaigns({ ads }: { ads: PublicAd[] }) {
  const reach = ads.reduce((a, x) => a + (x.reach ?? 0), 0);
  const clicks = ads.reduce((a, x) => a + (x.clicks ?? 0), 0);
  const leads = ads.reduce((a, x) => a + (x.leads ?? 0), 0);
  return (
    <section>
      <h2 className="mb-3 px-1 font-display text-xl">Your ad campaigns</h2>
      {ads.length === 0 ? (
        <div className="rounded-2xl bg-white p-5 text-sm text-stone-600 ring-1 ring-black/5">
          Your Instagram, Facebook, Google and Lofty ads will show here with live results once they launch.
        </div>
      ) : (
        <div className="space-y-3">
          {ads.length > 1 && (
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#0A0A0A] p-4 text-center text-white">
              {[["Reached", reach], ["Clicks", clicks], ["Leads & inquiries", leads]].map(([l, n]) => (
                <div key={l as string}>
                  <div className="font-display text-2xl text-[#D9BC8C]">{(n as number).toLocaleString()}</div>
                  <div className="text-[11px] text-white/60">{l as string}</div>
                </div>
              ))}
            </div>
          )}
          {ads.map(a => {
            const c = CHANNELS[a.channel as Channel] ?? CHANNELS.website;
            return (
              <div key={a.channel} className="rounded-2xl bg-white p-4 ring-1 ring-black/5" data-testid={`seller-ad-${a.channel}`}>
                <div className="flex items-center gap-3">
                  <img src={c.icon} alt="" className="size-9 rounded-lg bg-stone-50 object-contain p-1 ring-1 ring-black/5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-stone-500">{a.channel === "website" ? "SpaceMatch & listing pages" : dates(a.startDate, a.endDate)}</div>
                  </div>
                  {a.channel !== "website" && <StatusPill s={a.status} />}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Num label={c.reach} value={fmtN(a.reach)} />
                  {a.channel === "website" ? <Num label="Page views" value={fmtN(a.views)} /> : <Num label={c.clicks} value={fmtN(a.clicks)} />}
                  <Num label={c.leads} value={fmtN(a.leads)} />
                </div>
                {a.note && <p className="mt-3 text-sm text-stone-700">{a.note}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
                  <span>Updated {ago(a.updatedAt)} · {AUTO_FROM[a.source] ? `automatic from ${AUTO_FROM[a.source]}` : "by your agent"}</span>
                  {a.adLink && <a href={a.adLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-[#9C7434]">View ad <ExternalLink className="size-3" /></a>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------- Agent listing page ----------

const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-[16px] outline-none focus:border-[#9C7434] focus:ring-2 focus:ring-[#9C7434]/20";
const errMsg = apiErrorMessage;

type Row = ListingAdRow;
const useAdsData = (id: string) => useApiData(`listing-ads:${id}`, () => listingAdsApi.forListing(id), { pollMs: 120_000 });
/** Same checks as the backend (listing-ad.validation.ts). */
function checkAd(f: { startDate: string; endDate: string; reach: string; clicks: string; leads: string; spend: string; budget: string; campaignRef: string; adLink: string; note: string }) {
  const e: Record<string, string> = {};
  for (const [k, label] of [["reach", "Reach"], ["clicks", "Clicks"], ["leads", "Leads"], ["spend", "Spend"], ["budget", "Budget"]] as const) {
    const v = f[k];
    if (v && (!/^\d+(\.\d{1,2})?$/.test(v) || Number(v) > 1e9)) e[k] = `${label} must be a number (up to 2 decimals).`;
  }
  if (f.startDate && f.endDate && f.endDate < f.startDate) e.endDate = "End date is before the start date.";
  if (f.campaignRef.length > 200) e.campaignRef = "Campaign name is too long (200 characters max).";
  if (f.note.length > 400) e.note = "Note is too long (400 characters max).";
  if (f.adLink) {
    try {
      if (new URL(f.adLink).protocol !== "https:") throw new Error();
    } catch {
      e.adLink = "Ad link must be a full link starting with https://";
    }
  }
  return e;
}

function ManualCard({ listingId, channel, row, street }: { listingId: string; channel: AdChannel; row?: Row; street: string }) {
  const c = CHANNELS[channel];
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const blank = () => ({
    status: row?.status ?? "not_started", startDate: row?.startDate ?? "", endDate: row?.endDate ?? "",
    reach: row?.reach?.toString() ?? "", clicks: row?.clicks?.toString() ?? "", leads: row?.leads?.toString() ?? "",
    spend: row?.spend?.toString() ?? "", budget: row?.budget?.toString() ?? "",
    campaignRef: row?.campaignRef ?? "", adLink: row?.adLink ?? "", note: row?.note ?? "",
  });
  const [f, setF] = useState(blank);
  const [open, setOpen] = useState(false);
  useEffect(() => setF(blank()), [row?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof ReturnType<typeof blank>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: ["reach", "clicks", "leads", "spend", "budget"].includes(k) ? e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 13) : k === "adLink" ? e.target.value.trim() : e.target.value });
  const n = (s: string) => (s === "" ? null : Number(s));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = checkAd(f);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await listingAdsApi.save(listingId, channel, {
        status: f.status, startDate: f.startDate || null, endDate: f.endDate || null, reach: n(f.reach), clicks: n(f.clicks), leads: n(f.leads),
        spend: n(f.spend), budget: n(f.budget), campaignRef: f.campaignRef.trim() || null, adLink: f.adLink || null, note: f.note.trim() || null,
      });
      toast.success(f.status === "not_started" ? "Saved" : "Saved. Your seller sees the results now.");
      setOpen(false);
      setErrors({});
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  const fe = (k: string) => <FieldError msg={errors[k]} />;
  const cpl = row?.spend && row?.leads ? row.spend / row.leads : undefined;
  const auto = !!row && (row.source === "meta" || row.source === "google_ads");
  const matched: { id: string; name: string; status: string }[] = auto && row?.campaigns ? JSON.parse(row.campaigns) : [];
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5" data-testid={`ad-card-${channel}`}>
      <div className="flex items-center gap-3">
        <img src={c.icon} alt="" className="size-9 rounded-lg bg-stone-50 object-contain p-1 ring-1 ring-black/5" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{c.name}</div>
          <div className="text-xs text-stone-500">
            {auto ? `Automatic from ${AUTO_FROM[row!.source]} · ${dates(row!.startDate, row!.endDate) || "no dates"} · updated ${ago(row!.updatedAt)}`
              : row ? `${dates(row.startDate, row.endDate) || "No dates"} · typed in · updated ${ago(row.updatedAt)}` : channel === "lofty" ? "Typed in by you" : "Not started"}
          </div>
        </div>
        <StatusPill s={row?.status ?? "not_started"} />
      </div>
      {row && row.status !== "not_started" && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          <Num label={c.reach} value={fmtN(row.reach)} />
          <Num label={c.clicks} value={fmtN(row.clicks)} />
          <Num label={c.leads} value={fmtN(row.leads)} />
          <Num label="Spend 🔒" value={fmtMoney(row.spend)} />
          <Num label="Cost / lead 🔒" value={fmtMoney(cpl)} />
        </div>
      )}
      {auto && matched.length > 0 && (
        <p className="mt-3 text-[15px] text-stone-600" data-testid={`ad-auto-${channel}`}>
          Numbers fill in by themselves from {matched.length === 1 ? "campaign" : `${matched.length} campaigns`} {matched.map(m => `“${m.name}”`).join(", ")}.
        </p>
      )}
      {row?.error && auto && <p className="mt-2 flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="size-3.5" /> Last update failed: {row.error}</p>}
      {!auto && !open && channel !== "lofty" && (
        <p className="mt-3 text-[15px] text-stone-600">Type the numbers from {channel === "meta" ? "Meta Ads Manager" : "Google Ads"}. Put the street (“{street}”) in the campaign name so they fill in by themselves once {channel === "meta" ? "Meta Ads" : "Google Ads"} is connected.</p>
      )}
      {!auto && !open && channel === "lofty" && (
        <p className="mt-3 text-[15px] text-stone-600">Lofty doesn't share ad numbers with other apps, so type these from Lofty's ad report.</p>
      )}
      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-3 rounded-xl bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white">
          {auto ? "Edit link & note" : row ? "Update numbers" : channel === "lofty" ? "Add campaign" : "Add campaign name"}
        </button>
      ) : auto ? (
        <form onSubmit={submit} noValidate className="mt-4 space-y-3 border-t border-stone-100 pt-4">
          <label className="block text-xs font-medium text-stone-600">Campaign name (leave empty to match by street)<input maxLength={200} className={`${inputCls} ${errorBorder(errors.campaignRef)}`} value={f.campaignRef} onChange={set("campaignRef")} />{fe("campaignRef")}</label>
          <label className="block text-xs font-medium text-stone-600">Total budget ($) 🔒<input inputMode="decimal" className={`${inputCls} ${errorBorder(errors.budget)}`} value={f.budget} onChange={set("budget")} />{fe("budget")}</label>
          <label className="block text-xs font-medium text-stone-600">Ad link for the seller (optional)<input type="url" maxLength={600} className={`${inputCls} ${errorBorder(errors.adLink)}`} value={f.adLink} onChange={set("adLink")} placeholder="https://…" />{fe("adLink")}</label>
          <label className="block text-xs font-medium text-stone-600">Note for the seller (optional)<textarea maxLength={400} className={`${inputCls} min-h-[60px] ${errorBorder(errors.note)}`} value={f.note} onChange={set("note")} />{fe("note")}</label>
          <div className="flex gap-2">
            <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-[#9C7434] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy && <Loader2 className="size-4 animate-spin" />}Save</button>
            <button type="button" onClick={() => { setF(blank()); setErrors({}); setOpen(false); }} className="rounded-xl px-4 py-2 text-sm ring-1 ring-stone-200">Cancel</button>
          </div>
        </form>
      ) : (
        <form onSubmit={submit} noValidate className="mt-4 space-y-3 border-t border-stone-100 pt-4">
          <p className="text-xs text-stone-500">Where to find it: {c.where}</p>
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-xs font-medium text-stone-600">Status
              <select aria-label={`${channel} status`} className={inputCls} value={f.status} onChange={set("status")}>
                {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-stone-600">Start<input type="date" className={`${inputCls} ${errorBorder(errors.startDate)}`} value={f.startDate} onChange={set("startDate")} />{fe("startDate")}</label>
            <label className="block text-xs font-medium text-stone-600">End<input type="date" min={f.startDate || undefined} className={`${inputCls} ${errorBorder(errors.endDate)}`} value={f.endDate} onChange={set("endDate")} />{fe("endDate")}</label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-xs font-medium text-stone-600">{c.reach}<input aria-label={`${channel} reach`} inputMode="numeric" className={`${inputCls} ${errorBorder(errors.reach)}`} value={f.reach} onChange={set("reach")} />{fe("reach")}</label>
            <label className="block text-xs font-medium text-stone-600">{c.clicks}<input aria-label={`${channel} clicks`} inputMode="numeric" className={`${inputCls} ${errorBorder(errors.clicks)}`} value={f.clicks} onChange={set("clicks")} />{fe("clicks")}</label>
            <label className="block text-xs font-medium text-stone-600">{c.leads}<input aria-label={`${channel} leads`} inputMode="numeric" className={`${inputCls} ${errorBorder(errors.leads)}`} value={f.leads} onChange={set("leads")} />{fe("leads")}</label>
          </div>
          <div className="rounded-xl bg-stone-50 p-3">
            <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-stone-600"><Lock className="size-3" /> Agent only: sellers never see these</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="block text-xs font-medium text-stone-600">Spent so far ($)<input aria-label={`${channel} spend`} inputMode="decimal" className={`${inputCls} ${errorBorder(errors.spend)}`} value={f.spend} onChange={set("spend")} />{fe("spend")}</label>
              <label className="block text-xs font-medium text-stone-600">Total budget ($)<input inputMode="decimal" className={`${inputCls} ${errorBorder(errors.budget)}`} value={f.budget} onChange={set("budget")} />{fe("budget")}</label>
              <label className="col-span-2 block text-xs font-medium text-stone-600 sm:col-span-1">Campaign name<input maxLength={200} className={`${inputCls} ${errorBorder(errors.campaignRef)}`} value={f.campaignRef} onChange={set("campaignRef")} placeholder="As named in the ads account" />{fe("campaignRef")}</label>
            </div>
          </div>
          <label className="block text-xs font-medium text-stone-600">Ad link for the seller (optional)<input type="url" maxLength={600} className={`${inputCls} ${errorBorder(errors.adLink)}`} value={f.adLink} onChange={set("adLink")} placeholder="https://…" />{fe("adLink")}</label>
          <label className="block text-xs font-medium text-stone-600">Note for the seller (optional)<textarea maxLength={400} className={`${inputCls} min-h-[60px] ${errorBorder(errors.note)}`} value={f.note} onChange={set("note")} placeholder="Targeting buyers in Naperville & Wheaton, 25–55" />{fe("note")}</label>
          <div className="flex gap-2">
            <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-[#9C7434] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy && <Loader2 className="size-4 animate-spin" />}{busy ? "Saving…" : `Save ${c.name.split(" ")[0]}`}</button>
            <button type="button" onClick={() => { setF(blank()); setErrors({}); setOpen(false); }} className="rounded-xl px-4 py-2 text-sm ring-1 ring-stone-200">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function WebsiteCard({ row, match, refreshing, connected }: { row?: Row; match: { patterns: string[]; by: string[]; offSite?: string }; refreshing: boolean; connected: boolean }) {
  const c = CHANNELS.website;
  const hasData = !!row && row.updatedAt > 0;
  const startDate = row?.startDate;
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5" data-testid="ad-card-website">
      <div className="flex items-center gap-3">
        <img src={c.icon} alt="" className="size-9 rounded-lg bg-stone-50 object-contain p-1 ring-1 ring-black/5" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{c.name}</div>
          <div className="text-xs text-stone-500">
            Automatic from Google Analytics{hasData ? ` · updated ${ago(row!.updatedAt)}` : ""}
          </div>
        </div>
        <button
          aria-label="Refresh website numbers"
          disabled={refreshing || !match.patterns.length || !connected}
          title={connected ? "Refresh" : "Google Analytics isn't connected yet"}
          onClick={() => toast.message("Google Analytics isn't connected yet.")}
          className="grid size-9 place-items-center rounded-full ring-1 ring-stone-200 disabled:opacity-40"
        >
          {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </button>
      </div>
      {!connected ? (
        <p className="mt-3 text-sm text-stone-600">Website visits come from Google Analytics, which isn't connected to the new Hub yet. They'll fill in by themselves once it is.</p>
      ) : !match.patterns.length ? (
        <p className="mt-3 text-sm text-stone-600">Add the MLS # or the property website link in <b>Details</b> and this fills in by itself.</p>
      ) : hasData ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Num label="Visitors" value={fmtN(row!.reach)} />
            <Num label="Page views" value={fmtN(row!.views)} />
            <Num label="Inquiries" value={fmtN(row!.leads)} />
            <Num label="Contact clicks" value={fmtN(row!.clicks)} />
          </div>
          {row!.pages.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-stone-500">
              {row!.pages.map(p => <li key={p.host + p.path} className="flex justify-between gap-3"><span className="truncate">{p.host}{p.path}</span><span className="shrink-0 font-semibold text-stone-700">{p.views}</span></li>)}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-stone-500">No visits found yet on spacematchinc.com or teamspacematch.com for this listing.</p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-stone-600">{refreshing ? "Checking Google Analytics…" : "Tap refresh to pull the numbers now (they also update twice a day)."}</p>
      )}
      {match.patterns.length > 0 && <p className="mt-2 text-[11px] text-stone-400">Matched by {match.by.join(", ")}. Counts spacematchinc.com and teamspacematch.com pages since {startDate ? fmtDay(startDate) : "the live date"}.</p>}
      {match.offSite && <p className="mt-1 text-[11px] text-amber-700">Your property website ({match.offSite}) isn't in Google Analytics, so its visits aren't counted here.</p>}
      {row?.error && <p className="mt-2 flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="size-3.5" /> Last update failed: {row.error}</p>}
    </div>
  );
}

export function AgentAdCampaigns({ listingId }: { listingId: string }) {
  const { data, error, reload } = useAdsData(listingId);
  if (data === undefined && error) return <LoadError error={error} onRetry={() => void reload()} what="ad campaigns" />;
  if (data === undefined) return <Skeleton label="Loading ad campaigns and web reporting" rows={2} />;
  const by = (ch: string) => data.rows.find(r => r.channel === ch);
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[#9C7434]/10 p-3 text-sm text-stone-700 ring-1 ring-[#9C7434]/20">
        Sellers see each campaign's status, dates, reach, clicks and leads on their page. <b>Spend and budget stay private.</b> Type each campaign's numbers from its ads account; they'll fill in by themselves once Meta and Google Ads are connected.
      </div>
      {data.rows.length === 0 && <p className="px-1 text-sm text-stone-600">No campaign or website results yet. Results will appear here as they come in.</p>}
      <WebsiteCard row={by("website")} match={data.webMatch} refreshing={data.webRefreshing} connected={data.webConnected} />
      {(["meta", "google", "lofty"] as const).map(ch => <ManualCard key={ch} listingId={listingId} channel={ch} row={by(ch)} street={data.street} />)}
      {data.staff && (
        <p className="px-1 text-xs text-stone-500">Admin: Instagram/Facebook and Google cards read the SpaceMatch Meta Ads and Google Ads accounts twice a day. Lofty has no ads feed, so its numbers are typed in.</p>
      )}
    </div>
  );
}
