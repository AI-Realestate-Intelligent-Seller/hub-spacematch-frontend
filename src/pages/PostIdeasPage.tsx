import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { btnDark, btnLight, Card, CopyBtn, input, label, PageHead } from "@/components/hub/mm";
import { postIdeas } from "@/lib/marketMe";
import { areaLabel } from "../../convex/marketDefs";
import { useApiData } from "@/lib/apiData";
import { marketMeApi } from "@/lib/marketApi";

// /post-ideas — 4 ready post ideas a month (market update, seasonal, neighborhood spot, story/tip),
// filled with the agent's name and area. Static copy, no AI.
export function PostIdeasPage() {
  const s = useApiData("market-me:settings", () => marketMeApi.settings()).data; // new backend
  const now = new Date();
  const [offset, setOffset] = useState(0);
  const [custom, setCustom] = useState("");
  if (!s) return <div className="p-6 text-[17px] text-stone-700">Loading…</div>;
  const first = s.name.split(" ")[0];
  const areas = s.areas.map(a => areaLabel(a).replace(/ \(.*\)$/, ""));
  const [pick, setPick] = [custom || areas[0] || "your neighborhood", setCustom];
  const month = (now.getMonth() + offset) % 12;
  const mName = new Date(2026, month, 15).toLocaleDateString("en-US", { month: "long" });
  const ideas = postIdeas(month, first, pick);

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6" data-testid="pi-page">
      <PageHead title="Post ideas" sub="Four posts for the month with what to film and a caption to copy. Film on your phone, then send the clips to Make a Reel." />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={offset === 0 ? btnDark : btnLight} onClick={() => setOffset(0)} data-testid="pi-this">This month</button>
        <button type="button" className={offset === 1 ? btnDark : btnLight} onClick={() => setOffset(1)} data-testid="pi-next">Next month</button>
      </div>
      <Card>
        <label className={label} htmlFor="pi-area">Area in the captions</label>
        {areas.length > 1 ? (
          <select id="pi-area" className={input} value={pick} onChange={e => setPick(e.target.value)}>
            {areas.map(a => <option key={a}>{a}</option>)}
          </select>
        ) : (
          <input id="pi-area" className={input} value={custom} placeholder={areas[0] || "e.g. Lincoln Park"} onChange={e => setPick(e.target.value)} data-testid="pi-area" />
        )}
        {areas.length === 0 && (
          <Link to="/market-update" className="mt-2 inline-flex items-center gap-1 text-[16px] font-semibold text-[#7a5a26]">Save your areas once in the Market update kit <ArrowRight className="size-4" /></Link>
        )}
      </Card>
      <h2 className="text-[20px] font-bold text-[#0A0A0A]">{mName}</h2>
      {ideas.map((p, i) => (
        <Card key={p.kind} testid="pi-idea">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#9C7434] text-[17px] font-extrabold text-white">{i + 1}</span>
            <div>
              <div className="text-[15px] font-bold text-[#7a5a26]">{p.kind}</div>
              <div className="text-[18px] font-bold leading-tight text-[#0A0A0A]">{p.title}</div>
            </div>
          </div>
          <p className="mt-2 text-[16px] leading-snug text-[#1c1917]"><b>Film:</b> {p.shots}</p>
          <p className="mt-2 rounded-xl bg-[#F7F5F1] p-3 text-[16px] leading-relaxed" data-testid="pi-caption">{p.caption}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyBtn text={p.caption} label="Copy caption" testid="pi-copy" />
            {p.to && <Link to={p.to} className={btnLight}>{p.toLabel}</Link>}
          </div>
        </Card>
      ))}
    </div>
  );
}
