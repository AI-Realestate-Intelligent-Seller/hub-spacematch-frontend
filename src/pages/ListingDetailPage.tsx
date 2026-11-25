// Plan card and Zillow/Reel status still read the old backend (later slices of Wave 3).
import { useAction, useQuery } from "convex/react";
import { ArrowLeft, Check, ChevronDown, ClipboardPaste, Clapperboard, Copy, ExternalLink, Eye, EyeOff, FileBarChart, Mail, MailPlus, MessageSquare, RefreshCw, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { LAUNCH_STEPS, LISTING_STATUSES } from "../../convex/launchSteps";
import { parseShowingTime } from "../../convex/showingtimeParse";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FieldError, StatusChip, ago, errMsg, fieldCls, inputCls } from "./ListingsPage";
import { centsToPrice, check, detailsSchema, digitsOnly, eventSchema, orNull, priceToCents, rules, suggestionSchema, typeName, typePhone, typePrice } from "@/lib/listingForms";
import { fieldErrors, type Listing, type ListingEvent, type ListingMetric, listingsApi, useListingsData } from "@/lib/listingsApi";
import { formatFreeAddress, formatPrice } from "../../convex/address";
import { AgentAdCampaigns } from "../components/hub/AdCampaigns";
import { ListingAdOrder } from "../components/hub/AdOrder";
import { PlanBuilder } from "./ListingPlanPage";

type Tab = "steps" | "numbers" | "next" | "ads" | "activity" | "details";
const wkLabel = (w: string) => new Date(`${w}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const shiftWeek = (w: string, n: number) => new Date(new Date(`${w}T12:00:00Z`).getTime() + n * 7 * 864e5).toISOString().slice(0, 10);

function SellerLink({ l }: { l: Listing }) {
  const url = `${window.location.origin}/s/${l.token}`;
  const first = l.sellerName.split(/\s+/)[0];
  const msg = `Hi ${first}! Here's your private SpaceMatch page for ${l.address.split(",")[0]}. It updates live as we launch and market your home: ${url}`;
  return (
    <section className="rounded-2xl bg-[#0A0A0A] p-4 text-white">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.25em] text-[#D9BC8C]">Seller's live page</div>
        <div className="text-xs text-white/60">{l.sellerLastSeenAt ? `Seller opened ${ago(l.sellerLastSeenAt)}` : "Seller hasn't opened it yet"}</div>
      </div>
      <div className="mt-2 truncate rounded-lg bg-white/10 px-3 py-2 font-mono text-xs text-white/80">{url}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <button onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copied"))} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#9C7434] py-2.5 font-semibold"><Copy className="size-4" /> Copy</button>
        <a href={`sms:${(l.sellerPhone ?? "").replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(msg)}`} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5"><MessageSquare className="size-4" /> Text seller</a>
        <a href={`mailto:${l.sellerEmail ?? ""}?subject=${encodeURIComponent(`Your listing page · ${l.address.split(",")[0]}`)}&body=${encodeURIComponent(msg)}`} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5"><Mail className="size-4" /> Email seller</a>
        <a href={url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5"><ExternalLink className="size-4" /> Seller view</a>
      </div>
      <button onClick={() => confirm("Make a new link? The old one stops working.") && listingsApi.rotateLink(l._id).then(() => toast.success("New link made")).catch(err => toast.error(errMsg(err)))} className="mt-2 flex items-center gap-1 text-xs text-white/50 hover:text-white"><RefreshCw className="size-3" /> Reset link</button>
    </section>
  );
}

// One listing = one record: jump into other tools with this listing filled in,
// and see what's synced (Lofty contact, Zillow price/status).
function Connected({ l }: { l: Listing }) {
  const linkLofty = ({ id }: { id: string }) => listingsApi.linkLofty(id);
  const hasContact = !!(l.sellerEmail || l.sellerPhone);
  const zp = l.zillowPage;
  const zStatus: Record<string, string> = { FOR_SALE: "For sale", PENDING: "Pending", SOLD: "Sold", RECENTLY_SOLD: "Sold", COMING_SOON: "Coming soon", OFF_MARKET: "Off market" };
  const go = (to: string, icon: React.ReactNode, label: string) => (
    <Link to={`${to}?listing=${l._id}`} className="flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-sm font-semibold ring-1 ring-black/10 hover:ring-[#9C7434]">{icon}{label}</Link>
  );
  return (
    <section className="rounded-2xl bg-[#F7F5F1] p-4 ring-1 ring-[#D9BC8C]/50" data-testid="listing-connected">
      <div className="text-[11px] uppercase tracking-[0.25em] text-[#9C7434]">Use this listing</div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {go("/new", <FileBarChart className="size-4 text-[#9C7434]" />, "Request a CMA")}
        {go("/reels", <Clapperboard className="size-4 text-[#9C7434]" />, "Order a Reel")}
        {go("/seller-lists", <MailPlus className="size-4 text-[#9C7434]" />, "Mail the neighbors")}
      </div>
      <div className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="lofty-sync">
          <span className="font-semibold">Lofty:</span>
          {l.loftyLeadId ? (
            <span className="text-emerald-700"><Check className="mr-0.5 inline size-3.5" />Seller linked, tagged “Hub Listing”</span>
          ) : l.loftyError ? (
            <><span className="text-red-700">{l.loftyError}</span><button type="button" onClick={() => linkLofty({ id: l._id }).then(() => toast.success("Trying again…")).catch(err => toast.error(errMsg(err)))} className="font-semibold text-[#9C7434]">Try again</button></>
          ) : !hasContact ? (
            <span className="text-stone-500">Add the seller's email or phone (Details) and it links automatically.</span>
          ) : l.loftyAt === undefined ? (
            <><span className="text-stone-500">Linking…</span><button type="button" onClick={() => linkLofty({ id: l._id }).then(() => toast.success("Linking…")).catch(err => toast.error(errMsg(err)))} className="font-semibold text-[#9C7434]">Link now</button></>
          ) : <span className="text-stone-500">Not linked</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-2" data-testid="zillow-sync">
          <span className="font-semibold">Zillow:</span>
          {zp ? (
            <span className="text-stone-600">{zp.homeStatus ? zStatus[zp.homeStatus] ?? zp.homeStatus : "Found"}{zp.price ? ` · ${formatPrice(String(zp.price))}` : ""} · checked {ago(zp.checkedAt)}. Price and Pending/Sold update here by themselves.</span>
          ) : <span className="text-stone-500">Checked Mon + Thu once it's live. Price and Pending/Sold update here by themselves.</span>}
        </div>
      </div>
    </section>
  );
}

// Neighborhood & marketing plan (Michael 2026-11-08): builds by itself for new listings.
function PlanCard({ listingId }: { listingId: Id<"listings"> }) {
  const d = useQuery(api.listingPlans.forListing, { listingId }); // old backend until the plan slice moves
  if (!d) return null;
  const p = d.plan;
  const ready = p?.status === "ready" && p.plan;
  return (
    <section className="rounded-2xl bg-[#F7F5F1] p-4 ring-1 ring-[#D9BC8C]/50" data-testid="listing-plan-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-[#9C7434]">Neighborhood & marketing plan</div>
          <p className="mt-1 text-sm text-stone-600">{ready ? (p.plan as { headline?: string }).headline : "Highlights, census data, ideal buyers, schools, objection handlers, a max-offers marketing plan and a farming plan for this listing."}</p>
        </div>
        {ready && <Link to={`/listings/${listingId}/plan`} className="shrink-0 rounded-xl bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white" data-testid="plan-open">Open plan</Link>}
      </div>
      <div className="mt-3"><PlanBuilder listingId={listingId} plan={p} buildsLeft={d.buildsLeft} compact /></div>
    </section>
  );
}

function Steps({ l }: { l: Listing }) {
  const toggle = ({ id, key, done }: { id: string; key: string; done: boolean }) => listingsApi.toggleStep(id, key, done);
  return (
    <ul className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-black/5">
      {LAUNCH_STEPS.map(def => {
        const s = l.steps.find(x => x.key === def.key);
        return (
          <li key={def.key} className="flex items-center gap-3 p-3.5">
            <button
              aria-label={`Mark ${def.label} ${s?.done ? "not done" : "done"}`}
              onClick={() => toggle({ id: l._id, key: def.key, done: !s?.done }).catch(e => toast.error(errMsg(e)))}
              className={`grid size-8 shrink-0 place-items-center rounded-full ring-2 transition ${s?.done ? "bg-[#9C7434] text-white ring-[#9C7434]" : "text-transparent ring-stone-200 hover:ring-[#9C7434]"}`}
            >
              <Check className="size-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{def.label}</div>
              <div className="text-xs text-stone-500">{s?.done && s.doneAt ? `Done ${new Date(s.doneAt).toLocaleDateString()}` : def.seller}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const FIELDS = [
  ["zillowViews", "Zillow views"],
  ["zillowSaves", "Zillow saves"],
  ["mlsSaved", "MLS: favorite"],
  ["mlsMaybe", "MLS: maybe"],
  ["mlsNotInterested", "MLS: not interested"],
  ["reelViews", "Reel views (optional)"],
] as const;
type Metric = ListingMetric;
const autoKind = (k: string) => (k.startsWith("zillow") ? "zillow" : k === "reelViews" ? "reel" : k === "youtubeViews" ? "youtube" : "");
// The listing Reel on other channels: lifetime views (+ optional link). TikTok/Facebook have no feed.
const SOCIAL = [
  ["tiktokViews", "TikTok views", "tiktokLink", "tiktok"],
  ["fbViews", "Facebook views", "facebookLink", "facebook"],
  ["youtubeViews", "YouTube Shorts views", "", "youtube"],
] as const;

function CopyChip({ text }: { text: string }) {
  return (
    <button type="button" onClick={() => { void navigator.clipboard.writeText(text); toast.success("Copied"); }} className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[14px] text-stone-800 ring-1 ring-stone-200">
      {text} <Copy className="size-3.5" aria-hidden />
    </button>
  );
}

// One-time Gmail setup so Zillow (and ShowingTime) emails reach team@ by themselves.
function ForwardHelp({ myEmail }: { myEmail: string }) {
  const getCode = useAction(api.zillow.forwardingCode);
  const [email, setEmail] = useState(myEmail);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const lookup = async () => {
    setBusy(true); setCode(null);
    try {
      const r = await getCode({ email });
      if (r) setCode(r.code);
      else toast.message("No code yet. Gmail can take a minute, so try again shortly.");
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <ol className="mt-3 list-decimal space-y-3 pl-5 text-[15px] text-stone-700" data-testid="forward-help">
      <li>Open Gmail on a computer, in the inbox that gets Zillow's emails. Go to <b>Settings → See all settings → Forwarding and POP/IMAP → Add a forwarding address</b> and enter <CopyChip text="team@spacematchinc.com" />.</li>
      <li>Gmail asks for a confirmation code. Get it here:
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input className={`${inputCls} max-w-xs`} value={email} onChange={e => setEmail(e.target.value)} aria-label="Your Gmail address" placeholder="you@gmail.com" />
          <button type="button" onClick={lookup} disabled={busy} className="rounded-xl bg-[#0A0A0A] px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Checking…" : "Get my code"}</button>
          {code && <span className="rounded-lg bg-emerald-50 px-3 py-1.5 font-mono text-lg font-bold tracking-wider text-emerald-800" data-testid="forward-code">{code}</span>}
        </div>
      </li>
      <li>In Gmail's search bar, open <b>Show search options</b>, put <CopyChip text="my-listing@mail.zillow.com" /> in <b>From</b>, tap <b>Create filter</b>, tick <b>Forward it to team@spacematchinc.com</b>, then <b>Create filter</b>. That's it.</li>
      <li className="text-stone-500">Do it once. Every listing after that fills in by itself. A second filter for ShowingTime emails makes showings and feedback automatic too.</li>
    </ol>
  );
}

function AutoSources({ l, myEmail }: { l: Listing; myEmail: string }) {
  const z = useQuery(api.zillow.forListing, { id: l._id as Id<"listings"> }); // old backend until the Zillow slice moves
  const [open, setOpen] = useState(false);
  if (!z) return null;
  const lastDay = z.days[0];
  const street = l.address.split(",")[0];
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5" data-testid="auto-sources">
      <div className="font-semibold">Filled in automatically</div>
      <div className="mt-3 space-y-4">
        <div className="flex gap-3">
          <span className={`mt-1 size-2.5 shrink-0 rounded-full ${lastDay || z.page ? "bg-emerald-500" : "bg-stone-300"}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Zillow views and saves</div>
            {z.page ? (
              <p className="text-[15px] text-stone-600" data-testid="zillow-page-status">On. The Zillow page shows {z.page.views.toLocaleString()} views and {z.page.saves.toLocaleString()} saves in total (checked {new Date(z.page.checkedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}). We read it every Monday and Thursday morning, so weekly numbers fill in by themselves.</p>
            ) : (
              <p className="text-[15px] text-stone-600" data-testid="zillow-page-status">Once the listing is <b>Active</b>, we read its public Zillow page every Monday and Thursday morning, so nothing to do. Pasting the Zillow link under Details makes it exact.</p>
            )}
            {lastDay ? (
              <p className="text-[15px] text-stone-600" data-testid="zillow-status">On. Latest Zillow report: {new Date(`${lastDay.day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} had {lastDay.views} views and {lastDay.saves} saves. Weekly totals update twice a day.</p>
            ) : (
              <p className="text-[15px] text-stone-500" data-testid="zillow-status">Optional, for day-by-day numbers: if a Zillow account gets the “Daily Listing Report” email for {street}, forward it to team@.</p>
            )}
            <button type="button" onClick={() => setOpen(!open)} className="mt-1 inline-flex items-center gap-1 text-[15px] font-semibold text-[#7A5A25]">
              How to forward Zillow emails (optional, 2 minutes, once) <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {open && <ForwardHelp myEmail={myEmail} />}
          </div>
        </div>
        <div className="flex gap-3">
          <span className={`mt-1 size-2.5 shrink-0 rounded-full ${z.reel ? "bg-emerald-500" : "bg-stone-300"}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Instagram Reel views</div>
            {z.reel ? (
              <p className="text-[15px] text-stone-600" data-testid="reel-status">On. <a href={z.reel.permalink} target="_blank" rel="noreferrer" className="font-semibold text-[#7A5A25] underline">The Reel</a> has {z.reel.views.toLocaleString()} views{z.reel.matchedBy === "caption" ? " (found by the address in its caption)" : ""}. Updates twice a day.</p>
            ) : (
              <p className="text-[15px] text-stone-600" data-testid="reel-status">Not yet. Once the Reel is on @spacematchchicago with “{street.replace(/\s+(st|ave|rd|blvd|dr|ct|pl|ln|pkwy|ter|way)\.?$/i, "")}” in the caption, its views show up here. You can also paste the Reel link under Details.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Numbers({ l, metrics, thisWeek, myEmail }: { l: Listing; metrics: Metric[]; thisWeek: string; myEmail: string }) {
  const [wk, setWk] = useState(thisWeek);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const cur = metrics.find(m => m.weekOf === wk);
  const isAuto = (k: string) => !!cur?.auto?.includes(autoKind(k));
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => {
    setVals({
      ...Object.fromEntries([...FIELDS, ...SOCIAL].map(([k]) => [k, cur?.[k] != null ? String(cur[k]) : ""])),
      tiktokLink: l.links?.tiktok ?? "", facebookLink: l.links?.facebook ?? "",
    });
  }, [wk, cur?._id, cur?.updatedAt, l.links?.tiktok, l.links?.facebook]);
  const validate = (v: Record<string, string>) => {
    const errs: Record<string, string> = {};
    for (const [k] of [...FIELDS, ...SOCIAL]) {
      const r = rules.count.safeParse(v[k] ?? "");
      if (!r.success) errs[k] = r.error.issues[0]?.message ?? "Use a whole number.";
    }
    for (const k of ["tiktokLink", "facebookLink"]) {
      const r = rules.httpsUrl.safeParse((v[k] ?? "").trim());
      if (!r.success) errs[k] = r.error.issues[0]?.message ?? "Use a full link starting with https://";
    }
    return errs;
  };
  const setVal = (k: string, value: string) => {
    const next = { ...vals, [k]: value };
    setVals(next);
    if (errors[k]) setErrors(e => ({ ...e, [k]: validate(next)[k] ?? "" }));
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(vals);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const n: Record<string, number | null> = {};
    for (const [k] of [...FIELDS, ...SOCIAL]) n[k] = vals[k] === "" || vals[k] == null ? null : Number(vals[k]);
    setBusy(true);
    try {
      await listingsApi.saveMetrics(l._id, wk, { ...n, tiktokLink: orNull(vals.tiktokLink ?? ""), facebookLink: orNull(vals.facebookLink ?? "") });
      toast.success("Saved. Your seller sees it now.");
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <form onSubmit={submit} noValidate className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => { setWk(shiftWeek(wk, -1)); setErrors({}); }} className="rounded-full px-3 py-1 text-sm ring-1 ring-stone-200">‹</button>
          <div className="text-center"><div className="text-xs text-stone-500">Week of</div><div className="font-semibold">{wkLabel(wk)}{wk === thisWeek && " (this week)"}</div></div>
          <button type="button" disabled={wk >= thisWeek} onClick={() => { setWk(shiftWeek(wk, 1)); setErrors({}); }} className="rounded-full px-3 py-1 text-sm ring-1 ring-stone-200 disabled:opacity-30">›</button>
        </div>
        <p className="mt-3 text-[15px] text-stone-600">Type the connectMLS numbers (favorite / maybe / not interested). Zillow and Reel numbers fill in by themselves once connected below. About 30 seconds.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FIELDS.map(([k, label]) => (
            <label key={k} className="block text-xs font-medium text-stone-600">{label}{isAuto(k) && <span className="ml-1 font-semibold text-emerald-700">· auto</span>}
              <input className={fieldCls(errors[k], isAuto(k) ? "bg-stone-50 text-stone-500" : "")} inputMode="numeric" maxLength={8} readOnly={isAuto(k)} title={isAuto(k) ? "Filled in automatically" : undefined} value={vals[k] ?? ""} onChange={e => setVal(k, digitsOnly(e.target.value, 8))} aria-invalid={!!errors[k]} />
              <FieldError msg={errors[k]} />
            </label>
          ))}
        </div>
        <div className="mt-4 border-t border-stone-100 pt-3" data-testid="social-fields">
          <div className="font-medium">Reel on other channels (optional)</div>
          <p className="text-[15px] text-stone-600">Total views so far, from the TikTok or Facebook app. YouTube fills in by itself when the Short has the street in its title.</p>
          <div className="mt-2 space-y-2">
            {SOCIAL.map(([k, label, linkKey]) => (
              <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-2">
                <label className="block text-sm font-medium text-stone-600">{label}{isAuto(k) && <span className="ml-1 font-semibold text-emerald-700">· auto</span>}
                  <input aria-label={label} className={fieldCls(errors[k], isAuto(k) ? "bg-stone-50 text-stone-500" : "")} inputMode="numeric" maxLength={8} readOnly={isAuto(k)} value={vals[k] ?? ""} onChange={e => setVal(k, digitsOnly(e.target.value, 8))} aria-invalid={!!errors[k]} />
                  <FieldError msg={errors[k]} />
                </label>
                {linkKey ? (
                  <label className="block text-sm font-medium text-stone-600">Link
                    <input aria-label={`${label.split(" ")[0]} link`} type="url" maxLength={600} className={fieldCls(errors[linkKey])} placeholder="https://…" value={vals[linkKey] ?? ""} onChange={e => setVal(linkKey, e.target.value.trim())} aria-invalid={!!errors[linkKey]} />
                    <FieldError msg={errors[linkKey]} />
                  </label>
                ) : (
                  <p className="self-end pb-2 text-sm text-stone-500">{l.ytAuto ? <>Auto from <a className="font-semibold text-[#7A5A25] underline" href={l.ytAuto.url} target="_blank" rel="noreferrer">the Short</a>, twice a day</> : "Auto once matched; or type it"}</p>
                )}
              </div>
            ))}
          </div>
        </div>
        <button disabled={busy} className="mt-4 w-full rounded-xl bg-[#0A0A0A] py-2.5 font-semibold text-white disabled:opacity-60 sm:w-auto sm:px-6">{busy ? "Saving…" : "Save week"}</button>
      </form>
      <AutoSources l={l} myEmail={myEmail} />
      {metrics.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/5">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-stone-500"><th className="p-3">Week</th>{FIELDS.slice(0, 5).map(([, lb]) => <th key={lb} className="p-3">{lb}</th>)}</tr></thead>
            <tbody>
              {[...metrics].reverse().map(m => (
                <tr key={m._id} className="border-t border-stone-100"><td className="p-3 font-medium">{wkLabel(m.weekOf)}</td>{FIELDS.slice(0, 5).map(([k]) => <td key={k} className="p-3">{m[k] ?? "–"}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NextStepsEditor({ l }: { l: Listing }) {
  const rows = useListingsData(`listings:suggestions:${l._id}`, () => listingsApi.suggestions(l._id)).data?.items;
  const edit = ({ suggestionId, ...t }: { suggestionId: string; title: string; why: string; action: string }) => listingsApi.updateSuggestion(suggestionId, t);
  const setStatus = ({ suggestionId, status }: { suggestionId: string; status: "draft" | "published" | "dismissed" }) => listingsApi.updateSuggestion(suggestionId, { status });
  const [drafts, setDrafts] = useState<Record<string, { title: string; why: string; action: string }>>({});
  const [nw, setNw] = useState({ title: "", why: "", action: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { void listingsApi.refreshSuggestions(l._id).catch(() => {}); }, [l._id, l.updatedAt]);
  if (rows === undefined) return <div className="h-24 animate-pulse rounded-2xl bg-stone-100" />;
  const val = (r: (typeof rows)[number]) => drafts[r._id] ?? { title: r.title, why: r.why, action: r.action };
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); return true; } catch (e) { toast.error(errMsg(e)); return false; } };
  /** Checks one suggestion's text; errors are keyed "<id>.title" etc. */
  const valid = (id: string, t: { title: string; why: string; action: string }) => {
    const errs = check(suggestionSchema, t);
    setErrors(e => ({ ...e, [`${id}.title`]: errs.title ?? "", [`${id}.why`]: errs.why ?? "", [`${id}.action`]: errs.action ?? "" }));
    return !Object.keys(errs).length;
  };
  const draftRows = rows.filter(r => r.status === "draft");
  const pub = rows.filter(r => r.status === "published");
  return (
    <div className="space-y-4" data-testid="suggestions-editor">
      <section className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <h3 className="font-semibold">What we'd do next</h3>
        <p className="text-[15px] text-stone-600">Suggestions come from this listing's numbers (Zillow views vs showings, saves, days on market, open house, feedback words). Nothing reaches your seller until you tap Publish. Your seller can then tap Approve plan, and you get an email.</p>
      </section>
      {draftRows.length === 0 && pub.length === 0 && <p className="px-1 text-[15px] text-stone-500">No suggestions right now. They appear here as numbers come in, or add your own below.</p>}
      {[...draftRows, ...pub].map(r => {
        const d = val(r);
        const dirty = !!drafts[r._id];
        return (
          <section key={r._id} className={`rounded-2xl p-4 ring-1 ${r.status === "draft" ? "bg-[#9C7434]/10 ring-[#9C7434]/30" : "bg-white ring-black/5"}`} data-testid="suggestion">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${r.status === "draft" ? "bg-white text-[#7A5A25]" : "bg-emerald-50 text-emerald-700"}`}>{r.status === "draft" ? "Draft" : r.approvedAt ? `Published · seller approved ${ago(r.approvedAt)}` : "Published"}</span>
              {r.ruleKey === "custom" ? <span className="text-stone-500">Your own</span> : !r.stillTrue && <span className="text-stone-500">Numbers have moved since; check it still applies</span>}
            </div>
            <input aria-label="Suggestion title" maxLength={120} className={fieldCls(errors[`${r._id}.title`], "font-semibold")} value={d.title} onChange={e => setDrafts({ ...drafts, [r._id]: { ...d, title: e.target.value } })} />
            <FieldError msg={errors[`${r._id}.title`]} />
            <label className="mt-2 block text-sm text-stone-600">Why
              <textarea aria-label="Why" rows={2} maxLength={300} className={fieldCls(errors[`${r._id}.why`])} value={d.why} onChange={e => setDrafts({ ...drafts, [r._id]: { ...d, why: e.target.value } })} />
              <FieldError msg={errors[`${r._id}.why`]} />
            </label>
            <label className="mt-2 block text-sm text-stone-600">What we'll do
              <textarea aria-label="What we'll do" rows={2} maxLength={300} className={fieldCls(errors[`${r._id}.action`])} value={d.action} onChange={e => setDrafts({ ...drafts, [r._id]: { ...d, action: e.target.value } })} />
              <FieldError msg={errors[`${r._id}.action`]} />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status === "draft" ? (
                <button type="button" className="rounded-xl bg-[#0A0A0A] px-4 py-2 font-semibold text-white" onClick={() => valid(r._id, d) && act(async () => { if (dirty) await edit({ suggestionId: r._id, ...d }); await setStatus({ suggestionId: r._id, status: "published" }); setDrafts(({ [r._id]: _, ...rest }) => rest); }, "Published to your seller's page")}>Publish</button>
              ) : (
                <button type="button" className="rounded-xl px-4 py-2 font-semibold ring-1 ring-stone-300" onClick={() => act(() => setStatus({ suggestionId: r._id, status: "draft" }), "Hidden from your seller")}>Unpublish</button>
              )}
              {dirty && <button type="button" className="rounded-xl px-4 py-2 font-semibold ring-1 ring-stone-300" onClick={() => valid(r._id, d) && act(async () => { await edit({ suggestionId: r._id, ...d }); setDrafts(({ [r._id]: _, ...rest }) => rest); }, "Saved")}>Save text</button>}
              <button type="button" className="rounded-xl px-4 py-2 text-stone-600" onClick={() => act(() => setStatus({ suggestionId: r._id, status: "dismissed" }), "Dismissed")}>Dismiss</button>
            </div>
          </section>
        );
      })}
      <form noValidate className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-black/5" onSubmit={e => { e.preventDefault(); if (!valid("new", nw)) return; void act(async () => { await listingsApi.addSuggestion(l._id, nw); setNw({ title: "", why: "", action: "" }); }, "Added as a draft"); }}>
        <div className="font-semibold">Add your own</div>
        <input aria-label="New suggestion title" maxLength={120} placeholder="e.g. Stage the second bedroom" className={fieldCls(errors["new.title"])} value={nw.title} onChange={e => setNw({ ...nw, title: e.target.value })} />
        <FieldError msg={errors["new.title"]} />
        <input aria-label="New suggestion why" maxLength={300} placeholder="Why (one line)" className={fieldCls(errors["new.why"])} value={nw.why} onChange={e => setNw({ ...nw, why: e.target.value })} />
        <FieldError msg={errors["new.why"]} />
        <input aria-label="New suggestion action" maxLength={300} placeholder="What we'll do" className={fieldCls(errors["new.action"])} value={nw.action} onChange={e => setNw({ ...nw, action: e.target.value })} />
        <FieldError msg={errors["new.action"]} />
        <button className="rounded-xl bg-[#0A0A0A] px-4 py-2 font-semibold text-white">Add draft</button>
      </form>
    </div>
  );
}

function Activity({ l, events, openHouse }: { l: Listing; events: ListingEvent[]; openHouse: { _id: string; name: string; at: number }[] }) {
  const setStatus = ({ eventId, status, body }: { eventId: string; status: ListingEvent["status"]; body?: string }) =>
    listingsApi.setEventStatus(eventId, status, body === undefined ? undefined : orNull(body)).catch(err => { toast.error(errMsg(err)); throw err; });
  const remove = ({ eventId }: { eventId: string }) => listingsApi.removeEvent(eventId).catch(err => toast.error(errMsg(err)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<"update" | "offer" | "showing">("update");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [paste, setPaste] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const pending = events.filter(e => e.status === "pending");
  const rest = events.filter(e => e.status !== "pending");

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = check(eventSchema, { title, body });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await listingsApi.addEvent(l._id, { kind, title: title.trim(), body: orNull(body) });
      setTitle(""); setBody("");
      toast.success("Posted to your seller's page");
    } catch (err) { setErrors(fieldErrors(err)); toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  const doPaste = async () => {
    const firstLine = paste.split("\n").find(x => /FEEDBACK RECEIVED|SHOWING (CONFIRMED|CANCELL?ED)/i.test(x)) ?? "";
    const subj = firstLine.match(/(FEEDBACK RECEIVED|SHOWING (CONFIRMED|CANCELL?ED))[^\n]*/i)?.[0] ?? (/feedback/i.test(paste) ? "FEEDBACK RECEIVED | " : "");
    const p = parseShowingTime(subj.toUpperCase().startsWith("FEEDBACK") || subj.toUpperCase().startsWith("SHOWING") ? subj : `FEEDBACK RECEIVED | ${l.address}`, paste);
    if (!p) return toast.error("Couldn't read that. Paste the whole ShowingTime email.");
    try {
      await listingsApi.addParsedShowing(l._id, p);
      setPaste("");
      toast.success(p.kind === "feedback" ? "Feedback added. Review it below." : "Showing added");
    } catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <section className="rounded-2xl bg-[#9C7434]/10 p-4 ring-1 ring-[#9C7434]/30">
          <h3 className="font-semibold">Review before your seller sees it ({pending.length})</h3>
          <ul className="mt-3 space-y-3">
            {pending.map(e => (
              <li key={e._id} className="rounded-xl bg-white p-3">
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="text-stone-500">{e.when}</span>
                  {e.interest && <span className="rounded-full bg-stone-100 px-2">{e.interest}</span>}
                  {e.priceOpinion && <span className="rounded-full bg-stone-100 px-2">Price: {e.priceOpinion}</span>}
                  {e.rating && <span className="rounded-full bg-stone-100 px-2">★ {e.rating}/5</span>}
                </div>
                {e.agentOnly && <p className="mt-1 whitespace-pre-line text-xs text-stone-500">{e.agentOnly.split("\n")[0]} <span className="italic">(only you see this)</span></p>}
                <textarea maxLength={2000} className={`${inputCls} mt-2 min-h-[70px] text-sm`} value={edits[e._id] ?? e.body ?? ""} onChange={x => setEdits({ ...edits, [e._id]: x.target.value })} placeholder="Comment shown to the seller (edit or leave blank)" />
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setStatus({ eventId: e._id, status: "published", body: edits[e._id] ?? e.body ?? "" }).then(() => toast.success("Published"), () => {})} className="flex items-center gap-1 rounded-lg bg-[#0A0A0A] px-3 py-1.5 text-sm font-semibold text-white"><Send className="size-3.5" /> Publish</button>
                  <button onClick={() => setStatus({ eventId: e._id, status: "hidden" }).catch(() => {})} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ring-1 ring-stone-200"><EyeOff className="size-3.5" /> Keep private</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={post} noValidate className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <h3 className="font-semibold">Post an update to the seller</h3>
        <div className="mt-2 flex gap-1.5 text-sm">
          {(["update", "offer", "showing"] as const).map(k => (
            <button type="button" key={k} onClick={() => { setKind(k); setErrors({}); }} className={`rounded-full px-3 py-1 capitalize ${kind === k ? "bg-[#0A0A0A] text-white" : "ring-1 ring-stone-200"}`}>{k}</button>
          ))}
        </div>
        <input className={fieldCls(errors.title, "mt-3")} maxLength={140} aria-invalid={!!errors.title} value={title} onChange={e => { setTitle(e.target.value); if (errors.title) setErrors({}); }} placeholder={kind === "offer" ? "Offer received: $540,000, 30-day close" : kind === "showing" ? "Private showing Saturday 2pm" : "Broker open went great, 14 agents"} />
        <FieldError msg={errors.title} />
        <textarea className={fieldCls(errors.body, "mt-2 min-h-[70px]")} maxLength={2000} value={body} onChange={e => setBody(e.target.value)} placeholder="Details / next steps (optional)" />
        <FieldError msg={errors.body} />
        <button disabled={busy} className="mt-3 rounded-xl bg-[#9C7434] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Posting…" : "Post"}</button>
      </form>

      <details className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold"><ClipboardPaste className="size-4 text-[#9C7434]" /> Paste a ShowingTime email</summary>
        <p className="mt-2 text-xs text-stone-500">Showings and feedback arrive automatically once your ShowingTime emails forward to team@. Use this if one is missing: copy the whole email and paste it here.</p>
        <textarea maxLength={20000} className={`${inputCls} mt-2 min-h-[110px] text-sm`} value={paste} onChange={e => setPaste(e.target.value)} placeholder="FEEDBACK RECEIVED | 123 N Main St…" />
        <button type="button" disabled={!paste.trim()} onClick={doPaste} className="mt-2 rounded-xl bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Add it</button>
      </details>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <h3 className="font-semibold">Open house sign-ins ({openHouse.length})</h3>
        <p className="text-xs text-stone-500">From the Open House QR form with this address. Sellers see the count only.</p>
        {openHouse.length > 0 && <ul className="mt-2 text-sm">{openHouse.map(o => <li key={o._id} className="flex justify-between border-t border-stone-100 py-1.5"><span>{o.name}</span><span className="text-stone-500">{ago(o.at)}</span></li>)}</ul>}
        <Link to="/forms" className="mt-2 inline-block text-sm font-semibold text-[#9C7434]">Get the open house QR →</Link>
      </section>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <h3 className="font-semibold">Everything on the seller's page</h3>
        {rest.length === 0 ? <p className="mt-1 text-sm text-stone-500">Nothing yet.</p> : (
          <ul className="mt-2 divide-y divide-stone-100">
            {rest.map(e => (
              <li key={e._id} className="flex items-start gap-3 py-2.5 text-sm">
                <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[11px] capitalize ${e.status === "hidden" ? "bg-stone-100 text-stone-400" : "bg-[#D9BC8C]/30"}`}>{e.status === "hidden" ? "private" : e.kind}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{e.title}{e.when && <span className="font-normal text-stone-500"> · {e.when}</span>}</div>
                  {e.body && <div className="text-stone-600">{e.body}</div>}
                  <div className="text-xs text-stone-400">{ago(e.createdAt)}{e.source === "showingtime" && " · ShowingTime"}{e.source === "zillow" && " · from Zillow"}</div>
                </div>
                {e.status === "hidden"
                  ? <button aria-label="Show to seller" onClick={() => setStatus({ eventId: e._id, status: "published" }).catch(() => {})}><Eye className="size-4 text-stone-400" /></button>
                  : <button aria-label="Hide from seller" onClick={() => setStatus({ eventId: e._id, status: "hidden" }).catch(() => {})}><EyeOff className="size-4 text-stone-400" /></button>}
                <button aria-label="Delete" onClick={() => confirm("Delete this item?") && remove({ eventId: e._id })}><Trash2 className="size-4 text-stone-400" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Details({ l }: { l: Listing }) {
  const nav = useNavigate();
  const initial = (l: Listing) => ({
    address: l.address, mlsNumber: l.mlsNumber ?? "", price: centsToPrice(l.priceCents), photoUrl: l.photoUrl ?? "", liveDate: l.liveDate ?? "",
    sellerName: l.sellerName, sellerEmail: l.sellerEmail ?? "", sellerPhone: l.sellerPhone ?? "",
    zillow: l.links?.zillow ?? "", website: l.links?.website ?? "", reel: l.links?.reel ?? "", tour: l.links?.tour ?? "",
  });
  const [f, setF] = useState(() => initial(l));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [weekly, setWeekly] = useState<boolean | null>(null); // value being saved
  type Key = keyof typeof f;
  const filters: Partial<Record<Key, (v: string) => string>> = {
    mlsNumber: v => digitsOnly(v, 10),
    price: typePrice,
    sellerName: typeName,
    sellerPhone: typePhone,
    sellerEmail: v => v.replace(/\s/g, ""),
    photoUrl: v => v.trim(), zillow: v => v.trim(), website: v => v.trim(), reel: v => v.trim(), tour: v => v.trim(),
  };
  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...f, [k]: (filters[k] ?? (v => v))(e.target.value) };
    setF(next);
    if (errors[k]) setErrors(err => ({ ...err, [k]: check(detailsSchema, next)[k] ?? "" }));
  };
  // Only check on leaving a field that was changed (see NewListing for why).
  const blur = (k: Key) => () => {
    if (f[k] !== initial(l)[k]) setErrors(err => ({ ...err, [k]: check(detailsSchema, f)[k] ?? "" }));
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = check(detailsSchema, f);
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error("Fix the highlighted fields first.");
    const { zillow, website, reel, tour } = f;
    setBusy(true);
    try {
      const saved = await listingsApi.update(l._id, {
        address: f.address.trim(),
        mlsNumber: orNull(f.mlsNumber),
        priceCents: priceToCents(f.price),
        photoUrl: orNull(f.photoUrl),
        liveDate: orNull(f.liveDate),
        sellerName: f.sellerName.trim(),
        sellerEmail: orNull(f.sellerEmail),
        sellerPhone: orNull(f.sellerPhone),
        links: { zillow: orNull(zillow), website: orNull(website), reel: orNull(reel), tour: orNull(tour) },
      });
      setF(initial(saved)); // show the saved (normalised) values, e.g. formatted address
      toast.success("Saved");
    } catch (err) {
      const fe = fieldErrors(err);
      const mapped: Record<string, string> = {};
      for (const [k, m] of Object.entries(fe)) mapped[k === "priceCents" ? "price" : k.replace(/^links\./, "")] = m;
      setErrors(mapped);
      toast.error(errMsg(err));
    } finally { setBusy(false); }
  };
  const field = (k: Key, label: string, ph = "", type = "text", extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-sm font-medium">{label}
      <input className={fieldCls(errors[k])} type={type} value={f[k]} onChange={set(k)} onBlur={blur(k)} placeholder={ph} aria-invalid={!!errors[k]} {...extra} />
      <FieldError msg={errors[k]} />
    </label>
  );
  const maxDate = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-black/5">
        {field("address", "Address *", "1234 N Main St, Chicago, IL 60614", "text", { maxLength: 200, autoComplete: "street-address" })}
        <div className="grid grid-cols-2 gap-3">{field("mlsNumber", "MLS #", "Matches ShowingTime emails", "text", { inputMode: "numeric" })}{field("price", "List price", "$549,000", "text", { inputMode: "numeric" })}</div>
        <div className="grid grid-cols-2 gap-3">{field("liveDate", "Date live on MLS", "", "date", { min: "2000-01-01", max: maxDate })}{field("photoUrl", "Hero photo link", "https://…", "url", { maxLength: 600 })}</div>
      </section>
      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <h3 className="font-semibold">Seller</h3>
        {field("sellerName", "Name *", "", "text", { maxLength: 120, autoComplete: "off" })}
        <div className="grid grid-cols-2 gap-3">{field("sellerPhone", "Mobile", "(312) 555-0100", "tel", { inputMode: "tel" })}{field("sellerEmail", "Email", "", "email", { maxLength: 200 })}</div>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 p-3 text-sm">
          <span><b>Monday email summary</b><br /><span className="text-stone-500">Seller gets a short weekly report with a link to this page.</span></span>
          <input
            type="checkbox"
            className="size-5 accent-[#9C7434]"
            checked={weekly ?? l.weeklyEmail}
            disabled={weekly !== null}
            onChange={e => {
              const on = e.target.checked;
              const emailErr = check(detailsSchema.pick({ sellerEmail: true }), { sellerEmail: f.sellerEmail }).sellerEmail;
              if (on && (!f.sellerEmail.trim() || emailErr)) {
                setErrors(err => ({ ...err, sellerEmail: emailErr ?? "Add the seller's email first." }));
                return;
              }
              setWeekly(on);
              listingsApi
                .update(l._id, on ? { weeklyEmail: true, sellerEmail: orNull(f.sellerEmail) } : { weeklyEmail: false })
                .then(() => toast.success(on ? "Monday email on" : "Monday email off"))
                .catch(err => toast.error(errMsg(err)))
                .finally(() => setWeekly(null));
            }}
          />
        </label>
      </section>
      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <h3 className="font-semibold">Links on the seller's page</h3>
        {field("zillow", "Zillow listing", "https://www.zillow.com/…", "url", { maxLength: 600 })}
        {field("website", "Property website", "https://…", "url", { maxLength: 600 })}
        {field("reel", "Instagram Reel", "https://www.instagram.com/reel/…", "url", { maxLength: 600 })}
        {field("tour", "3D tour", "https://…", "url", { maxLength: 600 })}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button disabled={busy} className="rounded-xl bg-[#0A0A0A] px-6 py-2.5 font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save details"}</button>
          <button type="button" onClick={() => { setF(initial(l)); setErrors({}); }} className="text-sm text-stone-500 hover:text-stone-800">Undo changes</button>
        </div>
        <button type="button" onClick={() => confirm("Delete this listing and its seller page?") && listingsApi.remove(l._id).then(() => { toast.success("Listing deleted"); nav("/listings"); }).catch(err => toast.error(errMsg(err)))} className="flex items-center gap-1 text-sm text-red-600"><Trash2 className="size-4" /> Delete listing</button>
      </div>
    </form>
  );
}

export function ListingDetailPage() {
  const { id } = useParams();
  const { data, error, notFound, reload } = useListingsData(id ? `listings:get:${id}` : null, () => listingsApi.get(id!), { pollMs: 30_000 });
  const [tab, setTab] = useState<Tab>("steps");
  // The status picked while it saves (so the dropdown doesn't jump back for a few seconds).
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  if (notFound) return (
    <div className="space-y-3">
      <Link to="/listings" className="inline-flex items-center gap-1 text-sm text-stone-500"><ArrowLeft className="size-4" /> Listings</Link>
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-black/5"><h1 className="font-display text-xl">Listing not found</h1><p className="mt-1 text-sm text-stone-500">It may have been deleted, or it belongs to another agent.</p></div>
    </div>
  );
  if (data === undefined && error) return (
    <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">Couldn't load this listing. {errMsg(error)} <button type="button" onClick={() => void reload()} className="ml-1 font-semibold underline">Try again</button></div>
  );
  if (data === undefined) return <div className="h-40 animate-pulse rounded-2xl bg-stone-100" />;
  const { listing: l, events, metrics, openHouse, thisWeek } = data;
  const pending = events.filter(e => e.status === "pending").length;
  const tabs: [Tab, string][] = [["steps", "Launch steps"], ["numbers", "Weekly numbers"], ["next", "Next steps"], ["ads", "Ads & web"], ["activity", pending ? `Activity (${pending})` : "Activity"], ["details", "Details"]];
  return (
    <div className="space-y-4">
      <Link to="/listings" className="inline-flex items-center gap-1 text-sm text-stone-500"><ArrowLeft className="size-4" /> Listings</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">{formatFreeAddress(l.address).split(",")[0]}</h1>
          <p className="text-sm text-stone-500">{l.sellerName} · {l.agentName}{l.mlsNumber && ` · MLS ${l.mlsNumber}`}{l.price && ` · ${l.price}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip s={pendingStatus ?? l.status} />
          <select
            aria-label="Status"
            className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm"
            value={pendingStatus ?? l.status}
            disabled={pendingStatus !== null}
            onChange={e => {
              const status = e.target.value;
              setPendingStatus(status);
              listingsApi
                .update(l._id, { status })
                .then(() => toast.success(`Status: ${status}`))
                .catch(err => toast.error(errMsg(err)))
                .finally(() => setPendingStatus(null));
            }}
          >
            {LISTING_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <SellerLink l={l} />
      <Connected l={l} />
      <PlanCard listingId={l._id as Id<"listings">} />
      <div className="flex gap-1 overflow-x-auto rounded-full bg-stone-100 p-1 text-sm">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-4 py-1.5 ${tab === k ? "bg-white font-semibold shadow-sm" : "text-stone-600"}`}>{label}</button>
        ))}
      </div>
      {tab === "steps" && <Steps l={l} />}
      {tab === "numbers" && <Numbers l={l} metrics={metrics} thisWeek={thisWeek} myEmail={data.me.email} />}
      {tab === "next" && <NextStepsEditor l={l} />}
      {tab === "ads" && <><ListingAdOrder listingId={l._id as Id<"listings">} /><AgentAdCampaigns listingId={l._id as Id<"listings">} /></>}
      {tab === "activity" && <Activity l={l} events={events} openHouse={openHouse} />}
      {tab === "details" && <Details key={l._id} l={l} />}
    </div>
  );
}
