import { useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  ExternalLink,
  GraduationCap,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { PLAYBOOKS, type PlaybookLink } from "@/lib/playbooks";
import { useTrainingToggle } from "@/pages/TrainingPage";
import { api } from "../../convex/_generated/api";
import { TRAINING_MODULE_IDS } from "../../convex/trainingDefs";
import { AskMuseButton } from "@/components/hub/AskMuseButton";

function LinkChip({ l }: { l: PlaybookLink }) {
  const cls =
    "inline-flex items-center gap-1.5 rounded-full bg-[#F7F5F1] px-3 py-1.5 text-sm font-medium text-[#0A0A0A] ring-1 ring-[#ebe5da] hover:ring-[#9C7434]";
  if (l.href)
    return (
      <a href={l.href} target="_blank" rel="noreferrer" className={cls}>
        {l.label}
        <ExternalLink className="size-3.5 text-stone-400" />
      </a>
    );
  return (
    <Link to={l.to ?? "/home"} className={cls}>
      {l.label}
      <ArrowRight className="size-3.5 text-[#9C7434]" />
    </Link>
  );
}

function MarkDone({ id }: { id: string }) {
  const mine = useQuery(api.training.mine);
  const toggle = useTrainingToggle();
  const mid = `pb:${id}`;
  if (!TRAINING_MODULE_IDS.includes(mid) || !mine || mine.isShared) return null;
  const done = mine.done.includes(mid);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#F7F5F1] p-4 ring-1 ring-[#ebe5da]">
      <button
        type="button"
        onClick={() => toggle(mid, !done)}
        data-testid="playbook-done"
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${done ? "bg-white text-[#9C7434] ring-1 ring-[#9C7434]" : "bg-[#9C7434] text-white"}`}
      >
        <Check className="size-4" />
        {done ? "Done (tap to undo)" : "Mark as done"}
      </button>
      <Link
        to="/training"
        className="inline-flex items-center gap-1.5 text-sm text-stone-600"
      >
        <GraduationCap className="size-4 text-[#9C7434]" /> SpaceMatch Academy ·{" "}
        {mine.done.length}/{mine.total}
      </Link>
    </div>
  );
}

function PlaybookDetail({ id }: { id: string }) {
  const p = PLAYBOOKS.find(x => x.id === id);
  if (!p)
    return (
      <div className="space-y-3">
        <p className="text-stone-500">Playbook not found.</p>
        <Link to="/playbooks" className="text-[#9C7434] font-semibold">
          All playbooks
        </Link>
      </div>
    );
  const i = PLAYBOOKS.indexOf(p);
  const next = PLAYBOOKS[i + 1];
  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/training"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#0A0A0A]"
      >
        <ArrowLeft className="size-4" /> SpaceMatch Academy
      </Link>
      <header className="rounded-3xl bg-[#0A0A0A] p-6 text-white">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#D9BC8C]">
          Playbook {p.n}
        </div>
        <h1 className="mt-2 font-['Playfair_Display'] text-3xl font-bold leading-tight">
          {p.title}
        </h1>
        <p className="mt-3 text-[15px] text-white/80">{p.summary}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/60">
          <span>{p.who}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {p.minutes} min read
          </span>
        </div>
        <AskMuseButton title={p.title} className="mt-4 bg-white/10 ring-1 ring-[#D9BC8C]/50 hover:bg-white/20" />
      </header>
      {p.sections.map(s => (
        <section
          key={s.h}
          className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]"
        >
          <h2 className="font-['Playfair_Display'] text-xl font-semibold">
            {s.h}
          </h2>
          <ul className="mt-3 space-y-2.5">
            {s.items.map(it => (
              <li
                key={it}
                className="flex gap-3 text-[15px] leading-relaxed text-stone-700"
              >
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#9C7434]" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
          {s.links && s.links.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {s.links.map(l => (
                <LinkChip key={l.label} l={l} />
              ))}
            </div>
          )}
        </section>
      ))}
      <MarkDone id={p.id} />
      {next && (
        <Link
          to={`/playbooks/${next.id}`}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da] hover:ring-[#9C7434]"
        >
          <div className="min-w-0 flex-1">
            <div className="text-xs text-stone-500">Next playbook</div>
            <div className="font-semibold">{next.title}</div>
          </div>
          <ArrowRight className="size-4 text-[#9C7434]" />
        </Link>
      )}
    </article>
  );
}

export function PlaybooksPage() {
  const { id } = useParams();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return PLAYBOOKS;
    return PLAYBOOKS.filter(p =>
      `${p.title} ${p.summary} ${p.tags} ${p.sections.map(x => `${x.h} ${x.items.join(" ")}`).join(" ")}`
        .toLowerCase()
        .includes(s),
    );
  }, [q]);
  if (id) return <PlaybookDetail id={id} />;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-['Playfair_Display'] text-3xl font-bold">
          Playbooks
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          How we do things at SpaceMatch: {PLAYBOOKS.length} short, step-by-step
          guides. Get certified in the{" "}
          <Link to="/training" className="font-semibold text-[#9C7434]">
            SpaceMatch Academy
          </Link>
          .
        </p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search playbooks (e.g. open house, split, NDA)"
          className="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-10 pr-3 text-[15px]"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map(p => (
          <Link
            key={p.id}
            to={`/playbooks/${p.id}`}
            className="group flex gap-4 rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da] transition-all hover:ring-[#9C7434] hover:shadow-md"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0A0A0A] font-['Playfair_Display'] text-lg font-bold text-[#D9BC8C]">
              {p.n}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{p.title}</div>
              <div className="mt-0.5 text-sm text-stone-500 line-clamp-2">
                {p.summary}
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-xs text-stone-400">
                <Clock className="size-3" /> {p.minutes} min · {p.who}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {list.length === 0 && (
        <p className="text-sm text-stone-500 inline-flex items-center gap-2">
          <BookOpen className="size-4" /> No playbooks match.
        </p>
      )}
    </div>
  );
}
