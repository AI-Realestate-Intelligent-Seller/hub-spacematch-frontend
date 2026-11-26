// Seller page "Market & pricing" section: only the agent-published CMA. Sellers can read it, view
// the full report and download the PDF; nothing here can change it. Internal states and errors
// are never shown: while a new version is prepared the last published one stays up.
import { FileText, Hourglass, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApiData } from "@/lib/apiData";
import { cmaBuilderApi, compactMoney, money, num, type ReportFormat, type SellerCma, type SellerState, shortDate } from "@/lib/cmaBuilderApi";
import { PublishedPropertyResearch } from "./PropertyResearch";
import { ReportDownloadButton, ReportPreviewDialog } from "./shared";

const WAITING: Partial<Record<SellerState, [string, string]>> = {
  none: ["Market analysis is not yet available", "Your agent will share a comparative market analysis of recent nearby sales here."],
  requested: ["Your agent is preparing your market analysis", "Recent nearby sales are being gathered. You'll see the results here once your agent has reviewed them."],
  processing: ["Your market analysis is being prepared", "Recent nearby sales are being gathered and compared with your home."],
  under_review: ["Your agent is reviewing the market analysis", "It will appear here as soon as your agent approves it."],
};

/** Only the facts we actually have ("3 bd · 2 ba · 1,850 sq ft"); unknown ones are left out. */
function facts(c: NonNullable<SellerCma["report"]>["comparables"][number]) {
  return [
    c.source,
    c.status === "sold" ? `Sold ${shortDate(c.soldDate)}` : c.status === "pending" ? "Under contract" : "For sale now",
    c.beds != null ? `${num(c.beds, 1)} bd` : null,
    c.baths != null ? `${num(c.baths, 1)} ba` : null,
    c.sqft != null ? `${num(c.sqft)} sq ft` : null,
    c.distanceMi != null ? `${c.distanceMi.toFixed(1)} mi away` : null,
  ].filter(Boolean) as string[];
}

function RangeBar({ low, high, value, asking }: { low: number; high: number; value: number | null; asking: number | null }) {
  const pts = [low, high, value, asking].filter((x): x is number => x != null);
  const min = Math.min(...pts) * 0.97;
  const max = Math.max(...pts) * 1.03;
  const x = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  return (
    <div className="px-1 pt-8 pb-8" role="img" aria-label={`Recommended range ${money(low)} to ${money(high)}${asking ? `; your asking price ${money(asking)}` : ""}`}>
      <div className="relative h-3 rounded-full bg-stone-100">
        <div className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[#D9BC8C] to-[#9C7434]" style={{ left: x(low), width: `calc(${x(high)} - ${x(low)})` }} />
        {value != null && <div className="absolute -top-8 -translate-x-1/2 text-center" style={{ left: x(value) }}><div className="whitespace-nowrap text-xs font-semibold text-[#9C7434]">Market value</div><div className="mx-auto mt-0.5 h-6 w-0.5 bg-[#9C7434]" /></div>}
        {asking != null && <div className="absolute top-1 -translate-x-1/2 text-center" style={{ left: x(asking) }}><div className="mx-auto h-6 w-0.5 bg-[#0A0A0A]" /><div className="whitespace-nowrap text-xs font-semibold">Your price</div></div>}
      </div>
    </div>
  );
}

function Published({ d, token }: { d: SellerCma; token: string }) {
  const r = d.report!;
  const [full, setFull] = useState(false);
  const loadReport = (format?: ReportFormat, download?: boolean) => cmaBuilderApi.sellerPdf(token, format, download);
  const s = r.stats;
  const sold = r.comparables.filter(c => c.status === "sold");
  const ppsf = sold.filter(c => c.pricePerSqft).map((c, i) => ({ name: c.address?.split(",")[0]?.slice(0, 16) ?? `Sale ${i + 1}`, value: c.pricePerSqft! }));
  const trend = d.history.map(h => ({ date: shortDate(h.publishedAt), value: h.estimatedValue }));
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#0A0A0A] p-5 text-white">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[#D9BC8C]">Agent-approved market value</p>
        <div className="mt-1 font-display text-4xl">{money(r.estimatedValue)}</div>
        {r.range && <p className="mt-1 text-sm text-white/70">Recommended range {money(r.range.low)} – {money(r.range.high)}</p>}
        {r.recommendedListPrice && <p className="mt-0.5 text-sm text-white/70">Recommended list price {money(r.recommendedListPrice)}</p>}
        <p className="mt-3 text-xs text-white/50">Prepared by {r.agentName} · updated {shortDate(r.publishedAt)}</p>
      </div>
      {r.containsFixtures && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">This analysis includes test data and is not a real market report.</p>}
      {r.range && <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5"><RangeBar low={r.range.low} high={r.range.high} value={r.estimatedValue} asking={r.askingPrice} /><p className="text-center text-sm text-stone-600">{r.askingPrice == null ? "" : r.askingPrice > r.range.high ? "Your current price is above the range recent sales support." : r.askingPrice < r.range.low ? "Your current price is below the range recent sales support." : "Your current price sits within the range recent sales support."}</p></div>}
      {r.executiveSummary && <p className="whitespace-pre-line rounded-2xl bg-white p-4 text-[15px] ring-1 ring-black/5">{r.executiveSummary}</p>}

      {r.propertyResearch && <PublishedPropertyResearch research={r.propertyResearch} />}
      {s && r.sections.overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Similar homes sold", num(s.soldCount), "used for this analysis"],
            ["Average sold price", money(s.avgSoldPrice), s.medianSoldPrice ? `median ${money(s.medianSoldPrice)}` : ""],
            ["Average days to sell", num(s.avgDom), "days on market"],
            ["Price per sq ft", s.medianPpsf ? `$${s.medianPpsf}` : "–", s.subjectAskingPpsf ? `yours: $${s.subjectAskingPpsf}` : "median of sales"],
          ].map(([k, v, sub]) => (
            <div key={k} className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
              <div className="text-[12px] uppercase tracking-[0.12em] text-stone-500">{k}</div>
              <div className="mt-1.5 font-display text-2xl">{v}</div>
              {sub && <div className="text-xs text-stone-500">{sub}</div>}
            </div>
          ))}
        </div>
      )}

      {r.sections.market && ppsf.length > 1 && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
          <h3 className="font-display text-lg">Price per square foot of recent sales</h3>
          <p className="text-xs text-stone-500">The dark line is your home at its current price.</p>
          <ResponsiveContainer width="100%" height={Math.max(160, ppsf.length * 30)}>
            <BarChart data={ppsf} layout="vertical" margin={{ left: 4, right: 20, top: 8 }}>
              <CartesianGrid horizontal={false} stroke="#f0eeea" />
              <XAxis type="number" tickFormatter={v => `$${v}`} fontSize={11} />
              <YAxis type="category" dataKey="name" width={104} fontSize={10} interval={0} />
              <Tooltip formatter={(v: number) => `$${v} per sq ft`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="value" fill="#D9BC8C" radius={[0, 6, 6, 0]} />
              {s?.subjectAskingPpsf && <ReferenceLine x={s.subjectAskingPpsf} stroke="#0A0A0A" strokeWidth={1.5} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {r.sections.comparables && r.comparables.length > 0 && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
          <h3 className="font-display text-lg">Homes your agent compared</h3>
          <ul className="mt-2 divide-y divide-stone-100">
            {r.comparables.map((c, i) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{c.address ?? `Comparable home ${i + 1}`}</div>
                  <div className="text-xs text-stone-500">{facts(c).join(" · ")}</div>
                </div>
                <div className="shrink-0 text-right font-display text-lg">{money(c.price)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {trend.length > 1 && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
          <h3 className="flex items-center gap-2 font-display text-lg"><TrendingUp className="size-5 text-[#9C7434]" /> Market value over time</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trend} margin={{ right: 12, top: 8 }}>
              <CartesianGrid stroke="#f0eeea" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis tickFormatter={compactMoney} fontSize={11} width={56} domain={["auto", "auto"]} />
              <Tooltip formatter={(v: number) => money(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke="#9C7434" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {(r.pricingRecommendation || r.marketingRecommendations) && (
        <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-black/5">
          {r.pricingRecommendation && <div><h3 className="font-display text-lg">Your agent's pricing recommendation</h3><p className="mt-1 whitespace-pre-line text-[15px] text-stone-700">{r.pricingRecommendation}</p></div>}
          {r.marketingRecommendations && <div><h3 className="font-display text-lg">How we'll market it</h3><p className="mt-1 whitespace-pre-line text-[15px] text-stone-700">{r.marketingRecommendations}</p></div>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => setFull(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-white p-4 text-sm font-semibold ring-1 ring-black/5 active:scale-[0.99]"><FileText className="size-5 text-[#9C7434]" /> Full report</button>
        <ReportDownloadButton load={loadReport} format="pdf" />
        <ReportDownloadButton load={loadReport} format="pptx" />
      </div>
      <p className="px-1 text-xs text-stone-500">{r.disclaimer}</p>
      <ReportPreviewDialog open={full} onOpenChange={setFull} load={loadReport} title="Your market analysis" />
    </div>
  );
}

export function SellerMarketSection({ token }: { token: string }) {
  const { data, error } = useApiData(`portal:cma:${token}`, () => cmaBuilderApi.seller(token), { pollMs: 120_000 });
  if (error && !data) return null; // never show internal errors to sellers; the rest of the page still works
  return (
    <section id="market" aria-labelledby="market-h" className="scroll-mt-4 space-y-3" data-testid="seller-market">
      <h2 id="market-h" className="px-1 font-display text-xl">Market &amp; pricing</h2>
      {!data ? (
        <div role="status" className="h-32 animate-pulse rounded-2xl bg-white ring-1 ring-black/5" aria-busy="true" aria-label="Loading market analysis" />
      ) : data.report ? (
        <>
          {data.state === "refreshing" && <p className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-stone-600 ring-1 ring-black/5"><Hourglass className="size-4 text-[#9C7434]" /> Your agent is updating this analysis with the latest sales. The figures below stay until they approve the update.</p>}
          <Published d={data} token={token} />
        </>
      ) : (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
          <p className="flex items-center gap-2 font-semibold">{data.state !== "none" && <Hourglass className="size-4 text-[#9C7434]" />}{WAITING[data.state]?.[0] ?? WAITING.none![0]}</p>
          <p className="mt-1 text-[15px] text-stone-600">{WAITING[data.state]?.[1] ?? WAITING.none![1]}</p>
        </div>
      )}
    </section>
  );
}
