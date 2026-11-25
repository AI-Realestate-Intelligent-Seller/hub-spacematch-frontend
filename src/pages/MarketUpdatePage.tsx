import { BarChart3, Clapperboard, Loader2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, FieldError, LoadError, Skeleton, errorBorder } from "@/components/hub/FormState";
import { btnDark, btnGold, btnLight, Card, CopyBtn, H2, input, label, LinkBtn, PageHead, Stat } from "@/components/hub/mm";
import { apiErrorMessage, fieldErrors, useApiData } from "@/lib/apiData";
import { digitsOnly } from "@/lib/formRules";
import { typePrice } from "@/lib/listingForms";
import { marketMeApi } from "@/lib/marketApi";
import { money, monthName, updateKit } from "@/lib/marketMe";
import { areaLabel, MARKET_AREAS, MAX_AGENT_AREAS } from "../../convex/marketDefs";

// /market-update — monthly numbers for the agent's areas (MRED pull on the 2nd; agent can type them
// in from connectMLS when a pull is missing) → 30-second script, post caption, text to past clients.
// Never estimated: a missing number shows as "–".
const lastMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
};
const err = (e: unknown) => toast.error(apiErrorMessage(e));
const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }).slice(0, 7);

function AreaPicker({ areas, onSave }: { areas: string[]; onSave: (a: string[]) => Promise<unknown> }) {
  const [sel, setSel] = useState<string[]>(areas);
  const [busy, setBusy] = useState(false);
  const [pickErr, setPickErr] = useState("");
  const toggle = (k: string) =>
    setSel(s => (s.includes(k) ? s.filter(x => x !== k) : s.length >= MAX_AGENT_AREAS ? (toast(`Pick up to ${MAX_AGENT_AREAS}`), s) : [...s, k]));
  return (
    <Card testid="mu-areas">
      <H2>My areas (up to {MAX_AGENT_AREAS})</H2>
      <p className="mb-2 text-[15px] text-stone-600">{sel.length} of {MAX_AGENT_AREAS} picked</p>
      <div className="flex flex-wrap gap-2">
        {MARKET_AREAS.map(a => (
          <button
            key={a.key}
            type="button"
            onClick={() => { toggle(a.key); setPickErr(""); }}
            aria-pressed={sel.includes(a.key)}
            className={`min-h-[44px] rounded-full px-4 py-2 text-[16px] font-semibold ${sel.includes(a.key) ? "bg-[#0A0A0A] text-white" : "bg-[#F7F5F1] text-[#0A0A0A] ring-1 ring-[#ddd6ca]"}`}
            data-testid={`mu-area-${a.key}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <FieldError msg={pickErr} />
      <button
        type="button"
        disabled={busy}
        className={`${btnGold} mt-3 disabled:opacity-60`}
        onClick={() => {
          if (!sel.length) return setPickErr("Pick at least one area.");
          setBusy(true);
          onSave(sel).then(() => toast.success("Areas saved")).catch(err).finally(() => setBusy(false));
        }}
        data-testid="mu-save-areas"
      >
        {busy && <Loader2 className="size-[18px] animate-spin" />}{busy ? "Saving…" : "Save my areas"}
      </button>
    </Card>
  );
}

function EnterNumbers({ area }: { area: string }) {
  const [f, setFState] = useState({ month: lastMonth(), median: "", sales: "", domMedian: "", active: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const num = (s: string) => Number(s.replace(/[$,\s]/g, ""));
  const fields: [keyof typeof f, string, number][] = [["median", "Median sold price", 100_000_000], ["sales", "Homes sold", 100_000], ["domMedian", "Median days on market", 3650], ["active", "Homes for sale now", 100_000]];
  /** Same rules as the backend (market-me.validation.ts). */
  const validate = (v: typeof f) => {
    const e: Record<string, string> = {};
    if (!/^\d{4}-\d{2}$/.test(v.month)) e.month = "Pick the month.";
    else if (v.month < "2000-01") e.month = "That month is too far back.";
    else if (v.month > thisMonth()) e.month = "Pick this month or an earlier one.";
    for (const [k, l, max] of fields) {
      const raw = v[k].replace(/[$,\s]/g, "");
      if (!raw) e[k] = `Enter ${l.toLowerCase()}.`;
      else if (Number(raw) > max) e[k] = `${l} looks too high.`;
      else if (k === "median" && Number(raw) < 1000) e[k] = "Median price looks too low.";
    }
    return e;
  };
  const setF = (next: typeof f) => {
    setFState(next);
    if (Object.values(errors).some(Boolean)) {
      const e = validate(next);
      setErrors(x => Object.fromEntries(Object.keys(x).map(k => [k, e[k] ?? ""])));
    }
  };
  return (
    <div className="mt-3 rounded-xl bg-[#F7F5F1] p-3" data-testid="mu-enter">
      <p className="mb-2 text-[16px] text-stone-700">Need them now? Type them from connectMLS (Stats or a closed search for the month).</p>
      <label className={label} htmlFor={`mu-month-${area}`}>Month</label>
      <input id={`mu-month-${area}`} type="month" min="2000-01" max={thisMonth()} className={`${input} ${errorBorder(errors.month)}`} aria-invalid={!!errors.month} value={f.month} onChange={e => setF({ ...f, month: e.target.value })} />
      <FieldError msg={errors.month} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        {fields.map(([k, l]) => (
          <div key={k}>
            <label className={label} htmlFor={`mu-${k}-${area}`}>{l}</label>
            <input
              id={`mu-${k}-${area}`}
              inputMode="numeric"
              placeholder={k === "median" ? "$650,000" : "0"}
              className={`${input} ${errorBorder(errors[k])}`}
              aria-invalid={!!errors[k]}
              value={f[k]}
              onChange={e => setF({ ...f, [k]: k === "median" ? typePrice(e.target.value) : digitsOnly(e.target.value, 6) })}
              data-testid={`mu-${k}`}
            />
            <FieldError msg={errors[k]} />
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={busy}
        className={`${btnDark} mt-3 w-full disabled:opacity-60`}
        data-testid="mu-enter-save"
        onClick={() => {
          const errs = validate(f);
          setErrors(errs);
          if (Object.keys(errs).length) return;
          setBusy(true);
          marketMeApi
            .enterStats({ area, month: f.month, median: num(f.median), sales: num(f.sales), domMedian: num(f.domMedian), active: num(f.active) })
            .then(() => toast.success("Saved. Your kit is ready below."))
            .catch(e => { setErrors(fieldErrors(e)); err(e); })
            .finally(() => setBusy(false));
        }}
      >
        {busy && <Loader2 className="size-[18px] animate-spin" />}{busy ? "Saving…" : "Save numbers"}
      </button>
    </div>
  );
}

export function MarketUpdatePage() {
  const settings = useApiData("market-me:settings", () => marketMeApi.settings());
  const kitRes = useApiData("market-me:kit", () => marketMeApi.marketKit());
  const s = settings.data;
  const kit = kitRes.data;
  const [edit, setEdit] = useState(false);
  if (!s || !kit) {
    const error = settings.error ?? kitRes.error;
    return (
      <div className="mx-auto max-w-2xl space-y-4 pb-6" data-testid="mu-page">
        <PageHead title="Market update kit" sub="Your areas' numbers each month, turned into a 30-second video script, a post and a text for past clients." />
        {error ? <LoadError error={error} onRetry={() => { void settings.reload(); void kitRes.reload(); }} what="your market update" /> : <Skeleton rows={2} className="h-40" />}
      </div>
    );
  }
  const first = s.name.split(" ")[0];
  const showPicker = edit || s.areas.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6" data-testid="mu-page">
      <PageHead title="Market update kit" sub="Your areas' numbers each month, turned into a 30-second video script, a post and a text for past clients." />
      {showPicker ? (
        <AreaPicker areas={s.areas} onSave={a => marketMeApi.saveSettings({ areas: a }).then(() => setEdit(false))} />
      ) : (
        <button type="button" className={btnLight} onClick={() => setEdit(true)} data-testid="mu-change-areas">Change my areas</button>
      )}

      {s.areas.length === 0 && (
        <EmptyState icon={<BarChart3 className="size-8" />} title="Pick your areas to start">
          Choose up to {MAX_AGENT_AREAS} areas above. Each month you get their numbers, a 30-second video script, a post caption and a text for past clients.
        </EmptyState>
      )}
      {kit.areas.map(({ area, mred: mredRow, mine: mineRow }) => {
        const mred = mredRow ?? null;
        const mine = mineRow ?? null;
        const label = areaLabel(area).replace(/ \(.*\)$/, "");
        const useMine = !!mine && (!mred || mine.month > mred.month);
        const row = useMine ? mine : mred;
        const k = row ? updateKit(label, row.month, row, first, useMine ? "agent" : "mred") : null;
        return (
          <Card key={area} testid="mu-area">
            <H2>{areaLabel(area)}</H2>
            {row && k ? (
              <>
                <p className="mb-2 text-[15px] font-semibold text-[#7a5a26]">{monthName(row.month)} · {k.src}</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="mu-stats">
                  <Stat n={money(row.median)} label="Median sold" />
                  <Stat n={row.sales ?? "–"} label="Homes sold" />
                  <Stat n={row.domMedian ?? "–"} label="Days on market" />
                  <Stat n={row.active ?? "–"} label="For sale now" />
                </div>
                <h3 className="mt-4 text-[17px] font-bold">30-second video script</h3>
                <p className="mt-1 rounded-xl bg-[#F7F5F1] p-3 text-[16px] leading-relaxed" data-testid="mu-script">{k.script}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <CopyBtn text={k.script} label="Copy script" testid="mu-copy-script" />
                  <LinkBtn to="/reels" light icon={Clapperboard}>Make it a Reel</LinkBtn>
                </div>
                <h3 className="mt-4 text-[17px] font-bold">Post caption</h3>
                <p className="mt-1 whitespace-pre-line rounded-xl bg-[#F7F5F1] p-3 text-[16px] leading-relaxed">{k.caption}</p>
                <div className="mt-2"><CopyBtn text={k.caption} label="Copy caption" /></div>
                <h3 className="mt-4 text-[17px] font-bold">Text to past clients</h3>
                <p className="mt-1 rounded-xl bg-[#F7F5F1] p-3 text-[16px] leading-relaxed">{k.text}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <CopyBtn text={k.text} label="Copy text" />
                  <LinkBtn to="/past-clients" light icon={MessageSquare}>My past clients</LinkBtn>
                </div>
                {!useMine && <details className="mt-3"><summary className="cursor-pointer text-[16px] font-semibold text-[#7a5a26]">Newer numbers? Type them in</summary><EnterNumbers area={area} /></details>}
              </>
            ) : (
              <>
                <p className="text-[16px] leading-snug text-stone-700" data-testid="mu-coming">
                  Numbers for this area come with the monthly MLS pull on the 2nd. Nothing is estimated.
                </p>
                <EnterNumbers area={area} />
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}
