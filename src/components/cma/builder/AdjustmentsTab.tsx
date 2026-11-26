// Adjustments: per-comparable dollar adjustments with a recorded reason, the engine's size
// suggestions (applied only when the agent accepts them) and the agent's value override.
import { Lightbulb, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/apiData";
import { ADJUSTMENT_CATEGORIES, type Adjustment, type AdjustmentCategory, type Comparable, cmaBuilderApi, money, type Report, shortDate } from "@/lib/cmaBuilderApi";
import { btnGhost, btnPrimary, cardCls, inputCls, labelCls, NumberField } from "../shared";

const catLabel = (c: AdjustmentCategory) => ADJUSTMENT_CATEGORIES.find(([k]) => k === c)?.[1] ?? c;

function CompAdjustments({ r, c }: { r: Report; c: Comparable }) {
  const [cat, setCat] = useState<AdjustmentCategory>("condition");
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (list: Adjustment[], msg: string) => {
    setBusy(true);
    try {
      await cmaBuilderApi.updateComparable(r.id, c.id, { adjustments: list });
      toast.success(msg);
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    if (!amount) return setErr("Enter an amount (use a minus sign to subtract).");
    if (reason.trim().length < 3) return setErr("Say why (a few words).");
    setErr(null);
    if (await save([...c.adjustments, { category: cat, amount, reason: reason.trim() }], "Adjustment added")) {
      setAmount(null);
      setReason("");
    }
  };
  return (
    <article className={cardCls} aria-labelledby={`adj-${c.id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`adj-${c.id}`} className="font-semibold">{c.address}{c.isFixture && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">Fixture</span>}</h3>
        <span className="text-xs text-stone-500">Sold {shortDate(c.soldDate)} · match {c.similarity}/100</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-[#F7F5F1] p-2"><div className="text-[11px] uppercase tracking-wider text-stone-500">Sold price</div><div className="font-display text-lg">{money(c.soldPrice)}</div></div>
        <div className="rounded-xl bg-[#F7F5F1] p-2"><div className="text-[11px] uppercase tracking-wider text-stone-500">Adjustments</div><div className={`font-display text-lg ${c.adjustmentTotal > 0 ? "text-emerald-700" : c.adjustmentTotal < 0 ? "text-red-700" : ""}`}>{c.adjustmentTotal > 0 ? "+" : c.adjustmentTotal < 0 ? "−" : ""}{money(Math.abs(c.adjustmentTotal))}</div></div>
        <div className="rounded-xl bg-[#0A0A0A] p-2 text-white"><div className="text-[11px] uppercase tracking-wider text-[#D9BC8C]">Adjusted value</div><div className="font-display text-lg">{money(c.adjustedValue)}</div></div>
      </div>
      {c.adjustments.length > 0 && (
        <ul className="mt-3 divide-y divide-stone-100 text-sm">
          {c.adjustments.map(a => (
            <li key={a.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0"><span className="font-semibold">{catLabel(a.category)}</span> · {a.reason}<div className="text-xs text-stone-500">{a.suggested ? "Engine suggestion, accepted" : "Manual"}{a.byEmail ? ` · ${a.byEmail}` : ""}{a.at ? ` · ${shortDate(a.at)}` : ""}</div></div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`tabular-nums font-semibold ${a.amount > 0 ? "text-emerald-700" : "text-red-700"}`}>{a.amount > 0 ? "+" : "−"}{money(Math.abs(a.amount))}</span>
                {r.editable && <button type="button" aria-label={`Remove ${catLabel(a.category)} adjustment`} disabled={busy} className="rounded-lg p-1 text-stone-400 hover:bg-red-50 hover:text-red-700" onClick={() => void save(c.adjustments.filter(x => x.id !== a.id), "Adjustment removed")}><Trash2 className="size-4" /></button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {c.suggestions.length > 0 && r.editable && (
        <ul className="mt-3 space-y-2">
          {c.suggestions.map(s => (
            <li key={s.reason} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50/70 p-2.5 text-sm ring-1 ring-amber-200">
              <span className="flex min-w-0 gap-1.5"><Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-700" /><span>{s.reason} = <b>{s.amount > 0 ? "+" : "−"}{money(Math.abs(s.amount))}</b></span></span>
              <button type="button" className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold ring-1 ring-amber-300 hover:ring-amber-500" disabled={busy} onClick={() => void save([...c.adjustments, { category: s.category, amount: s.amount, reason: s.reason, suggested: true }], "Suggestion applied")}>Apply</button>
            </li>
          ))}
        </ul>
      )}
      {r.editable && (
        <form className="mt-3 grid grid-cols-2 items-end gap-2 sm:grid-cols-[140px_140px_1fr_auto]" onSubmit={e => { e.preventDefault(); void add(); }}>
          <label className="block"><span className={labelCls}>Type</span><select className={inputCls} value={cat} onChange={e => setCat(e.target.value as AdjustmentCategory)}>{ADJUSTMENT_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <NumberField id={`amt-${c.id}`} label="Amount (±)" prefix="$" step={500} value={amount} onChange={setAmount} />
          <label className="col-span-2 block sm:col-span-1"><span className={labelCls}>Reason</span><input className={inputCls} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Subject has a renovated kitchen" /></label>
          <button type="submit" className={`${btnGhost} col-span-2 sm:col-span-1`} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add</button>
          {err && <span role="alert" className="col-span-2 text-xs text-red-600 sm:col-span-4">{err}</span>}
        </form>
      )}
    </article>
  );
}

function Override({ r }: { r: Report }) {
  const [value, setValue] = useState<number | null>(r.override?.value ?? null);
  const [reason, setReason] = useState(r.override?.reason ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (clear = false) => {
    if (!clear && (!value || value < 1000)) return setErr("Enter the value in dollars.");
    if (!clear && reason.trim().length < 10) return setErr("Explain the override in at least 10 characters. It's recorded in the audit trail.");
    setErr(null);
    setBusy(true);
    try {
      await cmaBuilderApi.update(r.id, { override: clear ? null : { value: value!, reason: reason.trim() } });
      toast.success(clear ? "Override removed" : "Override recorded");
      if (clear) {
        setValue(null);
        setReason("");
      }
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={cardCls} aria-labelledby="ovr-h">
      <h3 id="ovr-h" className="font-display text-lg">Your market value</h3>
      <p className="mt-1 text-sm text-stone-600">The engine estimate is {money(r.engineValue)}. If you know something the data doesn't, set your own value. The reason is saved with your name in the audit trail; your preview shows the engine estimate next to it.</p>
      {r.override && <p className="mt-2 rounded-xl bg-sky-50 p-2.5 text-sm text-sky-900 ring-1 ring-sky-200">Override {money(r.override.value)} by {r.override.byName} on {shortDate(r.override.at)}: “{r.override.reason}”</p>}
      {r.editable && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr]">
          <NumberField id="ovr-v" label="Value" prefix="$" step={1000} value={value} onChange={setValue} />
          <label className="block"><span className={labelCls}>Reason</span><input className={inputCls} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Only listing on the block with a finished basement and new roof" /></label>
          {err && <span role="alert" className="text-xs text-red-600 sm:col-span-2">{err}</span>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}Save override</button>
            {r.override && <button type="button" className={btnGhost} disabled={busy} onClick={() => void save(true)}>Use the engine estimate</button>}
          </div>
        </div>
      )}
    </section>
  );
}

function SizeFactor({ r }: { r: Report }) {
  const current = r.analysis?.settings.sizeAdjustmentFactor ?? 0.5;
  const [v, setV] = useState(Math.round(current * 100));
  if (!r.editable) return null;
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-black/5">
      <label className="block">
        <span className={labelCls}>Size suggestion rate: {v}% of median $/sq ft</span>
        <input type="range" min={0} max={100} step={5} value={v} onChange={e => setV(Number(e.target.value))} className="w-56 accent-[#9C7434]" aria-valuetext={`${v} percent`} />
      </label>
      {v !== Math.round(current * 100) && <button type="button" className={btnGhost} onClick={() => cmaBuilderApi.update(r.id, { settings: { sizeAdjustmentFactor: v / 100 } }).then(() => toast.success("Suggestions updated")).catch(e => toast.error(apiErrorMessage(e)))}>Update suggestions</button>}
      <p className="basis-full text-xs text-stone-500">An extra square foot usually adds less than the average $/sq ft. Suggestions only change the value when you apply them.</p>
    </div>
  );
}

export function AdjustmentsTab({ r }: { r: Report }) {
  const sold = r.comparables.filter(c => c.selected && c.status === "sold");
  return (
    <div className="space-y-4">
      <Override r={r} />
      <SizeFactor r={r} />
      {sold.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-stone-500 ring-1 ring-black/5">Select sold comparables first. Only sold homes are adjusted.</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">{sold.map(c => <CompAdjustments key={c.id} r={r} c={c} />)}</div>
      )}
    </div>
  );
}
