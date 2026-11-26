// Market analysis: charts from the collected data only. Missing numbers stay missing ("–"), never filled in.
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApiData } from "@/lib/apiData";
import { cmaBuilderApi, compactMoney, money, num, type Report, shortDate } from "@/lib/cmaBuilderApi";
import { cardCls, Kpi } from "../shared";

const GOLD = "#9C7434";
const SAND = "#D9BC8C";
const INK = "#0A0A0A";
const short = (a: string) => a.split(",")[0]!.slice(0, 22);

/** "Too high (3) · About right (1)" from the buyer agents' price opinions. */
function countOpinions(list: string[]) {
  const m = new Map<string, number>();
  for (const p of list) m.set(p, (m.get(p) ?? 0) + 1);
  return [...m].map(([k, n]) => `${k} (${n})`).join(" · ");
}

function ChartCard({ title, sub, children, empty }: { title: string; sub?: string; children: React.ReactNode; empty?: string | false }) {
  return (
    <section className={cardCls}>
      <h3 className="font-display text-lg">{title}</h3>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
      <div className="mt-3">{empty ? <p className="py-10 text-center text-sm text-stone-500">{empty}</p> : children}</div>
    </section>
  );
}

export function MarketTab({ r }: { r: Report }) {
  const a = r.analysis;
  const history = useApiData(`cma:history:${r.listing.id}`, () => cmaBuilderApi.history(r.listing.id)).data;
  const context = useApiData(`cma:context:${r.listing.id}`, () => cmaBuilderApi.context(r.listing.id)).data;
  const sold = r.comparables.filter(c => c.selected && c.status === "sold");
  const asking = r.askingPrice ?? r.subject.askingPrice ?? null;

  const priceData = sold.map(c => ({ name: short(c.address), value: c.adjustedValue ?? c.soldPrice ?? 0, sold: c.soldPrice ?? 0 })).sort((x, y) => x.value - y.value);
  const ppsfData = sold.filter(c => c.pricePerSqft).map(c => ({ name: short(c.address), value: c.pricePerSqft! })).sort((x, y) => x.value - y.value);
  const mix = [
    { name: "Sold", value: r.comparables.filter(c => c.status === "sold").length, fill: GOLD },
    { name: "Pending", value: r.comparables.filter(c => c.status === "pending").length, fill: SAND },
    { name: "Active", value: r.comparables.filter(c => c.status === "active").length, fill: INK },
  ];
  const trend = (history?.trend ?? []).map(t => ({ date: shortDate(t.at), value: t.estimatedValue, median: t.medianSoldPrice }));
  const cmp = a?.comparedToPublished;
  const tooltip = { contentStyle: { borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 } };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Median days on market" value={num(a?.sold.medianDom)} sub={`Average ${num(a?.sold.avgDom)}`} />
        <Kpi label="Sold-to-list" value={a?.soldToListRatio ? `${(a.soldToListRatio * 100).toFixed(1)}%` : "–"} sub={a?.soldToListCount ? `${a.soldToListCount} sales with a list price` : "No list prices at sale"} />
        <Kpi label="Active listings" value={a?.active.count ?? 0} sub={a?.active.medianPpsf ? `Median $${a.active.medianPpsf}/sq ft` : undefined} />
        <Kpi label="Since last published" value={cmp?.changePct != null ? `${cmp.changePct > 0 ? "+" : ""}${cmp.changePct}%` : "–"} sub={cmp ? `${cmp.newSales} new sale${cmp.newSales === 1 ? "" : "s"} vs v${cmp.version}` : "No earlier published version"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Adjusted sold prices" sub="Selected sales after your adjustments; gold line = estimate, black = asking" empty={!priceData.length && "No selected sold comparables yet."}>
          <ResponsiveContainer width="100%" height={Math.max(180, priceData.length * 34)}>
            <BarChart data={priceData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="#f0eeea" />
              <XAxis type="number" tickFormatter={compactMoney} domain={["dataMin - 30000", "dataMax + 30000"]} fontSize={11} />
              <YAxis type="category" dataKey="name" width={130} fontSize={11} />
              <Tooltip formatter={(v: number) => money(v)} {...tooltip} />
              <Bar dataKey="value" name="Adjusted value" fill={SAND} radius={[0, 6, 6, 0]} />
              {r.estimatedValue != null && <ReferenceLine x={r.estimatedValue} stroke={GOLD} strokeWidth={2} strokeDasharray="4 3" />}
              {asking != null && <ReferenceLine x={asking} stroke={INK} strokeWidth={1.5} />}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Price per square foot" sub="Black line = your asking $/sq ft" empty={!ppsfData.length && "No sold comparables with square footage."}>
          <ResponsiveContainer width="100%" height={Math.max(180, ppsfData.length * 34)}>
            <BarChart data={ppsfData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="#f0eeea" />
              <XAxis type="number" tickFormatter={v => `$${v}`} fontSize={11} />
              <YAxis type="category" dataKey="name" width={130} fontSize={11} />
              <Tooltip formatter={(v: number) => `$${v}/sq ft`} {...tooltip} />
              <Bar dataKey="value" name="$/sq ft" fill={GOLD} radius={[0, 6, 6, 0]} />
              {a?.subjectPositioning.askingPpsf != null && <ReferenceLine x={a.subjectPositioning.askingPpsf} stroke={INK} strokeWidth={1.5} />}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sold, pending and active" sub="Everything collected for this CMA" empty={!r.comparables.length && "Nothing collected yet."}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mix} margin={{ right: 12 }}>
              <CartesianGrid vertical={false} stroke="#f0eeea" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip {...tooltip} />
              <Bar dataKey="value" name="Homes" radius={[6, 6, 0, 0]}>{mix.map(m => <Cell key={m.name} fill={m.fill} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Valuation over time" sub="Each analysed version of this CMA" empty={trend.length < 2 && "The trend appears after the second analysed version (weekly refreshes add one)."}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend} margin={{ right: 12 }}>
              <CartesianGrid stroke="#f0eeea" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis tickFormatter={compactMoney} fontSize={11} width={60} domain={["auto", "auto"]} />
              <Tooltip formatter={(v: number) => money(v)} {...tooltip} />
              <Line type="monotone" dataKey="value" name="Estimate" stroke={GOLD} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="median" name="Median sold" stroke={INK} strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className={cardCls} aria-labelledby="mk-h">
        <h3 id="mk-h" className="font-display text-lg">Marketing activity</h3>
        <p className="text-xs text-stone-500">{context?.note ?? "Context for the pricing conversation. It never changes the calculated value."}</p>
        {context ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {[["Showings", context.activity.showings], ["Buyer feedback", context.activity.feedback], ["Offers", context.activity.offers], ["Zillow views (total)", context.activity.totals.zillowViews || "–"]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-[#F7F5F1] p-3"><div className="text-xs text-stone-500">{k}</div><div className="font-display text-xl">{v}</div></div>
              ))}
            </div>
            {context.activity.priceOpinions.length > 0 && <p className="mt-3 text-sm"><span className="text-stone-500">Buyer agents on price:</span> {countOpinions(context.activity.priceOpinions)}</p>}
            <ul className="mt-3 flex flex-wrap gap-1.5">{context.connectors.map(c => <li key={c.id} title={c.note} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600">{c.label}: {c.connected ? "connected" : "not connected"}</li>)}</ul>
          </>
        ) : <div className="mt-3 h-20 animate-pulse rounded-xl bg-stone-100" />}
      </section>
    </div>
  );
}
