import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, LifeBuoy } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { Doc } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { HELP_STATUSES, HELP_STATUS_LABEL, helpDueAt } from "../../convex/helpDue";

type Req = Doc<"helpRequests">;
const WHEN: Record<string, string> = { now: "Urgent", today: "Today", week: "This week" };
const URG_TONE: Record<string, string> = { now: "bg-red-100 text-red-800", today: "bg-amber-100 text-amber-900", week: "bg-stone-100 text-stone-700" };
const COL_TONE: Record<string, string> = { new: "bg-[#0A0A0A]", in_progress: "bg-[#9C7434]", waiting: "bg-amber-500", done: "bg-emerald-600" };
const dur = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};
const errMsg = (e: unknown) => String((e as Error)?.message ?? e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? "Something went wrong";

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const NEXT: Record<string, [string, string][]> = {
  new: [["in_progress", "Start"], ["waiting", "Waiting on agent"], ["done", "Done"]],
  in_progress: [["waiting", "Waiting on agent"], ["done", "Done"]],
  waiting: [["in_progress", "Back in progress"], ["done", "Done"]],
  done: [["in_progress", "Reopen"]],
};

function Card({ r, now, isAdmin, myEmail, support }: { r: Req; now: number; isAdmin: boolean; myEmail: string; support: { name: string; email: string }[] }) {
  const setStatus = useMutation(api.help.setStatus);
  const reassign = useMutation(api.help.reassign);
  const [note, setNote] = useState("");
  const due = helpDueAt(r.urgency, r.createdAt);
  const overdue = r.status !== "done" && now > due;
  const amISupport = support.some(s => s.email === myEmail);
  const move = (status: string) =>
    setStatus({ id: r._id, status, reply: note || undefined })
      .then(() => { setNote(""); toast.success(`Moved to ${HELP_STATUS_LABEL[status]}. ${r.fromName.split(" ")[0]} gets an email.`); })
      .catch(e => toast.error(errMsg(e)));
  return (
    <div className={`rounded-xl bg-white p-3 ring-1 ${overdue ? "ring-2 ring-red-500" : "ring-[#ebe5da]"}`} data-testid="help-card">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${URG_TONE[r.urgency] ?? URG_TONE.week}`}>{WHEN[r.urgency] ?? r.urgency}</span>
        {overdue && <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white"><AlertTriangle className="size-3" /> Overdue</span>}
        <span className="ml-auto text-xs text-stone-500">
          {r.status === "done" ? `done ${dur(now - (r.doneAt ?? r.statusAt ?? r.createdAt))} ago` : `${dur(now - r.createdAt)} waiting`}
        </span>
      </div>
      <div className="mt-1.5 text-[15px] font-semibold leading-snug">{r.topic}</div>
      <div className="text-xs text-stone-600">{r.fromName} → {r.toName}</div>
      {r.details && <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-stone-800">{r.details}</p>}
      {r.reply && <p className="mt-1 text-sm text-stone-700"><b>Note:</b> {r.reply}</p>}
      <div className="mt-2 flex flex-col gap-1.5">
        {r.status !== "done" && (
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note for the agent (optional)" className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#9C7434]" />
        )}
        <div className="flex flex-wrap gap-1.5">
          {(NEXT[r.status] ?? NEXT.new).map(([s, label]) => (
            <button key={s} type="button" onClick={() => move(s)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${s === "done" ? "bg-[#0A0A0A] text-white" : "ring-1 ring-stone-300"}`}>{label}</button>
          ))}
        </div>
        {isAdmin && r.status !== "done" && (
          <div className="flex items-center gap-1.5">
            <select aria-label="Reassign" value={r.toEmail} onChange={e => reassign({ id: r._id, toEmail: e.target.value }).then(() => toast.success("Reassigned")).catch(err => toast.error(errMsg(err)))} className="flex-1 rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs">
              {support.map(s => <option key={s.email} value={s.email}>{s.name}</option>)}
            </select>
            {amISupport && r.toEmail !== myEmail && (
              <button type="button" onClick={() => reassign({ id: r._id, toEmail: myEmail }).then(() => toast.success("It's yours"))} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#7a5a26] ring-1 ring-[#9C7434]/40">Take it</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MyRow({ r }: { r: Req }) {
  const setStatus = useMutation(api.help.setStatus);
  return (
    <div className="p-4" data-testid="help-row">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold text-white ${COL_TONE[r.status] ?? COL_TONE.new}`}>{HELP_STATUS_LABEL[r.status] ?? r.status}</span>
        <span className="text-[16px] font-semibold">{r.topic}</span>
        <span className="text-sm text-stone-600">to {r.toName}</span>
      </div>
      {r.details && <p className="mt-1.5 whitespace-pre-wrap text-[15px] text-stone-800">{r.details}</p>}
      {r.reply && <p className="mt-1.5 text-[15px] text-stone-700"><b>Note from {r.statusBy ?? r.toName}:</b> {r.reply}</p>}
      {r.status !== "done" && (
        <button type="button" onClick={() => setStatus({ id: r._id, status: "done" }).then(() => toast("Closed"))} className="mt-2 text-sm font-semibold text-[#7a5a26]">
          Don't need it anymore
        </button>
      )}
    </div>
  );
}

export function HelpPage() {
  const data = useQuery(api.help.list);
  const now = useNow();
  const [fTo, setFTo] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fUrg, setFUrg] = useState("");
  const [mobileCol, setMobileCol] = useState("new");
  if (!data) return null;
  const rows = data.toMe.filter(r => (!fTo || r.toEmail === fTo) && (!fFrom || r.fromEmail === fFrom) && (!fUrg || r.urgency === fUrg));
  const agents = [...new Map(data.toMe.map(r => [r.fromEmail, r.fromName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const col = (s: string) => {
    const c = rows.filter(r => r.status === s);
    // Open columns: oldest first. Done: most recent first, last 30.
    return s === "done" ? c.sort((a, b) => (b.doneAt ?? b.statusAt ?? 0) - (a.doneAt ?? a.statusAt ?? 0)).slice(0, 30) : c.sort((a, b) => a.createdAt - b.createdAt);
  };
  const overdueN = rows.filter(r => r.status !== "done" && now > helpDueAt(r.urgency, r.createdAt)).length;
  const sel = "rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <LifeBuoy className="size-7 text-[#9C7434]" />
        <h1 className="font-['Playfair_Display'] text-3xl font-bold">Help requests</h1>
        {overdueN > 0 && <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-sm font-semibold text-white">{overdueN} overdue</span>}
      </div>
      {data.canHandle && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-2 text-lg font-semibold">{data.isAdmin ? "Team board" : "Asked of you"}</h2>
            {data.isAdmin && (
              <select aria-label="Filter person asked" className={sel} value={fTo} onChange={e => setFTo(e.target.value)}>
                <option value="">Everyone asked</option>
                {data.support.map(s => <option key={s.email} value={s.email}>{s.name}</option>)}
              </select>
            )}
            <select aria-label="Filter agent" className={sel} value={fFrom} onChange={e => setFFrom(e.target.value)}>
              <option value="">All agents</option>
              {agents.map(([e, n]) => <option key={e} value={e}>{n}</option>)}
            </select>
            <select aria-label="Filter urgency" className={sel} value={fUrg} onChange={e => setFUrg(e.target.value)}>
              <option value="">Any urgency</option>
              {Object.entries(WHEN).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <p className="text-xs text-stone-500">Due: Urgent within 1 hour, Today by end of day, This week by Friday (Chicago time). Overdue cards turn red. Moving a card emails the agent with your note.</p>
          {/* Phone: one column at a time */}
          <div className="flex gap-1 overflow-x-auto rounded-full bg-stone-100 p-1 text-sm md:hidden">
            {HELP_STATUSES.map(s => (
              <button key={s} onClick={() => setMobileCol(s)} className={`shrink-0 rounded-full px-3 py-1.5 ${mobileCol === s ? "bg-white font-semibold shadow-sm" : "text-stone-600"}`}>
                {HELP_STATUS_LABEL[s]} ({rows.filter(r => r.status === s).length})
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {HELP_STATUSES.map(s => {
              const items = col(s);
              return (
                <div key={s} className={`${mobileCol === s ? "block" : "hidden"} rounded-2xl bg-stone-100/70 p-2.5 md:block`} data-testid={`help-col-${s}`}>
                  <div className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold">
                    <span className={`size-2.5 rounded-full ${COL_TONE[s]}`} /> {HELP_STATUS_LABEL[s]} <span className="text-stone-500">{rows.filter(r => r.status === s).length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.length === 0 && <div className="px-1 py-3 text-sm text-stone-500">Nothing here.</div>}
                    {items.map(r => <Card key={r._id} r={r} now={now} isAdmin={data.isAdmin} myEmail={data.myEmail} support={data.support} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <section>
        <h2 className="mb-2 text-lg font-semibold">Your requests</h2>
        <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-[#ebe5da]">
          {data.mine.length === 0 && (
            <div className="p-4 text-[15px] text-stone-600">
              Nothing yet. Use <b>Request help</b> on anyone in <Link to="/home#team" className="font-semibold text-[#7a5a26]">Your support team</Link>.
            </div>
          )}
          {data.mine.map(r => <MyRow key={r._id} r={r} />)}
        </div>
      </section>
    </div>
  );
}
