import { AlertTriangle, Check, ExternalLink, Image as ImageIcon, ImagePlus, Lightbulb, Loader2, MessageSquarePlus, PlusCircle, Rocket, Sparkles, ThumbsUp, Trash2, Wrench, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState, FieldError, LoadError, Skeleton } from "@/components/hub/FormState";
import { apiErrorMessage, fieldErrors, useApiData } from "@/lib/apiData";
import { type FeedbackItem, MAX_SHOT_BYTES, SHOT_TYPES, feedbackApi } from "@/lib/feedbackApi";
import { FEEDBACK_AREAS, FEEDBACK_CATEGORIES, FEEDBACK_KINDS, FEEDBACK_OPEN, FEEDBACK_STATUS } from "../../convex/feedbackDefs";

const errMsg = apiErrorMessage;
const MAX_TITLE = 120;
const MAX_DETAILS = 3000;
const KIND_LABEL: Record<string, string> = Object.fromEntries(FEEDBACK_KINDS.map(k => [k.id, k.label]));
const PRIO: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };
const ago = (t: number) => {
  const d = Math.floor((Date.now() - t) / 864e5);
  return d < 1 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

type Item = FeedbackItem & { viktorNote?: string };

function SuggestForm({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [area, setArea] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chip = (on: boolean) => `rounded-xl px-3.5 py-2.5 text-left ring-1 ${on ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-800 ring-stone-300"}`;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!kind) e.kind = "Pick fix, make it better, or add-on.";
    if (!area) e.area = "Pick where in the Hub.";
    if (!title.trim()) e.title = "Add a short title.";
    else if (title.trim().length < 4) e.title = "Add a short title (4 characters or more).";
    if (details.trim().length > MAX_DETAILS) e.details = `Details are too long (${MAX_DETAILS} characters max).`;
    return e;
  };
  /** Checks the picked screenshot right away (type and size). */
  const pickFile = (f: File | null) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return setFile(null);
    if (!SHOT_TYPES.includes(f.type)) return setErrors(e => ({ ...e, shot: "Screenshots must be PNG, JPG, WebP or GIF images." }));
    if (f.size > MAX_SHOT_BYTES) return setErrors(e => ({ ...e, shot: `That image is ${(f.size / 1048576).toFixed(1)} MB. Screenshots can be 4 MB at most.` }));
    setErrors(e => ({ ...e, shot: "" }));
    setFile(f);
  };
  const send = async () => {
    const errs = validate();
    setErrors(e => ({ ...errs, shot: e.shot ?? "" }));
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const shotKey = file ? await feedbackApi.uploadShot(file) : null;
      await feedbackApi.create({ kind, area, title: title.trim(), details: details.trim(), blocking: kind === "fix" ? blocking : undefined, shotKey });
      toast.success(blocking && kind === "fix" ? "Sent. The admins got an email because it's blocking you." : "Thanks! It's in the weekly review.");
      setKind(""); setArea(""); setTitle(""); setDetails(""); setBlocking(false); setFile(null); setErrors({});
      onDone();
    } catch (e) {
      setErrors(fieldErrors(e));
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const clear = (k: string) => errors[k] && setErrors(e => ({ ...e, [k]: "" }));

  return (
    <section className="space-y-5 rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]" data-testid="feedback-form">
      <div>
        <div className="mb-2 text-[15px] font-semibold">What kind?</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {FEEDBACK_KINDS.map(k => (
            <button key={k.id} type="button" onClick={() => { setKind(k.id); clear("kind"); }} aria-pressed={kind === k.id} className={chip(kind === k.id)} data-testid={`kind-${k.id}`}>
              <div className="text-[15px] font-semibold">{k.label}</div>
              <div className={`text-sm ${kind === k.id ? "text-stone-300" : "text-stone-600"}`}>{k.sub}</div>
            </button>
          ))}
        </div>
        <FieldError msg={errors.kind} />
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[15px] font-semibold">Where in the Hub? *</span>
        <select aria-label="Where in the Hub" aria-invalid={!!errors.area} value={area} onChange={e => { setArea(e.target.value); clear("area"); }} className={`w-full rounded-xl border bg-white p-3 text-[16px] ${errors.area ? "border-red-400" : "border-stone-300"}`}>
          <option value="">Pick one…</option>
          {FEEDBACK_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <FieldError msg={errors.area} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[15px] font-semibold">In one line *</span>
        <input value={title} onChange={e => { setTitle(e.target.value); clear("title"); }} maxLength={MAX_TITLE} aria-invalid={!!errors.title} placeholder={kind === "fix" ? "e.g. Today doesn't show my showings" : "e.g. Add a buyer net sheet calculator"} className={`w-full rounded-xl border p-3 text-[16px] outline-none focus:border-[#9C7434] ${errors.title ? "border-red-400" : "border-stone-300"}`} />
        <span className="flex justify-between gap-3"><FieldError msg={errors.title} /><span className="ml-auto mt-1 text-xs text-stone-500">{title.length}/{MAX_TITLE}</span></span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[15px] font-semibold">Details <span className="font-normal text-stone-500">(optional)</span></span>
        <textarea value={details} onChange={e => { setDetails(e.target.value); clear("details"); }} maxLength={MAX_DETAILS} rows={4} aria-invalid={!!errors.details} placeholder="What happened or what you want, and how it would help you or your clients…" className={`w-full rounded-xl border p-3 text-[16px] outline-none focus:border-[#9C7434] ${errors.details ? "border-red-400" : "border-stone-300"}`} />
        <span className="flex justify-between gap-3"><FieldError msg={errors.details} /><span className="ml-auto mt-1 text-xs text-stone-500">{details.length}/{MAX_DETAILS}</span></span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={e => pickFile(e.target.files?.[0] ?? null)} data-testid="feedback-file" />
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold ring-1 ring-stone-300">
          <ImagePlus className="size-4" /> {file ? "Change screenshot" : "Add a screenshot"}
        </button>
        {file && (
          <span className="inline-flex items-center gap-1 text-sm text-stone-700">
            {file.name.slice(0, 30)}
            <button type="button" aria-label="Remove screenshot" onClick={() => setFile(null)}><X className="size-4" /></button>
          </span>
        )}
        <span className="text-xs text-stone-500">PNG, JPG, WebP or GIF, up to 4 MB.</span>
        <div className="basis-full"><FieldError msg={errors.shot} /></div>
      </div>
      {kind === "fix" && (
        <label className="flex items-start gap-3 rounded-xl bg-red-50 p-3 text-[15px] text-red-900">
          <input type="checkbox" checked={blocking} onChange={e => setBlocking(e.target.checked)} className="mt-1 size-4" />
          <span><b>This is stopping me from working.</b> The admins get an email right away instead of waiting for the weekly review.</span>
        </label>
      )}
      <button type="button" disabled={busy} onClick={send} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#9C7434] px-5 py-3 text-[16px] font-semibold text-white disabled:opacity-60 sm:w-auto">
        {busy && <Loader2 className="size-4 animate-spin" />}{busy ? (file ? "Uploading…" : "Sending…") : "Send to the review"}
      </button>
    </section>
  );
}

// Status badge: soft tint + coloured dot (Submitted → In review → Approved → Being built → Live).
const STATUS_BADGE: Record<string, { cls: string; dot: string }> = {
  new: { cls: "bg-stone-100 text-stone-700 ring-stone-200", dot: "bg-stone-400" },
  reviewed: { cls: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  approved: { cls: "bg-[#9C7434]/10 text-[#7A5A25] ring-[#9C7434]/25", dot: "bg-[#9C7434]" },
  building: { cls: "bg-sky-50 text-sky-800 ring-sky-200", dot: "bg-sky-500" },
  shipped: { cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  later: { cls: "bg-stone-50 text-stone-500 ring-stone-200", dot: "bg-stone-300" },
  declined: { cls: "bg-stone-50 text-stone-500 ring-stone-200", dot: "bg-stone-300" },
  merged: { cls: "bg-stone-50 text-stone-500 ring-stone-200", dot: "bg-stone-300" },
};
const KIND_ICON: Record<string, typeof Wrench> = { fix: Wrench, improve: Sparkles, addon: PlusCircle };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";
const Tag = ({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "red" }) => (
  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12.5px] font-medium ${tone === "red" ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-[#F7F5F1] text-stone-700 ring-1 ring-[#ebe5da]"}`}>{children}</span>
);

function IdeaRow({ r, admin, isAdmin }: { r: Item; admin?: boolean; isAdmin?: boolean }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [shotOpen, setShotOpen] = useState(false);
  const noteErr = note.trim().length > 1000 ? "Note is too long (1000 characters max)." : "";
  const run = (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    return fn().then(() => { if (ok) toast.success(ok); }).catch(e => toast.error(errMsg(e))).finally(() => setBusy(false));
  };
  const act = (status: string, msg: string) => {
    if (noteErr) return;
    void run(async () => { await feedbackApi.decide(r._id, status, note.trim() || null); setNote(""); }, msg);
  };
  const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.new;
  const KindIcon = KIND_ICON[r.kind] ?? Lightbulb;
  const long = r.details.length > 240 || r.details.split("\n").length > 3;
  const canDelete = isAdmin || (r.mine && r.status === "new");
  const deciding = admin && FEEDBACK_OPEN.includes(r.status);
  return (
    <article className={`rounded-2xl bg-white ring-1 transition-shadow hover:shadow-[0_4px_18px_-6px_rgba(10,10,10,0.12)] ${r.blocking && r.status !== "shipped" ? "ring-red-200" : "ring-[#ebe5da]"}`} data-testid="idea-row">
      <div className="flex gap-4 p-4 sm:p-5">
        {/* Me too */}
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => feedbackApi.vote(r._id))}
          aria-label={r.voted ? "Remove my vote" : "Me too"}
          aria-pressed={r.voted}
          title={r.voted ? "You voted for this. Tap to remove your vote." : "Me too"}
          className={`group flex h-[68px] w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xl text-[15px] font-bold transition disabled:opacity-60 ${r.voted ? "bg-[#9C7434] text-white shadow-sm" : "bg-[#F7F5F1] text-stone-700 ring-1 ring-[#ebe5da] hover:ring-[#9C7434]/50"}`}
        >
          <ThumbsUp className={`size-[18px] transition-transform group-active:scale-90 ${r.voted ? "fill-white/25" : ""}`} />
          <span className="leading-none tabular-nums">{r.votes}</span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 text-[17px] font-semibold leading-snug text-[#1F1E1B]">{r.title}</h3>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ring-1 ${badge.cls}`}>
              <span className={`size-1.5 rounded-full ${badge.dot}`} aria-hidden />{FEEDBACK_STATUS[r.status] ?? r.status}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-stone-500">
            <span className="grid size-6 place-items-center rounded-full bg-[#0A0A0A] text-[10px] font-semibold text-[#D9BC8C]" aria-hidden>{initials(r.fromName)}</span>
            <span className="font-medium text-stone-700">{r.mine ? "You" : r.fromName}</span>
            <span aria-hidden>·</span>
            <span>{ago(r.createdAt)}</span>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Tag><KindIcon className="size-3.5 text-[#9C7434]" />{KIND_LABEL[r.kind] ?? r.kind}</Tag>
            <Tag>{r.area}</Tag>
            <Tag>{FEEDBACK_CATEGORIES[r.category] ?? r.category}</Tag>
            {r.blocking && r.status !== "shipped" && <Tag tone="red"><AlertTriangle className="size-3.5" />Blocking work</Tag>}
            {admin && r.priority && <Tag>{PRIO[r.priority] ?? r.priority} priority</Tag>}
            {admin && r.estimate && <Tag>{r.estimate}</Tag>}
          </div>

          {r.details && (
            <div className="mt-3">
              <p className={`whitespace-pre-wrap text-[15px] leading-relaxed text-stone-700 ${long && !expanded ? "line-clamp-3" : ""}`}>{r.details}</p>
              {long && (
                <button type="button" onClick={() => setExpanded(v => !v)} className="mt-1 text-[13.5px] font-semibold text-[#7A5A25] hover:underline">
                  {expanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}

          {r.shotUrl && (
            <button type="button" onClick={() => setShotOpen(true)} className="group relative mt-3 block h-28 w-44 overflow-hidden rounded-xl bg-stone-100 ring-1 ring-[#ebe5da]" aria-label="View screenshot">
              <img src={r.shotUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4 text-[11.5px] font-medium text-white">
                <ImageIcon className="size-3.5" /> Screenshot
              </span>
            </button>
          )}

          {admin && r.viktorNote && <p className="mt-3 rounded-lg bg-[#F7F5F1] p-2.5 text-[14px] text-stone-700"><b>Review note:</b> {r.viktorNote}</p>}
          {r.decisionNote && (
            <blockquote className="mt-3 rounded-r-lg border-l-[3px] border-[#9C7434] bg-[#F7F5F1] px-3 py-2 text-[14.5px] text-stone-700">
              <span className="mb-0.5 block text-[12px] font-semibold uppercase tracking-wide text-[#7A5A25]">Note from {r.decidedBy ?? "the team"}</span>
              {r.decisionNote}
            </blockquote>
          )}
        </div>
      </div>

      {(deciding || canDelete) && (
        <div className="space-y-2.5 rounded-b-2xl border-t border-[#f0ebe2] bg-[#FCFBF9] px-4 py-3 sm:px-5">
          {deciding && (
            <>
              <input value={note} onChange={e => setNote(e.target.value.slice(0, 1001))} aria-label="Note to the agent" aria-invalid={!!noteErr} placeholder="Note to the agent (optional)" className={`w-full rounded-lg border bg-white px-3 py-2 text-[14.5px] outline-none focus:border-[#9C7434] focus:ring-2 focus:ring-[#9C7434]/15 ${noteErr ? "border-red-400" : "border-stone-200"}`} />
              <FieldError msg={noteErr} />
            </>
          )}
          <div className={`flex flex-wrap items-center gap-2 ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {deciding && r.status !== "approved" && r.status !== "building" && (
              <button type="button" onClick={() => act("approved", "Approved. It goes into the next update.")} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A0A0A] px-3.5 py-2 text-[13.5px] font-semibold text-white"><Check className="size-4" /> Approve</button>
            )}
            {deciding && (r.status === "approved" || r.status === "building") && (
              <button type="button" onClick={() => act("shipped", "Marked live. The agent gets an email.")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[13.5px] font-semibold text-white"><Rocket className="size-4" /> Mark live</button>
            )}
            {deciding && <button type="button" onClick={() => act("later", "Moved to Not now")} className="rounded-lg bg-white px-3.5 py-2 text-[13.5px] font-semibold text-stone-700 ring-1 ring-stone-200 hover:ring-stone-300">Not now</button>}
            {deciding && <button type="button" onClick={() => act("declined", "Declined")} className="rounded-lg bg-white px-3.5 py-2 text-[13.5px] font-semibold text-stone-500 ring-1 ring-stone-200 hover:ring-stone-300">Decline</button>}
            {busy && <Loader2 className="size-4 animate-spin text-stone-400" />}
            {canDelete && (
              <button type="button" onClick={() => confirm("Delete this idea?") && run(() => feedbackApi.remove(r._id), "Deleted")} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium text-stone-500 hover:bg-red-50 hover:text-red-700">
                <Trash2 className="size-4" /> Delete
              </button>
            )}
          </div>
        </div>
      )}

      {shotOpen && r.shotUrl && (
        <Dialog open onOpenChange={setShotOpen}>
          <DialogContent className="max-w-3xl p-3">
            <DialogTitle className="sr-only">Screenshot for “{r.title}”</DialogTitle>
            <img src={r.shotUrl} alt={`Screenshot for ${r.title}`} className="max-h-[80svh] w-full rounded-lg object-contain" />
            <a href={r.shotUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-start text-[13.5px] font-semibold text-[#7A5A25] hover:underline">
              <ExternalLink className="size-3.5" /> Open full size
            </a>
          </DialogContent>
        </Dialog>
      )}
    </article>
  );
}

export function FeedbackPage() {
  const { data, error, reload } = useApiData("feedback:list", () => feedbackApi.list(), { pollMs: 120_000 });
  const [tab, setTab] = useState<"ideas" | "review">("ideas");
  const [filter, setFilter] = useState("open");
  const review = useMemo(() => (data?.items ?? []).filter(r => ["new", "reviewed"].includes(r.status)), [data]);
  const approved = useMemo(() => (data?.items ?? []).filter(r => ["approved", "building"].includes(r.status)), [data]);
  if (!data) return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3"><Lightbulb className="size-7 text-[#9C7434]" /><h1 className="font-['Playfair_Display'] text-3xl font-bold">Suggest a fix or add-on</h1></div>
      {error ? <LoadError error={error} onRetry={() => void reload()} what="the ideas" /> : <Skeleton rows={3} className="h-28" />}
    </div>
  );
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
        Tell us what's broken or what would make the Hub better. The team sorts and reviews ideas each week and approves what gets built. You'll get an email when yours is approved or live. If someone already posted your idea, tap <b>👍 Me too</b> so it rises to the top.
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
            <div className="space-y-3">
              {ideas.length === 0 ? (
                <div className="p-3">
                  <EmptyState icon={<MessageSquarePlus className="size-8" />} title={filter === "mine" ? "You haven't posted an idea yet" : filter === "shipped" ? "Nothing live yet" : "No ideas here yet"}>
                    {filter === "shipped" ? "Ideas show up here once they're built." : "Use the form above to suggest a fix or an add-on. Be the first."}
                  </EmptyState>
                </div>
              ) : ideas.map(r => <IdeaRow key={r._id} r={r} isAdmin={data.isAdmin} />)}
            </div>
          </section>
        </>
      )}

      {tab === "review" && data.isAdmin && (
        <section className="space-y-6" data-testid="review-panel">
          <p className="text-[15px] text-stone-700">
            Ideas are sorted into categories automatically when they're posted. Approve, put off or decline them here; the agent gets an email. Approved items go into the next Hub update.
          </p>
          {byCat.length === 0 && <EmptyState icon={<Check className="size-8" />} title="Nothing waiting for review">New ideas from agents show up here.</EmptyState>}
          {byCat.map(([c, rows]) => (
            <div key={c} className="space-y-2">
              <h3 className="text-[16px] font-semibold">{FEEDBACK_CATEGORIES[c]} <span className="font-normal text-stone-500">({rows.length})</span></h3>
              <div className="space-y-3">{rows.map(r => <IdeaRow key={r._id} r={r} admin isAdmin />)}</div>
            </div>
          ))}
          {approved.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[16px] font-semibold">Approved, next update <span className="font-normal text-stone-500">({approved.length})</span></h3>
              <div className="space-y-3">{approved.map(r => <IdeaRow key={r._id} r={r} admin isAdmin />)}</div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
