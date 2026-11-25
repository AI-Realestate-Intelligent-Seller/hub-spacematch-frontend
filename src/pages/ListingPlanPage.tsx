// Neighborhood & marketing plan for one listing (Michael 2026-11-08).
import { useMutation } from "convex/react";
import { ArrowLeft, Check, Copy, ExternalLink, Loader2, Printer, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { formatFreeAddress, formatPrice } from "../../convex/address";
import { ago, errMsg, inputCls } from "./ListingsPage";
import { EmptyState, Skeleton } from "@/components/hub/FormState";
import { supportsLegacyListing } from "@/lib/listingsApi";
import { useLegacyQuery } from "@/auth/convexClient";

type Src = { name: string; url: string };
export type Plan = {
  headline: string;
  property_snapshot: { label: string; value: string; source: string }[];
  neighborhood_highlights: { title: string; detail: string; source: string }[];
  demographics_takeaways: string[];
  buyer_profiles: { name: string; why_this_home: string; where_to_reach: string; message: string }[];
  lifestyle: string[];
  schools: { name: string; grades: string; ratings: string; source: string }[];
  cons: { con: string; objection_handler: string }[];
  marketing_plan: {
    pricing_strategy: string;
    phases: { phase: string; when: string; actions: string[] }[];
    content_ideas: { format: string; idea: string; hook: string }[];
    offer_strategy: string[];
  };
  farming_plan: { area: string; list_size_note: string; touches: { when: string; channel: string; action: string }[]; door_knock_script: string };
  verify_before_using: string[];
  sources: Src[];
};
type AcsArea = Record<string, number | string | null>;
type Facts = { neighborhood?: string | null; census?: { release?: string; areas?: AcsArea[]; error?: string }; schools?: { name: string; level: string; grades: string; address: string; boundarySource: string }[]; schoolDistricts?: string[] };

const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success("Copied"));

function Section({ id, title, kicker, text, children }: { id: string; title: string; kicker?: string; text: () => string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 break-inside-avoid-page rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5" data-testid={`plan-${id}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          {kicker && <div className="text-[11px] uppercase tracking-[0.25em] text-[#9C7434]">{kicker}</div>}
          <h2 className="font-display text-xl">{title}</h2>
        </div>
        <button type="button" onClick={() => copy(text())} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#9C7434] ring-1 ring-[#D9BC8C] print:hidden"><Copy className="size-3.5" /> Copy</button>
      </div>
      <div className="space-y-3 text-[15px] leading-relaxed text-stone-800">{children}</div>
    </section>
  );
}

const fmt = (k: string, v: number | string | null | undefined) => {
  if (v === null || v === undefined || v === "" || v === 0) return "—";
  if (typeof v !== "number") return String(v);
  if (/Income|Value|Rent/.test(k)) return `$${Math.round(v).toLocaleString()}`;
  if (/Pct$/.test(k)) return `${v}%`;
  if (k === "medianYearBuilt") return String(v);
  return v.toLocaleString();
};
const ACS_ROWS: [string, string][] = [
  ["medianHouseholdIncome", "Median household income"],
  ["medianHomeValue", "Median home value (owner estimate)"],
  ["medianGrossRent", "Median rent"],
  ["ownerOccupiedPct", "Owner-occupied homes"],
  ["singleFamilyPct", "Single-family homes"],
  ["twoToFourUnitPct", "2–4 unit buildings"],
  ["medianYearBuilt", "Median year built"],
  ["bachelorsOrHigherPct", "Bachelor's degree or higher"],
  ["workFromHomePct", "Work from home"],
  ["commuteTransitPct", "Commute by transit"],
  ["walkOrBikePct", "Commute on foot or bike"],
  ["avgHouseholdSize", "Average household size"],
];
const areaLabel = (n: string) => n.replace(/^Census Tract ([\d.]+).*$/, "This tract ($1)").replace(/, IL$/, "");

function Census({ facts, takeaways }: { facts: Facts; takeaways: string[] }) {
  const c = facts.census;
  if (!c?.areas?.length) return <p className="text-red-700">Census data didn't load for this address{c?.error ? ` (${c.error})` : ""}. Rebuild to try again.</p>;
  const areas = c.areas;
  return (
    <>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[440px] text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-500">
              <th className="px-1 py-1.5 font-medium" />
              {areas.map(a => <th key={String(a.geoId)} className="px-1 py-1.5 text-right font-medium">{areaLabel(String(a.name))}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {ACS_ROWS.map(([k, label]) => (
              <tr key={k}>
                <td className="px-1 py-1.5 text-stone-600">{label}</td>
                {areas.map((a, i) => <td key={String(a.geoId)} className={`px-1 py-1.5 text-right tabular-nums ${i === 0 ? "font-semibold" : "text-stone-500"}`}>{fmt(k, a[k] as number)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500">Source: U.S. Census Bureau, {c.release ?? "ACS 5-year"} (via Census Reporter). Estimates with margins of error. Race, ethnicity, age and household-type data are left out on purpose.</p>
      {takeaways.length > 0 && <ul className="list-disc space-y-1 pl-5">{takeaways.map(t => <li key={t}>{t}</li>)}</ul>}
    </>
  );
}

const asText = {
  highlights: (p: Plan) => p.neighborhood_highlights.map(h => `• ${h.title}: ${h.detail}`).join("\n"),
  buyers: (p: Plan) => p.buyer_profiles.map(b => `${b.name}\nWhy this home: ${b.why_this_home}\nWhere to reach: ${b.where_to_reach}\nMessage: ${b.message}`).join("\n\n"),
  lifestyle: (p: Plan) => p.lifestyle.join("\n\n"),
  schools: (p: Plan) => p.schools.map(s => `${s.name} (${s.grades}): ${s.ratings}`).join("\n"),
  cons: (p: Plan) => p.cons.map(c => `Con: ${c.con}\nHandler: ${c.objection_handler}`).join("\n\n"),
  marketing: (p: Plan) => [
    `Pricing: ${p.marketing_plan.pricing_strategy}`,
    ...p.marketing_plan.phases.map(ph => `${ph.phase} (${ph.when})\n${ph.actions.map(a => `• ${a}`).join("\n")}`),
    `Offer strategy\n${p.marketing_plan.offer_strategy.map(a => `• ${a}`).join("\n")}`,
  ].join("\n\n"),
  content: (p: Plan) => p.marketing_plan.content_ideas.map(c => `${c.format}: ${c.idea}\nHook: ${c.hook}`).join("\n\n"),
  farming: (p: Plan) => [`Area: ${p.farming_plan.area}`, `List: ${p.farming_plan.list_size_note}`, ...p.farming_plan.touches.map(t => `• ${t.when} · ${t.channel}: ${t.action}`), `Door-knock script: ${p.farming_plan.door_knock_script}`].join("\n"),
};

const NAV: [string, string][] = [
  ["highlights", "Highlights"], ["demographics", "Data"], ["buyers", "Buyers"], ["lifestyle", "Lifestyle"], ["schools", "Schools"],
  ["cons", "Objections"], ["marketing", "Marketing plan"], ["content", "Content"], ["farming", "Farming"], ["verify", "Verify"],
];

export function PlanBuilder({ listingId, plan, buildsLeft, compact }: { listingId: Id<"listings">; plan: Doc<"listingPlans"> | null; buildsLeft: number | null; compact?: boolean }) {
  const request = useMutation(api.listingPlans.request);
  const [open, setOpen] = useState(!plan);
  const [neighborhood, setNeighborhood] = useState(plan?.neighborhood ?? "");
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const building = plan && (plan.status === "queued" || plan.status === "building") && Date.now() - plan.updatedAt < 15 * 60 * 1000;
  const go = async () => {
    setBusy(true);
    try {
      await request({ listingId, neighborhood: neighborhood || undefined, notes: notes || undefined });
      setOpen(false);
      toast.success("Building your plan. About 2 minutes.");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  if (building) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-white/70 p-3 text-sm ring-1 ring-[#D9BC8C]/60" data-testid="plan-building">
        <Loader2 className="size-5 shrink-0 animate-spin text-[#9C7434]" />
        <div><div className="font-semibold">{plan.step ?? "Building…"}</div><div className="text-xs text-stone-500">Takes about 2 minutes. You can leave this page; it keeps going.</div></div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {plan?.status === "error" && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" data-testid="plan-error">The last build didn't finish: {plan.error}</p>}
      {!open && plan ? (
        <button type="button" onClick={() => setOpen(true)} className={`flex items-center gap-1 text-sm font-semibold text-[#9C7434] ${compact ? "" : "print:hidden"}`}><RefreshCw className="size-3.5" /> {plan.status === "error" ? "Try again" : "Rebuild with my notes"}</button>
      ) : (
        <div className="space-y-2 print:hidden">
          <label className="block text-sm font-medium">Neighborhood <span className="font-normal text-stone-500">(optional, we detect it)</span>
            <input className={inputCls} value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="e.g. Logan Square, west of the 606" />
          </label>
          <label className="block text-sm font-medium">What makes this home special? <span className="font-normal text-stone-500">(optional, makes the plan sharper)</span>
            <textarea className={`${inputCls} min-h-[80px]`} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Beds/baths, garage, yard, rehab year, seller's timeline, price you're going in at…" />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={busy} onClick={go} className="flex items-center gap-1.5 rounded-xl bg-[#0A0A0A] px-5 py-2.5 font-semibold text-white disabled:opacity-60" data-testid="plan-build"><Sparkles className="size-4 text-[#D9BC8C]" /> {plan ? "Rebuild plan" : "Build my plan"}</button>
            {buildsLeft !== null && plan && <span className="text-xs text-stone-500">{buildsLeft} rebuild{buildsLeft === 1 ? "" : "s"} left for this listing</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function ListingPlanPage() {
  const { id } = useParams();
  const available = !!id && supportsLegacyListing(id);
  const data = useLegacyQuery(api.listingPlans.forListing, available ? { listingId: id as Id<"listings"> } : "skip");
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  if (!available || data instanceof Error) return (
    <EmptyState icon={<Sparkles className="size-8" />} title="Marketing plan unavailable"
      action={<Link to={id ? `/listings/${id}` : "/listings"} className="font-semibold text-[#7a5a26] underline">Back to {id ? "listing" : "listings"}</Link>} />
  );
  if (data === undefined) return <Skeleton label="Loading marketing plan" rows={2} />;
  const { listing: l, plan: row, buildsLeft, prompt } = data;
  const p = (row?.plan ?? null) as Plan | null;
  const facts = (row?.facts ?? {}) as Facts;
  const street = formatFreeAddress(l.address).split(",")[0];
  const chatPrompt = `${prompt}\n\nListing: ${l.address}${facts.neighborhood ? ` (${facts.neighborhood})` : ""}${l.price ? `, listed at ${formatPrice(l.price)}` : ""}. Verify the information, use reliable local data and make sure the marketing complies with Fair Housing rules.`;
  return (
    <div className="mx-auto max-w-3xl space-y-4 print:max-w-none">
      <Link to={`/listings/${l._id}`} className="inline-flex items-center gap-1 text-sm text-stone-500 print:hidden"><ArrowLeft className="size-4" /> {street}</Link>
      <header className="rounded-2xl bg-[#0A0A0A] p-5 text-white print:bg-white print:p-0 print:text-black">
        <div className="text-[11px] uppercase tracking-[0.25em] text-[#D9BC8C] print:text-[#9C7434]">Neighborhood & marketing plan</div>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl">{street}</h1>
        <p className="text-sm text-white/60 print:text-stone-500">{[facts.neighborhood, l.price && formatPrice(l.price), l.mlsNumber && `MLS ${l.mlsNumber}`, l.agentName].filter(Boolean).join(" · ")}</p>
        {p && <p className="mt-3 text-lg leading-snug text-[#F7F5F1] print:text-black" data-testid="plan-headline">{p.headline}</p>}
        <div className="mt-4 flex flex-wrap gap-2 text-sm print:hidden">
          {p && <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl bg-[#9C7434] px-3 py-2 font-semibold"><Printer className="size-4" /> Print / save PDF</button>}
          <button type="button" onClick={() => copy(chatPrompt)} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2"><Copy className="size-4" /> Copy prompt for ChatGPT</button>
        </div>
        {row?.finishedAt && <p className="mt-2 text-xs text-white/40 print:hidden">Built {ago(row.finishedAt)}</p>}
      </header>

      <div className="rounded-2xl bg-[#F7F5F1] p-4 ring-1 ring-[#D9BC8C]/50 print:hidden">
        <PlanBuilder listingId={l._id} plan={row} buildsLeft={buildsLeft} />
      </div>

      {p && (
        <>
          <nav className="sticky top-16 z-30 -mx-4 flex gap-1 overflow-x-auto bg-background/95 px-4 py-2 text-sm backdrop-blur print:hidden">
            {NAV.map(([k, label]) => <a key={k} href={`#${k}`} className="shrink-0 rounded-full bg-white px-3 py-1 ring-1 ring-black/10 hover:ring-[#9C7434]">{label}</a>)}
          </nav>

          <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>Fair Housing built in: buyer profiles describe needs and lifestyle, never protected classes, and paid ads follow Meta's Housing rules. Review the <a href="#verify" className="font-semibold underline">Verify</a> list before anything goes public.</span>
          </div>

          {p.property_snapshot.length > 0 && (
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="plan-snapshot">
              {p.property_snapshot.map(s => (
                <div key={s.label} className="rounded-xl bg-white p-3 ring-1 ring-black/5" title={s.source}>
                  <div className="text-[11px] uppercase tracking-wider text-stone-500">{s.label}</div>
                  <div className="font-semibold">{s.value}</div>
                </div>
              ))}
            </section>
          )}

          <Section id="highlights" kicker="Positioning" title="Neighborhood highlights" text={() => asText.highlights(p)}>
            <ul className="space-y-2.5">{p.neighborhood_highlights.map(h => <li key={h.title}><b>{h.title}.</b> {h.detail} <span className="text-xs text-stone-400">({h.source})</span></li>)}</ul>
          </Section>

          <Section id="demographics" kicker="Census data" title="The numbers" text={() => (facts.census?.areas ?? []).map(a => `${a.name}: ${ACS_ROWS.map(([k, lab]) => `${lab} ${fmt(k, a[k] as number)}`).join("; ")}`).join("\n") + "\n" + p.demographics_takeaways.join("\n")}>
            <Census facts={facts} takeaways={p.demographics_takeaways} />
          </Section>

          <Section id="buyers" kicker="Who to market to" title="Ideal buyer profiles" text={() => asText.buyers(p)}>
            <div className="grid gap-3 sm:grid-cols-2">
              {p.buyer_profiles.map(b => (
                <div key={b.name} className="rounded-xl bg-[#F7F5F1] p-3.5">
                  <div className="font-semibold">{b.name}</div>
                  <p className="mt-1 text-sm"><span className="text-stone-500">Why this home:</span> {b.why_this_home}</p>
                  <p className="mt-1 text-sm"><span className="text-stone-500">Where to reach:</span> {b.where_to_reach}</p>
                  <p className="mt-2 border-l-2 border-[#9C7434] pl-2 text-sm italic">“{b.message}”</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="lifestyle" kicker="If you lived here" title="The lifestyle" text={() => asText.lifestyle(p)}>
            {p.lifestyle.map(t => <p key={t}>{t}</p>)}
          </Section>

          <Section id="schools" kicker="Schools" title="School ratings" text={() => asText.schools(p)}>
            {facts.schools && facts.schools.length > 0 && <p className="text-xs text-stone-500">Boundary schools from the official {facts.schools[0].boundarySource}. Buyers should confirm enrollment with the district.</p>}
            {!facts.schools?.length && !!facts.schoolDistricts?.length && <p className="text-xs text-stone-500">School districts for this address (U.S. Census Bureau boundaries): {facts.schoolDistricts.join(" · ")}. Confirm the assigned school with the district's school finder.</p>}
            <ul className="space-y-2.5">{p.schools.map(s => <li key={s.name} className="rounded-xl bg-[#F7F5F1] p-3"><div className="font-semibold">{s.name} <span className="font-normal text-stone-500">· {s.grades}</span></div><div className="text-sm">{s.ratings}</div><div className="mt-1 text-xs text-stone-400">{s.source}</div></li>)}</ul>
          </Section>

          <Section id="cons" kicker="Objections" title="Cons & how to handle them" text={() => asText.cons(p)}>
            <ul className="space-y-3">{p.cons.map(c => <li key={c.con}><div className="font-semibold">“{c.con}”</div><div className="mt-0.5 text-sm text-stone-700"><span className="font-semibold text-[#9C7434]">Say:</span> {c.objection_handler}</div></li>)}</ul>
          </Section>

          <Section id="marketing" kicker="Top-marketer plan" title="Marketing plan for max offers" text={() => asText.marketing(p)}>
            <p><b>Pricing.</b> {p.marketing_plan.pricing_strategy}</p>
            <ol className="space-y-3">
              {p.marketing_plan.phases.map((ph, i) => (
                <li key={ph.phase} className="rounded-xl bg-[#F7F5F1] p-3.5">
                  <div className="flex flex-wrap items-baseline gap-x-2"><span className="grid size-6 place-items-center rounded-full bg-[#9C7434] text-xs font-bold text-white">{i + 1}</span><b>{ph.phase}</b><span className="text-xs text-stone-500">{ph.when}</span></div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{ph.actions.map(a => <li key={a}>{a}</li>)}</ul>
                </li>
              ))}
            </ol>
            <div><b>Offer strategy</b><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{p.marketing_plan.offer_strategy.map(a => <li key={a}>{a}</li>)}</ul></div>
          </Section>

          <Section id="content" kicker="Content" title="Listing content ideas" text={() => asText.content(p)}>
            <div className="grid gap-3 sm:grid-cols-2">{p.marketing_plan.content_ideas.map(c => <div key={c.idea} className="rounded-xl bg-[#F7F5F1] p-3.5"><div className="text-[11px] uppercase tracking-wider text-[#9C7434]">{c.format}</div><p className="mt-1 text-sm">{c.idea}</p><p className="mt-2 text-sm font-semibold">Hook: “{c.hook}”</p></div>)}</div>
          </Section>

          <Section id="farming" kicker="Farming" title="Neighborhood farming plan" text={() => asText.farming(p)}>
            <p><b>Area.</b> {p.farming_plan.area}</p>
            <p><b>List.</b> {p.farming_plan.list_size_note} <Link to={`/seller-lists?listing=${l._id}`} className="font-semibold text-[#9C7434] print:hidden">Get the owner list →</Link></p>
            <ol className="relative space-y-3 border-l-2 border-[#D9BC8C] pl-4">
              {p.farming_plan.touches.map(t => <li key={t.when + t.channel}><div className="text-xs font-semibold uppercase tracking-wider text-[#9C7434]">{t.when} · {t.channel}</div><div className="text-sm">{t.action}</div></li>)}
            </ol>
            <div className="rounded-xl bg-[#0A0A0A] p-3.5 text-sm text-white print:bg-white print:text-black print:ring-1 print:ring-black/10"><div className="text-[11px] uppercase tracking-wider text-[#D9BC8C]">Door-knock script</div><p className="mt-1">{p.farming_plan.door_knock_script}</p></div>
            <div className="flex flex-wrap gap-2 text-sm print:hidden">
              <Link to={`/mailers?listing=${l._id}`} className="rounded-xl bg-white px-3 py-2 font-semibold ring-1 ring-black/10 hover:ring-[#9C7434]">Seller mailers</Link>
              <Link to={`/seller-lists?listing=${l._id}`} className="rounded-xl bg-white px-3 py-2 font-semibold ring-1 ring-black/10 hover:ring-[#9C7434]">Seller lists</Link>
              <Link to={`/reels?listing=${l._id}`} className="rounded-xl bg-white px-3 py-2 font-semibold ring-1 ring-black/10 hover:ring-[#9C7434]">Order the Reel</Link>
            </div>
          </Section>

          <Section id="verify" kicker="Before you publish" title="Verify these" text={() => p.verify_before_using.map(v => `☐ ${v}`).join("\n")}>
            <ul className="space-y-2">
              {p.verify_before_using.map((v, i) => (
                <li key={v}>
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <button type="button" aria-label="Mark checked" onClick={() => setChecked({ ...checked, [i]: !checked[i] })} className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded ring-2 ${checked[i] ? "bg-[#9C7434] text-white ring-[#9C7434]" : "text-transparent ring-stone-300"}`}><Check className="size-3.5" /></button>
                    <span className={checked[i] ? "text-stone-400 line-through" : ""}>{v}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5" data-testid="plan-sources">
            <h2 className="font-display text-lg">Sources</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {p.sources.map(s => (
                <li key={s.name + s.url}>{/^https?:\/\//.test(s.url) ? <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#9C7434] underline-offset-2 hover:underline">{s.name} <ExternalLink className="size-3" /></a> : <span>{s.name}</span>}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
