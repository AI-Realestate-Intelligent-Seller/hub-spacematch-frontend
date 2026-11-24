import { useMutation, useQuery } from "convex/react";
import { Check, ExternalLink, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { GROWTH_LEVELS, GROWTH_PLAYBOOK_URL } from "../../convex/growthDefs";
import { GrowthScoreCard, TeamScores } from "./growth/GrowthScore";

const errMsg = (e: unknown) =>
  String(e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? "Something went wrong";

// "**bold**" → <b>
function Rich({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*)/)
        .map((p, i) =>
          p.startsWith("**") ? (
            <b key={i}>{p.slice(2, -2)}</b>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
    </>
  );
}

function Bar({
  done,
  total,
  dark,
}: {
  done: number;
  total: number;
  dark?: boolean;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-stone-200"}`}
    >
      <div
        className="h-full rounded-full bg-[#9C7434] transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const ago = (t: number | null) => {
  if (!t) return "not started";
  const d = Math.floor((Date.now() - t) / 864e5);
  return d === 0
    ? "active today"
    : d === 1
      ? "active yesterday"
      : `active ${d} days ago`;
};

function TeamProgress() {
  const team = useQuery(api.growth.team);
  if (!team) return null;
  const started = team.filter(r => r.done > 0).length;
  return (
    <section
      className="rounded-2xl bg-white ring-1 ring-[#ebe5da]"
      data-testid="growth-team"
    >
      <div className="flex items-center gap-2 border-b border-stone-100 p-4">
        <Users className="size-5 text-[#9C7434]" />
        <h2 className="text-lg font-semibold">Who's doing it</h2>
        <span className="ml-auto text-sm text-stone-600">
          {started} of {team.length} started
        </span>
      </div>
      <div className="divide-y divide-stone-100">
        {team.map(r => (
          <div
            key={r.email}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 p-4 sm:grid-cols-[180px_1fr_auto]"
          >
            <div className="font-semibold">{r.name}</div>
            <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
              <Bar done={r.done} total={r.total} />
              <div className="mt-1 text-sm text-stone-600">
                {r.levels
                  .map(l => `${l.title} ${l.done}/${l.total}`)
                  .join(" · ")}
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold">
                {Math.round((r.done / r.total) * 100)}%
              </div>
              <div className="text-stone-600">{ago(r.updatedAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function GrowthPage() {
  const me = useQuery(api.hubMe.me);
  const mine = useQuery(api.growth.mine);
  const toggle = useMutation(api.growth.toggle);
  const setLevel = useMutation(api.growth.setLevel);
  const [tab, setTab] = useState<number | null>(null);
  const [viewAgent, setViewAgent] = useState<string | undefined>(undefined);
  // "Playbook step" links on fixes: open that item's level, then scroll to it.
  useEffect(() => {
    const go = () => {
      const id = window.location.hash.match(/^#growth-item-(.+)$/)?.[1];
      if (!id) return;
      const lv = GROWTH_LEVELS.findIndex(l =>
        l.weeks.some(w => w.items.some(i => i.id === id)),
      );
      if (lv >= 0) setTab(lv + 1);
      setTimeout(
        () =>
          document
            .getElementById(`growth-item-${id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
        80,
      );
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []);
  const level = tab ?? mine?.level ?? 1;
  const done = new Set(mine?.done ?? []);
  const L = GROWTH_LEVELS[level - 1];
  const levelIds = L.weeks.flatMap(w => w.items.map(i => i.id));
  const levelDone = levelIds.filter(i => done.has(i)).length;

  const flip = (id: string) =>
    toggle({ itemId: id, done: !done.has(id) }).catch(e =>
      toast.error(errMsg(e)),
    );

  return (
    <div className="space-y-6">
      <header className="-mx-4 -mt-5 bg-[#0A0A0A] px-5 py-8 text-white lg:-mx-6 md:px-10">
        <div className="text-sm font-semibold text-[#D9BC8C]">
          90-day Growth Playbook
        </div>
        <h1 className="mt-1 font-['Playfair_Display'] text-3xl font-bold md:text-4xl">
          Build the presence before you need the business.
        </h1>
        <p className="mt-2 max-w-2xl text-[17px] text-[#e7e1d6]">
          45 minutes a day. Check items off as you go. Your progress saves to
          your account, and team leads can see who's moving.
        </p>
        <div className="mt-5 max-w-xl">
          <Bar done={mine?.done.length ?? 0} total={mine?.total ?? 54} dark />
          <div
            className="mt-1.5 text-sm text-[#e7e1d6]"
            data-testid="growth-total"
          >
            {mine?.done.length ?? 0} of {mine?.total ?? 54} done
          </div>
        </div>
        <a
          href={GROWTH_PLAYBOOK_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#D9BC8C]"
        >
          Read the full playbook (stages, SPACE formula, scripts){" "}
          <ExternalLink className="size-4" />
        </a>
      </header>

      {me?.isShared && (
        <div className="rounded-xl bg-amber-50 p-4 text-[15px] text-amber-900 ring-1 ring-amber-200">
          You're on the shared team account, so checkboxes are off. Sign in with
          your own @spacematchinc.com email to track your progress.
        </div>
      )}

      {me?.isStaff && viewAgent && (
        <button
          type="button"
          onClick={() => setViewAgent(undefined)}
          className="text-sm font-semibold text-[#7a5a26]"
        >
          ← Back to my own card
        </button>
      )}
      <GrowthScoreCard agentEmail={viewAgent} />
      {me?.isStaff && (
        <TeamScores
          selected={viewAgent}
          onOpen={e => {
            setViewAgent(e);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}

      <h2 className="pt-2 font-['Playfair_Display'] text-2xl font-bold">
        The 90-day checklist
      </h2>
      <div className="grid gap-3 sm:grid-cols-3" role="tablist">
        {GROWTH_LEVELS.map((l, i) => {
          const ids = l.weeks.flatMap(w => w.items.map(x => x.id));
          const n = ids.filter(x => done.has(x)).length;
          const on = level === i + 1;
          return (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setTab(i + 1);
                if (mine?.startedAt) void setLevel({ level: i + 1 });
              }}
              className={`rounded-2xl p-4 text-left ring-1 transition ${on ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white ring-[#ebe5da] hover:shadow-md"}`}
            >
              <div
                className={`text-sm ${on ? "text-[#D9BC8C]" : "text-[#7a5a26]"} font-semibold`}
              >
                {l.label}
              </div>
              <div className="text-lg font-semibold">{l.title}</div>
              <div
                className={`mt-1 text-sm ${on ? "text-[#e7e1d6]" : "text-stone-600"}`}
              >
                {l.who}
              </div>
              <div className="mt-3">
                <Bar done={n} total={ids.length} dark={on} />
              </div>
              <div
                className={`mt-1 text-sm ${on ? "text-[#e7e1d6]" : "text-stone-600"}`}
              >
                {n} of {ids.length}
              </div>
            </button>
          );
        })}
      </div>

      <section className="space-y-4" data-testid="growth-level">
        <div className="text-[15px] text-stone-700">
          <b>{L.title}:</b> {levelDone} of {levelIds.length} done
        </div>
        {L.weeks.map(w => (
          <div
            key={w.title}
            className="rounded-2xl bg-white ring-1 ring-[#ebe5da]"
          >
            <h3 className="border-b border-stone-100 px-4 py-3 text-[17px] font-semibold">
              {w.title}
            </h3>
            <div className="divide-y divide-stone-100">
              {w.items.map(it => {
                const on = done.has(it.id);
                return (
                  <button
                    key={it.id}
                    type="button"
                    data-testid={`growth-item-${it.id}`}
                    id={`growth-item-${it.id}`}
                    aria-pressed={on}
                    disabled={me?.isShared}
                    onClick={() => flip(it.id)}
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-[#F7F5F1] disabled:cursor-not-allowed"
                  >
                    <span
                      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ring-2 ${on ? "bg-[#9C7434] ring-[#9C7434]" : "bg-white ring-stone-300"}`}
                    >
                      {on && <Check className="size-4 text-white" />}
                    </span>
                    <span
                      className={`text-[16px] leading-relaxed ${on ? "text-stone-500 line-through decoration-stone-300" : "text-[#1c1a17]"}`}
                    >
                      <Rich text={it.text} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="rounded-2xl bg-[#F7F5F1] p-4 text-[15px] text-stone-800 ring-1 ring-[#ebe5da]">
          <b>{L.title} is complete when:</b> {L.doneWhen}
        </div>
      </section>

      <TeamProgress />
    </div>
  );
}
