// Seller lists (Michael 2026-10-31): order an owner list for up to 3 ZIPs, or (2026-11-10) for specific building
// addresses → Viktor pulls public records
// (Realist via the team's MLS) → ranked list with a suggested postcard per home → one tap into /mailers.
// Price = $5 per ZIP (Michael 2026-11-01; first list free), paid by Zelle after the list is ready.
import { PayByCard } from "@/components/PayByCard";
import { useMutation, useQuery } from "convex/react";
import { Building2, CheckCircle2, Download, FileSpreadsheet, ListChecks, Loader2, Mail, MapPin, Repeat, RotateCw, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { DESIGNS } from "@/lib/mailerBuilder";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { MailOrderPanel } from "@/components/MailOrderPanel";
import { AgentCopyAddress, useCopyAddress } from "@/components/AgentCopyAddress";
import { ListingPicker } from "@/components/hub/ListingPicker";

const card = "rounded-2xl bg-white p-4 md:p-5 ring-1 ring-[#ebe5da]";
const btnDark = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
const btnLight = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7F5F1] px-4 py-2.5 text-sm font-semibold text-[#0A0A0A] ring-1 ring-[#ebe5da] disabled:opacity-50";
const pill = (on: boolean) => `rounded-full px-3.5 py-1.5 text-sm font-semibold ${on ? "bg-[#0A0A0A] text-white" : "bg-[#F7F5F1] ring-1 ring-[#ebe5da]"}`;
const errMsg = (e: unknown) => String((e as Error).message ?? e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? String((e as Error).message ?? e);
const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const designTitle = (id: string) => DESIGNS.find(d => d.id === id)?.title ?? id;
const GROUP_ORDER = ["buyers", "launch", "value", "market"];
const GROUP_WHY: Record<string, string> = {
  buyers: "Listed since 2023 and didn't sell. They already want to move; a buyer-match offer gets them talking.",
  launch: "Higher-value houses (top 25% in the ZIP). Show them how a SpaceMatch launch beats a plain listing.",
  value: "Long-time house owners. A free home value is the easiest yes.",
  market: "Condo and townhome owners. They compare against recent sales in their building, so lead with the neighborhood report.",
};
const YEARS = [5, 7, 10, 15, 20];
const TYPES: [string, string][] = [["half", "50/50 houses + condos"], ["both", "Houses + condos, best score first"], ["sfr", "Houses only"], ["condo", "Condos & townhomes"]];
const TOPS: [number, string][] = [[200, "Top 200"], [400, "Top 400"], [800, "Top 800"], [0, "Everyone"]];
const typeLabel = (t: string) => TYPES.find(x => x[0] === t)?.[1] ?? t;
// Building orders (Michael 2026-11-10): street addresses instead of whole ZIPs; 0 years = every owner in the building.
type Bld = { address: string; zip: string };
const MAX_BUILDINGS = 10;
const BLD_YEARS: [number, string][] = [[0, "Everyone"], [5, "5 years"], [10, "10 years"], [15, "15 years"]];
const filled = (b: Bld) => b.address.trim() !== "" || b.zip.trim() !== "";
const areaOf = (o: { zips: string[]; buildings?: Bld[] | null }) =>
  o.buildings?.length ? (o.buildings.length === 1 ? o.buildings[0].address : `${o.buildings.length} buildings`) : `ZIP ${o.zips.join(", ")}`;

type Summary = {
  total: number;
  designs: Record<string, number>;
  zips: { zip: string; city: string; clean: number; inList: number; houses: number; condos: number; triedToSell: number; designs: Record<string, number> }[];
  buildings?: { address: string; zip: string; inList: number; clean: number }[];
};

// Progress tracker (Michael 2026-11-01: "put a tracker on it so we know when it may finish").
// The /hub/seller-lists cron runs at :07 :22 :37 :52, 7am–9:52pm Chicago, one list per run;
// a run is ~1 min login + ~2 min per ZIP + ~1 min to build. Stage comes from the worker's statusNote.
const SLOT_MINS = [7, 22, 37, 52];
const chicagoMinutes = (d: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(d);
  return Number(parts.find(p => p.type === "hour")?.value ?? 0) * 60 + Number(parts.find(p => p.type === "minute")?.value ?? 0);
};
function nextRunAt(now: Date, skip: number) {
  const cur = chicagoMinutes(now);
  const slots: number[] = [];
  for (let day = 0; day < 2 && slots.length <= skip; day++)
    for (let h = 7; h <= 21; h++) for (const m of SLOT_MINS) { const t = day * 1440 + h * 60 + m; if (t > cur) slots.push(t); }
  const t = slots[Math.min(skip, slots.length - 1)];
  return new Date(now.getTime() + (t - cur) * 60000 - now.getSeconds() * 1000);
}
const runMinutes = (zips: number) => 2 + 2 * zips;
const clock = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const STEPS = ["In line", "Logging in", "Pulling records", "Building list", "Ready"];
function stageOf(status: string, note?: string) {
  if (status === "delivered") return 4;
  if (status !== "pulling") return 0;
  if (/cleaning|postcard|building/i.test(note ?? "")) return 3;
  if (/logging in/i.test(note ?? "")) return 1;
  return 2;
}
function useNow(ms = 20000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
function ListTracker({ o }: { o: { status: string; statusNote?: string; zips: string[]; queueAhead?: number | null; pickedUpAt?: number } }) {
  const now = useNow();
  const stage = stageOf(o.status, o.statusNote);
  const run = runMinutes(o.zips.length);
  let line: string;
  if (o.status === "queued") {
    const start = nextRunAt(now, o.queueAhead ?? 0);
    const done = new Date(start.getTime() + run * 60000);
    const mins = Math.max(1, Math.round((done.getTime() - now.getTime()) / 60000));
    line = `Starts about ${clock(start)} · ready about ${clock(done)}${mins <= 90 ? ` (≈${mins} min)` : ""}`;
  } else {
    const started = o.pickedUpAt ?? now.getTime();
    const done = new Date(started + run * 60000);
    const left = Math.round((done.getTime() - now.getTime()) / 60000);
    line = left > 0 ? `Started ${clock(new Date(started))} · ready about ${clock(done)} (≈${left} min)` : "Almost done: finishing up now";
  }
  const pct = o.status === "queued" ? 4 : Math.min(96, 25 * stage + (o.pickedUpAt ? Math.min(20, ((now.getTime() - o.pickedUpAt) / (run * 60000)) * 20) : 0));
  return (
    <div className="mt-3 rounded-xl bg-[#F7F5F1] p-3" data-testid="list-tracker">
      <div className="h-1.5 overflow-hidden rounded-full bg-[#e7e0d3]"><div className="h-full rounded-full bg-[#9C7434] transition-all duration-700" style={{ width: `${pct}%` }} /></div>
      <ol className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px] leading-tight">
        {STEPS.map((label, i) => (
          <li key={label} className={i < stage ? "text-[#9C7434]" : i === stage ? "font-semibold text-[#0A0A0A]" : "text-stone-400"}>
            <span className="mx-auto mb-1 flex size-4 items-center justify-center">
              {i < stage ? <CheckCircle2 className="size-4" /> : i === stage ? <Loader2 className="size-4 animate-spin" /> : <span className="size-2 rounded-full bg-stone-300" />}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm font-medium text-stone-800" data-testid="list-eta">{line}</p>
      <p className="text-xs text-stone-500">Estimate. This page updates by itself, and you get an email when it's ready.</p>
    </div>
  );
}

export type OrderMode = "mail" | "list";

function NewList({ as, onPlaced, mode, setMode }: { as?: string; onPlaced: () => void; mode: OrderMode; setMode: (m: OrderMode) => void }) {
  const cfg = useQuery(api.sellerLists.config, { as });
  const place = useMutation(api.sellerLists.place);
  const [zips, setZips] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [years, setYears] = useState(10);
  const [types, setTypes] = useState("half");
  const [top, setTop] = useState(400);
  const [skipTrusts, setSkipTrusts] = useState(true);
  const [series, setSeries] = useState(false);
  const [busy, setBusy] = useState(false);
  const [where, setWhere] = useState<"zip" | "building">(() => (new URLSearchParams(window.location.search).get("where") === "building" ? "building" : "zip"));
  const [blds, setBlds] = useState<Bld[]>([{ address: "", zip: "" }]);
  const [bYears, setBYears] = useState(0);
  const byBuilding = where === "building";
  const realBlds = blds.filter(filled);
  const setBld = (i: number, patch: Partial<Bld>) => setBlds(blds.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const mail = mode === "mail";
  const copy = useCopyAddress(as);
  useEffect(() => { if (mail && top === 0) setTop(400); }, [mail, top]);

  function addZips(text: string) {
    const found = text.match(/\d{5}/g) ?? [];
    if (!found.length) return;
    const next = [...new Set([...zips, ...found])];
    if (next.length > 3) toast.message("Up to 3 ZIP codes per list. Place another order for the rest.");
    setZips(next.slice(0, 3));
    setDraft("");
  }

  async function submit() {
    const all = byBuilding ? [] : [...new Set([...zips, ...(draft.match(/\d{5}/g) ?? [])])].slice(0, 3);
    if (byBuilding ? !realBlds.length : !all.length) return toast.error(byBuilding ? "Add at least one building address" : "Add at least one ZIP code");
    if (mail && !copy.address) return toast.error("Add the address where your own copy should go");
    setBusy(true);
    try {
      await place({
        zips: all, years: byBuilding ? bYears : years, types, top, skipTrusts, as,
        ...(byBuilding ? { buildings: realBlds.map(b => ({ address: b.address.trim(), zip: b.zip.trim() })) } : {}),
        ...(mail ? { mail: series ? ("series" as const) : ("once" as const) } : {}),
      });
      toast.success(mail ? "Ordered. We'll email you when your postcards are ready to review." : cfg?.firstFree ? "Ordered. Your first list is free." : "Ordered. We'll email you when it's ready.");
      setZips([]); setDraft(""); setBlds([{ address: "", zip: "" }]);
      onPlaced();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  const blocked = cfg?.unpaid.length ? cfg.unpaid[0] : null;
  const bldZips = new Set(realBlds.map(b => b.zip.trim()).filter(z => /^\d{5}$/.test(z)));
  const zipCount = byBuilding ? Math.max(1, Math.min(3, bldZips.size)) : Math.max(1, Math.min(3, new Set([...zips, ...(draft.match(/\d{5}/g) ?? [])]).size));
  const bldLabel = realBlds.length === 1 ? realBlds[0].address.trim() || "this building" : `${realBlds.length} buildings`;
  const perZip = cfg?.pricePerZip ?? 5;
  const cardPrice = cfg?.cardPrice ?? 1.16;
  const listFee = cfg?.firstFree ? 0 : perZip * zipCount;
  const maxCards = (top || 400) * zipCount;
  const estimate = listFee + maxCards * cardPrice;
  const money2 = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="font-display text-xl">What should we do?</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {([
            ["mail", "Mail it for me", "We pull the homeowners, pick the best postcard for each home, and Lob prints and mails them. You review the cards and pay once.", "Recommended"],
            ["list", "Just the list", `A ranked list of homeowners to download and mail your own way. $${perZip} per ZIP (first list free).`, ""],
          ] as [OrderMode, string, string, string][]).map(([k, t, d, badge]) => (
            <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-2xl p-4 text-left ring-1 transition ${mode === k ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-[#F7F5F1] ring-[#ebe5da]"}`} data-testid={`mode-${k}`}>
              <div className="flex items-center gap-2 font-semibold">{k === "mail" ? <Mail className={`size-4 ${mode === k ? "text-[#D9BC8C]" : "text-[#9C7434]"}`} /> : <ListChecks className={`size-4 ${mode === k ? "text-[#D9BC8C]" : "text-[#9C7434]"}`} />}{t}
                {badge && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${mode === k ? "bg-[#D9BC8C] text-[#0A0A0A]" : "bg-[#9C7434]/10 text-[#9C7434]"}`}>{badge}</span>}
              </div>
              <p className={`mt-1 text-[13px] leading-snug ${mode === k ? "text-stone-300" : "text-stone-600"}`}>{d}</p>
            </button>
          ))}
        </div>
        {mail && (
          <ol className="mt-3 grid gap-2 text-[13px] text-stone-600 sm:grid-cols-4" data-testid="mail-steps">
            {[byBuilding ? "You pick the buildings" : "You pick ZIPs and how many homes", "We pull the list and build your cards (about 30 min)", "You see your cards and the total, then Zelle once", "Michael confirms and Lob mails them. Replies go to your inbox and Lofty"].map((t, i) => (
              <li key={t} className="rounded-xl bg-[#F7F5F1] p-2.5"><b className="font-display text-lg text-[#9C7434]">{i + 1}</b> {t}</li>
            ))}
          </ol>
        )}
      </section>

      <section className={card}>
        <div className="text-xs font-semibold text-[#9C7434]">Step 1</div>
        <h2 className="font-display text-xl">Where do you want to mail?</h2>
        <p className="mt-1 text-sm text-stone-500">You don't need a listing. Farm any area or any building you want more business from.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {([
            ["zip", "A whole area", "Pick up to 3 ZIP codes. We rank the owners most likely to sell."],
            ["building", "Specific buildings", "Type one or more building addresses. Every owner who lives there gets a card."],
          ] as ["zip" | "building", string, string][]).map(([k, t, d]) => (
            <button key={k} type="button" onClick={() => setWhere(k)} aria-pressed={where === k} className={`rounded-2xl p-3.5 text-left ring-1 transition ${where === k ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-[#F7F5F1] ring-[#ebe5da]"}`} data-testid={`where-${k}`}>
              <div className="flex items-center gap-2 font-semibold">{k === "zip" ? <MapPin className={`size-4 ${where === k ? "text-[#D9BC8C]" : "text-[#9C7434]"}`} /> : <Building2 className={`size-4 ${where === k ? "text-[#D9BC8C]" : "text-[#9C7434]"}`} />}{t}</div>
              <p className={`mt-1 text-[13px] leading-snug ${where === k ? "text-stone-300" : "text-stone-600"}`}>{d}</p>
            </button>
          ))}
        </div>
        {byBuilding ? (
          <div className="mt-3 space-y-2" data-testid="building-rows">
            {blds.map((b, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place and only removed by index
              <div key={i} className="flex items-center gap-2">
                <input value={b.address} onChange={e => setBld(i, { address: e.target.value })} placeholder="2800 N Lake Shore Dr" aria-label={`Building ${i + 1} street address`} data-testid={`bld-address-${i}`} className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[15px]" />
                <input value={b.zip} onChange={e => setBld(i, { zip: e.target.value.replace(/\D/g, "").slice(0, 5) })} inputMode="numeric" placeholder="ZIP" aria-label={`Building ${i + 1} ZIP code`} data-testid={`bld-zip-${i}`} className="w-[5.5rem] shrink-0 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[15px]" />
                {blds.length > 1 && <button type="button" aria-label={`Remove building ${i + 1}`} onClick={() => setBlds(blds.filter((_, j) => j !== i))} className="shrink-0 p-1 text-stone-400 hover:text-red-600"><X className="size-4" /></button>}
              </div>
            ))}
            {blds.length < MAX_BUILDINGS && <button type="button" onClick={() => setBlds([...blds, { address: "", zip: "" }])} className="text-sm font-semibold text-[#9C7434]" data-testid="bld-add">+ Add another building</button>}
            <p className="text-xs text-stone-500">Street number and street name, plus the ZIP. Condo and townhome buildings in northern Illinois. If a building uses more than one street number, add each one. Up to {MAX_BUILDINGS} addresses in up to 3 ZIP codes.</p>
            <ListingPicker
              className="mt-1"
              label="Is it one of your listings' buildings? (optional)"
              hint="Adds that listing's address so you can mail its neighbors in the building."
              onPick={l => {
                if (!l.zip) return toast.error("That listing has no ZIP yet. Add the full address on the listing page.");
                const address = l.address.split(",")[0].replace(/\s+(#|apt|unit)\s*\S+$/i, "").trim();
                if (blds.some(b => b.address.trim().toLowerCase() === address.toLowerCase())) return toast.message("That building is already added");
                const row = { address, zip: l.zip };
                setBlds(realBlds.length < blds.length ? [...realBlds, row] : [...blds, row].slice(0, MAX_BUILDINGS));
                toast.success(`Added ${address}`);
              }}
            />
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm text-stone-500">Up to 3 ZIP codes per list. Northern Illinois (MRED) ZIPs only.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {zips.map(z => (
            <span key={z} className="inline-flex items-center gap-1 rounded-full bg-[#0A0A0A] px-3 py-1.5 text-sm font-semibold text-white" data-testid={`zip-chip-${z}`}>
              <MapPin className="size-3.5 text-[#D9BC8C]" />{z}
              <button type="button" aria-label={`Remove ${z}`} onClick={() => setZips(zips.filter(x => x !== z))}><X className="size-3.5" /></button>
            </span>
          ))}
          {zips.length < 3 && (
            <input
              value={draft}
              inputMode="numeric"
              onChange={e => { const t = e.target.value; if (/\d{5}[\s,]/.test(t)) addZips(t); else setDraft(t.replace(/[^\d\s,]/g, "").slice(0, 20)); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addZips(draft); } }}
              onBlur={() => addZips(draft)}
              placeholder={zips.length ? "Add another" : "e.g. 60614"}
              className="w-36 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[15px]"
              aria-label="ZIP code"
              data-testid="zip-input"
            />
          )}
        </div>
        <ListingPicker
          className="mt-3"
          label="Mailing around one of your listings? (optional)"
          hint="Adds the listing's ZIP. Great for Just Listed / Just Sold cards to the neighbors."
          onPick={l => {
            if (!l.zip) return toast.error("That listing has no ZIP yet. Add the full address on the listing page.");
            if (zips.includes(l.zip)) return toast.message(`${l.zip} is already in the list`);
            addZips(l.zip);
            toast.success(`Added ${l.zip} (${l.address.split(",")[0]})`);
          }}
        />
          </>
        )}
      </section>

      <section className={card}>
        <div className="text-xs font-semibold text-[#9C7434]">Step 2</div>
        <h2 className="font-display text-xl">Who should be on it?</h2>
        <div className="mt-3 space-y-4">
          {byBuilding ? (
            <div>
              <div className="mb-1.5 text-sm font-semibold">Owned their home at least</div>
              <div className="flex flex-wrap gap-2">{BLD_YEARS.map(([y, l]) => <button key={y} type="button" className={pill(bYears === y)} onClick={() => setBYears(y)} data-testid={`bld-years-${y}`}>{l}</button>)}</div>
              <p className="mt-1.5 text-xs text-stone-500">“Everyone” mails the whole building. Longer-time owners are more likely to sell.</p>
            </div>
          ) : (
          <div>
            <div className="mb-1.5 text-sm font-semibold">Owned the home at least</div>
            <div className="flex flex-wrap gap-2">{YEARS.map(y => <button key={y} type="button" className={pill(years === y)} onClick={() => setYears(y)}>{y} years</button>)}</div>
          </div>
          )}
          {!byBuilding && <div>
            <div className="mb-1.5 text-sm font-semibold">Home type</div>
            <div className="flex flex-wrap gap-2">{TYPES.map(([k, l]) => <button key={k} type="button" className={pill(types === k)} onClick={() => setTypes(k)} data-testid={`type-${k}`}>{l}</button>)}</div>
            {types === "both" && <p className="mt-1.5 text-xs text-stone-500">Condos usually rank higher on Sell Score, so city ZIPs come back mostly condos. Pick “Houses only” to farm houses.</p>}
            {types === "half" && <p className="mt-1.5 text-xs text-stone-500">Half houses, half condos/townhomes, each ranked by Sell Score. If a ZIP runs short on one type, the rest come from the other.</p>}
          </div>}
          {!byBuilding && <div>
            <div className="mb-1.5 text-sm font-semibold">{mail ? "Homes to mail per ZIP" : "List size per ZIP"}</div>
            <div className="flex flex-wrap gap-2">{TOPS.filter(([n]) => !mail || (cfg?.mailTops ?? [200, 400, 800]).includes(n)).map(([n, l]) => <button key={n} type="button" className={pill(top === n)} onClick={() => setTop(n)}>{l}</button>)}</div>
            <p className="mt-1.5 text-xs text-stone-500">“Top” = most likely to sell first.{mail ? ` Mailing is ${money2(cardPrice)} a card, so 400 homes ≈ ${money(Math.round(400 * cardPrice))} per card sent.` : ` Lob mails for ${money2(cardPrice)} a card, so 400 homes ≈ ${money(Math.round(400 * cardPrice))} per drop.`}</p>
          </div>}
          {mail && (
            <div>
              <div className="mb-1.5 text-sm font-semibold">How many times?</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={pill(!series)} onClick={() => setSeries(false)} data-testid="series-off">Mail once</button>
                <button type="button" className={pill(series)} onClick={() => setSeries(true)} data-testid="series-on"><Repeat className="mr-1 inline size-3.5" />{cfg?.seriesDrops ?? 3} cards, every {Math.round((cfg?.gapDays ?? 28) / 7)} weeks</button>
              </div>
              <p className="mt-1.5 text-xs text-stone-500">{series ? "Same homes, a different card each time (anyone who replied is taken off). Each card is billed when it's ready, and you can stop the series anytime." : "Most replies come after the 3rd card. You can always mail the same homes again later."}</p>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skipTrusts} onChange={e => setSkipTrusts(e.target.checked)} data-testid="skip-trusts" /> Skip homes held in a trust or estate</label>
          <div className="rounded-xl bg-[#F7F5F1] p-3 text-[13px] text-stone-600">
            <b className="text-stone-800">Always on:</b> owner lives in the home · no LLC, bank or company owners · nothing on the market right now · no parking or storage units · one card per owner. Owners who listed since 2023 and didn't sell go to the top.{byBuilding ? " Units the owner rents out are left off, because public records don't give us where that owner gets mail." : ""}
          </div>
        </div>
      </section>

      <section className={card}>
        <div className="text-xs font-semibold text-[#9C7434]">Step 3</div>
        <h2 className="font-display text-xl">Order it</h2>
        <div className="mt-2 rounded-xl bg-[#0A0A0A] p-3 text-sm text-white" data-testid="price-box">
          {mail && byBuilding ? (
            <div className="space-y-1" data-testid="bld-price">
              <div><b className="text-[#D9BC8C]">{money2(cardPrice)} a card</b> for every owner we find{listFee ? ` + list ${money(listFee)} ($${perZip} per ZIP the buildings are in)` : cfg?.firstFree ? " + list free (your first)" : ""}. A 200-owner building ≈ {money(Math.round(200 * cardPrice))}{series ? " per card" : ""}.</div>
              <div className="text-xs text-stone-300">Print, postage and mailing included. You see your cards, the number of owners and the exact total before anything is mailed, then pay once by Zelle to {cfg?.zelleTo ?? "…"}.</div>
            </div>
          ) : mail ? (
            <div className="space-y-1">
              <div>Up to <b className="text-[#D9BC8C]">{money2(estimate)}</b>{series ? " for card 1" : ""}: {maxCards.toLocaleString()} cards × {money2(cardPrice)}{listFee ? ` + list ${money(listFee)} ($${perZip} per ZIP)` : cfg?.firstFree ? " + list free (your first)" : ""}.</div>
              <div className="text-xs text-stone-300">Print, postage and mailing included. You see your cards and the exact total before anything is mailed, then pay once by Zelle to {cfg?.zelleTo ?? "…"}.{series ? ` Cards 2 and 3 cost up to ${money2(maxCards * cardPrice)} each, billed when each one is ready.` : ""}</div>
            </div>
          ) : cfg?.firstFree ? (
            <><b className="text-[#D9BC8C]">Your first list is free.</b> After that, a list is ${cfg?.pricePerZip ?? 5} per ZIP code, paid by Zelle once it's ready.</>
          ) : (
            <>This list is <b className="text-[#D9BC8C]">{money(perZip * zipCount)}</b> (${cfg?.pricePerZip ?? 5} per ZIP code{byBuilding ? " the buildings are in" : ""}). Pay by Zelle to {cfg?.zelleTo ?? "…"} once it's ready.</>
          )}
        </div>
        {mail && <div className="mt-2"><AgentCopyAddress agentEmail={as} cardPrice={cardPrice} perDesign /></div>}
        {blocked && <div className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Pay list {blocked.code} ({money(blocked.amount)}) in “My lists” first, then order the next one.</div>}
        <button type="button" disabled={busy || !!blocked || (mail && !copy.address) || (byBuilding ? !realBlds.length : !zips.length && !/\d{5}/.test(draft))} onClick={submit} className={`${btnDark} mt-3 w-full py-3`} data-testid="order-list">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ListChecks className="size-4" />}
          {byBuilding
            ? (mail ? (realBlds.length ? `Get my postcards ready for ${bldLabel}` : "Get my postcards ready") : realBlds.length ? `Pull my list for ${bldLabel}` : "Pull my list")
            : mail ? (zips.length ? `Get my postcards ready for ${zips.join(", ")}` : "Get my postcards ready") : zips.length ? `Pull my list for ${zips.join(", ")}` : "Pull my list"}
        </button>
        <p className="mt-2 text-xs text-stone-500">{mail ? "The list usually takes 5–25 minutes during the day (7am–10pm), then about 10–30 minutes to build your cards. “My orders” shows a live tracker, and you get an email when your cards are ready to review." : "Usually ready in 5–25 minutes during the day (7am–10pm). “My orders” shows a live tracker with the expected finish time, and you get an email."}</p>
      </section>
    </div>
  );
}

function Groups({ id, s }: { id: Id<"sellerListOrders">; s: Summary }) {
  const groups = GROUP_ORDER.filter(k => s.designs[k]);
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {groups.map(k => (
        <div key={k} className="flex gap-3 rounded-xl bg-[#F7F5F1] p-3" data-testid={`group-${k}`}>
          <img src={`/mailers/thumbs/${k}-front.jpg`} alt="" className="h-14 w-[100px] shrink-0 rounded object-cover ring-1 ring-[#ebe5da]" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-snug">{s.designs[k]} homes · “{designTitle(k)}”</div>
            <p className="mt-0.5 text-xs text-stone-500">{GROUP_WHY[k]}</p>
            <Link to={`/mailers?list=${id}&group=${k}`} className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-[#9C7434]" data-testid={`make-mailing-${k}`}><Send className="size-3.5" /> Make this mailing</Link>
          </div>
        </div>
      ))}
    </div>
  );
}

const mailLabel = (o: Doc<"sellerListOrders">) => {
  const d = o.mail?.drops.find(x => !["mailed", "stopped"].includes(x.status)) ?? o.mail?.drops[o.mail.drops.length - 1];
  if (!d) return "Building your cards";
  const n = o.mail!.mode === "series" ? `Card ${d.n}: ` : "";
  return n + ({ building: "Building your cards", proofing: "Making proofs", ready: o.payment?.status === "sent" ? "Payment sent" : "Ready to pay", mailing: "Mailing", mailed: "Mailed", failed: "Stopped", scheduled: "Next card scheduled", stopped: "Stopped" }[d.status] ?? d.status);
};

function MyLists({ as }: { as?: string }) {
  const rows = useQuery(api.sellerLists.mine, { as });
  const cfg = useQuery(api.sellerLists.config, { as });
  const markSent = useMutation(api.sellerLists.markSent);
  const cancel = useMutation(api.sellerLists.cancel);
  const answer = useMutation(api.sellerLists.answer);
  const [reply, setReply] = useState<Record<string, string>>({});
  if (rows === undefined) return <div className="text-sm text-stone-500">Loading…</div>;
  if (!rows.length) return <div className={`${card} text-center text-sm text-stone-500`}>Nothing ordered yet. Start in “New order”.</div>;
  return (
    <div className="space-y-3">
      {rows.map(o => {
        const s = o.summary as Summary | undefined;
        const p = o.payment;
        return (
          <div key={o._id} className={card} data-testid="seller-list">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{o.mail && <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-[#9C7434]/10 px-2 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-[#9C7434]"><Mail className="size-3" /> Mail it for me</span>}{areaOf(o)} <span className="text-xs font-normal text-stone-400">· {o.code}</span></div>
                {o.buildings && o.buildings.length > 1 && <div className="text-xs text-stone-600" data-testid="order-buildings">{o.buildings.map(b => b.address).join(" · ")}</div>}
                <div className="text-xs text-stone-500">{typeLabel(o.filters.types)} · {o.filters.years ? `owned ${o.filters.years}+ yrs` : "any length of ownership"} · {o.filters.top ? `top ${o.filters.top} per ZIP` : "everyone"}{o.filters.skipTrusts ? " · no trusts" : ""}</div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${o.status === "delivered" ? "bg-emerald-50 text-emerald-700" : o.status === "failed" ? "bg-red-50 text-red-700" : "bg-[#F7F5F1] text-stone-700"}`} data-testid="list-status">
                {o.mail && o.status === "delivered" ? mailLabel(o) : o.statusLabel}{o.status === "queued" && o.queueAhead ? ` · ${o.queueAhead} ahead` : ""}{o.free && !o.mail ? " · free" : ""}
              </span>
            </div>
            {(o.status === "queued" || o.status === "pulling") && <ListTracker o={o} />}
            {o.mail && (o.status === "queued" || o.status === "pulling") && <p className="mt-2 text-xs text-stone-500">Then we build your cards and email you to review them. Nothing is mailed until you pay and Michael confirms.</p>}
            {o.mail && o.status === "delivered" && <MailOrderPanel o={o} zelleTo={cfg?.zelleTo ?? ""} />}
            {o.statusNote && o.status !== "delivered" && o.status !== "pulling" && <p className="mt-2 text-sm text-stone-600">{o.statusNote}</p>}
            {o.status === "needs_info" && (
              <div className="mt-2 space-y-2 rounded-xl bg-amber-50 p-3 text-sm">
                <p><b>Viktor asks:</b> {o.question}</p>
                <textarea value={reply[o._id] ?? ""} onChange={e => setReply({ ...reply, [o._id]: e.target.value })} className="w-full rounded-lg border border-amber-200 p-2" rows={2} />
                <button type="button" className={btnDark} onClick={() => answer({ id: o._id, text: reply[o._id] ?? "" }).catch(e => toast.error(errMsg(e)))}>Send answer</button>
              </div>
            )}
            {o.status === "queued" && <button type="button" className="mt-2 text-xs font-semibold text-stone-500 underline" onClick={() => cancel({ id: o._id }).catch(e => toast.error(errMsg(e)))}>Cancel</button>}
            {o.status === "delivered" && s?.buildings && (
              <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-[#ebe5da]" data-testid="building-counts">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[#F7F5F1] text-stone-500"><tr><th className="px-3 py-2">Building</th><th className="px-3 py-2">Owners in your list</th></tr></thead>
                  <tbody>
                    {s.buildings.map(b => (
                      <tr key={`${b.address}${b.zip}`} className="border-t border-[#f0ebe2]"><td className="px-3 py-2 font-medium">{b.address} <span className="text-stone-400">{b.zip}</span></td><td className="px-3 py-2">{b.inList ? b.inList.toLocaleString() : <span className="text-red-700">None found. Check the street number, or add each number the building uses.</span>}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {o.status === "delivered" && s && !o.mail && (
              <div className="mt-3 space-y-3">
                <div className="overflow-x-auto rounded-xl ring-1 ring-[#ebe5da]">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-[#F7F5F1] text-stone-500"><tr><th className="px-3 py-2">ZIP</th><th className="px-3 py-2">In your list</th><th className="px-3 py-2">Houses / condos</th><th className="px-3 py-2">Listed, didn't sell</th><th className="px-3 py-2">Passed filters</th></tr></thead>
                    <tbody>
                      {s.zips.map(z => (
                        <tr key={z.zip} className="border-t border-[#f0ebe2]"><td className="px-3 py-2 font-medium">{z.zip} <span className="text-stone-400">{z.city}</span></td><td className="px-3 py-2">{z.inList.toLocaleString()}</td><td className="px-3 py-2">{z.houses} / {z.condos}</td><td className="px-3 py-2">{z.triedToSell}</td><td className="px-3 py-2">{z.clean.toLocaleString()}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-sm font-semibold">Suggested postcard for each group</div>
                <Groups id={o._id} s={s} />
                <div className="flex flex-wrap gap-2">
                  {o.files.map(f => f.url && (
                    <a key={f.kind} href={f.url} download={f.name} className={btnLight} data-testid={`download-${f.kind}`}>
                      {f.kind === "xlsx" ? <FileSpreadsheet className="size-4" /> : <Download className="size-4" />}{f.kind === "xlsx" ? "Excel (with details)" : "CSV for Wise Pelican"}
                    </a>
                  ))}
                </div>
                {o.viktorNote && <p className="text-xs text-stone-500">{o.viktorNote}</p>}
                {!o.costFinal && !o.free && <p className="text-xs text-stone-500">Finalizing the price ($5 per ZIP). It shows here within the hour.</p>}
                {p && p.status !== "waived" && (
                  <div className={`rounded-xl p-3 text-sm ${p.status === "confirmed" ? "bg-emerald-50 text-emerald-800" : "bg-[#0A0A0A] text-white"}`} data-testid="pay-box">
                    {p.status === "confirmed" ? (
                      <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-4" /> Paid {money(p.amount)}. Thanks!</span>
                    ) : p.status === "sent" ? (
                      <>You sent {money(p.amount)}. Waiting for Michael to confirm.</>
                    ) : (
                      <div className="space-y-2">
                        <div>Zelle <b className="text-[#D9BC8C]">{money(p.amount)}</b> to <b>{cfg?.zelleTo}</b> with memo <b className="text-[#D9BC8C]">{p.code}</b>.</div>
                        {p.note && <div className="text-amber-200">{p.note}</div>}
                        <button type="button" className="rounded-lg bg-[#D9BC8C] px-3 py-1.5 font-semibold text-[#0A0A0A]" onClick={() => markSent({ id: o._id }).then(() => toast.success("Thanks! Michael will confirm.")).catch(e => toast.error(errMsg(e)))} data-testid="i-sent-it">I sent it</button>
                        <PayByCard kind="list" id={o._id} amount={p.amount} dark after="It's marked paid as soon as the card goes through." />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AdminOrders() {
  const q = useQuery(api.sellerLists.queue);
  const lob = useQuery(api.mailOrders.lobMonth);
  const confirm = useMutation(api.sellerLists.confirmPayment);
  const waive = useMutation(api.sellerLists.waive);
  const retry = useMutation(api.mailOrders.retryDrop);
  if (!q) return <div className="text-sm text-stone-500">Loading…</div>;
  const t = q.totals;
  const dropOf = (o: Doc<"sellerListOrders">) => o.mail?.drops.find(d => !["mailed", "stopped"].includes(d.status)) ?? o.mail?.drops[o.mail.drops.length - 1];
  return (
    <div className="space-y-3">
      {lob && (
        <div className={`rounded-xl px-3 py-2 text-sm ring-1 ${lob.mode === "live" && lob.cards >= lob.freeMonthly * 0.8 ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-white text-stone-600 ring-[#ebe5da]"}`} data-testid="lob-month">
          {lob.mode === "live" ? <>Lob this month: <b>{lob.cards}</b> of {lob.freeMonthly} cards on the free plan. Above that you need Lob's Startup plan ($260/mo).</> : <>Lob is in <b>test mode</b>: “Received” runs a test mailing (nothing printed or charged).</>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[["Lists delivered", t.orders], ["Homes", t.homes.toLocaleString()], ["Paid", money(t.revenue)], ["Owed", money(t.owed)], [`Viktor cost · ${t.credits.toLocaleString()} cr`, money(Math.round(t.cost * 100) / 100)]].map(([l, v]) => (
          <div key={String(l)} className="rounded-xl bg-[#0A0A0A] p-3 text-white"><div className="font-display text-xl">{String(v)}</div><div className="text-xs text-[#D9BC8C]">{String(l)}</div></div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-[#ebe5da]">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[#F7F5F1] text-stone-500"><tr><th className="px-3 py-2">List</th><th className="px-3 py-2">Agent</th><th className="px-3 py-2">ZIPs</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Homes</th><th className="px-3 py-2">Cost</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Payment</th></tr></thead>
          <tbody>
            {q.orders.map(o => (
              <tr key={o._id} className="border-t border-[#f0ebe2] align-top">
                <td className="px-3 py-2 font-medium">{o.code}{o.mail && <div className="text-[11px] font-semibold text-[#9C7434]">Mail it for me{o.mail.mode === "series" ? " · series" : ""}</div>}</td>
                <td className="px-3 py-2">{o.agentName}</td>
                <td className="px-3 py-2">{o.buildings?.length ? <>{o.buildings.map(b => b.address).join("; ")} <span className="text-stone-400">({o.zips.join(", ")})</span></> : o.zips.join(", ")}</td>
                <td className="px-3 py-2">{o.mail && o.status === "delivered" ? mailLabel(o) : o.statusLabel}{o.mail && dropOf(o)?.error && <div className="max-w-[220px] text-[11px] text-red-700">{dropOf(o)!.error}</div>}</td>
                <td className="px-3 py-2">{o.homes ?? "—"}{o.mail && dropOf(o)?.cards ? <div className="text-[11px] text-stone-500">{dropOf(o)!.cards} cards{dropOf(o)!.sent ? ` · ${dropOf(o)!.sent} mailed` : ""}</div> : null}</td>
                <td className="px-3 py-2">{o.costCredits ? `${o.costCredits.toLocaleString()} cr · ${money(Math.round(o.costUsd * 100) / 100)}` : "—"}{o.costCredits && !o.costFinal ? " (tallying)" : ""}</td>
                <td className="px-3 py-2">{o.mail && dropOf(o)?.amount ? <>{money(dropOf(o)!.amount)}<div className="text-[11px] text-stone-500">{dropOf(o)!.listAmount ? `list ${money(dropOf(o)!.listAmount)} + ` : ""}cards {money(dropOf(o)!.cardAmount)}</div></> : o.free ? "Free (first)" : o.price != null ? money(o.price) : "—"}</td>
                <td className="px-3 py-2">
                  {o.payment ? (
                    <div className="space-y-1">
                      <div>{o.payment.status}</div>
                      {q.canConfirm && (o.payment.status === "sent" || o.payment.status === "awaiting") && (
                        <div className="flex flex-wrap gap-1">
                          <button type="button" className="rounded-lg bg-[#0A0A0A] px-2 py-1 text-xs font-semibold text-white" data-testid="admin-received" onClick={() => {
                            const d = dropOf(o);
                            if (o.mail && d?.status === "ready") {
                              const over = lob && lob.mode === "live" && lob.cards + d.cards > lob.freeMonthly ? `\n\nHeads up: that's ${lob.cards + d.cards} Lob cards this month, over the free plan's ${lob.freeMonthly}. Lob needs the Startup plan for this.` : "";
                              if (!window.confirm(`Payment received? Lob will print and mail ${d.cards} cards now. This can't be undone.${over}`)) return;
                            }
                            confirm({ id: o._id, received: true }).then(() => o.mail && toast.success("Mailing started")).catch(e => toast.error(errMsg(e)));
                          }}>Received</button>
                          {o.payment.status === "sent" && <button type="button" className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-semibold" onClick={() => confirm({ id: o._id, received: false }).catch(e => toast.error(errMsg(e)))}>Not in my account</button>}
                          <button type="button" className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-semibold" onClick={() => waive({ id: o._id }).catch(e => toast.error(errMsg(e)))}>Waive</button>
                        </div>
                      )}
                    </div>
                  ) : "—"}
                  {o.mail && dropOf(o)?.status === "failed" && q.canConfirm && (
                    <button type="button" className="mt-1 inline-flex items-center gap-1 rounded-lg bg-[#0A0A0A] px-2 py-1 text-xs font-semibold text-white" onClick={() => retry({ id: o._id }).then(() => toast.success("Retrying")).catch(e => toast.error(errMsg(e)))} data-testid="admin-retry"><RotateCw className="size-3" /> Retry</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SellerListsPage() {
  const cfg = useQuery(api.sellerLists.config, {});
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "new";
  const [as, setAs] = useState<string | undefined>(undefined);
  const mode: OrderMode = params.get("mode") === "list" ? "list" : "mail";
  const setMode = (m: OrderMode) => setParams(p => { p.set("mode", m); return p; }, { replace: true });
  const setTab = (t: string) => setParams(p => { p.set("tab", t); return p; }, { replace: true });
  const tabs = useMemo(() => {
    const t: [string, string][] = [["new", "New order"], ["mine", "My orders"]];
    if (cfg?.isStaff) t.push(["orders", cfg.toConfirm ? `All orders (${cfg.toConfirm} to confirm)` : "All orders"]);
    return t;
  }, [cfg]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#0A0A0A]">{tab === "new" && mode === "mail" ? <Mail className="size-6 text-[#D9BC8C]" /> : <ListChecks className="size-6 text-[#D9BC8C]" />}</span>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">{tab === "new" && mode === "mail" ? "Mail it for me" : "Seller lists"}</h1>
          <p className="text-stone-600">{tab === "new" && mode === "mail"
            ? "Pick up to 3 ZIP codes or type building addresses. No listing needed. We find the homeowners most likely to sell (no LLCs or trusts), put your best postcard on each home, and Lob mails them. You review and pay once."
            : "Pick up to 3 ZIP codes or type building addresses. No listing needed. Viktor pulls the homeowners most likely to sell, skips LLCs and trusts, and suggests the best postcard for each group."}</p>
        </div>
      </div>
      {cfg?.isStaff && cfg.agents.length > 0 && tab !== "orders" && (
        <label className="flex items-center gap-2 text-sm text-stone-600">Order for
          <select value={as ?? ""} onChange={e => setAs(e.target.value || undefined)} className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[15px]" aria-label="Order for">
            <option value="">Me</option>
            {cfg.agents.map(a => <option key={a.email} value={a.email}>{a.name}</option>)}
          </select>
        </label>
      )}
      <div className="flex gap-1 overflow-x-auto rounded-full bg-stone-100 p-1 text-[15px]" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-4 py-1.5 ${tab === k ? "bg-white font-semibold shadow-sm" : "text-stone-600"}`} data-testid={`tab-${k}`}>{label}</button>
        ))}
      </div>
      {tab === "new" && <NewList as={as} mode={mode} setMode={setMode} onPlaced={() => { setTab("mine"); window.scrollTo({ top: 0 }); }} />}
      {tab === "mine" && <MyLists as={as} />}
      {tab === "orders" && cfg?.isStaff && <AdminOrders />}
    </div>
  );
}
