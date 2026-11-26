import { Check, Eye, Heart, Home, Mail, MessageSquare, Phone, PlayCircle, Globe, Users, CalendarCheck, ThumbsUp, Megaphone, Loader2, Lightbulb, ArrowUpRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { LAUNCH_STEPS } from "../../convex/launchSteps";
import { SellerAdCampaigns } from "../components/hub/AdCampaigns";
import { SellerMarketSection } from "@/components/cma/SellerMarketSection";
import { listingsApi, type PortalData as ApiPortalData, useListingsData } from "@/lib/listingsApi";

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 14 ? `${d}d ago` : new Date(t).toLocaleDateString();
};
const fmtDate = (t?: number) => (t ? new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");
const daysOn = (live?: string) => {
  if (!live) return null;
  const d = Math.floor((Date.now() - new Date(`${live}T12:00:00`).getTime()) / 864e5);
  return d >= 0 ? d : null;
};
const wkLabel = (w: string) => new Date(`${w}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Eye; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-stone-500">
        <Icon className="size-4 text-[#9C7434]" /> {label}
      </div>
      <div className="mt-2 font-display text-3xl text-[#0A0A0A]">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-stone-500">{sub}</div>}
    </div>
  );
}

type PortalData = ApiPortalData;

// One row per channel the listing Reel is on. Channels with no number are hidden.
function SocialReel({ data }: { data: PortalData }) {
  const m = data.metrics;
  const latest = (k: "reelViews" | "fbViews" | "tiktokViews" | "youtubeViews") => [...m].reverse().find(x => x[k] != null);
  const rows = ([
    ["Instagram", "reelViews", "reel", data.links.reel, data.social.reelCheckedAt],
    ["Facebook", "fbViews", "facebook", data.links.facebook, undefined],
    ["TikTok", "tiktokViews", "tiktok", data.links.tiktok, undefined],
    ["YouTube Shorts", "youtubeViews", "youtube", data.links.youtube, data.social.youtubeCheckedAt],
  ] as const).flatMap(([label, k, autoKey, href, checked]) => {
    const r = latest(k);
    const views = r?.[k];
    if (r == null || views == null || views <= 0) return [];
    const auto = !!autoKey && r.auto.includes(autoKey);
    return [{ label, views, href, note: auto ? `Updated ${ago(checked ?? r.updatedAt)}` : `Entered by your agent ${ago(r.updatedAt)}` }];
  });
  if (!rows.length) return null;
  const max = Math.max(...rows.map(r => r.views));
  const total = rows.reduce((a, r) => a + r.views, 0);
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5" data-testid="social-reel">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl">Your Reel across social</h2>
        <span className="text-[15px] text-stone-600">{total.toLocaleString()} views</span>
      </div>
      <ul className="mt-4 space-y-4">
        {rows.map(r => (
          <li key={r.label} data-testid={`social-${r.label.split(" ")[0].toLowerCase()}`}>
            <div className="flex items-baseline justify-between gap-3">
              {r.href ? (
                <a href={r.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold">{r.label}<ArrowUpRight className="size-4 text-[#9C7434]" aria-hidden /></a>
              ) : <span className="font-semibold">{r.label}</span>}
              <span className="font-display text-2xl">{r.views.toLocaleString()}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-gradient-to-r from-[#9C7434] to-[#D9BC8C]" style={{ width: `${Math.max(4, (r.views / max) * 100)}%` }} />
            </div>
            <div className="mt-1 text-sm text-stone-500">{r.note}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NextSteps({ data, token, demo }: { data: PortalData; token: string; demo?: boolean }) {
  const [demoApprovedAt, setDemoApprovedAt] = useState<number | null>(null);
  const approve = async (a: { token: string }) => { if (demo) setDemoApprovedAt(Date.now()); else await listingsApi.approvePlan(a.token); };
  const [busy, setBusy] = useState(false);
  const list = demo && demoApprovedAt ? data.suggestions.map(x => ({ ...x, approvedAt: x.approvedAt ?? demoApprovedAt })) : data.suggestions;
  if (!list.length) return null;
  const open = list.filter(s => !s.approvedAt);
  const lastApproved = Math.max(0, ...list.map(s => s.approvedAt ?? 0));
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5" data-testid="next-steps">
      <h2 className="flex items-center gap-2 font-display text-xl"><Lightbulb className="size-5 text-[#9C7434]" aria-hidden /> What we'd do next</h2>
      <p className="mt-1 text-[15px] text-stone-600">Based on your listing's numbers so far. Your agent reviewed each one.</p>
      <ol className="mt-4 space-y-3">
        {list.map((s, i) => (
          <li key={s._id} className="rounded-xl bg-[#F7F5F1] p-4">
            <div className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#9C7434] text-sm font-bold text-white">{s.approvedAt ? <Check className="size-4" /> : i + 1}</span>
              <div className="min-w-0">
                <div className="font-semibold">{s.title}</div>
                {s.why && <p className="mt-0.5 text-[15px] text-stone-600">{s.why}</p>}
                {s.action && <p className="mt-1 text-[15px]"><b>What we'll do:</b> {s.action}</p>}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {open.length > 0 ? (
        <button
          type="button" disabled={busy}
          onClick={async () => { setBusy(true); try { await approve({ token }); } finally { setBusy(false); } }}
          className="mt-4 w-full rounded-xl bg-[#0A0A0A] py-3 text-[17px] font-semibold text-white active:scale-[0.99] disabled:opacity-60"
        >{busy ? "Sending…" : "Approve plan"}</button>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold text-emerald-700" data-testid="plan-approved"><Check className="size-5" /> You approved this plan {ago(lastApproved)}. Your agent has been told.{demo ? " (Demo: nothing was sent.)" : ""}</p>
      )}
      <p className="mt-2 text-sm text-stone-500">Questions? Text or call your agent below before approving.</p>
    </section>
  );
}

export function SellerPortalPage() {
  const { token = "" } = useParams();
  // Poll for seller-visible updates such as new open-house sign-ins.
  const res = useListingsData(`portal:${token}`, () => listingsApi.portal(token), { pollMs: 15_000 });
  // undefined = loading, null = link not found (or expired)
  const data = res.notFound ? null : res.data;
  useEffect(() => {
    if (data) void listingsApi.portalSeen(token).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data, token]);
  useEffect(() => {
    if (data) document.title = `${data.address.split(",")[0]} · SpaceMatch`;
  }, [data]);

  if (data === undefined)
    return <div className="grid min-h-svh place-items-center bg-[#F7F5F1]"><Loader2 className="size-6 animate-spin text-[#9C7434]" /></div>;
  if (data === null)
    return (
      <div className="grid min-h-svh place-items-center bg-[#F7F5F1] p-6 text-center">
        <div>
          <div className="mb-6 text-xs font-bold tracking-[0.35em] text-[#9C7434]">SPACEMATCH</div>
          <h1 className="font-display text-2xl">This link has expired</h1>
          <p className="mt-2 text-stone-600">Please ask your SpaceMatch agent for a new link.</p>
        </div>
      </div>
    );

  return <SellerPortalView data={data} token={token} />;
}

export type SellerPortalData = PortalData;

export function SellerPortalView({ data, token, demo, top, bottom }: { data: PortalData; token: string; demo?: boolean; top?: ReactNode; bottom?: ReactNode }) {
  const done = data.steps.filter(s => s.done).length;
  const pct = Math.round((done / Math.max(1, data.steps.length)) * 100);
  const next = data.steps.find(s => !s.done);
  const dom = daysOn(data.liveDate);
  const m = data.metrics;
  // Each number comes from its own latest week (Zillow emails, Instagram and the agent's form fill different rows).
  const lastZ = [...m].reverse().find(x => x.zillowViews != null || x.zillowSaves != null);
  const lastR = [...m].reverse().find(x => x.reelViews != null);
  const lastM = [...m].reverse().find(x => x.mlsSaved != null || x.mlsMaybe != null || x.mlsNotInterested != null);
  // Zillow's own page total (read twice a week) beats our weekly sum when it is higher.
  const totalViews = Math.max(m.reduce((a, x) => a + (x.zillowViews ?? 0), 0), data.zillowTotals?.views ?? 0);
  const totalSaves = Math.max(m.reduce((a, x) => a + (x.zillowSaves ?? 0), 0), data.zillowTotals?.saves ?? 0);
  const maxViews = Math.max(1, ...m.map(x => x.zillowViews ?? 0));
  const feedback = data.events.filter(e => e.kind === "feedback");
  const updates = data.events.filter(e => e.kind !== "feedback");
  const linkBtns = [
    { href: data.links.zillow, label: "Zillow", icon: Home },
    { href: data.links.website, label: "Property website", icon: Globe },
    { href: data.links.reel, label: "Instagram Reel", icon: PlayCircle },
    { href: data.links.tour, label: "3D tour", icon: Eye },
  ].filter(l => l.href);

  return (
    <div className="min-h-svh bg-[#F7F5F1] text-[#0A0A0A]">
      <header className="bg-[#0A0A0A] px-5 pb-8 pt-5 text-white" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between">
            <img src="/logo-white.png" alt="SpaceMatch" className="h-6" />
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] text-[#D9BC8C]">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> {demo ? "Demo · sample listing" : <>Live · updated {ago(data.updatedAt)}</>}
            </span>
          </div>
          <p className="mt-7 text-[11px] uppercase tracking-[0.3em] text-[#D9BC8C]">Your listing launch</p>
          <h1 className="mt-2 font-display text-[28px] leading-tight sm:text-4xl">{data.address.split(",")[0]}</h1>
          <p className="mt-1 text-sm text-white/60">{data.address.split(",").slice(1).join(",").trim()}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-[#9C7434] px-3 py-1 font-semibold">{data.status}</span>
            {data.price && <span className="rounded-full bg-white/10 px-3 py-1">{data.price}</span>}
            {dom !== null && <span className="rounded-full bg-white/10 px-3 py-1">{dom} day{dom === 1 ? "" : "s"} on market</span>}
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-4 max-w-3xl space-y-5 px-4 pb-16">
        {top}
        {data.photoUrl && <img src={data.photoUrl} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover shadow-lg" />}

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <p className="text-[15px]">Hi {data.sellerFirstName}, this page updates live as we launch and market your home.</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-gradient-to-r from-[#9C7434] to-[#D9BC8C] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-semibold">{done}/{data.steps.length}</span>
          </div>
          {next && <p className="mt-2 text-sm text-stone-600">Next up: <b>{LAUNCH_STEPS.find(s => s.key === next.key)?.label}</b></p>}
        </section>

        <section>
          <h2 className="mb-3 px-1 font-display text-xl">How buyers are responding</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat icon={CalendarCheck} label="Showings" value={data.counts.showings} sub="booked via ShowingTime" />
            <Stat icon={Users} label="Open house" value={data.counts.openHouse} sub="visitors signed in" />
            <Stat icon={Eye} label="Zillow views" value={lastZ?.zillowViews ?? data.zillowTotals?.views ?? "–"} sub={lastZ ? `week of ${wkLabel(lastZ.weekOf)} · ${totalViews.toLocaleString()} total` : data.zillowTotals ? "total on Zillow so far" : "first numbers after launch"} />
            <Stat icon={Heart} label="Zillow saves" value={lastZ?.zillowSaves ?? data.zillowTotals?.saves ?? "–"} sub={lastZ ? `${totalSaves.toLocaleString()} total` : data.zillowTotals ? "total on Zillow so far" : undefined} />
            <Stat icon={ThumbsUp} label="Buyer feedback" value={data.counts.feedback} sub="from showing agents" />
            {lastR && lastR.reelViews != null ? (
              <Stat icon={Megaphone} label="Reel views" value={lastR.reelViews.toLocaleString()} sub={lastR.auto?.includes("reel") ? "total so far on Instagram" : `week of ${wkLabel(lastR.weekOf)}`} />
            ) : null}
          </div>

          {lastM && (
            <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-black/5">
              <div className="text-[12px] uppercase tracking-[0.12em] text-stone-500">MLS buyers' reactions · week of {wkLabel(lastM.weekOf)}</div>
              <div className="mt-3 grid grid-cols-3 text-center">
                {[["Favorite", lastM.mlsSaved, "text-emerald-700"], ["Maybe", lastM.mlsMaybe, "text-amber-700"], ["Not for them", lastM.mlsNotInterested, "text-stone-500"]].map(([l, n, c]) => (
                  <div key={l as string}><div className={`font-display text-2xl ${c}`}>{(n as number | undefined) ?? 0}</div><div className="text-xs text-stone-500">{l as string}</div></div>
                ))}
              </div>
            </div>
          )}

          {m.filter(x => x.zillowViews != null).length > 1 && (
            <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-black/5">
              <div className="text-[12px] uppercase tracking-[0.12em] text-stone-500">Zillow views by week</div>
              <div className="mt-4 flex h-28 items-end gap-2">
                {m.filter(x => x.zillowViews != null).slice(-8).map(x => (
                  <div key={x.weekOf} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[11px] font-semibold">{x.zillowViews ?? 0}</span>
                    <div className="w-full rounded-t-md bg-[#D9BC8C]" style={{ height: `${Math.max(4, ((x.zillowViews ?? 0) / maxViews) * 80)}px` }} />
                    <span className="text-[10px] text-stone-500">{wkLabel(x.weekOf)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <SocialReel data={data} />

        {/* Market & pricing: the agent-published CMA only (hidden on the public demo). */}
        {!demo && <SellerMarketSection token={token} />}

        <NextSteps data={data} token={token} demo={demo} />

        <SellerAdCampaigns ads={data.ads} />

        <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
          <h2 className="font-display text-xl">Launch timeline</h2>
          <ol className="mt-4">
            {LAUNCH_STEPS.map((def, i) => {
              const s = data.steps.find(x => x.key === def.key);
              const isNext = next?.key === def.key;
              return (
                <li key={def.key} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < LAUNCH_STEPS.length - 1 && <span className={`absolute left-[13px] top-7 h-[calc(100%-20px)] w-0.5 ${s?.done ? "bg-[#9C7434]" : "bg-stone-200"}`} />}
                  <span className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${s?.done ? "bg-[#9C7434] text-white" : isNext ? "bg-white text-[#9C7434] ring-2 ring-[#9C7434]" : "bg-stone-100 text-stone-400"}`}>
                    {s?.done ? <Check className="size-4" /> : i + 1}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div className={`font-semibold ${s?.done ? "" : isNext ? "text-[#9C7434]" : "text-stone-500"}`}>
                      {def.label} {s?.doneAt && <span className="ml-1 text-xs font-normal text-stone-500">· {fmtDate(s.doneAt)}</span>}
                      {isNext && <span className="ml-2 rounded-full bg-[#9C7434]/10 px-2 py-0.5 text-[11px] font-semibold text-[#9C7434]">Up next</span>}
                    </div>
                    <p className="text-sm text-stone-600">{s?.note || def.seller}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {linkBtns.length > 0 && (
          <section className="grid grid-cols-2 gap-3">
            {linkBtns.map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl bg-white p-4 text-sm font-semibold ring-1 ring-black/5 active:scale-[0.99]">
                <l.icon className="size-5 text-[#9C7434]" /> {l.label}
              </a>
            ))}
          </section>
        )}

        <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
          <h2 className="font-display text-xl">Buyer feedback</h2>
          {feedback.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">Feedback from showing agents will appear here after your agent reviews it.</p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {feedback.map(e => (
                <li key={e._id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span>{e.when || fmtDate(e.createdAt)}</span>
                    {e.interest && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">{e.interest}</span>}
                    {e.priceOpinion && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">Price: {e.priceOpinion}</span>}
                    {e.rating && <span className="rounded-full bg-[#D9BC8C]/30 px-2 py-0.5 text-stone-800">★ {e.rating}/5</span>}
                  </div>
                  {e.body && <p className="mt-1.5 text-[15px]">“{e.body}”</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
          <h2 className="font-display text-xl">Updates from your agent</h2>
          {updates.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">Showings, offers and news will show up here.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {updates.map(e => (
                <li key={e._id} className="flex gap-3">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${e.kind === "offer" ? "bg-emerald-500" : e.kind === "showing" ? "bg-[#9C7434]" : "bg-stone-400"}`} />
                  <div>
                    <div className="font-semibold">{e.title}{e.when && <span className="font-normal text-stone-500"> · {e.when}</span>}</div>
                    {e.body && <p className="whitespace-pre-line text-sm text-stone-700">{e.body}</p>}
                    <div className="text-xs text-stone-400">{ago(e.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-[#0A0A0A] p-5 text-white">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#D9BC8C]">Your agent</p>
          <div className="mt-1 font-display text-2xl">{data.agent.name}</div>
          <p className="text-sm text-white/60">{demo ? "SpaceMatch Inc." /* public demo: no brokerage name until Michael says (10-24) */ : "SpaceMatch Inc. · a team of Real Broker, LLC"}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            {data.agent.phone && <a href={`tel:${data.agent.phone.replace(/\D/g, "")}`} className="flex flex-col items-center gap-1 rounded-xl bg-white/10 py-3"><Phone className="size-5 text-[#D9BC8C]" />Call</a>}
            {data.agent.phone && <a href={`sms:${data.agent.phone.replace(/\D/g, "")}`} className="flex flex-col items-center gap-1 rounded-xl bg-white/10 py-3"><MessageSquare className="size-5 text-[#D9BC8C]" />Text</a>}
            {data.agent.email && <a href={`mailto:${data.agent.email}`} className="flex flex-col items-center gap-1 rounded-xl bg-white/10 py-3"><Mail className="size-5 text-[#D9BC8C]" />Email</a>}
          </div>
        </section>

        {bottom}

        {!demo && <p className="px-2 text-center text-xs text-stone-500">
          Tip: tap Share → “Add to Home Screen” to keep this page one tap away. Showings, website visits, Zillow and Reel numbers update automatically; MLS numbers are updated weekly by your agent.
        </p>}
      </main>
    </div>
  );
}
