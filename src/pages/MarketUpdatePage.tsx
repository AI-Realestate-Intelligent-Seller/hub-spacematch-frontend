import { useMutation, useQuery } from "convex/react";
import { Clapperboard, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { btnDark, btnGold, btnLight, Card, CopyBtn, H2, input, label, LinkBtn, PageHead, Stat , toastErr } from "@/components/hub/mm";
import { money, monthName, updateKit } from "@/lib/marketMe";
import { areaLabel, MARKET_AREAS, MAX_AGENT_AREAS } from "../../convex/marketDefs";
import { api } from "../../convex/_generated/api";

// /market-update — monthly numbers for the agent's areas (MRED pull on the 2nd; agent can type them
// in from connectMLS when a pull is missing) → 30-second script, post caption, text to past clients.
// Never estimated: a missing number shows as "–".
const lastMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
};
const err = toastErr;

function AreaPicker({ areas, onSave }: { areas: string[]; onSave: (a: string[]) => Promise<unknown> }) {
  const [sel, setSel] = useState<string[]>(areas);
  const toggle = (k: string) =>
    setSel(s => (s.includes(k) ? s.filter(x => x !== k) : s.length >= MAX_AGENT_AREAS ? (toast(`Pick up to ${MAX_AGENT_AREAS}`), s) : [...s, k]));
  return (
    <Card testid="mu-areas">
      <H2>My areas (up to {MAX_AGENT_AREAS})</H2>
      <div className="flex flex-wrap gap-2">
        {MARKET_AREAS.map(a => (
          <button
            key={a.key}
            type="button"
            onClick={() => toggle(a.key)}
            className={`min-h-[44px] rounded-full px-4 py-2 text-[16px] font-semibold ${sel.includes(a.key) ? "bg-[#0A0A0A] text-white" : "bg-[#F7F5F1] text-[#0A0A0A] ring-1 ring-[#ddd6ca]"}`}
            data-testid={`mu-area-${a.key}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <button type="button" className={`${btnGold} mt-3`} onClick={() => onSave(sel).then(() => toast.success("Areas saved")).catch(err)} data-testid="mu-save-areas">Save my areas</button>
    </Card>
  );
}

function EnterNumbers({ area }: { area: string }) {
  const enter = useMutation(api.marketMe.enterStats);
  const [f, setF] = useState({ month: lastMonth(), median: "", sales: "", domMedian: "", active: "" });
  const num = (s: string) => Number(s.replace(/[$,\s]/g, ""));
  const fields: [keyof typeof f, string][] = [["median", "Median sold price"], ["sales", "Homes sold"], ["domMedian", "Median days on market"], ["active", "Homes for sale now"]];
  return (
    <div className="mt-3 rounded-xl bg-[#F7F5F1] p-3" data-testid="mu-enter">
      <p className="mb-2 text-[16px] text-stone-700">Need them now? Type them from connectMLS (Stats or a closed search for the month).</p>
      <label className={label} htmlFor={`mu-month-${area}`}>Month</label>
      <input id={`mu-month-${area}`} type="month" className={input} value={f.month} onChange={e => setF({ ...f, month: e.target.value })} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        {fields.map(([k, l]) => (
          <div key={k}>
            <label className={label} htmlFor={`mu-${k}-${area}`}>{l}</label>
            <input id={`mu-${k}-${area}`} inputMode="numeric" className={input} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} data-testid={`mu-${k}`} />
          </div>
        ))}
      </div>
      <button
        type="button"
        className={`${btnDark} mt-3 w-full`}
        data-testid="mu-enter-save"
        onClick={() => {
          if (fields.some(([k]) => !f[k] || !Number.isFinite(num(f[k])))) return toast.error("Fill in all 4 numbers");
          enter({ area, month: f.month, median: num(f.median), sales: num(f.sales), domMedian: num(f.domMedian), active: num(f.active) })
            .then(() => toast.success("Saved. Your kit is ready below."))
            .catch(err);
        }}
      >
        Save numbers
      </button>
    </div>
  );
}

export function MarketUpdatePage() {
  const s = useQuery(api.marketMe.settings);
  const kit = useQuery(api.marketMe.marketKit);
  const save = useMutation(api.marketMe.saveSettings);
  const [edit, setEdit] = useState(false);
  if (!s || !kit) return <div className="p-6 text-[17px] text-stone-700">Loading…</div>;
  const first = s.name.split(" ")[0];
  const showPicker = edit || s.areas.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6" data-testid="mu-page">
      <PageHead title="Market update kit" sub="Your areas' numbers each month, turned into a 30-second video script, a post and a text for past clients." />
      {showPicker ? (
        <AreaPicker areas={s.areas} onSave={a => save({ areas: a }).then(() => setEdit(false))} />
      ) : (
        <button type="button" className={btnLight} onClick={() => setEdit(true)} data-testid="mu-change-areas">Change my areas</button>
      )}

      {kit.areas.map(({ area, mred, mine }) => {
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
