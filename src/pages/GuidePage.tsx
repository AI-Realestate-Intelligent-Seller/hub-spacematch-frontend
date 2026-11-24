import { ArrowRight, BookOpen, Check, Compass, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  FIRST_WEEK,
  type Situation,
  SITUATIONS,
  STAGES,
  TOOLS_GUIDE,
} from "@/lib/hubGuide";
import { AskMuseButton } from "@/components/hub/AskMuseButton";

// /guide: "when do I use what". Static content (src/lib/hubGuide.ts), no AI.
const WEEK_KEY = "hub-guide-week";

function useWeekTicks() {
  const [done, setDone] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(WEEK_KEY) ?? "[]");
    } catch {
      return [];
    }
  });
  const toggle = (i: number) =>
    setDone(d => {
      const n = d.includes(i) ? d.filter(x => x !== i) : [...d, i];
      localStorage.setItem(WEEK_KEY, JSON.stringify(n));
      return n;
    });
  return { done, toggle };
}

function SituationCard({ s, open }: { s: Situation; open: boolean }) {
  return (
    <details
      id={`s-${s.id}`}
      open={open}
      className="group rounded-2xl bg-white ring-1 ring-[#ebe5da] open:ring-[#9C7434]"
      data-testid="situation"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 md:p-5">
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold text-[#0A0A0A]">{s.title}</div>
          <div className="text-[15px] text-stone-600">{s.goal}</div>
        </div>
        <ArrowRight className="size-5 shrink-0 text-[#9C7434] transition-transform group-open:rotate-90" />
      </summary>
      <ol className="space-y-3 px-4 pb-4 md:px-5 md:pb-5">
        {s.steps.map((st, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0A0A0A] text-sm font-semibold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-relaxed text-stone-800">{st.text}</p>
              {st.to && (
                <Link
                  to={st.to}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-[#F7F5F1] px-3 py-1.5 text-sm font-semibold text-[#7a5a27] ring-1 ring-[#e4d9c4] hover:bg-[#efe7d8]"
                >
                  {st.label ?? "Open"} <ArrowRight className="size-3.5" />
                </Link>
              )}
            </div>
          </li>
        ))}
        <li className="flex flex-wrap items-center gap-4">
          {s.playbook && (
            <Link
              to={`/playbooks/${s.playbook}`}
              className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#9C7434] hover:underline"
            >
              <BookOpen className="size-4" /> Read the full playbook
            </Link>
          )}
          <AskMuseButton title={s.title} kind="situation" />
        </li>
      </ol>
    </details>
  );
}

export function GuidePage() {
  const [params, setParams] = useSearchParams();
  const stage = params.get("stage") ?? "all";
  const focus = params.get("s");
  const [q, setQ] = useState("");
  const { done, toggle } = useWeekTicks();

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return SITUATIONS.filter(s => stage === "all" || s.stage === stage).filter(
      s =>
        !needle ||
        [s.title, s.goal, ...s.steps.map(x => x.text)].join(" ").toLowerCase().includes(needle),
    );
  }, [stage, q]);

  const tools = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return TOOLS_GUIDE.filter(
      t => !needle || [t.name, t.what, t.when].join(" ").toLowerCase().includes(needle),
    );
  }, [q]);

  useEffect(() => {
    if (focus) document.getElementById(`s-${focus}`)?.scrollIntoView({ block: "center" });
  }, [focus]);

  const setStage = (id: string) => {
    const n = new URLSearchParams(params);
    if (id === "all") n.delete("stage");
    else n.set("stage", id);
    n.delete("s");
    setParams(n, { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-10">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[#9C7434]">
          <Compass className="size-6" />
          <span className="text-[15px] font-semibold">Hub Guide</span>
        </div>
        <h1 className="font-['Playfair_Display'] text-3xl md:text-4xl font-bold text-[#0A0A0A]">
          What do I use, and when?
        </h1>
        <p className="text-[17px] text-stone-700">
          Find your situation below and tap the tool. Each one shows the exact
          steps we use as a team.
        </p>
      </header>

      {/* First week */}
      <section className="rounded-2xl bg-[#0A0A0A] p-5 text-white" data-testid="first-week">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-['Playfair_Display'] text-xl font-semibold">Your first week</h2>
          <span className="text-sm text-[#D9BC8C]">
            {done.length} of {FIRST_WEEK.length} done
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {FIRST_WEEK.map((st, i) => {
            const on = done.includes(i);
            return (
              <li key={i} className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-label={on ? "Mark not done" : "Mark done"}
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ring-1 ${on ? "bg-[#9C7434] ring-[#9C7434]" : "ring-stone-500"}`}
                >
                  {on && <Check className="size-4" />}
                </button>
                <div className={`flex-1 text-[15px] leading-relaxed ${on ? "text-stone-400 line-through" : "text-stone-100"}`}>
                  {st.text}{" "}
                  {st.to && (
                    <Link to={st.to} className="font-semibold text-[#D9BC8C] no-underline hover:underline">
                      {st.label} →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Filter */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-[#ebe5da] focus-within:ring-[#9C7434]">
          <Search className="size-5 text-stone-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search: open house, offer, landlord, mailer…"
            className="flex-1 bg-transparent text-[16px] outline-none"
            aria-label="Search the guide"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="tablist">
          {[{ id: "all", label: "All" }, ...STAGES].map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStage(s.id)}
              className={`rounded-full px-3.5 py-1.5 text-[15px] font-medium ring-1 ${stage === s.id ? "bg-[#9C7434] text-white ring-[#9C7434]" : "bg-white text-stone-700 ring-[#ebe5da]"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* Situations */}
      <section className="space-y-3">
        <h2 className="font-['Playfair_Display'] text-2xl font-semibold text-[#0A0A0A]">
          When this happens…
        </h2>
        {list.length === 0 && (
          <p className="text-[15px] text-stone-600">
            Nothing matches. Try another word, or ask in{" "}
            <Link to="/help" className="font-semibold text-[#9C7434]">Get help</Link>.
          </p>
        )}
        {list.map(s => (
          <SituationCard key={s.id} s={s} open={focus === s.id || (!!q && list.length <= 3)} />
        ))}
      </section>

      {/* Every tool */}
      <section className="space-y-3">
        <h2 className="font-['Playfair_Display'] text-2xl font-semibold text-[#0A0A0A]">
          Every tool in the Hub
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {tools.map(t => (
            <Link
              key={t.id}
              to={t.to}
              className="flex flex-col rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da] hover:ring-[#9C7434]"
              data-testid="guide-tool"
            >
              <div className="text-[17px] font-semibold text-[#0A0A0A]">{t.name}</div>
              <p className="mt-1 text-[15px] leading-relaxed text-stone-700">{t.what}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-stone-800">
                <b>Use it when:</b> {t.when}
              </p>
              <p className="mt-1 text-sm text-stone-500">Find it: {t.where}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
