import { DAYS, type Hours, LEAD_TYPES, RATINGS, STAGE_LABEL } from "../../../convex/deskDefs";

export const errMsg = (e: unknown) =>
  String((e as Error)?.message ?? e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? String((e as Error)?.message ?? "Something went wrong");

export const input = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-[15px] outline-none focus:border-[#9C7434]";
export const label = "mb-1 block text-sm font-semibold text-stone-700";

const DAY_LABEL: Record<string, string> = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };
const TIMES = Array.from({ length: 35 }, (_, i) => 360 + i * 30); // 6:00 → 23:00
export const minLabel = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${((h + 11) % 12) + 1}${mm ? `:${String(mm).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
};

export function hoursSummary(h: Hours) {
  const on = DAYS.filter(d => h[d]);
  if (!on.length) return "No hours set";
  const groups = new Map<string, string[]>();
  for (const d of on) {
    const k = `${minLabel(h[d]![0])}–${minLabel(h[d]![1])}`;
    groups.set(k, [...(groups.get(k) ?? []), DAY_LABEL[d]]);
  }
  return [...groups.entries()].map(([k, ds]) => `${ds.length > 2 ? `${ds[0]}–${ds[ds.length - 1]}` : ds.join(", ")} ${k}`).join(" · ");
}

export function HoursEditor({ value, onChange }: { value: Hours; onChange: (h: Hours) => void }) {
  return (
    <div className="space-y-1.5" data-testid="hours-editor">
      {[...DAYS.slice(1), DAYS[0]].map(d => {
        const h = value[d];
        return (
          <div key={d} className="flex items-center gap-2">
            <label className="flex w-20 items-center gap-2 text-[15px] font-medium">
              <input type="checkbox" checked={!!h} onChange={e => onChange({ ...value, [d]: e.target.checked ? [540, 1140] : null })} className="size-4 accent-[#9C7434]" />
              {DAY_LABEL[d]}
            </label>
            {h ? (
              <>
                <select aria-label={`${d} start`} className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm" value={h[0]} onChange={e => onChange({ ...value, [d]: [Number(e.target.value), Math.max(h[1], Number(e.target.value) + 30)] })}>
                  {TIMES.map(t => <option key={t} value={t}>{minLabel(t)}</option>)}
                </select>
                <span className="text-stone-500">to</span>
                <select aria-label={`${d} end`} className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm" value={h[1]} onChange={e => onChange({ ...value, [d]: [h[0], Number(e.target.value)] })}>
                  {TIMES.filter(t => t > h[0]).map(t => <option key={t} value={t}>{minLabel(t)}</option>)}
                </select>
              </>
            ) : (
              <span className="text-sm text-stone-500">Not bookable</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const typeLabel = (t: string) => LEAD_TYPES.find(x => x.id === t)?.label ?? t;

export function RatingChip({ r }: { r?: string }) {
  const x = RATINGS.find(y => y.id === r);
  if (!x) return null;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${x.tone}`}>{x.label}</span>;
}

const STAGE_TONE: Record<string, string> = {
  to_vet: "bg-stone-800 text-white",
  booked: "bg-amber-500 text-white",
  accepted: "bg-emerald-600 text-white",
  needs_agent: "bg-red-600 text-white",
  done: "bg-stone-200 text-stone-800",
  closed: "bg-stone-100 text-stone-500",
};
export function StageChip({ s }: { s: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STAGE_TONE[s] ?? STAGE_TONE.done}`}>{STAGE_LABEL[s] ?? s}</span>;
}

export const ago = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
