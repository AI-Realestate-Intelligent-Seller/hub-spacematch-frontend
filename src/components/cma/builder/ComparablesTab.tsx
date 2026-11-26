// Comparables: table or cards, search, filters, sorting, select/deselect, manual entry, CSV import
// and a detail panel. Every change saves at once and the backend recalculates the value.
import { ExternalLink, FileUp, LayoutGrid, Loader2, Pencil, Plus, Rows3, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiErrorMessage, fieldErrors } from "@/lib/apiData";
import { COMP_STATUS_LABEL, CONDITIONS, type Comparable, type CompStatus, cmaBuilderApi, type ImportResult, money, type NewComparable, num, PROPERTY_TYPES, type PropertyType, type Report, shortDate, typeLabel } from "@/lib/cmaBuilderApi";
import { btnGhost, btnPrimary, cardCls, inputCls, labelCls, NumberField } from "../shared";

type Sort = "similarity" | "price" | "distance" | "date" | "ppsf";
const priceOf = (c: Comparable) => (c.status === "sold" ? c.soldPrice : c.listPrice ?? c.originalListPrice);
const STATUS_TONE: Record<CompStatus, string> = { sold: "bg-emerald-50 text-emerald-800", pending: "bg-amber-50 text-amber-800", active: "bg-sky-50 text-sky-800", off_market: "bg-stone-100 text-stone-600" };
/** Source links: only plain web links are opened (never javascript: or file:). */
const safeHref = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);

function Badges({ c }: { c: Comparable }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {c.isFixture && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900" title="Development fixture: not a real property">Fixture</span>}
      {c.source === "public-records" && <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-stone-600">Public Records</span>}
      {c.manual && <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-stone-600">{c.source === "csv" ? "CSV" : "Manual"}</span>}
      {c.outlier && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700" title="Price per sq ft is far from the other sales">Outlier</span>}
    </span>
  );
}

function Match({ v }: { v: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`Similarity ${v}/100`}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-stone-100"><span className="block h-full rounded-full bg-[#9C7434]" style={{ width: `${v}%` }} /></span>
      <span className="tabular-nums text-xs text-stone-600">{v}</span>
    </span>
  );
}

// ---------- Add / edit a manual comparable ----------

const EMPTY: NewComparable = { status: "sold", address: "" };

function CompFormDialog({ reportId, initial, open, onOpenChange }: { reportId: string; initial?: Comparable; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [f, setF] = useState<NewComparable>(() => (initial ? { ...initial } : EMPTY));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof NewComparable>(k: K, v: NewComparable[K]) => setF(x => ({ ...x, [k]: v }));
  const save = async () => {
    const e: Record<string, string> = {};
    if (!/\d/.test(f.address ?? "")) e.address = "Add the street address with its house number.";
    if (f.status === "sold" && !f.soldPrice) e.soldPrice = "Add the sold price.";
    if (f.status === "sold" && !f.soldDate) e.soldDate = "Add the sale date.";
    if (f.status !== "sold" && !f.listPrice) e.listPrice = "Add the list price.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = {
      status: f.status, address: f.address, city: f.city ?? null, zip: f.zip ?? null, propertyType: f.propertyType ?? null, listPrice: f.listPrice ?? null,
      originalListPrice: f.originalListPrice ?? null, soldPrice: f.status === "sold" ? (f.soldPrice ?? null) : null, soldDate: f.status === "sold" ? (f.soldDate ?? null) : null,
      listDate: f.listDate ?? null, daysOnMarket: f.daysOnMarket ?? null, beds: f.beds ?? null, baths: f.baths ?? null, sqft: f.sqft ?? null, lotSqft: f.lotSqft ?? null,
      yearBuilt: f.yearBuilt ?? null, condition: f.condition ?? null, garageSpaces: f.garageSpaces ?? null, distanceMi: f.distanceMi ?? null, notes: f.notes ?? null,
    };
    setBusy(true);
    try {
      if (initial) await cmaBuilderApi.updateComparable(reportId, initial.id, { fields: body });
      else await cmaBuilderApi.addComparable(reportId, body);
      toast.success(initial ? "Comparable updated" : "Comparable added and selected");
      onOpenChange(false);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] flex-col sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display text-xl font-normal">{initial ? "Edit comparable" : "Add a comparable"}</DialogTitle>
          <DialogDescription>Enter only facts you can verify (MLS, county records, the listing agent).</DialogDescription>
        </DialogHeader>
        <form className="grid min-h-0 grid-cols-2 gap-3 overflow-y-auto px-0.5 pb-1 sm:grid-cols-4" onSubmit={e => { e.preventDefault(); void save(); }} noValidate>
          <label className="col-span-2 block sm:col-span-3"><span className={labelCls}>Street address *</span>
            <input className={inputCls} value={f.address} onChange={e => set("address", e.target.value)} aria-invalid={!!errors.address} placeholder="123 N Main St" />
            {errors.address && <span role="alert" className="mt-1 block text-xs text-red-600">{errors.address}</span>}
          </label>
          <label className="block"><span className={labelCls}>Status *</span>
            <select className={inputCls} value={f.status} onChange={e => set("status", e.target.value as CompStatus)}>{(["sold", "pending", "active"] as CompStatus[]).map(s => <option key={s} value={s}>{COMP_STATUS_LABEL[s]}</option>)}</select>
          </label>
          <label className="col-span-1 block"><span className={labelCls}>City</span><input className={inputCls} value={f.city ?? ""} onChange={e => set("city", e.target.value || null)} /></label>
          <label className="col-span-1 block"><span className={labelCls}>ZIP</span><input className={inputCls} inputMode="numeric" maxLength={5} value={f.zip ?? ""} onChange={e => set("zip", e.target.value.replace(/\D/g, "") || null)} /></label>
          <label className="col-span-2 block"><span className={labelCls}>Property type</span>
            <select className={inputCls} value={f.propertyType ?? ""} onChange={e => set("propertyType", (e.target.value || null) as PropertyType | null)}><option value="">–</option>{PROPERTY_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          {f.status === "sold" ? (
            <>
              <NumberField id="cf-sp" label="Sold price *" prefix="$" value={f.soldPrice} onChange={v => set("soldPrice", v)} error={errors.soldPrice} />
              <label className="block"><span className={labelCls}>Sale date *</span><input type="date" className={inputCls} value={f.soldDate ?? ""} max={new Date().toISOString().slice(0, 10)} onChange={e => set("soldDate", e.target.value || null)} aria-invalid={!!errors.soldDate} />
                {errors.soldDate && <span role="alert" className="mt-1 block text-xs text-red-600">{errors.soldDate}</span>}</label>
            </>
          ) : null}
          <NumberField id="cf-lp" label={f.status === "sold" ? "List price at sale" : "List price *"} prefix="$" value={f.listPrice} onChange={v => set("listPrice", v)} error={errors.listPrice} />
          <NumberField id="cf-olp" label="Original list price" prefix="$" value={f.originalListPrice} onChange={v => set("originalListPrice", v)} />
          <NumberField id="cf-beds" label="Beds" value={f.beds} onChange={v => set("beds", v)} />
          <NumberField id="cf-baths" label="Baths" step={0.5} value={f.baths} onChange={v => set("baths", v)} />
          <NumberField id="cf-sqft" label="Sq ft" value={f.sqft} onChange={v => set("sqft", v)} error={errors.sqft} />
          <NumberField id="cf-dist" label="Distance" suffix="mi" step={0.1} value={f.distanceMi} onChange={v => set("distanceMi", v)} />
          <NumberField id="cf-dom" label="Days on market" value={f.daysOnMarket} onChange={v => set("daysOnMarket", v)} />
          <NumberField id="cf-year" label="Year built" value={f.yearBuilt} onChange={v => set("yearBuilt", v)} />
          <NumberField id="cf-lot" label="Lot" suffix="sq ft" value={f.lotSqft} onChange={v => set("lotSqft", v)} />
          <label className="block"><span className={labelCls}>Condition</span><select className={inputCls} value={f.condition ?? ""} onChange={e => set("condition", e.target.value || null)}><option value="">–</option>{CONDITIONS.map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="col-span-2 block sm:col-span-4"><span className={labelCls}>Notes</span><textarea rows={2} maxLength={1000} className={inputCls} value={f.notes ?? ""} onChange={e => set("notes", e.target.value || null)} /></label>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
        <DialogFooter>
          <button type="button" className={btnGhost} onClick={() => onOpenChange(false)}>Cancel</button>
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}{initial ? "Save changes" : "Add comparable"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- CSV import ----------

function CsvImport({ reportId, disabled }: { reportId: string; disabled: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const pick = async (file: File) => {
    if (file.size > 900_000) return toast.error("That file is over 900 KB. Export fewer rows or columns.");
    setBusy(true);
    try {
      const r = await cmaBuilderApi.importCsv(reportId, await file.text());
      setResult(r);
      toast.success(`${r.imported} comparable${r.imported === 1 ? "" : "s"} imported`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <>
      <input ref={ref} type="file" accept=".csv,text/csv" className="sr-only" aria-label="CSV file" onChange={e => e.target.files?.[0] && void pick(e.target.files[0])} />
      <button type="button" className={btnGhost} disabled={disabled || busy} onClick={() => ref.current?.click()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} Import CSV</button>
      <Dialog open={!!result} onOpenChange={o => !o && setResult(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-normal">CSV imported</DialogTitle>
            <DialogDescription>{result?.imported} added · {result?.duplicates} already on this CMA · {result?.rejectedCount} skipped{result?.truncated ? " · only the first 2,000 rows were read" : ""}</DialogDescription>
          </DialogHeader>
          {result && (
            <div className="max-h-80 space-y-3 overflow-y-auto text-sm">
              <div>
                <div className="mb-1 font-semibold">Columns matched</div>
                <ul className="flex flex-wrap gap-1">{result.mapping.map(m => <li key={m.header} className={`rounded-full px-2 py-0.5 text-xs ring-1 ${m.field ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-stone-50 text-stone-500 ring-stone-200"}`}>{m.header}{m.field ? ` → ${m.field}` : " (ignored)"}</li>)}</ul>
              </div>
              {result.rejected.length > 0 && (
                <div>
                  <div className="mb-1 font-semibold">Skipped rows</div>
                  <ul className="space-y-0.5 text-stone-600">{result.rejected.map((r, i) => <li key={i}>{r.record}: {r.reason}</li>)}</ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter><button type="button" className={btnPrimary} onClick={() => setResult(null)}>Done</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- Detail panel ----------

function DetailSheet({ c, r, onClose, onEdit }: { c: Comparable | null; r: Report; onClose: () => void; onEdit: (c: Comparable) => void }) {
  const [notes, setNotes] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!c) return null;
  const href = safeHref(c.sourceUrl);
  const rows: [string, string][] = [
    ["Status", COMP_STATUS_LABEL[c.status]], ["Sold price", money(c.soldPrice)], ["Sale date", shortDate(c.soldDate)], ["List price", money(c.listPrice)],
    ["Original list", money(c.originalListPrice)], ["Listed", shortDate(c.listDate)], ["Days on market", num(c.daysOnMarket)], ["Beds / baths", `${num(c.beds, 1)} / ${num(c.baths, 1)}`],
    ["Square feet", num(c.sqft)], ["$ / sq ft", c.pricePerSqft ? `$${c.pricePerSqft}` : "–"], ["Lot", c.lotSqft ? `${num(c.lotSqft)} sq ft` : "–"], ["Year built", String(c.yearBuilt ?? "–")],
    ["Type", typeLabel(c.propertyType)], ["Condition", c.condition ?? "–"], ["Garage", num(c.garageSpaces)], ["Distance", c.distanceMi == null ? "–" : `${c.distanceMi.toFixed(2)} mi`],
    ["Similarity", `${c.similarity}/100 (${Math.round(c.coverage * 100)}% of facts compared)`], ["Adjusted value", money(c.adjustedValue)], ["Source", `${c.source}${c.sourceRecordId ? ` · ${c.sourceRecordId}` : ""}`], ["Collected", shortDate(c.collectedAt)],
  ];
  return (
    <Sheet open onOpenChange={o => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl font-normal">{c.address}</SheetTitle>
          <SheetDescription asChild><div><Badges c={c} /></div></SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{rows.map(([k, v]) => <div key={k}><dt className="text-xs text-stone-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
          {c.features.length > 0 && <p className="text-sm"><span className="text-stone-500">Features:</span> {c.features.join(", ")}</p>}
          {href && <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm font-semibold text-[#9C7434] hover:underline">Open source listing <ExternalLink className="size-3.5" /></a>}
          <label className="block"><span className={labelCls}>Notes for this comparable</span>
            <textarea rows={3} maxLength={1000} className={inputCls} disabled={!r.editable} value={notes ?? c.notes ?? ""} onChange={e => setNotes(e.target.value)} />
          </label>
          {r.editable && (
            <div className="flex flex-wrap gap-2">
              {notes !== null && notes !== (c.notes ?? "") && <button type="button" className={btnPrimary} onClick={() => cmaBuilderApi.updateComparable(r.id, c.id, { notes: notes || null }).then(() => { toast.success("Note saved"); setNotes(null); }).catch(e => toast.error(apiErrorMessage(e)))}>Save note</button>}
              {c.manual && <button type="button" className={btnGhost} onClick={() => onEdit(c)}><Pencil className="size-4" /> Edit facts</button>}
              {c.manual && <button type="button" className={`${btnGhost} text-red-700`} onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /> Delete</button>}
            </div>
          )}
          {!c.manual && <p className="text-xs text-stone-500">Collected records keep their original facts. Use adjustments or a note to reflect what you know, or deselect it.</p>}
        </div>
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this comparable?</AlertDialogTitle>
              <AlertDialogDescription>{c.address} and its adjustments are removed from this CMA. The value is recalculated.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => cmaBuilderApi.removeComparable(r.id, c.id).then(() => { toast.success("Comparable deleted"); onClose(); }).catch(e => toast.error(apiErrorMessage(e)))}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

// ---------- Tab ----------

function SelectionCheckbox({ c, checked, disabled, onChange }: { c: Comparable; checked: boolean; disabled: boolean; onChange: (selected: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center" onClick={e => e.stopPropagation()}>
      <input type="checkbox" className="size-4 accent-[#9C7434]" checked={checked} disabled={disabled} onChange={e => onChange(e.currentTarget.checked)} aria-label={`${checked ? "Deselect" : "Select"} ${c.address}`} />
    </label>
  );
}

export function ComparablesTab({ r }: { r: Report }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | CompStatus>("all");
  const [sort, setSort] = useState<Sort>("similarity");
  const [view, setView] = useState<"table" | "cards">("table");
  const [showFilters, setShowFilters] = useState(false);
  const [maxDist, setMaxDist] = useState<number | null>(null);
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [minSqft, setMinSqft] = useState<number | null>(null);
  const [maxSqft, setMaxSqft] = useState<number | null>(null);
  const [soldAfter, setSoldAfter] = useState("");
  const [selection, setSelection] = useState<Record<string, { selected: boolean; saving: boolean }>>({});
  const saveQueue = useRef(Promise.resolve());
  const [detail, setDetail] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; c?: Comparable }>({ open: false });

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = r.comparables.filter(c => {
      if (status !== "all" && c.status !== status) return false;
      if (t && !`${c.address} ${c.city ?? ""} ${c.zip ?? ""} ${c.sourceRecordId ?? ""}`.toLowerCase().includes(t)) return false;
      const p = priceOf(c);
      if (maxDist != null && (c.distanceMi == null || c.distanceMi > maxDist)) return false;
      if (minPrice != null && (p == null || p < minPrice)) return false;
      if (maxPrice != null && (p == null || p > maxPrice)) return false;
      if (minSqft != null && (c.sqft == null || c.sqft < minSqft)) return false;
      if (maxSqft != null && (c.sqft == null || c.sqft > maxSqft)) return false;
      if (soldAfter && c.status === "sold" && (c.soldDate ?? "") < soldAfter) return false;
      return true;
    });
    const key: Record<Sort, (c: Comparable) => number> = {
      similarity: c => -c.similarity, price: c => -(priceOf(c) ?? 0), distance: c => c.distanceMi ?? 999, date: c => -new Date(c.soldDate ?? c.listDate ?? 0).getTime(), ppsf: c => -(c.pricePerSqft ?? 0),
    };
    return [...list].sort((a, b) => Number(b.selected) - Number(a.selected) || key[sort](a) - key[sort](b));
  }, [r.comparables, q, status, sort, maxDist, minPrice, maxPrice, minSqft, maxSqft, soldAfter]);

  useEffect(() => {
    const changes = Object.entries(selection);
    const remaining = changes.filter(([id, change]) => {
      const current = r.comparables.find(c => c.id === id);
      return current && r.editable && (change.saving || current.selected !== change.selected);
    });
    if (remaining.length !== changes.length) setSelection(Object.fromEntries(remaining));
  }, [r.comparables, r.editable, selection]);

  const toggle = (c: Comparable, selected: boolean) => {
    setSelection(previous => ({ ...previous, [c.id]: { selected, saving: true } }));
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const saved = await cmaBuilderApi.updateComparable(r.id, c.id, { selected });
        setSelection(previous => ({ ...previous, [c.id]: { selected: saved.selected, saving: false } }));
      } catch (error) {
        setSelection(previous => {
          const next = { ...previous };
          delete next[c.id];
          return next;
        });
        toast.error(apiErrorMessage(error));
      }
    });
  };
  const counts = { all: r.comparables.length, sold: 0, active: 0, pending: 0, off_market: 0 } as Record<"all" | CompStatus, number>;
  for (const c of r.comparables) counts[c.status]++;
  const sel = r.comparables.find(c => c.id === detail) ?? null;

  const checkbox = (c: Comparable) => (
    <SelectionCheckbox
      c={c}
      checked={selection[c.id]?.selected ?? c.selected}
      disabled={!r.editable || selection[c.id]?.saving === true}
      onChange={selected => toggle(c, selected)}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input className={`${inputCls} pl-9`} placeholder="Search address, ZIP or MLS #" value={q} onChange={e => setQ(e.target.value)} aria-label="Search comparables" />
        </div>
        <select className={`${inputCls} w-auto`} value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort by">
          <option value="similarity">Best match</option><option value="price">Price</option><option value="distance">Distance</option><option value="date">Most recent</option><option value="ppsf">$ / sq ft</option>
        </select>
        <button type="button" className={btnGhost} aria-expanded={showFilters} onClick={() => setShowFilters(v => !v)}><SlidersHorizontal className="size-4" /> Filters</button>
        <div className="flex rounded-xl bg-stone-100 p-1" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")} className={`rounded-lg p-1.5 ${view === "table" ? "bg-white shadow-sm" : "text-stone-500"}`} aria-label="Table view"><Rows3 className="size-4" /></button>
          <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")} className={`rounded-lg p-1.5 ${view === "cards" ? "bg-white shadow-sm" : "text-stone-500"}`} aria-label="Card view"><LayoutGrid className="size-4" /></button>
        </div>
        <CsvImport reportId={r.id} disabled={!r.editable} />
        <button type="button" className={btnPrimary} disabled={!r.editable} onClick={() => setForm({ open: true })}><Plus className="size-4" /> Add</button>
      </div>

      <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Status filter">
        {(["all", "sold", "pending", "active"] as const).map(s => (
          <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`shrink-0 rounded-full px-3 py-1 text-sm transition ${status === s ? "bg-[#0A0A0A] font-semibold text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stone-300"}`}>
            {s === "all" ? "All" : COMP_STATUS_LABEL[s]} <span className="tabular-nums opacity-70">{counts[s]}</span>
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5 sm:grid-cols-3 lg:grid-cols-6">
          <NumberField id="f-dist" label="Max distance" suffix="mi" step={0.5} value={maxDist} onChange={setMaxDist} />
          <NumberField id="f-pmin" label="Min price" prefix="$" value={minPrice} onChange={setMinPrice} />
          <NumberField id="f-pmax" label="Max price" prefix="$" value={maxPrice} onChange={setMaxPrice} />
          <NumberField id="f-smin" label="Min sq ft" value={minSqft} onChange={setMinSqft} />
          <NumberField id="f-smax" label="Max sq ft" value={maxSqft} onChange={setMaxSqft} />
          <label className="block"><span className={labelCls}>Sold after</span><input type="date" className={inputCls} value={soldAfter} onChange={e => setSoldAfter(e.target.value)} /></label>
        </div>
      )}

      {!r.editable && <p className="text-sm text-stone-500">{r.status === "published" || r.status === "superseded" ? "Choose Edit CMA above to add properties to a new draft. Your seller will keep seeing the published version until you publish the draft." : "Comparable editing is available when the CMA is ready for review."}</p>}

      {r.comparables.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white/60 p-8 text-center">
          <h3 className="text-[17px] font-semibold">No comparables yet</h3>
          <p className="mx-auto mt-1 max-w-md text-[15px] text-stone-600">Add sales you know by hand, or export a search from your MLS as CSV and import it. Sold homes set the value.</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-stone-500 ring-1 ring-black/5">No comparables match these filters.</p>
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/5">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[#F7F5F1] text-left text-[11px] uppercase tracking-wider text-stone-500">
              <tr>
                <th className="w-10 p-3"><span className="sr-only">Selected</span></th><th className="p-3">Property</th><th className="p-3">Status</th><th className="p-3 text-right">Price</th><th className="p-3">Date</th>
                <th className="p-3 text-right">Bd / Ba</th><th className="p-3 text-right">Sq ft</th><th className="p-3 text-right">$/sq ft</th><th className="p-3 text-right">Dist.</th><th className="p-3 text-right">DOM</th><th className="p-3">Match</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map(c => (
                <tr key={c.id} onClick={() => setDetail(c.id)} className={`cursor-pointer transition hover:bg-[#F7F5F1]/70 ${c.selected ? "" : "text-stone-500"}`}>
                  <td className="p-3">{checkbox(c)}</td>
                  <td className="p-3"><button type="button" className="text-left font-semibold text-[#0A0A0A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9C7434]" onClick={e => { e.stopPropagation(); setDetail(c.id); }}>{c.address}</button><div className="mt-0.5"><Badges c={c} /></div></td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[c.status]}`}>{COMP_STATUS_LABEL[c.status]}</span></td>
                  <td className="p-3 text-right tabular-nums">{money(priceOf(c))}</td>
                  <td className="p-3 whitespace-nowrap">{shortDate(c.status === "sold" ? c.soldDate : c.listDate)}</td>
                  <td className="p-3 text-right tabular-nums">{num(c.beds, 1)} / {num(c.baths, 1)}</td>
                  <td className="p-3 text-right tabular-nums">{num(c.sqft)}</td>
                  <td className="p-3 text-right tabular-nums">{c.pricePerSqft ? `$${c.pricePerSqft}` : "–"}</td>
                  <td className="p-3 text-right tabular-nums">{c.distanceMi == null ? "–" : c.distanceMi.toFixed(2)}</td>
                  <td className="p-3 text-right tabular-nums">{num(c.daysOnMarket)}</td>
                  <td className="p-3"><Match v={c.similarity} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(c => (
            <article key={c.id} className={`${cardCls} cursor-pointer transition hover:ring-[#9C7434] ${c.selected ? "ring-[#D9BC8C]" : "opacity-75"}`} onClick={() => setDetail(c.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="truncate font-semibold">{c.address}</div><div className="mt-1 flex flex-wrap items-center gap-1"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[c.status]}`}>{COMP_STATUS_LABEL[c.status]}</span><Badges c={c} /></div></div>
                {checkbox(c)}
              </div>
              <div className="mt-3 font-display text-2xl">{money(priceOf(c))}</div>
              <div className="mt-1 text-sm text-stone-600">{num(c.beds, 1)} bd · {num(c.baths, 1)} ba · {num(c.sqft)} sq ft{c.pricePerSqft ? ` · $${c.pricePerSqft}/sq ft` : ""}</div>
              <div className="mt-2 flex items-center justify-between text-xs text-stone-500"><span>{c.distanceMi == null ? "–" : `${c.distanceMi.toFixed(2)} mi`} · {shortDate(c.status === "sold" ? c.soldDate : c.listDate)}</span><Match v={c.similarity} /></div>
            </article>
          ))}
        </div>
      )}
      <p className="text-xs text-stone-500">Selected sold comparables set the value; selected active and pending ones appear as competition. Changes recalculate straight away.</p>

      {sel && <DetailSheet key={sel.id} c={sel} r={r} onClose={() => setDetail(null)} onEdit={c => setForm({ open: true, c })} />}
      {form.open && <CompFormDialog reportId={r.id} initial={form.c} open={form.open} onOpenChange={o => setForm(f => ({ ...f, open: o }))} />}
    </div>
  );
}
