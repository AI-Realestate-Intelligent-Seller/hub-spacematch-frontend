// Overview: value, range, sample, quality and how the asking price sits against the comparables.
import { AlertTriangle, Pencil, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/apiData";
import { CONDITIONS, cmaBuilderApi, dateTime, money, num, PROPERTY_TYPES, type PropertyType, type Report, type Subject, typeLabel } from "@/lib/cmaBuilderApi";
import { btnGhost, btnPrimary, cardCls, inputCls, Kpi, labelCls, NumberField } from "../shared";

const GRADE: Record<string, string> = { high: "text-emerald-700", medium: "text-amber-700", low: "text-red-700", insufficient: "text-stone-500" };

/** A horizontal scale: comparable range, estimate and the asking price. */
export function PositionBar({ low, high, estimate, asking }: { low: number; high: number; estimate: number | null; asking: number | null }) {
  const pts = [low, high, estimate, asking].filter((x): x is number => x != null);
  const min = Math.min(...pts) * 0.96;
  const max = Math.max(...pts) * 1.04;
  const x = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  return (
    <div className="px-10 pt-7 pb-9" role="img" aria-label={`Range ${money(low)} to ${money(high)}${asking ? `, asking ${money(asking)}` : ""}`}>
      <div className="relative h-2.5 rounded-full bg-stone-100">
        <div className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[#D9BC8C] to-[#9C7434]" style={{ left: x(low), width: `calc(${x(high)} - ${x(low)})` }} />
        {estimate != null && (
          <div className="absolute -top-7 -translate-x-1/2 text-center" style={{ left: x(estimate) }}>
            <div className="whitespace-nowrap text-[11px] font-semibold text-[#9C7434]">Estimate {money(estimate)}</div>
            <div className="mx-auto mt-0.5 h-5 w-0.5 bg-[#9C7434]" />
          </div>
        )}
        {asking != null && (
          <div className="absolute top-1 -translate-x-1/2 text-center" style={{ left: x(asking) }}>
            <div className="mx-auto h-5 w-0.5 bg-[#0A0A0A]" />
            <div className="whitespace-nowrap text-[11px] font-semibold">Asking {money(asking)}</div>
          </div>
        )}
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-stone-500" aria-hidden>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: x(low) }}>{money(low)}</span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: x(high) }}>{money(high)}</span>
      </div>
    </div>
  );
}

function SubjectDialog({ r, open, onOpenChange }: { r: Report; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [s, setS] = useState<Subject>(r.subject);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Subject>(k: K, v: Subject[K]) => setS(x => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true);
    try {
      await cmaBuilderApi.update(r.id, { subject: { propertyType: s.propertyType, beds: s.beds ?? null, baths: s.baths ?? null, sqft: s.sqft ?? null, lotSqft: s.lotSqft ?? null, yearBuilt: s.yearBuilt ?? null, condition: s.condition ?? null, garageSpaces: s.garageSpaces ?? null } });
      toast.success("Subject updated and recalculated");
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-normal">Subject property facts</DialogTitle>
          <DialogDescription>Similarity scores and size suggestions use these. Changes recalculate the CMA.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block"><span className={labelCls}>Property type</span>
            <select className={inputCls} value={s.propertyType} onChange={e => set("propertyType", e.target.value as PropertyType)}>{PROPERTY_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <NumberField id="sd-beds" label="Bedrooms" value={s.beds} onChange={v => set("beds", v)} />
          <NumberField id="sd-baths" label="Bathrooms" value={s.baths} onChange={v => set("baths", v)} step={0.5} />
          <NumberField id="sd-sqft" label="Square feet" value={s.sqft} onChange={v => set("sqft", v)} />
          <NumberField id="sd-year" label="Year built" value={s.yearBuilt} onChange={v => set("yearBuilt", v)} />
          <NumberField id="sd-lot" label="Lot size" suffix="sq ft" value={s.lotSqft} onChange={v => set("lotSqft", v)} />
          <NumberField id="sd-garage" label="Garage spaces" value={s.garageSpaces} onChange={v => set("garageSpaces", v)} />
          <label className="col-span-2 block"><span className={labelCls}>Condition</span>
            <select className={inputCls} value={s.condition ?? ""} onChange={e => set("condition", e.target.value || null)}><option value="">Not sure</option>{CONDITIONS.map(c => <option key={c}>{c}</option>)}</select>
          </label>
        </div>
        <DialogFooter>
          <button type="button" className={btnGhost} onClick={() => onOpenChange(false)}>Cancel</button>
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save & recalculate"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OverviewTab({ r }: { r: Report }) {
  const a = r.analysis;
  const [editSubject, setEditSubject] = useState(false);
  const selected = r.comparables.filter(c => c.selected);
  const asking = r.askingPrice ?? r.subject.askingPrice ?? null;
  const insufficient = a?.status === "insufficient_data" && !r.override;
  return (
    <div className="space-y-4">
      {insufficient && (
        <div role="status" className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div><b>Not enough sold comparables for a value.</b> {a?.insufficientReason} Add comparables by hand, import a CSV, or widen the search and refresh. The engine won't guess.</div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi tone="dark" label={r.overridden ? "Market value (agent)" : "Estimated market value"} value={insufficient ? "—" : money(r.estimatedValue)} sub={r.overridden ? `Engine: ${money(r.engineValue)}` : a?.ppsfIndication ? `$/sq ft check: ${money(a.ppsfIndication)}` : undefined} />
        <Kpi tone="gold" label={r.range?.fromAgent ? "Recommended range" : "Indicated range"} value={r.range ? <span className="text-xl">{money(r.range.low)} – {money(r.range.high)}</span> : "—"} sub={r.range?.fromAgent ? "Set by you" : a?.valueRange ? "Middle half of adjusted comparables" : undefined} />
        <Kpi label="Current asking" value={money(asking)} sub={a?.subjectPositioning.vsEstimatePct != null ? `${a.subjectPositioning.vsEstimatePct > 0 ? "+" : ""}${a.subjectPositioning.vsEstimatePct}% vs estimate` : undefined} />
        <Kpi label="Comparables" value={`${selected.length} / ${r.comparables.length}`} sub={`selected · ${a?.sold.count ?? 0} sold used for value`} />
        <Kpi label="Avg sold price" value={money(a?.sold.avgPrice)} sub={a?.sold.medianPrice ? `Median ${money(a.sold.medianPrice)}` : undefined} />
        <Kpi label="Avg $ / sq ft" value={a?.sold.avgPpsf ? `$${a.sold.avgPpsf}` : "—"} sub={a?.subjectPositioning.askingPpsf ? `Asking: $${a.subjectPositioning.askingPpsf}/sq ft` : undefined} />
        <Kpi label="Avg days on market" value={num(a?.sold.avgDom)} sub={a?.soldToListRatio ? `Sold-to-list ${(a.soldToListRatio * 100).toFixed(1)}%` : "Sold-to-list: no data"} />
        <Kpi label="Competition" value={`${a?.active.count ?? 0} active · ${a?.pending.count ?? 0} pending`} sub={a?.active.medianPrice ? `Active median ${money(a.active.medianPrice)}` : undefined} />
      </div>

      {a?.valueRange && r.estimatedValue != null && (
        <section className={cardCls} aria-labelledby="pos-h">
          <h3 id="pos-h" className="font-display text-lg">Where the asking price sits</h3>
          <PositionBar low={r.range?.low ?? a.valueRange.low} high={r.range?.high ?? a.valueRange.high} estimate={r.estimatedValue} asking={asking} />
          <p className="text-sm text-stone-600">
            {a.subjectPositioning.position === "above_range" ? "The asking price is above the comparable range." : a.subjectPositioning.position === "below_range" ? "The asking price is below the comparable range." : a.subjectPositioning.position === "within_range" ? "The asking price is within the comparable range." : "No asking price on the listing."}
          </p>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={cardCls} aria-labelledby="q-h">
          <div className="flex items-center justify-between gap-2">
            <h3 id="q-h" className="flex items-center gap-2 font-display text-lg"><ShieldCheck className="size-5 text-[#9C7434]" /> Data quality</h3>
            {a && <span className={`text-sm font-semibold capitalize ${GRADE[a.quality.grade]}`}>{a.quality.grade} · {a.quality.score}/100</span>}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-stone-700">{(a?.quality.notes ?? ["Not analysed yet."]).map(n => <li key={n}>• {n}</li>)}</ul>
          {a?.warnings.length ? <ul className="mt-3 space-y-1 text-sm text-amber-800">{a.warnings.map(w => <li key={w} className="flex gap-1.5"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{w}</li>)}</ul> : null}
          <p className="mt-3 text-xs text-stone-500">Data from {r.providerLabel} · collected {dateTime(r.dataCollectedAt)} · calculated {dateTime(a?.computedAt)}</p>
        </section>
        <section className={cardCls} aria-labelledby="s-h">
          <div className="flex items-center justify-between gap-2">
            <h3 id="s-h" className="font-display text-lg">Subject property</h3>
            {r.editable && <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-[#9C7434] hover:underline" onClick={() => setEditSubject(true)}><Pencil className="size-3.5" /> Edit facts</button>}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
            {[
              ["Type", typeLabel(r.subject.propertyType)],
              ["Beds / baths", `${num(r.subject.beds, 1)} / ${num(r.subject.baths, 1)}`],
              ["Square feet", num(r.subject.sqft)],
              ["Lot", r.subject.lotSqft ? `${num(r.subject.lotSqft)} sq ft` : "–"],
              ["Year built", r.subject.yearBuilt ?? "–"],
              ["Condition", r.subject.condition ?? "–"],
            ].map(([k, v]) => <div key={k}><dt className="text-xs text-stone-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>
          <p className="mt-3 text-xs text-stone-500">Search: {r.params.radiusMi} mi · sold within {r.params.soldWithinDays} days · {r.params.statuses.join(", ")}</p>
        </section>
      </div>
      {editSubject && <SubjectDialog r={r} open={editSubject} onOpenChange={setEditSubject} />}
    </div>
  );
}
