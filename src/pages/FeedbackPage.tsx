import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, ImagePlus, Lightbulb, ThumbsUp, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FEEDBACK_AREAS, FEEDBACK_CATEGORIES, FEEDBACK_KINDS, FEEDBACK_OPEN, FEEDBACK_STATUS } from "../../convex/feedbackDefs";

const errMsg = (e: unknown) => String((e as Error)?.message ?? e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? "Something went wrong";
const STATUS_TONE: Record<string, string> = {
  new: "bg-stone-200 text-stone-800",
  reviewed: "bg-amber-100 text-amber-900",
  approved: "bg-[#9C7434] text-white",
  building: "bg-[#0A0A0A] text-white",
  shipped: "bg-emerald-600 text-white",
  later: "bg-stone-100 text-stone-600",
  declined: "bg-stone-100 text-stone-500",
  merged: "bg-stone-100 text-stone-500",
};
const KIND_LABEL: Record<string, string> = Object.fromEntries(FEEDBACK_KINDS.map(k => [k.id, k.label]));
const PRIO: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };
const ago = (t: number) => {
  const d = Math.floor((Date.now() - t) / 864e5);
  return d < 1 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

type Data = FunctionReturnType<typeof api.feedback.list>;
type Item = Data["items"][number];

function SuggestForm({ onDone }: { onDone: () => void }) {
  const create = useMutation(api.feedback.create);
  const uploadUrl = useMutation(api.feedback.uploadUrl);
  const [kind, setKind] = useState("");
  const [area, setArea] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chip = (on: boolean) => `rounded-xl px-3.5 py-2.5 text-left ring-1 ${on ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-800 ring-stone-300"}`;

  const send = async () => {
    if (!kind) return toast.error("Pick fix, make it better, or add-on");
    if (!area) return toast.error("Pick where in the Hub");
    if (title.trim().length < 4) return toast.error("Add a short title");
    setBusy(true);
    try {
      let shotId: Id<"_storage"> | undefined;
      if (file) {
        const url = await uploadUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!res.ok) throw new Error("Screenshot upload failed");
        shotId = (await res.json()).storageId;
      }
      await create({ kind, area, title, details, blocking: kind === "fix" ? blocking : undefined, shotId });
      toast.success(blocking && kind === "fix" ? "Sent. Michael got an email because it's blocking you." : "Thanks! It's in Michael's weekly review.");
      setKind(""); setArea(""); setTitle(""); setDetails(""); setBlocking(false); setFile(null);
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-5 rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]" data-testid="feedback-form">
      <div>
        <div className="mb-2 text-[15px] font-semibold">What kind?</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {FEEDBACK_KINDS.map(k => (
            <button key={k.id} type="button" onClick={() => setKind(k.id)} className={chip(kind === k.id)} data-testid={`kind-${k.id}`}>
              <div className="text-[15px] font-semibold">{k.label}</div>
              <div className={`text-sm ${kind === k.id ? "text-stone-300" : "text-stone-600"}`}>{k.sub}</div>
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[15px] font-semibold">Where in the Hub?</span>
        <select aria-label="Where in the Hub" value={area} onChange={e => setArea(e.target.value)} className="w-full rounded-xl border border-stone-300 bg-white p-3 text-[16px]">
          <option value="">Pick one…</option>
          {FEEDBACK_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[15px] font-semibold">In one line</span>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder={kind === "fix" ? "e.g. Today doesn't show my showings" : "e.g. Add a buyer net sheet calculator"} className="w-full rounded-xl border border-stone-300 p-3 text-[16px] outline-none focus:border-[#9C7434]" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[15px] font-semibold">Details <span className="font-normal text-stone-500">(optional)</span></span>
        <textarea value={details} onChange={e => setDetails(e.target.value)} rows={4} placeholder="What happened or what you want, and how it would help you or your clients…" className="w-full rounded-xl border border-stone-300 p-3 text-[16px] outline-none focus:border-[#9C7434]" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} data-testid="feedback-file" />
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold ring-1 ring-stone-300">
          <ImagePlus className="size-4" /> {file ? "Change screenshot" : "Add a screenshot"}
        </button>
        {file && (
          <span className="inline-flex items-center gap-1 text-sm text-stone-700">
            {file.name.slice(0, 30)}
            <button type="button" aria-label="Remove screenshot" onClick={() => setFile(null)}><X className="size-4" /></button>
          </span>
        )}
      </div>
      {kind === "fix" && (
        <label className="flex items-start gap-3 rounded-xl bg-red-50 p-3 text-[15px] text-red-900">
          <input type="checkbox" checked={blocking} onChange={e => setBlocking(e.target.checked)} className="mt-1 size-4" />
          <span><b>This is stopping me from working.</b> Michael gets an email right away instead of waiting for the weekly review.</span>
        </label>
      )}
      <button type="button" disabled={busy} onClick={send} className="w-full rounded-xl bg-[#9C7434] px-5 py-3 text-[16px] font-semibold text-white disabled:opacity-60 sm:w-auto">
        {busy ? "Sending…" : "Send to Michael's review"}
      </button>
    </section>
  );
}

function IdeaRow({ r, admin, isAdmin }: { r: Item; admin?: boolean; isAdmin?: boolean }) {
  const vote = useMutation(api.feedback.vote);
  const decide = useMutation(api.feedback.decide);
  const remove = useMutation(api.feedback.remove);
  const [note, setNote] = useState("");
  const act = (status: string, msg: string) =>
    decide({ id: r._id, status, note: note || undefined })
      .then(() => { setNote(""); toast.success(msg); })
      .catch(e => toast.error(errMsg(e)));
  return (
    <div className="p-4" data-testid="idea-row">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => vote({ id: r._id }).catch(e => toast.error(errMsg(e)))}
          className={`flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-sm font-bold ring-1 ${r.voted ? "bg-[#9C7434] text-white ring-[#9C7434]" : "bg-white text-stone-700 ring-stone-300"}`}
          aria-label={r.voted ? "Remove my vote" : "Me too"}
          title="Me too"
        >
          <ThumbsUp className="size-4" />
          {r.votes}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${STATUS_TONE[r.status] ?? STATUS_TONE.new}`}>{FEEDBACK_STATUS[r.status] ?? r.status}</span>
            <span className="rounded-full bg-[#F7F5F1] px-2.5 py-0.5 text-[13px] font-medium text-stone-700 ring-1 ring-[#ebe5da]">{FEEDBACK_CATEGORIES[r.category] ?? r.category}</span>
            {r.blocking && r.status !== "shipped" && <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">Blocking</span>}
            {admin && r.priority && <span className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold ring-1 ring-stone-300">{PRIO[r.priority] ?? r.priority} priority</span>}
            {admin && r.estimate && <span className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold ring-1 ring-stone-300">{r.estimate}</span>}
          </div>
          <div className="mt-1.5 text-[16px] font-semibold leading-snug">{r.title}</div>
          <div className="text-sm text-stone-600">{KIND_LABEL[r.kind] ?? r.kind} · {r.area} · {r.fromName} · {ago(r.createdAt)}</div>
          {r.details && <p className="mt-1.5 whitespace-pre-wrap text-[15px] text-stone-800">{r.details}</p>}
          {r.shotUrl && (
            <a href={r.shotUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block">
              <img src={r.shotUrl} alt="Screenshot" className="max-h-40 rounded-lg ring-1 ring-stone-200" />
            </a>
          )}
          {admin && r.viktorNote && <p className="mt-2 rounded-lg bg-[#F7F5F1] p-2.5 text-[15px] text-stone-800"><b>Viktor:</b> {r.viktorNote}</p>}
          {r.decisionNote && <p className="mt-1.5 text-[15px] text-stone-700"><b>Note from {r.decidedBy ?? "Michael"}:</b> {r.decisionNote}</p>}
          {admin && FEEDBACK_OPEN.includes(r.status) && (
            <div className="mt-3 space-y-2">
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note to the agent (optional)" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-[15px] outline-none focus:border-[#9C7434]" />
              <div className="flex flex-wrap gap-2">
                {r.status !== "approved" && r.status !== "building" && (
                  <button type="button" onClick={() => act("approved", "Approved. Viktor builds it in the next update.")} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A0A0A] px-3.5 py-2 text-sm font-semibold text-white"><Check className="size-4" /> Approve</button>
                )}
                {(r.status === "approved" || r.status === "building") && (
                  <button type="button" onClick={() => act("shipped", "Marked live. The agent gets an email.")} className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white">Mark live</button>
                )}
                <button type="button" onClick={() => act("later", "Moved to Not now")} className="rounded-lg px-3.5 py-2 text-sm font-semibold ring-1 ring-stone-300">Not now</button>
                <button type="button" onClick={() => act("declined", "Declined")} className="rounded-lg px-3.5 py-2 text-sm font-semibold text-stone-600 ring-1 ring-stone-300">Decline</button>
              </div>
            </div>
          )}
          {(isAdmin || (r.mine && r.status === "new")) && (
            <button type="button" onClick={() => confirm("Delete this idea?") && remove({ id: r._id }).then(() => toast("Deleted")).catch(e => toast.error(errMsg(e)))} className="mt-2 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-red-700">
              <Trash2 className="size-3.5" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function FeedbackPage() {
  const data = useQuery(api.feedback.list);
  const [tab, setTab] = useState<"ideas" | "review">("ideas");
  const [filter, setFilter] = useState("open");
  const review = useMemo(() => (data?.items ?? []).filter(r => ["new", "reviewed"].includes(r.status)), [data]);
  const approved = useMemo(() => (data?.items ?? []).filter(r => ["approved", "building"].includes(r.status)), [data]);
  if (!data) return null;
  const ideas = data.items
    .filter(r => r.status !== "merged")
    .filter(r => (filter === "open" ? FEEDBACK_OPEN.includes(r.status) : filter === "mine" ? r.mine : filter === "shipped" ? r.status === "shipped" : true))
    .sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt);
  const byCat = Object.keys(FEEDBACK_CATEGORIES)
    .map(c => [c, review.filter(r => r.category === c).sort((a, b) => Number(!!b.blocking) - Number(!!a.blocking) || b.votes - a.votes)] as const)
    .filter(([, rows]) => rows.length);
  const tabBtn = (on: boolean) => `rounded-full px-4 py-2 text-[15px] font-semibold ${on ? "bg-[#0A0A0A] text-white" : "text-stone-700 ring-1 ring-stone-300"}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Lightbulb className="size-7 text-[#9C7434]" />
        <h1 className="font-['Playfair_Display'] text-3xl font-bold">Suggest a fix or add-on</h1>
      </div>
      <p className="max-w-2xl text-[16px] text-stone-700">
        Tell us what's broken or what would make the Hub better. Viktor sorts every idea into categories each week, and Michael reviews and approves what gets built. You'll get an email when yours is approved or live. If someone already posted your idea, tap <b>👍 Me too</b> so it rises to the top.
      </p>
      {data.isAdmin && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={tabBtn(tab === "ideas")} onClick={() => setTab("ideas")}>Team ideas</button>
          <button type="button" className={tabBtn(tab === "review")} onClick={() => setTab("review")} data-testid="review-tab">
            Review {review.length > 0 && <span className="ml-1 rounded-full bg-[#D9BC8C] px-1.5 text-xs font-bold text-black">{review.length}</span>}
          </button>
        </div>
      )}

      {tab === "ideas" && (
        <>
          <SuggestForm onDone={() => setFilter("open")} />
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-2 text-lg font-semibold">Ideas from the team</h2>
              <select aria-label="Filter ideas" value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm">
                <option value="open">Open</option>
                <option value="mine">Mine</option>
                <option value="shipped">Live</option>
                <option value="all">All</option>
              </select>
            </div>
            <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-[#ebe5da]">
              {ideas.length === 0 ? <p className="p-5 text-[15px] text-stone-600">No ideas here yet. Be the first.</p> : ideas.map(r => <IdeaRow key={r._id} r={r} isAdmin={data.isAdmin} />)}
            </div>
          </section>
        </>
      )}

      {tab === "review" && data.isAdmin && (
        <section className="space-y-6" data-testid="review-panel">
          <p className="text-[15px] text-stone-700">
            Viktor posts the weekly summary in #team-app-design every Monday morning with categories, duplicates merged and a credit estimate per item. Approve here or reply in that Slack thread. Approved items go into the next Hub update.
          </p>
          {byCat.length === 0 && <p className="rounded-2xl bg-white p-5 text-[15px] text-stone-600 ring-1 ring-[#ebe5da]">Nothing waiting for review.</p>}
          {byCat.map(([c, rows]) => (
            <div key={c} className="space-y-2">
              <h3 className="text-[16px] font-semibold">{FEEDBACK_CATEGORIES[c]} <span className="font-normal text-stone-500">({rows.length})</span></h3>
              <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-[#ebe5da]">{rows.map(r => <IdeaRow key={r._id} r={r} admin isAdmin />)}</div>
            </div>
          ))}
          {approved.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[16px] font-semibold">Approved, next update <span className="font-normal text-stone-500">({approved.length})</span></h3>
              <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-[#ebe5da]">{approved.map(r => <IdeaRow key={r._id} r={r} admin isAdmin />)}</div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
