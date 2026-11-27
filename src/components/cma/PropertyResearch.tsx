import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/apiData";
import { cmaBuilderApi, compactMoney, money, type AgentResearch, type PublishedResearch, type Report, type ResearchCounty, type ResearchFact, shortDate } from "@/lib/cmaBuilderApi";
import { btnGhost } from "./shared";

const subjectFields = { beds: "beds", baths: "baths", yearBuilt: "yearBuilt" } as const;

function Trend({ title, values }: { title: string; values: { period: string; value: number }[] }) {
  if (values.length < 2) return null;
  return (
    <div className="h-48 min-w-0" role="img" aria-label={title}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={values} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="period" minTickGap={24} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={compactMoney} tick={{ fontSize: 11 }} width={60} />
          <Tooltip formatter={(value) => money(Number(value))} />
          <Line type="linear" dataKey="value" name={title} stroke="#9C7434" strokeWidth={2} dot={values.length < 8} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function History({ sales, assessments, county }: Pick<PublishedResearch, "sales" | "assessments" | "county">) {
  const valueLabel = county?.valueLabel ?? "Assessed value";
  const marketSales = sales.filter(s => s.marketCandidate);
  const latest = marketSales[0];
  const earliest = marketSales.at(-1);
  const change = latest && earliest && latest.date !== earliest.date && earliest.price > 0 ? (latest.price / earliest.price - 1) * 100 : null;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {sales.length > 0 && (
        <section className="min-w-0 space-y-2">
          <h3 className="font-semibold">Recorded sales</h3>
          <p className="text-sm">Last recorded price {money(sales[0].price)}{change == null ? "" : ` · ${change.toFixed(1)}% change between earliest and latest screened sales`}</p>
          <Trend title="Recorded sale price" values={marketSales.slice().reverse().map(s => ({ period: s.date, value: s.price }))} />
          <div className="max-h-52 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead><tr><th>Date</th><th>Price</th><th>Deed</th></tr></thead>
              <tbody>{sales.map((s, i) => <tr key={`${s.date}-${i}`} className="border-t border-stone-200"><td className="py-1">{shortDate(s.date)}</td><td>{money(s.price)}</td><td>{s.deed || "Unspecified"}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
      {assessments.length > 0 && (
        <section className="min-w-0 space-y-2">
          <h3 className="font-semibold">{county?.valueLabel ? `${county.valueLabel} history` : "Assessed values"}</h3>
          <p className="text-sm text-stone-600">{county?.valueLabel ? `${county.provider}: the county's estimate of market value, used for property taxation.` : "County assessment roll values for property taxation."}</p>
          <Trend title={valueLabel} values={assessments.slice().reverse().map(a => ({ period: String(a.year), value: a.value }))} />
          <div className="max-h-52 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead><tr><th>Year</th><th>Assessment</th><th>Roll stage</th><th>YoY</th></tr></thead>
              <tbody>{assessments.map((a, i) => {
                const previous = assessments[i + 1];
                const yoy = previous?.year === a.year - 1 && previous.value > 0 ? `${((a.value / previous.value - 1) * 100).toFixed(1)}%` : "–";
                return <tr key={a.year} className="border-t border-stone-200"><td className="py-1">{a.year}</td><td>{money(a.value)}</td><td>{a.stage}</td><td>{yoy}</td></tr>;
              })}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function FactValue({ fact }: { fact: ResearchFact }) {
  return (
    <>
      <span className="block break-words font-medium">{fact.label} · {fact.value}{fact.unit ? ` ${fact.unit}` : ""}</span>
      <a className="text-xs text-[#77551E] underline" href={fact.url} target="_blank" rel="noreferrer">{fact.provider} · {fact.dataset}{fact.effectiveDate ? ` · ${fact.effectiveDate}` : ""}</a>
    </>
  );
}

export function PublishedPropertyResearch({ research }: { research: PublishedResearch }) {
  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <h3 className="font-display text-xl">Property research</h3>
      <p className="text-xs text-stone-600">Records collected {shortDate(research.collectedAt)}</p>
      <ul className="grid gap-3 sm:grid-cols-2">{research.facts.map(fact => <li key={fact.label}><FactValue fact={fact} /></li>)}</ul>
      <History {...research} />
      <HistorySources {...research} />
    </section>
  );
}

const COOK_COUNTY: ResearchCounty = { name: "Cook County", provider: "Cook County Assessor", salesUrl: "https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json", assessmentsUrl: "https://datacatalog.cookcountyil.gov/resource/uzyt-m557.json" };

function HistorySources({ sales, assessments, county = COOK_COUNTY }: Pick<PublishedResearch, "sales" | "assessments" | "county">) {
  if (!sales.length && !assessments.length) return null;
  return (
    <div className="flex flex-wrap gap-3 text-xs text-[#77551E]">
      {sales.length > 0 && county.salesUrl && <a className="underline" href={county.salesUrl} target="_blank" rel="noreferrer">{county.name} parcel sales</a>}
      {assessments.length > 0 && county.assessmentsUrl && <a className="underline" href={county.assessmentsUrl} target="_blank" rel="noreferrer">{county.name} {(county.valueLabel ?? "assessed values").toLowerCase()}</a>}
    </div>
  );
}

export function AgentPropertyResearch({ report, reload, onSavingChange }: { report: Report; reload: () => void; onSavingChange: (saving: boolean) => void }) {
  const research = report.propertyResearch;
  if (!research) return (
    <p className="rounded-2xl bg-white p-4 text-sm" role="status">{["queued", "collecting", "normalizing", "analyzing"].includes(report.status) ? (report.progressNote ?? "Property research is queued.") : "Property research is unavailable for this CMA version."}</p>
  );
  return <ResearchReview key={`${report.id}:${research.collectedAt}`} report={report} research={research} reload={reload} onSavingChange={onSavingChange} />;
}

type ApprovalChange = (approvals: string[]) => string[];

function ResearchReview({ report, research, reload, onSavingChange }: { report: Report; research: AgentResearch; reload: () => void; onSavingChange: (saving: boolean) => void }) {
  const [displayed, setDisplayed] = useState<string[]>();
  const [saving, setSaving] = useState(false);
  const [applyingFact, setApplyingFact] = useState(false);
  const confirmed = useRef(research.approvals);
  const queued = useRef<ApprovalChange[]>([]);
  const running = useRef(false);
  const approvals = displayed ?? research.approvals;
  useEffect(() => {
    if (saving || applyingFact || !displayed) return;
    if (displayed.length === research.approvals.length && displayed.every(key => research.approvals.includes(key))) setDisplayed(undefined);
  }, [applyingFact, displayed, research.approvals, saving]);

  const fields = Object.entries(research.facts).map(([key, fact]) => {
    const field = subjectFields[key as keyof typeof subjectFields];
    const existing = field ? report.subject[field] : null;
    return { key, fact, field, existing, conflict: existing != null && existing !== fact.value };
  });
  const eligible = [
    ...fields.filter(field => !field.conflict).map(field => field.key),
    ...(research.sales.length ? ["sales"] : []),
    ...(research.assessments.length ? ["assessments"] : []),
  ];
  const allIncluded = eligible.every(key => approvals.includes(key));
  const missing = Object.entries({ type: "property type", beds: "bedrooms", baths: "bathrooms", area: "square footage", yearBuilt: "year built", lot: "lot size", basement: "basement", garage: "garage" }).filter(([key]) => !research.facts[key]).map(([, label]) => label);
  const applyChanges = (initial: string[], changes: ApprovalChange[]) =>
    changes.reduce((result, change) => change(result), initial);

  const save = async (change: ApprovalChange) => {
    queued.current.push(change);
    setDisplayed(previous => change(previous ?? research.approvals));
    if (running.current) return;
    running.current = true;
    confirmed.current = approvals;
    setSaving(true);
    onSavingChange(true);
    while (queued.current.length) {
      const batch = queued.current.splice(0);
      try {
        const result = await cmaBuilderApi.update(report.id, { researchApprovals: applyChanges(confirmed.current, batch) });
        confirmed.current = result.propertyResearch?.approvals ?? confirmed.current;
      } catch (error) {
        toast.error(apiErrorMessage(error));
      }
      setDisplayed(applyChanges(confirmed.current, queued.current));
    }
    running.current = false;
    setSaving(false);
    onSavingChange(false);
    reload();
  };

  const applyCountyValue = async (key: string, field: string, value: number) => {
    setApplyingFact(true);
    onSavingChange(true);
    try {
      const result = await cmaBuilderApi.update(report.id, {
        researchApprovals: [...new Set([...approvals, key])],
        subject: { [field]: value },
      });
      setDisplayed(result.propertyResearch?.approvals);
      reload();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setApplyingFact(false);
      onSavingChange(false);
    }
  };

  const approval = (key: string) => (
    <label className="flex items-center gap-2 text-xs text-stone-700">
      <input type="checkbox" className="accent-[#9C7434]" disabled={!report.editable || applyingFact} checked={approvals.includes(key)} onChange={event => {
        const checked = event.currentTarget.checked;
        void save(previous => checked ? [...new Set([...previous, key])] : previous.filter(item => item !== key));
      }} />
      Include in published report
    </label>
  );
  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <h2 className="font-display text-xl">Property research</h2>
      <p className="text-sm text-stone-600">Review public records about the listing, including parcel facts, recorded sales and assessed values. Choose which items to share when you publish. To use a nearby sale in the valuation, select it in Comparables.</p>
      <p className="text-sm text-stone-600">{research.status === "clarification" ? "Address clarification needed" : research.status === "partial" ? "Partial results" : research.status === "unavailable" ? "Research unavailable" : "Ready for review"} · {shortDate(research.collectedAt)}</p>
      {research.issues.length > 0 && <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{research.issues.map(i => <li key={i.source}>{i.source} · {i.message}</li>)}</ul>}
      {report.editable && eligible.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btnGhost} disabled={allIncluded || applyingFact} onClick={() => void save(previous => [...new Set([...previous, ...eligible])])}>Include all</button>
          <span className="text-sm text-stone-600" role="status">{saving ? "Saving selections…" : `${eligible.filter(key => approvals.includes(key)).length} of ${eligible.length} included`}</span>
          {fields.some(field => field.conflict) && <p className="w-full text-xs text-stone-600">Resolve conflicting facts individually to include them.</p>}
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {fields.map(({ key, fact, field, existing, conflict }) => {
          return (
            <li key={key} className="space-y-1 rounded-xl bg-stone-50 p-3">
              <FactValue fact={fact} />
              {conflict ? <p className="text-xs text-amber-800">CMA value {existing} differs from county record.</p> : approval(key)}
              {field && existing == null && <p className="text-xs text-stone-600">Used for the preliminary analysis while the CMA field is blank.</p>}
              {field && typeof fact.value === "number" && existing !== fact.value && report.editable && <button type="button" className={btnGhost} disabled={saving || applyingFact} onClick={() => void applyCountyValue(key, field, Number(fact.value))}>Use county value</button>}
            </li>
          );
        })}
      </ul>
      {missing.length > 0 && <p className="text-sm text-stone-600">Missing from public records · {missing.join(", ")}</p>}
      <History {...research} />
      <HistorySources {...research} />
      <div className="flex flex-wrap gap-4">
        {research.sales.length > 0 && <div className="space-y-1"><p className="text-sm font-medium">Sales history</p>{approval("sales")}</div>}
        {research.assessments.length > 0 && <div className="space-y-1"><p className="text-sm font-medium">Assessment history</p>{approval("assessments")}</div>}
      </div>
      <p className="text-sm text-stone-600">Review Public Records candidates in Comparables before selecting them for valuation.</p>
    </section>
  );
}
