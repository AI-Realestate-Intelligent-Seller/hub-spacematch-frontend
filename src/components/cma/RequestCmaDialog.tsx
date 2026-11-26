// "Request CMA" dialog on the listing page: property facts come from the listing (and any earlier
// CMA request for the address); the agent sets the comparable search and picks a data source.
import { AlertTriangle, CheckCircle2, Info, Loader2, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";
import { apiErrorMessage, fieldErrors, useApiData } from "@/lib/apiData";
import { CONDITIONS, cmaBuilderApi, type Defaults, money, PROPERTY_TYPES, type PropertyType, type SearchParams, type Subject } from "@/lib/cmaBuilderApi";
import { btnGhost, btnPrimary, inputCls, labelCls, NumberField } from "./shared";

const RADII: SearchParams["radiusMi"][] = [0.5, 1, 3, 5];
const WINDOWS: SearchParams["soldWithinDays"][] = [90, 180, 365];
const STATUSES: [SearchParams["statuses"][number], string][] = [["sold", "Sold"], ["pending", "Pending"], ["active", "Active"]];

function Segmented<T extends string | number>({ label, options, value, onChange, fmt }: { label: string; options: T[]; value: T; onChange: (v: T) => void; fmt: (v: T) => string }) {
  return (
    <fieldset>
      <legend className={labelCls}>{label}</legend>
      <div className="flex rounded-xl bg-stone-100 p-1" role="radiogroup" aria-label={label}>
        {options.map(o => (
          <button
            key={String(o)}
            type="button"
            role="radio"
            aria-checked={o === value}
            onClick={() => onChange(o)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9C7434] ${o === value ? "bg-white font-semibold shadow-sm" : "text-stone-600 hover:text-stone-900"}`}
          >
            {fmt(o)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Form({ d, listingId, onDone }: { d: Defaults; listingId: string; onDone: (id: string) => void }) {
  const [subject, setSubject] = useState<Subject>(d.subject);
  const [p, setP] = useState<SearchParams>(d.params);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<string | null>(null);
  const s = <K extends keyof Subject>(k: K, v: Subject[K]) => setSubject(x => ({ ...x, [k]: v }));
  const provider = d.providers.find(x => x.id === p.provider);

  const local = useMemo(() => {
    const e: Record<string, string> = {};
    if (!subject.address?.trim() || !/\d/.test(subject.address)) e["subject.address"] = "The address needs a house number.";
    if (p.sqftMin && p.sqftMax && p.sqftMin > p.sqftMax) e.sqftMax = "Max is below min.";
    if (p.bedsMin && p.bedsMax && p.bedsMin > p.bedsMax) e.bedsMax = "Max is below min.";
    if (!p.statuses.length) e.statuses = "Pick at least one.";
    if (!provider?.available) e.provider = "Pick an available data source.";
    return e;
  }, [subject, p, provider]);
  const err = (k: string) => errors[k] ?? (Object.keys(errors).length ? local[k] : undefined);

  const submit = async () => {
    setConflict(null);
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    try {
      const r = await cmaBuilderApi.request(listingId, { ...p, subject });
      toast.success(r.status === "queued" ? "CMA requested. Collection runs in the background." : "CMA created. Add comparables in the builder.");
      onDone(r.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setConflict(e.message);
      else {
        setErrors(fieldErrors(e));
        toast.error(apiErrorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        void submit();
      }}
      className="flex min-h-0 flex-1 flex-col"
      noValidate
    >
      <div className="-mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pb-2">
        {/* Subject */}
        <section aria-labelledby="cma-subject" className="rounded-2xl bg-[#F7F5F1] p-4 ring-1 ring-[#D9BC8C]/50">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="cma-subject" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9C7434]">Subject property</h3>
            <span className="text-xs text-stone-500">Listing {d.listing.id.slice(0, 8)}… · {d.listing.status}</span>
          </div>
          <p className="mt-1.5 font-display text-lg leading-snug">{d.listing.address}</p>
          <p className="text-sm text-stone-600">Asking {money(d.listing.price)}</p>
          {d.prefilledFrom && <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-600"><Info className="size-3.5 text-[#9C7434]" /> Facts filled in from: {d.prefilledFrom}. Check them.</p>}
          {d.missing.length > 0 && !d.prefilledFrom && <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800"><AlertTriangle className="size-3.5" /> The listing doesn't store size, rooms or condition yet. Add what you know for better matches.</p>}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="col-span-2 block">
              <span className={labelCls}>Property type</span>
              <select className={inputCls} value={subject.propertyType} onChange={e => s("propertyType", e.target.value as PropertyType)}>
                {PROPERTY_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <label className="col-span-2 block">
              <span className={labelCls}>Condition</span>
              <select className={inputCls} value={subject.condition ?? ""} onChange={e => s("condition", e.target.value || null)}>
                <option value="">Not sure</option>
                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <NumberField id="s-beds" label="Bedrooms" value={subject.beds} onChange={v => s("beds", v)} min={0} max={30} error={err("subject.beds")} />
            <NumberField id="s-baths" label="Bathrooms" value={subject.baths} onChange={v => s("baths", v)} step={0.5} min={0} max={30} error={err("subject.baths")} />
            <NumberField id="s-sqft" label="Square feet" value={subject.sqft} onChange={v => s("sqft", v)} min={200} max={50000} error={err("subject.sqft")} />
            <NumberField id="s-year" label="Year built" value={subject.yearBuilt} onChange={v => s("yearBuilt", v)} min={1700} max={new Date().getFullYear() + 2} error={err("subject.yearBuilt")} />
            <NumberField id="s-lot" label="Lot size" suffix="sq ft" value={subject.lotSqft} onChange={v => s("lotSqft", v)} min={100} error={err("subject.lotSqft")} />
            <NumberField id="s-garage" label="Garage spaces" value={subject.garageSpaces} onChange={v => s("garageSpaces", v)} min={0} max={20} />
            <label className="col-span-2 block">
              <span className={labelCls}>ZIP</span>
              <input className={inputCls} inputMode="numeric" maxLength={5} value={subject.zip ?? ""} onChange={e => s("zip", e.target.value.replace(/\D/g, "").slice(0, 5) || null)} aria-invalid={!!err("subject.zip")} />
            </label>
          </div>
        </section>

        {/* Search */}
        <section aria-labelledby="cma-search" className="space-y-4">
          <h3 id="cma-search" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9C7434]">Comparable search</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Segmented label="Search radius" options={RADII} value={p.radiusMi} onChange={v => setP({ ...p, radiusMi: v })} fmt={v => `${v} mi`} />
            <Segmented label="Sold within" options={WINDOWS} value={p.soldWithinDays} onChange={v => setP({ ...p, soldWithinDays: v })} fmt={v => `${v} days`} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <NumberField id="p-sqmin" label="Min sq ft" value={p.sqftMin} onChange={v => setP({ ...p, sqftMin: v })} min={0} />
            <NumberField id="p-sqmax" label="Max sq ft" value={p.sqftMax} onChange={v => setP({ ...p, sqftMax: v })} min={0} error={err("sqftMax")} />
            <NumberField id="p-bmin" label="Min beds" value={p.bedsMin} onChange={v => setP({ ...p, bedsMin: v })} min={0} />
            <NumberField id="p-bmax" label="Max beds" value={p.bedsMax} onChange={v => setP({ ...p, bedsMax: v })} min={0} error={err("bedsMax")} />
            <NumberField id="p-bath" label="Min baths" value={p.bathsMin} onChange={v => setP({ ...p, bathsMin: v })} step={0.5} min={0} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend className={labelCls}>Property types</legend>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_TYPES.filter(([k]) => k !== "land").map(([k, l]) => (
                  <label key={k} className={`cursor-pointer rounded-full px-3 py-1 text-sm ring-1 transition has-focus-visible:ring-2 has-focus-visible:ring-[#9C7434] ${p.propertyTypes.includes(k) ? "bg-[#0A0A0A] text-white ring-black" : "bg-white text-stone-700 ring-stone-200"}`}>
                    <input type="checkbox" className="sr-only" checked={p.propertyTypes.includes(k)} onChange={() => setP({ ...p, propertyTypes: toggle(p.propertyTypes, k) })} />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className={labelCls}>Listing statuses</legend>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map(([k, l]) => (
                  <label key={k} className={`cursor-pointer rounded-full px-3 py-1 text-sm ring-1 transition has-focus-visible:ring-2 has-focus-visible:ring-[#9C7434] ${p.statuses.includes(k) ? "bg-[#0A0A0A] text-white ring-black" : "bg-white text-stone-700 ring-stone-200"}`}>
                    <input type="checkbox" className="sr-only" checked={p.statuses.includes(k)} onChange={() => setP({ ...p, statuses: toggle(p.statuses, k) })} />
                    {l}
                  </label>
                ))}
              </div>
              {err("statuses") && <span role="alert" className="mt-1 block text-xs text-red-600">{err("statuses")}</span>}
              <p className="mt-1 text-xs text-stone-500">Sold homes set the value; active and pending show your competition.</p>
            </fieldset>
          </div>
          <label className="block">
            <span className={labelCls}>Additional instructions <span className="font-normal text-stone-500">(optional)</span></span>
            <textarea rows={2} maxLength={2000} className={inputCls} placeholder="e.g. Prefer same subdivision; skip new construction" value={p.instructions ?? ""} onChange={e => setP({ ...p, instructions: e.target.value || null })} />
          </label>
        </section>

        {/* Source */}
        <fieldset aria-describedby={err("provider") ? "prov-err" : undefined}>
          <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9C7434]">Data source</legend>
          <div className="space-y-2">
            {d.providers.map(pr => (
              <label key={pr.id} className={`flex gap-3 rounded-xl p-3 ring-1 transition has-focus-visible:ring-2 has-focus-visible:ring-[#9C7434] ${!pr.available ? "cursor-not-allowed bg-stone-50 ring-stone-200" : p.provider === pr.id ? "cursor-pointer bg-[#F7F5F1] ring-[#9C7434]" : "cursor-pointer bg-white ring-stone-200 hover:ring-stone-300"}`}>
                <input type="radio" name="provider" className="mt-1 accent-[#9C7434]" disabled={!pr.available} checked={p.provider === pr.id} onChange={() => setP({ ...p, provider: pr.id })} />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {pr.label}
                    {pr.isFixture && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">Test data</span>}
                    {!pr.available && <Lock className="size-3.5 text-stone-400" aria-label="Not available" />}
                  </span>
                  <span className="block text-xs text-stone-500">
                    {pr.available
                      ? pr.kind === "manual" ? "Public research runs automatically. You can review county comparables, add your own, or import an MLS CSV." : pr.kind === "browser" ? "Collected in the background with a headless browser." : "Collected in the background from the provider's API."
                      : pr.reason}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {err("provider") && <span id="prov-err" role="alert" className="mt-1 block text-xs text-red-600">{err("provider")}</span>}
        </fieldset>

        {conflict && (
          <div role="alert" className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{conflict} <Link to={`/listings/${listingId}/cma`} className="font-semibold underline">Open CMA Builder</Link></span>
          </div>
        )}
      </div>
      <DialogFooter className="mt-3 border-t border-stone-100 pt-3">
        <button type="submit" className={btnPrimary} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          {busy ? "Requesting…" : "Request CMA"}
        </button>
      </DialogFooter>
    </form>
  );
}

export function RequestCmaDialog({ listingId, open, onOpenChange, onRequested }: { listingId: string; open: boolean; onOpenChange: (o: boolean) => void; onRequested: (reportId: string) => void }) {
  const { data, error, reload } = useApiData(open ? `cma:defaults:${listingId}` : null, () => cmaBuilderApi.defaults(listingId));
  // Fresh form each time the dialog opens.
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (open) setNonce(n => n + 1);
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] flex-col sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display text-2xl font-normal">Request a CMA</DialogTitle>
          <DialogDescription>Comparables are collected in the background. Nothing reaches your seller until you review and publish it.</DialogDescription>
        </DialogHeader>
        {error && !data ? (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
            Couldn't load the listing. {apiErrorMessage(error)} <button type="button" className="font-semibold underline" onClick={() => void reload()}>Try again</button>
          </div>
        ) : !data ? (
          <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading listing facts">
            {[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-stone-100" />)}
          </div>
        ) : (
          <Form key={nonce} d={data} listingId={listingId} onDone={onRequested} />
        )}
        {!data && <DialogFooter><button type="button" className={btnGhost} onClick={() => onOpenChange(false)}>Close</button></DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
