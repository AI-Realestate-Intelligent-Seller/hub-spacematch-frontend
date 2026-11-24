import { useQuery } from "convex/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";

const TZ = "America/Chicago";
const dayKey = (t: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
const fmt = (t: number, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...o }).format(new Date(t));

const STATUS = {
  active: { label: "Used it", cls: "bg-emerald-100 text-emerald-800" },
  opened: { label: "Looked only", cls: "bg-amber-100 text-amber-800" },
  away: { label: "Not this week", cls: "bg-stone-100 text-stone-600" },
  never: { label: "Never signed in", cls: "bg-red-50 text-red-700" },
} as const;

function ago(t: number | null) {
  if (!t) return "—";
  const d = Math.floor((Date.now() - t) / 864e5);
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 14) return `${d} days ago`;
  return fmt(t, { month: "short", day: "numeric" });
}

export function AdoptionPage() {
  const [week, setWeek] = useState<number | undefined>(undefined);
  const data = useQuery(api.adoption.scoreboard, { weekStart: week });

  if (data === undefined) return <div className="py-16 text-center text-stone-500">Loading scoreboard…</div>;
  if (data === null) return <div className="py-16 text-center text-stone-600">The adoption scoreboard is for Hub admins.</div>;

  const t = data.totals;
  const days = Array.from({ length: 7 }, (_, i) => data.weekStart + i * 864e5 + 6 * 36e5);
  const label = (k: string) => data.actionMeta.find(a => a.key === k)?.label ?? k;
  const areaRows = Object.entries(t.areaPeople).sort((a, b) => b[1] - a[1]);
  const maxTrend = Math.max(t.agents, 1);
  const top = areaRows[0];

  return (
    <div className="space-y-6" data-testid="adoption-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-[#0A0A0A]">Adoption scoreboard</h1>
          <p className="mt-1 text-stone-600">Who opened the Hub and what they used, Monday to Sunday (Chicago time).</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white p-1 ring-1 ring-black/10">
          <button aria-label="Previous week" onClick={() => setWeek(data.prevWeek)} className="rounded-full p-2 hover:bg-stone-100"><ChevronLeft className="size-5" /></button>
          <span className="min-w-36 text-center font-semibold" data-testid="week-label">
            {data.label}{data.inProgress ? <span className="ml-1 text-sm font-normal text-stone-500">(so far)</span> : null}
          </span>
          <button aria-label="Next week" disabled={!data.nextWeekStart} onClick={() => data.nextWeekStart && setWeek(data.nextWeekStart === data.current ? undefined : data.nextWeekStart)} className="rounded-full p-2 hover:bg-stone-100 disabled:opacity-30"><ChevronRight className="size-5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat big={`${t.inHub}/${t.agents}`} label="Agents opened the Hub" />
        <Stat big={String(t.didSomething)} label="Did something in it" sub="CMA, listing, form, link, order…" />
        <Stat big={String(t.neverSignedIn)} label="Never signed in" warn={t.neverSignedIn > 0} />
        <Stat big={top ? top[0] : "—"} label="Most used" sub={top ? `${top[1]} ${top[1] === 1 ? "person" : "people"}` : "No page visits yet"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
          <h2 className="font-semibold text-[#0A0A0A]">Agents in the Hub, by week</h2>
          <div className="mt-4 flex h-36 items-end gap-3">
            {data.trend.map(w => (
              <div key={w.weekStart} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-28 w-full items-end justify-center gap-1">
                  <div title={`${w.inHub} opened`} className="w-1/2 max-w-7 rounded-t bg-[#D9BC8C]" style={{ height: `${(w.inHub / maxTrend) * 100}%`, minHeight: w.inHub ? 4 : 0 }} />
                  <div title={`${w.didSomething} did something`} className="w-1/2 max-w-7 rounded-t bg-[#9C7434]" style={{ height: `${(w.didSomething / maxTrend) * 100}%`, minHeight: w.didSomething ? 4 : 0 }} />
                </div>
                <div className={`text-sm ${w.weekStart === data.weekStart ? "font-semibold text-[#0A0A0A]" : "text-stone-500"}`}>{w.label}</div>
                <div className="text-sm text-stone-600">{w.inHub} · {w.didSomething}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-sm text-stone-600">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-[#D9BC8C]" /> Opened</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-[#9C7434]" /> Did something</span>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
          <h2 className="font-semibold text-[#0A0A0A]">What got used</h2>
          {areaRows.length === 0 ? (
            <p className="mt-3 text-stone-600">No page visits tracked for this week.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {areaRows.slice(0, 10).map(([a, n]) => (
                <li key={a} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-[15px]">{a}</span>
                  <span className="h-2.5 flex-1 rounded-full bg-stone-100"><span className="block h-2.5 rounded-full bg-[#9C7434]" style={{ width: `${(n / Math.max(t.agents, 1)) * 100}%` }} /></span>
                  <span className="w-16 text-right text-sm text-stone-600">{n} {n === 1 ? "person" : "people"}</span>
                </li>
              ))}
            </ul>
          )}
          {Object.keys(t.byAction).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
              {Object.entries(t.byAction).map(([k, n]) => (
                <span key={k} className="rounded-full bg-[#F7F5F1] px-3 py-1 text-sm">{n} {label(k).toLowerCase()}</span>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl bg-white ring-1 ring-black/5">
        <div className="border-b border-stone-100 px-5 py-4">
          <h2 className="font-semibold text-[#0A0A0A]">Everyone</h2>
        </div>
        <ul className="divide-y divide-stone-100" data-testid="adoption-rows">
          {data.rows.map(r => {
            const s = STATUS[r.status];
            const areas = Object.entries(r.areas).sort((a, b) => b[1] - a[1]);
            const acts = Object.entries(r.actions);
            return (
              <li key={r.email} className="grid gap-2 px-5 py-3 md:grid-cols-[14rem_9rem_1fr_7rem] md:items-center" data-testid="adoption-row">
                <div>
                  <div className="font-semibold text-[#0A0A0A]">{r.name}</div>
                  <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-sm font-medium ${s.cls}`}>{s.label}</span>
                </div>
                <div className="flex gap-1" aria-label={`${r.days.length} days in the Hub`}>
                  {days.map(d => {
                    const on = r.days.includes(dayKey(d));
                    return (
                      <span key={d} title={fmt(d, { weekday: "long", month: "short", day: "numeric" })} className={`flex size-5 items-center justify-center rounded text-[11px] font-bold ${on ? "bg-[#9C7434] text-white" : "bg-stone-100 text-stone-400"}`}>
                        {fmt(d, { weekday: "narrow" })}
                      </span>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {areas.map(([a, n]) => (
                    <span key={a} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-sm text-stone-700">{a}{n > 1 ? ` ×${n}` : ""}</span>
                  ))}
                  {acts.map(([k, n]) => (
                    <span key={k} className="rounded-full bg-[#9C7434]/10 px-2.5 py-0.5 text-sm font-medium text-[#7a5a26]">{n} {label(k).toLowerCase()}</span>
                  ))}
                  {!areas.length && !acts.length && <span className="text-sm text-stone-400">Nothing this week</span>}
                </div>
                <div className="text-sm text-stone-600 md:text-right">Last seen: {ago(r.lastSeen)}</div>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-sm text-stone-500">
        Counted from Hub page visits{data.trackingSince ? ` (tracked since ${fmt(data.trackingSince, { month: "short", day: "numeric" })})` : " (tracking starts today)"}, sign-ins, and things people created.
        Before page tracking, “Looked only” can be undercounted. The shared team@ login isn’t credited to anyone. A summary of last week is emailed to Michael every Monday morning.
      </p>
    </div>
  );
}

function Stat({ big, label, sub, warn }: { big: string; label: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
      <div className={`font-display text-3xl ${warn ? "text-red-700" : "text-[#0A0A0A]"}`}>{big}</div>
      <div className="mt-1 font-medium text-stone-700">{label}</div>
      {sub && <div className="text-sm text-stone-500">{sub}</div>}
    </div>
  );
}
