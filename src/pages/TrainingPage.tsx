import { useMutation, useQuery } from "convex/react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Award,
  BarChart3,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  FileSignature,
  FileText,
  GraduationCap,
  Home,
  Megaphone,
  MessagesSquare,
  PhoneCall,
  Rocket,
  Store,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import {
  PASS_MARK,
  TRAINING_TRACKS,
  type TrainingModule,
  type TrainingTrack,
} from "../../convex/trainingDefs";

const ICONS: Record<string, LucideIcon> = {
  Rocket,
  PhoneCall,
  Home,
  FileSignature,
  FileText,
  Store,
  Megaphone,
  BarChart3,
};
const SHORT: Record<string, string> = {
  start: "OS",
  leads: "Leads",
  listings: "Listings",
  buyers: "Buyers",
  edge: "Edge",
  marketing: "Content/AI",
  numbers: "Numbers",
};
const errMsg = (x: unknown) =>
  String((x as Error).message).match(/Uncaught Error: ([^\n]+)/)?.[1] ??
  "Could not save";
type Status = "certified" | "ready" | "in_progress" | "not_started";
const GOLD = "#9C7434";

export function useTrainingToggle() {
  const toggle = useMutation(api.training.toggle);
  return async (moduleId: string, done: boolean) => {
    try {
      await toggle({ moduleId, done });
      if (done) toast.success("Marked done");
    } catch (x) {
      toast.error(errMsg(x));
    }
  };
}

// Deterministic option order per question so the right answer isn't always in the same spot.
function order(n: number, seed: number) {
  const idx = Array.from({ length: n }, (_, i) => i);
  const k = seed % n;
  return seed % 2
    ? [...idx.slice(k), ...idx.slice(0, k)].reverse()
    : [...idx.slice(k), ...idx.slice(0, k)];
}

function StatusPill({
  status,
  done,
  total,
}: {
  status: Status;
  done: number;
  total: number;
}) {
  if (status === "certified")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#9C7434] px-2.5 py-1 text-xs font-semibold text-white">
        <Award className="size-3.5" /> Certified
      </span>
    );
  if (status === "ready")
    return (
      <span className="rounded-full bg-[#F3E9D7] px-2.5 py-1 text-xs font-semibold text-[#7a5a26]">
        Awaiting sign-off
      </span>
    );
  return (
    <span className="rounded-full bg-[#F7F5F1] px-2.5 py-1 text-xs font-semibold text-stone-600">
      {done}/{total}
    </span>
  );
}

function ModuleRow({
  m,
  done,
  onToggle,
  fileUrl,
}: {
  m: TrainingModule;
  done: boolean;
  onToggle: () => void;
  fileUrl?: string | null;
}) {
  const body = (
    <div className="min-w-0 flex-1">
      <div
        className={`font-semibold text-[15px] ${done ? "text-stone-400 line-through decoration-stone-300" : ""}`}
      >
        {m.title}
      </div>
      <div className="inline-flex items-center gap-1 text-xs text-stone-500">
        <Clock className="size-3" /> {m.minutes} min
        {m.note ? ` · ${m.note}` : ""}
        {m.playbook
          ? " · Playbook"
          : m.file
            ? " · PDF"
            : m.href
              ? " · Doc"
              : " · Do it in the Hub"}
      </div>
    </div>
  );
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#F7F5F1]">
      <button
        type="button"
        onClick={onToggle}
        aria-label={done ? "Mark not done" : "Mark done"}
        data-testid={`train-${m.id}`}
        className={`grid size-6 shrink-0 place-items-center rounded-full ring-1 ${done ? "bg-[#9C7434] ring-[#9C7434] text-white" : "ring-stone-300 text-transparent hover:ring-[#9C7434]"}`}
      >
        <Check className="size-3.5" />
      </button>
      {m.playbook ? (
        <Link
          to={`/playbooks/${m.playbook}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {body}
          <ArrowRight className="size-4 text-stone-400" />
        </Link>
      ) : m.file ? (
        fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            data-testid={`train-file-${m.file}`}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            {body}
            <FileText className="size-4 text-stone-400" />
          </a>
        ) : (
          <div
            className="flex min-w-0 flex-1 items-center gap-3"
            data-testid={`train-file-${m.file}`}
          >
            {body}
            <span className="text-xs text-stone-500">
              {fileUrl === null ? "File missing, tell the office" : "Loading…"}
            </span>
          </div>
        )
      ) : m.to ? (
        <Link to={m.to} className="flex min-w-0 flex-1 items-center gap-3">
          {body}
          <ArrowRight className="size-4 text-stone-400" />
        </Link>
      ) : (
        <a
          href={m.href}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {body}
          <ExternalLink className="size-4 text-stone-400" />
        </a>
      )}
    </div>
  );
}

function Drill({ t }: { t: TrainingTrack }) {
  return (
    <div
      className="space-y-3 bg-[#F7F5F1] px-4 py-4 text-[14px] leading-relaxed text-stone-700"
      data-testid={`drill-${t.id}`}
    >
      <p>
        <b className="text-[#0A0A0A]">The scenario:</b> {t.drill.scenario}
      </p>
      <p>
        <b className="text-[#0A0A0A]">Your partner plays:</b> {t.drill.partner}
      </p>
      <div>
        <b className="text-[#0A0A0A]">What good sounds like:</b>
        <ul className="mt-1.5 space-y-1">
          {t.drill.good.map(g => (
            <li key={g} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-[#9C7434]" />
              {g}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-stone-500">
        Run it with Brandon, Michael or a teammate. Swap roles, then run it
        again. 10 minutes.
      </p>
    </div>
  );
}

function Quiz({
  t,
  canSave,
  onClose,
}: {
  t: TrainingTrack;
  canSave: boolean;
  onClose: () => void;
}) {
  const submit = useMutation(api.training.submitQuiz);
  const [picks, setPicks] = useState<(number | null)[]>(t.quiz.map(() => null));
  const [result, setResult] = useState<{
    score: number;
    total: number;
    passed: boolean;
    correct: boolean[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const all = picks.every(p => p !== null);
  const go = async () => {
    if (!canSave) {
      toast.error("Sign in with your own email so your results are yours.");
      return;
    }
    setBusy(true);
    try {
      const r = await submit({
        trackId: t.id,
        answers: picks.map(p => p ?? -1),
      });
      setResult(r);
      if (r.passed) toast.success(`Passed ${r.score}/${r.total}`);
    } catch (x) {
      toast.error(errMsg(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="space-y-4 bg-[#F7F5F1] px-4 py-4"
      data-testid={`quiz-${t.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">
          Certification check · {t.quiz.length} questions · pass with{" "}
          {PASS_MARK}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-stone-400 hover:text-stone-700"
        >
          <X className="size-4" />
        </button>
      </div>
      {t.quiz.map((q, qi) => (
        <fieldset
          key={q.q}
          className="rounded-xl bg-white p-3 ring-1 ring-[#ebe5da]"
        >
          <legend className="sr-only">{q.q}</legend>
          <div className="text-[14px] font-semibold">
            {qi + 1}. {q.q}
          </div>
          <div className="mt-2 grid gap-1.5">
            {order(q.options.length, qi + t.n).map(oi => {
              const picked = picks[qi] === oi;
              const show = !!result;
              const right = show && oi === q.answer;
              const wrong = show && picked && oi !== q.answer;
              return (
                <button
                  type="button"
                  key={oi}
                  disabled={show}
                  onClick={() =>
                    setPicks(p => p.map((x, i) => (i === qi ? oi : x)))
                  }
                  className={`rounded-lg px-3 py-2 text-left text-[14px] ring-1 ${right ? "bg-[#F3E9D7] ring-[#9C7434] font-semibold" : wrong ? "bg-red-50 ring-red-300" : picked ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white ring-stone-200 hover:ring-[#9C7434]"}`}
                >
                  {q.options[oi]}
                </button>
              );
            })}
          </div>
          {result && !result.correct[qi] && (
            <p className="mt-2 text-xs text-stone-600">
              <b>Why:</b> {q.why}
            </p>
          )}
        </fieldset>
      ))}
      {!result ? (
        <button
          type="button"
          disabled={!all || busy}
          onClick={go}
          data-testid={`quiz-submit-${t.id}`}
          className="w-full rounded-xl bg-[#9C7434] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy
            ? "Checking…"
            : all
              ? "Check my answers"
              : "Answer every question"}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`text-sm font-semibold ${result.passed ? "text-[#7a5a26]" : "text-red-700"}`}
            data-testid={`quiz-result-${t.id}`}
          >
            {result.score}/{result.total} ·{" "}
            {result.passed
              ? "Passed. Finish every module and a team lead signs you off."
              : `Not yet. You need ${PASS_MARK}. Review the "why" notes and retry.`}
          </span>
          {!result.passed && (
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setPicks(t.quiz.map(() => null));
              }}
              className="rounded-xl bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TrackCard({
  t,
  done,
  st,
  canSave,
  onToggle,
}: {
  t: TrainingTrack;
  done: Set<string>;
  st?: {
    status: string;
    quiz: { best: number; total: number } | null;
    cert: { by: string; at: number } | null;
  };
  canSave: boolean;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState<"" | "drill" | "quiz">("");
  const files = useQuery(
    api.trainingFiles.urls,
    t.modules.some(m => m.file) ? {} : "skip",
  );
  const I = ICONS[t.icon] ?? GraduationCap;
  const n = t.modules.filter(m => done.has(m.id)).length;
  const status = (st?.status ?? "not_started") as Status;
  return (
    <section
      className={`overflow-hidden rounded-2xl bg-white ring-1 ${status === "certified" ? "ring-[#9C7434]" : "ring-[#ebe5da]"}`}
      data-testid={`track-${t.id}`}
    >
      <header className="flex items-start gap-3 border-b border-stone-100 px-4 py-3">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-[#0A0A0A]">
          <I className="size-5 text-[#D9BC8C]" />
          <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[#9C7434] text-[10px] font-bold text-white">
            {t.n}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-['Playfair_Display'] text-lg leading-tight">
            {t.title}
          </h2>
          <p className="text-xs text-stone-500">{t.blurb}</p>
        </div>
        <StatusPill status={status} done={n} total={t.modules.length} />
      </header>
      <div className="h-1 bg-stone-100">
        <div
          className="h-full"
          style={{
            width: `${Math.round((n / t.modules.length) * 100)}%`,
            background: GOLD,
          }}
        />
      </div>
      <div className="divide-y divide-stone-100">
        {t.modules.map(m => (
          <ModuleRow
            key={m.id}
            m={m}
            done={done.has(m.id)}
            onToggle={() => onToggle(m.id)}
            fileUrl={
              m.file
                ? files === undefined
                  ? undefined
                  : (files[m.file] ?? null)
                : undefined
            }
          />
        ))}
      </div>
      <div className="grid grid-cols-2 border-t border-stone-100 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setOpen(open === "drill" ? "" : "drill")}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-3 hover:bg-[#F7F5F1]"
          data-testid={`drill-btn-${t.id}`}
        >
          <MessagesSquare className="size-4 text-[#9C7434]" /> Role-play drill{" "}
          <ChevronDown
            className={`size-3.5 text-stone-400 transition ${open === "drill" ? "rotate-180" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "quiz" ? "" : "quiz")}
          className="inline-flex items-center justify-center gap-1.5 border-l border-stone-100 px-3 py-3 hover:bg-[#F7F5F1]"
          data-testid={`quiz-btn-${t.id}`}
        >
          <Award className="size-4 text-[#9C7434]" />{" "}
          {st?.quiz
            ? `Check: best ${st.quiz.best}/${st.quiz.total}`
            : "Certification check"}
        </button>
      </div>
      {open === "drill" && <Drill t={t} />}
      {open === "quiz" && (
        <Quiz t={t} canSave={canSave} onClose={() => setOpen("")} />
      )}
      {status === "certified" && st?.cert && (
        <div className="border-t border-stone-100 px-4 py-2 text-xs text-[#7a5a26]">
          Signed off by {st.cert.by} ·{" "}
          {new Date(st.cert.at).toLocaleDateString()}
        </div>
      )}
      {status !== "certified" && (
        <div className="border-t border-stone-100 px-4 py-2 text-xs text-stone-500">
          Outcome: {t.outcome}
        </div>
      )}
    </section>
  );
}

function TeamProgress() {
  const team = useQuery(api.training.team);
  const certify = useMutation(api.training.certify);
  if (!team) return null;
  const sign = async (email: string, trackId: string, on: boolean) => {
    try {
      await certify({ email, trackId, on });
      toast.success(on ? "Signed off" : "Sign-off removed");
    } catch (x) {
      toast.error(errMsg(x));
    }
  };
  const waiting = team.reduce((k, a) => k + a.ready, 0);
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9C7434]">
        <Users className="size-3.5" /> Team progress (team leads only)
        {waiting > 0 && (
          <span className="ml-2 rounded-full bg-[#9C7434] px-2 py-0.5 text-[10px] text-white normal-case tracking-normal">
            {waiting} awaiting your sign-off
          </span>
        )}
      </h2>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-[#ebe5da]">
        <table className="w-full text-sm" data-testid="team-progress">
          <thead>
            <tr className="bg-[#F7F5F1] text-left text-[11px] uppercase tracking-wider text-stone-500">
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Modules</th>
              <th className="px-3 py-2">Certified</th>
              {TRAINING_TRACKS.map(t => (
                <th key={t.id} className="px-2 py-2 whitespace-nowrap">
                  {t.n}. {SHORT[t.id] ?? t.id}
                </th>
              ))}
              <th className="px-3 py-2">Last activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {team.map(a => (
              <tr key={a.email}>
                <td className="px-3 py-2 font-medium whitespace-nowrap">
                  {a.name}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-stone-200">
                      <div
                        className="h-full bg-[#9C7434]"
                        style={{
                          width: `${Math.round((a.done / a.total) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-stone-500">
                      {a.done}/{a.total}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-[#7a5a26]">
                  {a.certified}/7
                </td>
                {a.tracks.map(t => (
                  <td
                    key={t.id}
                    className="px-2 py-2 text-xs whitespace-nowrap"
                  >
                    {t.status === "certified" ? (
                      <button
                        type="button"
                        title={`Signed off by ${t.cert?.by}. Click to undo.`}
                        onClick={() => sign(a.email, t.id, false)}
                        className="inline-flex items-center gap-0.5 font-semibold text-[#9C7434]"
                      >
                        <Award className="size-3.5" />✓
                      </button>
                    ) : t.status === "ready" ? (
                      <button
                        type="button"
                        onClick={() => sign(a.email, t.id, true)}
                        className="rounded-md bg-[#9C7434] px-2 py-1 font-semibold text-white"
                      >
                        Sign off
                      </button>
                    ) : (
                      <span className="text-stone-500">
                        {t.done}/{t.total}
                        {t.quiz ? ` · ${t.quiz.best}/${t.quiz.total}` : ""}
                      </span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 text-xs text-stone-500 whitespace-nowrap">
                  {a.updatedAt
                    ? new Date(a.updatedAt).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Cells show modules done · best check score. "Sign off" appears when an
        agent has finished every module and passed the check. Watch the
        role-play before you sign.
      </p>
    </section>
  );
}

export function TrainingPage() {
  const mine = useQuery(api.training.mine);
  const toggle = useTrainingToggle();
  const done = new Set(mine?.done ?? []);
  const total =
    mine?.total ?? TRAINING_TRACKS.reduce((n, t) => n + t.modules.length, 0);
  const pct = Math.round((done.size / total) * 100);
  const certified =
    mine?.tracks.filter(t => t.status === "certified").length ?? 0;
  const nextTrack = TRAINING_TRACKS.find(t =>
    t.modules.some(m => !done.has(m.id)),
  );
  const nextModule = nextTrack?.modules.find(m => !done.has(m.id));
  const canSave = !!mine && !mine.isShared;
  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-[#0A0A0A] p-6 text-white">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#D9BC8C]">
          <GraduationCap className="size-4" /> SpaceMatch Academy
        </div>
        <h1 className="mt-2 font-['Playfair_Display'] text-3xl font-bold">
          Systems that close deals
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-white/75">
          Our playbook, not generic coaching: the tools, numbers and words we
          actually use. {TRAINING_TRACKS.length} tracks · {total} short modules.
          Each track ends with a role-play drill and a 5-question check, and a
          team lead signs you off.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center sm:max-w-md">
          <div className="rounded-xl bg-white/10 py-2">
            <div className="text-xl font-bold">
              {done.size}/{total}
            </div>
            <div className="text-[11px] text-white/60">modules</div>
          </div>
          <div className="rounded-xl bg-white/10 py-2">
            <div className="text-xl font-bold">{certified}/7</div>
            <div className="text-[11px] text-white/60">certified</div>
          </div>
          <div className="rounded-xl bg-white/10 py-2">
            <div className="text-xl font-bold">{pct}%</div>
            <div className="text-[11px] text-white/60">complete</div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full bg-[#D9BC8C]" style={{ width: `${pct}%` }} />
        </div>
        {mine?.isShared && (
          <p className="mt-3 text-xs text-white/60">
            You're on the shared team login. Sign in with your own email to
            track progress and get certified.
          </p>
        )}
        {nextModule && canSave && (
          <Link
            to={
              nextModule.playbook
                ? `/playbooks/${nextModule.playbook}`
                : (nextModule.to ?? "/training")
            }
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#9C7434] px-4 py-2.5 text-sm font-semibold"
          >
            Up next: {nextModule.title} <ArrowRight className="size-4" />
          </Link>
        )}
      </header>

      <ol className="grid gap-2 rounded-2xl bg-white p-4 text-sm ring-1 ring-[#ebe5da] sm:grid-cols-4">
        {[
          ["Read", "Short modules, 3–6 minutes each"],
          ["Do", "Every module links to the Hub tool you'll use"],
          ["Practice", "Role-play drill with a teammate"],
          ["Certify", `Pass the check (${PASS_MARK}/5) + team-lead sign-off`],
        ].map(([h, s], i) => (
          <li key={h} className="flex gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#0A0A0A] text-xs font-bold text-[#D9BC8C]">
              {i + 1}
            </span>
            <div>
              <div className="font-semibold">{h}</div>
              <div className="text-xs text-stone-500">{s}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-2">
        {TRAINING_TRACKS.map(t => (
          <TrackCard
            key={t.id}
            t={t}
            done={done}
            st={mine?.tracks.find(x => x.id === t.id)}
            canSave={canSave}
            onToggle={id => toggle(id, !done.has(id))}
          />
        ))}
      </div>
      <TeamProgress />
    </div>
  );
}
