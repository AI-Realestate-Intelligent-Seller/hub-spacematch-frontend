import { useAction, useMutation, useQuery } from "convex/react";
import { CalendarCheck, CalendarClock, ChevronLeft, ClipboardPaste, Headset, Mail, MessageSquare, Phone, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import {
  type Busy,
  CLOSE_REASONS,
  DESK_SOURCES,
  type Hours,
  LANGUAGES,
  LEAD_TYPES,
  MEETING_KINDS,
  OUTCOMES,
  RATINGS,
  detailLines,
  fieldsFor,
  fmtDay,
  fmtTime,
  fmtWhen,
  kindLabel,
  openSlots,
  outcomeLabel,
  parseLeadText,
} from "../../convex/deskDefs";
import { HoursEditor, RatingChip, StageChip, ago, errMsg, hoursSummary, input, label, typeLabel } from "@/components/hub/DeskBits";

type Lead = Doc<"deskLeads">;
type Board = NonNullable<ReturnType<typeof useBoard>>;
type Agent = Board["agents"][number];
type Avail = { busy: Record<string, Busy[]>; errors: Record<string, string>; checkedAt: number };

const useBoard = () => useQuery(api.desk.board);

const TABS = [
  { id: "vet", label: "To vet" },
  { id: "booked", label: "Booked" },
  { id: "rebook", label: "Rebook" },
  { id: "followup", label: "How did it go?" },
  { id: "done", label: "Done & closed" },
  { id: "report", label: "Report" },
  { id: "agents", label: "Agents & hours" },
] as const;

const inTab = (l: Lead, tab: string, now: number) => {
  const end = (l.apptStart ?? 0) + (l.apptMinutes ?? 60) * 60000;
  if (tab === "vet") return l.stage === "to_vet";
  if (tab === "booked") return (l.stage === "booked" || l.stage === "accepted") && end > now;
  if (tab === "rebook") return l.stage === "needs_agent";
  if (tab === "followup") return (l.stage === "booked" || l.stage === "accepted") && end <= now;
  if (tab === "done") return l.stage === "done" || l.stage === "closed";
  return false;
};

export function DeskPage() {
  const board = useBoard();
  const me = useQuery(api.hubMe.me);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "vet";
  const open = params.get("open");
  const [avail, setAvail] = useState<Avail | null>(null);
  const [availErr, setAvailErr] = useState("");
  const fetchAvail = useAction(api.deskActions.availability);
  const now = Date.now();

  const loadAvail = useCallback(() => {
    setAvailErr("");
    fetchAvail({ from: Date.now(), days: 8 })
      .then(setAvail)
      .catch(e => setAvailErr(errMsg(e)));
  }, [fetchAvail]);

  if (me && !me.isAdmin && !me.isOps) {
    return <p className="text-[15px] text-stone-700">The Lead Desk is for admins and ops. Your booked appointments are in <Link className="font-semibold text-[#7a5a26] underline" to="/appointments">My appointments</Link>.</p>;
  }
  if (!board) return null;
  const set = (k: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [a, b] of Object.entries(k)) b === null ? p.delete(a) : p.set(a, b);
    setParams(p, { replace: false });
  };
  const count = (t: string) => board.rows.filter(l => inTab(l, t, now)).length;
  const rows = board.rows
    .filter(l => inTab(l, tab, now))
    .sort((a, b) => (tab === "booked" ? (a.apptStart ?? 0) - (b.apptStart ?? 0) : tab === "done" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
  const selected = open && open !== "new" ? board.rows.find(l => l._id === open) : undefined;

  return (
    <div className="space-y-5" data-testid="desk-page">
      <div className="flex flex-wrap items-center gap-3">
        <Headset className="size-7 text-[#9C7434]" />
        <h1 className="font-['Playfair_Display'] text-3xl font-bold">Lead Desk</h1>
        <span className="text-[15px] text-stone-600">Vet any lead, book an agent, track what happened.</span>
        {me?.canNewLeads && <Link to="/new-leads" className="ml-auto rounded-xl bg-white px-4 py-2.5 text-[15px] font-semibold ring-1 ring-[#ebe5da]" data-testid="desk-new-leads">New Leads tracker</Link>}
        <button type="button" onClick={() => set({ open: "new" })} className="flex items-center gap-1.5 rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-[15px] font-semibold text-white" data-testid="desk-new">
          <Plus className="size-4" /> New lead
        </button>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map(t => {
          const n = ["report", "agents"].includes(t.id) ? 0 : count(t.id);
          const alert = (t.id === "rebook" || t.id === "followup") && n > 0;
          return (
            <button key={t.id} type="button" onClick={() => set({ tab: t.id, open: null })}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[15px] font-semibold ${tab === t.id ? "bg-[#9C7434] text-white" : "bg-white text-stone-700 ring-1 ring-[#ebe5da]"}`}>
              {t.label}{n ? <span className={`ml-1.5 rounded-full px-1.5 text-xs ${tab === t.id ? "bg-white/25" : alert ? "bg-red-600 text-white" : "bg-stone-200"}`}>{n}</span> : null}
            </button>
          );
        })}
      </div>

      {open === "new" ? (
        <div className="max-w-2xl">
          <BackLink onClick={() => set({ open: null })} />
          <LeadEditor onSaved={id => set({ open: id, tab: "vet" })} />
        </div>
      ) : selected ? (
        <div>
          <BackLink onClick={() => set({ open: null })} />
          <LeadDetail key={selected._id} lead={selected} board={board} avail={avail} availErr={availErr} loadAvail={loadAvail} />
        </div>
      ) : tab === "report" ? (
        <Report rows={board.rows} />
      ) : tab === "agents" ? (
        <AgentsTab agents={board.agents} />
      ) : (
        <LeadList rows={rows} tab={tab} onOpen={id => set({ open: id })} />
      )}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-3 flex items-center gap-1 text-[15px] font-semibold text-[#7a5a26]">
      <ChevronLeft className="size-4" /> Back to the list
    </button>
  );
}

function LeadList({ rows, tab, onOpen }: { rows: Lead[]; tab: string; onOpen: (id: string) => void }) {
  if (!rows.length) {
    const empty: Record<string, string> = {
      vet: "Nothing to vet. New Peak Presence YouTube leads show up here on their own; add calls and referrals with New lead.",
      booked: "No upcoming appointments.",
      rebook: "Nothing to rebook.",
      followup: "Every past appointment has an outcome.",
      done: "Nothing here yet.",
    };
    return <p className="rounded-2xl bg-white p-6 text-[15px] text-stone-600 ring-1 ring-[#ebe5da]">{empty[tab]}</p>;
  }
  return (
    <div className="divide-y divide-[#efe9df] overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe5da]">
      {rows.map(l => (
        <button key={l._id} type="button" onClick={() => onOpen(l._id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-4 text-left hover:bg-[#faf8f4]" data-testid="desk-row">
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[16px] font-semibold">{l.name}</span>
              <span className="text-sm text-stone-600">{typeLabel(l.leadType)}</span>
              <RatingChip r={l.rating} />
              {tab !== "vet" && <StageChip s={l.stage} />}
            </span>
            <span className="mt-0.5 block truncate text-sm text-stone-600">
              {l.apptStart && tab !== "vet" ? `${fmtWhen(l.apptStart)} · ${l.agentName} · ${kindLabel(l.apptKind ?? "")}` : l.details.address ?? l.details.areas ?? l.phone ?? ""}
              {l.stage === "needs_agent" && l.declineReason ? ` · ${l.declineReason}` : ""}
              {l.stage === "done" && l.outcome ? ` · ${outcomeLabel(l.outcome)}` : ""}
              {l.stage === "closed" && l.closeReason ? ` · ${l.closeReason}` : ""}
            </span>
          </span>
          <span className="text-right text-sm text-stone-500">
            <span className="block">{l.source}</span>
            <span className="block">{ago(l.createdAt)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ── New / edit lead ───────────────────────────────────────────────────
function LeadEditor({ lead, onSaved }: { lead?: Lead; onSaved: (id: string) => void }) {
  const create = useMutation(api.desk.create);
  const update = useMutation(api.desk.update);
  const [f, setF] = useState({
    source: lead?.source ?? "Office call",
    leadType: lead?.leadType ?? "seller",
    name: lead?.name ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    language: lead?.language ?? "English",
    rating: lead?.rating ?? "",
    notes: lead?.notes ?? "",
  });
  const [details, setDetails] = useState<Record<string, string>>(lead?.details ?? {});
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const fields = fieldsFor(f.leadType);
  const applyPaste = () => {
    const p = parseLeadText(paste);
    setF(x => ({ ...x, name: x.name || p.name || "", phone: x.phone || p.phone || "", email: x.email || p.email || "" }));
    if (p.address) setDetails(d => ({ ...d, address: d.address || p.address || "" }));
    toast.success(`Filled in ${[p.name && "name", p.phone && "phone", p.email && "email", p.address && "address"].filter(Boolean).join(", ") || "nothing (no name/phone found)"}`);
  };
  const save = () => {
    setBusy(true);
    const kept = Object.fromEntries(Object.entries(details).filter(([k]) => fields.some(x => x.id === k)));
    const args = { ...f, details: kept, rating: f.rating || undefined, rawText: lead ? undefined : paste || undefined };
    (lead ? update({ id: lead._id, ...args }).then(() => lead._id) : create(args))
      .then(id => { toast.success(lead ? "Saved" : "Lead added"); onSaved(id as string); })
      .catch(e => toast.error(errMsg(e)))
      .finally(() => setBusy(false));
  };
  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da] md:p-5" data-testid="lead-editor">
      {!lead && (
        <details className="rounded-xl bg-[#F7F5F1] p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-[15px] font-semibold"><ClipboardPaste className="size-4 text-[#9C7434]" /> Paste a lead email or text to fill this in</summary>
          <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={4} className={`${input} mt-2`} placeholder="Name: … Phone: … Address: …" />
          <button type="button" onClick={applyPaste} className="mt-2 rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-stone-300">Fill in</button>
        </details>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className={label}>Type</span>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_TYPES.map(t => (
              <button key={t.id} type="button" onClick={() => setF({ ...f, leadType: t.id })} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${f.leadType === t.id ? "bg-[#0A0A0A] text-white" : "ring-1 ring-stone-300"}`}>{t.label}</button>
            ))}
          </div>
        </div>
        <label>
          <span className={label}>Source</span>
          <select className={input} value={f.source} onChange={e => setF({ ...f, source: e.target.value })}>
            {[...new Set([f.source, ...DESK_SOURCES])].map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label><span className={label}>Name *</span><input className={input} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} data-testid="lead-name" /></label>
        <label><span className={label}>Phone</span><input className={input} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} inputMode="tel" data-testid="lead-phone" /></label>
        <label><span className={label}>Email</span><input className={input} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} inputMode="email" data-testid="lead-email" /></label>
        <label>
          <span className={label}>Language</span>
          <select className={input} value={f.language} onChange={e => setF({ ...f, language: e.target.value })}>
            {LANGUAGES.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        {fields.map(fd => (
          <label key={fd.id} className={fd.id === "address" || fd.id === "areas" ? "sm:col-span-2" : ""}>
            <span className={label}>{fd.label}</span>
            {fd.kind === "select" ? (
              <select className={input} value={details[fd.id] ?? ""} onChange={e => setDetails({ ...details, [fd.id]: e.target.value })} data-testid={`f-${fd.id}`}>
                <option value="">—</option>
                {fd.options?.map(o => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input className={input} value={details[fd.id] ?? ""} placeholder={fd.placeholder} onChange={e => setDetails({ ...details, [fd.id]: e.target.value })} data-testid={`f-${fd.id}`} />
            )}
          </label>
        ))}
      </div>
      {(details.listedNow ?? "").startsWith("Yes") && <p className="rounded-lg bg-red-50 p-3 text-[15px] font-semibold text-red-800">Listed with another agent: don't book or solicit. Close it as "Already has an agent".</p>}
      <div>
        <span className={label}>How hot?</span>
        <div className="flex gap-1.5">
          {RATINGS.map(r => (
            <button key={r.id} type="button" onClick={() => setF({ ...f, rating: f.rating === r.id ? "" : r.id })} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${f.rating === r.id ? r.tone + " ring-2 ring-stone-800" : "ring-1 ring-stone-300"}`}>{r.label}</button>
          ))}
        </div>
      </div>
      <label className="block"><span className={label}>Call notes for the agent</span><textarea rows={3} className={input} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="What they said, best time to reach them, anything the agent should know" data-testid="lead-notes" /></label>
      <button type="button" disabled={busy} onClick={save} className="rounded-xl bg-[#9C7434] px-5 py-2.5 text-[15px] font-semibold text-white disabled:opacity-60" data-testid="lead-save">{lead ? "Save changes" : "Add to the desk"}</button>
    </div>
  );
}

// ── Lead detail ───────────────────────────────────────────────────────
function LeadDetail({ lead: l, board, avail, availErr, loadAvail }: { lead: Lead; board: Board; avail: Avail | null; availErr: string; loadAvail: () => void }) {
  const [editing, setEditing] = useState(false);
  const [booking, setBooking] = useState(l.stage === "to_vet" || l.stage === "needs_agent");
  const close = useMutation(api.desk.close);
  const reopen = useMutation(api.desk.reopen);
  const cancel = useMutation(api.desk.cancelBooking);
  const outcome = useMutation(api.desk.staffOutcome);
  const remove = useMutation(api.desk.remove);
  const isOpen = l.stage === "booked" || l.stage === "accepted";
  const ended = isOpen && (l.apptStart ?? 0) + (l.apptMinutes ?? 60) * 60000 < Date.now();
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da] md:p-5" data-testid="lead-detail">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold">{l.name}</h2>
            <StageChip s={l.stage} />
            <RatingChip r={l.rating} />
          </div>
          <div className="mt-1 text-[15px] text-stone-600">{typeLabel(l.leadType)} · {l.source} · added {ago(l.createdAt)}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {l.phone && <a href={`tel:${l.phone}`} className="flex items-center gap-1.5 rounded-lg bg-[#0A0A0A] px-3 py-2 text-sm font-semibold text-white"><Phone className="size-4" /> Call {l.phone}</a>}
            {l.phone && <a href={`sms:${l.phone}`} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-stone-300"><MessageSquare className="size-4" /> Text</a>}
            {l.email && <a href={`mailto:${l.email}`} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-stone-300"><Mail className="size-4" /> {l.email}</a>}
          </div>
          {editing ? (
            <div className="mt-4"><LeadEditor lead={l} onSaved={() => setEditing(false)} /></div>
          ) : (
            <>
              <dl className="mt-4 divide-y divide-[#f0ebe2] text-[15px]">
                {detailLines(l).filter(([k]) => k !== "Type" && k !== "Source").map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[42%_1fr] gap-2 py-1.5"><dt className="text-stone-600">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>
                ))}
              </dl>
              <button type="button" onClick={() => setEditing(true)} className="mt-3 rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-stone-300" data-testid="lead-edit">Edit / add vetting details</button>
            </>
          )}
          {l.rawText && (
            <details className="mt-3 text-sm text-stone-600"><summary className="cursor-pointer font-semibold">Original email</summary><p className="mt-1 whitespace-pre-wrap">{l.rawText}</p></details>
          )}
        </div>

        {l.bookedAt && (
          <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da] md:p-5" data-testid="booking-status">
            <h3 className="flex items-center gap-2 text-lg font-semibold"><CalendarCheck className="size-5 text-[#9C7434]" /> {kindLabel(l.apptKind ?? "")} with {l.agentName}</h3>
            <p className="text-[15px]">{fmtWhen(l.apptStart ?? 0)} · {l.apptMinutes} min{l.apptLocation ? ` · ${l.apptLocation}` : ""}</p>
            <ul className="space-y-1 text-[15px] text-stone-700">
              <li>{l.stage === "accepted" ? `✅ ${l.agentName?.split(" ")[0]} accepted ${ago(l.respondedAt ?? 0)}` : l.stage === "booked" ? `⏳ Waiting for ${l.agentName?.split(" ")[0]} (booked ${ago(l.bookedAt)}${l.escalatedAt ? ", alert sent" : ""})` : l.stage === "needs_agent" ? `↩️ ${l.declineReason ?? "Needs a new agent"}` : l.outcome ? `Outcome: ${outcomeLabel(l.outcome)}${l.outcomeNote ? ` · ${l.outcomeNote}` : ""}` : ""}</li>
              <li>{l.calendarEventId ? <>📅 On {l.agentName?.split(" ")[0]}'s Google Calendar{l.calendarLink ? <> · <a className="font-semibold text-[#7a5a26] underline" href={l.calendarLink} target="_blank" rel="noreferrer">open</a></> : null}</> : l.calendarError ? `📅 Calendar: ${l.calendarError}` : isOpen ? "📅 Adding to Google Calendar…" : null}</li>
              <li>{l.loftyLeadId ? <>🏠 In Lofty · <a className="font-semibold text-[#7a5a26] underline" href={`https://crm.lofty.com/admin/home/lead/detail/${l.loftyLeadId}`} target="_blank" rel="noreferrer">open lead</a></> : l.loftyError ? `🏠 Lofty: ${l.loftyError}` : null}</li>
              {l.textClient && <li>💬 Client texts: {Object.keys(l.texts ?? {}).filter(k => k !== "outcomeNudge").map(k => ({ confirm: "confirmation", r24: "24 h reminder", r2: "2 h reminder" })[k] ?? k).join(", ") || (l.stage === "accepted" ? "sending…" : "confirmation goes out when the agent accepts")}{l.textError ? ` · error: ${l.textError}` : ""}</li>}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              {(isOpen || l.stage === "needs_agent") && <button type="button" onClick={() => setBooking(true)} className="rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-stone-300">Change agent or time</button>}
              {isOpen && <button type="button" onClick={() => { const r = prompt("Why cancel? (the agent sees this)") ?? undefined; if (r === undefined) return; cancel({ id: l._id, reason: r }).then(() => toast.success("Cancelled, back in To vet")).catch(e => toast.error(errMsg(e))); }} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-200">Cancel booking</button>}
            </div>
            {ended && (
              <div className="pt-2">
                <div className="mb-1 text-sm font-semibold text-stone-700">Log the outcome for {l.agentName?.split(" ")[0]}:</div>
                <div className="flex flex-wrap gap-1.5">
                  {OUTCOMES.map(o => <button key={o.id} type="button" onClick={() => outcome({ id: l._id, outcome: o.id }).then(() => toast.success("Logged")).catch(e => toast.error(errMsg(e)))} className="rounded-lg px-2.5 py-1 text-sm font-semibold ring-1 ring-stone-300">{o.label}</button>)}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {(l.stage === "to_vet" || l.stage === "needs_agent") && (
            <select aria-label="Close lead" className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm" value="" onChange={e => e.target.value && close({ id: l._id, reason: e.target.value }).then(() => toast.success("Closed")).catch(err => toast.error(errMsg(err)))}>
              <option value="">Close without booking…</option>
              {CLOSE_REASONS.map(r => <option key={r}>{r}</option>)}
            </select>
          )}
          {(l.stage === "closed" || l.stage === "done") && <button type="button" onClick={() => reopen({ id: l._id }).then(() => toast.success("Back in To vet"))} className="rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-stone-300">Reopen</button>}
          {board.me.isAdmin && !isOpen && <button type="button" onClick={() => confirm("Delete this lead for good?") && remove({ id: l._id }).then(() => toast("Deleted")).catch(e => toast.error(errMsg(e)))} className="text-sm text-stone-500 underline">Delete</button>}
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da]">
          <h3 className="mb-2 text-[15px] font-semibold">History</h3>
          <ol className="space-y-1 text-sm text-stone-700">
            {[...l.history].reverse().map((h, i) => <li key={i}><span className="text-stone-500">{fmtWhen(h.at)} · {h.by}:</span> {h.text}</li>)}
          </ol>
        </div>
      </div>

      <div>
        {booking && l.stage !== "done" && l.stage !== "closed" ? (
          <BookPanel lead={l} board={board} avail={avail} availErr={availErr} loadAvail={loadAvail} onDone={() => setBooking(false)} />
        ) : null}
      </div>
    </div>
  );
}

// ── Book an agent ─────────────────────────────────────────────────────
const words = (s: string) => (s.toLowerCase().match(/\b(\d{5}|[a-z]{4,})\b/g) ?? []).filter(w => !["chicago", "street", "avenue", "north", "south", "east", "west", "road", "drive", "unit"].includes(w));

function BookPanel({ lead: l, board, avail, availErr, loadAvail, onDone }: { lead: Lead; board: Board; avail: Avail | null; availErr: string; loadAvail: () => void; onDone: () => void }) {
  const book = useMutation(api.desk.book);
  const defKind = l.leadType === "seller" || l.leadType === "landlord" ? "listing" : "phone";
  const [kind, setKind] = useState(l.apptKind ?? defKind);
  const [minutes, setMinutes] = useState(l.apptMinutes ?? MEETING_KINDS.find(k => k.id === defKind)!.minutes);
  const [agentEmail, setAgentEmail] = useState(l.stage === "needs_agent" ? "" : (l.agentEmail ?? ""));
  const [slot, setSlot] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [location, setLocation] = useState(l.apptLocation ?? l.details.address ?? "");
  const [textClient, setTextClient] = useState(l.textClient ?? !!l.phone);
  const [onlyMatch, setOnlyMatch] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!avail || Date.now() - avail.checkedAt > 5 * 60000) loadAvail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deskBusy = useMemo(() => {
    const m: Record<string, Busy[]> = {};
    for (const r of board.rows) {
      if (r._id === l._id || !r.agentEmail || !r.apptStart || !(r.stage === "booked" || r.stage === "accepted")) continue;
      (m[r.agentEmail] ??= []).push({ start: r.apptStart, end: r.apptStart + (r.apptMinutes ?? 60) * 60000 });
    }
    return m;
  }, [board.rows, l._id]);

  const leadWords = words(`${l.details.address ?? ""} ${l.details.areas ?? ""}`);
  const ranked = board.agents
    .filter(a => a.active)
    .map(a => {
      const lang = !!l.language && l.language !== "English" && a.languages.includes(l.language);
      const area = leadWords.some(w => a.areas.toLowerCase().includes(w));
      const slots = openSlots({ hours: a.hours as Hours, busy: [...(avail?.busy[a.email] ?? []), ...(deskBusy[a.email] ?? [])], from: Date.now(), days: 8, minutes, now: Date.now() });
      return { a, lang, area, slots, score: (lang ? 2 : 0) + (area ? 1 : 0) };
    })
    .filter(x => !onlyMatch || x.score > 0)
    .sort((x, y) => y.score - x.score || x.a.lastBookedAt - y.a.lastBookedAt || x.a.name.localeCompare(y.a.name));
  const suggested = ranked.find(x => x.slots.length)?.a.email;
  const chosen = ranked.find(x => x.a.email === agentEmail) ?? (agentEmail ? { a: board.agents.find(a => a.email === agentEmail)!, slots: [] as number[], lang: false, area: false, score: 0 } : undefined);
  const byDay = new Map<string, number[]>();
  for (const s of chosen?.slots ?? []) byDay.set(fmtDay(s), [...(byDay.get(fmtDay(s)) ?? []), s]);
  const customMs = custom ? new Date(custom).getTime() : NaN; // datetime-local = device time (Chicago for the team)
  const start = slot ?? (Number.isFinite(customMs) ? customMs : null);

  const submit = () => {
    if (!chosen || !start) return toast.error("Pick an agent and a time");
    setBusy(true);
    book({ id: l._id, agentEmail: chosen.a.email, apptStart: start, apptMinutes: minutes, apptKind: kind, apptLocation: kind === "listing" || kind === "showing" ? location : undefined, textClient })
      .then(() => { toast.success(`Booked. ${chosen.a.name.split(" ")[0]} gets a calendar invite, email and push.`); onDone(); })
      .catch(e => toast.error(errMsg(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da] md:p-5" data-testid="book-panel">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><CalendarClock className="size-5 text-[#9C7434]" /> Book an agent</h3>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label>
          <span className={label}>Meeting</span>
          <select className={input} value={kind} onChange={e => { setKind(e.target.value); setMinutes(MEETING_KINDS.find(k => k.id === e.target.value)?.minutes ?? 60); setSlot(null); }} data-testid="book-kind">
            {MEETING_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
        <label>
          <span className={label}>Length</span>
          <select className={input} value={minutes} onChange={e => { setMinutes(Number(e.target.value)); setSlot(null); }}>
            {[15, 30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m} min</option>)}
          </select>
        </label>
      </div>
      {(kind === "listing" || kind === "showing") && (
        <label className="block"><span className={label}>Where</span><input className={input} value={location} onChange={e => setLocation(e.target.value)} placeholder="Property address" /></label>
      )}

      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-stone-700">Agent</span>
          {(leadWords.length > 0 || (l.language && l.language !== "English")) && (
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyMatch} onChange={e => setOnlyMatch(e.target.checked)} className="accent-[#9C7434]" /> Only area/language matches</label>
          )}
          <button type="button" onClick={loadAvail} className="ml-auto flex items-center gap-1 text-sm font-semibold text-[#7a5a26]"><RefreshCw className="size-3.5" /> {avail ? `Calendars checked ${ago(avail.checkedAt)}` : "Checking calendars…"}</button>
        </div>
        {availErr && <p className="mb-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Couldn't read Google Calendars ({availErr}). Slots below only use agents' hours and Lead Desk bookings.</p>}
        <div className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1" data-testid="agent-list">
          {ranked.map(({ a, lang, area, slots }) => (
            <button key={a.email} type="button" onClick={() => { setAgentEmail(a.email); setSlot(null); }}
              className={`w-full rounded-xl p-2.5 text-left ring-1 ${agentEmail === a.email ? "bg-[#F7F5F1] ring-2 ring-[#9C7434]" : "ring-[#ebe5da] hover:bg-[#faf8f4]"}`} data-testid="agent-option">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[15px] font-semibold">{a.name}</span>
                {a.email === suggested && <span className="rounded-full bg-[#9C7434] px-2 py-0.5 text-xs font-semibold text-white">Suggested</span>}
                {lang && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">{l.language}</span>}
                {area && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">Area match</span>}
                {avail?.errors[a.email] && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">calendar hidden</span>}
                <span className="ml-auto text-xs text-stone-500">{a.booked30} booked in 30 d</span>
              </div>
              <div className="mt-0.5 text-sm text-stone-600">
                {slots.length ? `Next open: ${slots.slice(0, 3).map(s => `${fmtDay(s).split(",")[0]} ${fmtTime(s)}`).join(" · ")}` : "No open slots in the next 8 days"}
                {!a.hoursSet && " · default hours"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {chosen && (
        <div data-testid="slot-picker">
          <div className="mb-1.5 text-sm font-semibold text-stone-700">Time for {chosen.a.name.split(" ")[0]} <span className="font-normal text-stone-500">({hoursSummary(chosen.a.hours as Hours)})</span></div>
          {byDay.size === 0 && <p className="text-sm text-stone-600">No open slots inside their hours. Pick a time by hand below (check with the agent first).</p>}
          <div className="max-h-[260px] space-y-2 overflow-y-auto">
            {[...byDay.entries()].map(([day, list]) => (
              <div key={day}>
                <div className="text-sm font-semibold">{day}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {list.map(s => (
                    <button key={s} type="button" onClick={() => { setSlot(s); setCustom(""); }} className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${slot === s ? "bg-[#0A0A0A] text-white" : "ring-1 ring-stone-300"}`} data-testid="slot">{fmtTime(s)}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <label className="mt-2 block text-sm text-stone-600">Other time: <input type="datetime-local" value={custom} onChange={e => { setCustom(e.target.value); setSlot(null); }} className="ml-1 rounded-lg border border-stone-300 px-2 py-1" /></label>
        </div>
      )}

      {l.phone && (
        <label className="flex items-start gap-2 text-[15px]">
          <input type="checkbox" checked={textClient} onChange={e => setTextClient(e.target.checked)} className="mt-1 size-4 accent-[#9C7434]" data-testid="book-text" />
          <span>Text the client from (773) 985-7153: a confirmation once the agent accepts, then reminders 24 h and 2 h before.</span>
        </label>
      )}

      <button type="button" disabled={busy || !chosen || !start} onClick={submit} className="w-full rounded-xl bg-[#9C7434] px-5 py-3 text-[16px] font-semibold text-white disabled:opacity-50" data-testid="book-submit">
        {chosen && start ? `Book ${chosen.a.name.split(" ")[0]} · ${fmtWhen(start)}` : "Pick an agent and a time"}
      </button>
      <p className="text-sm text-stone-600">Booking sends the agent a Google Calendar invite, an email with Accept / Can't make it, and a push, and adds the lead to Lofty under them. No answer in 30 minutes → Cris, Anthony and Michael get an alert.</p>
    </div>
  );
}

// ── Report ────────────────────────────────────────────────────────────
function Report({ rows }: { rows: Lead[] }) {
  const [days, setDays] = useState(30);
  const since = days ? Date.now() - days * 864e5 : 0;
  const list = rows.filter(r => r.createdAt >= since);
  const by = new Map<string, Lead[]>();
  for (const r of list) by.set(r.source, [...(by.get(r.source) ?? []), r]);
  const stat = (ls: Lead[]) => ({
    leads: ls.length,
    booked: ls.filter(r => r.bookedAt).length,
    met: ls.filter(r => r.outcome === "met" || r.outcome === "signed").length,
    signed: ls.filter(r => r.outcome === "signed").length,
    noShow: ls.filter(r => r.outcome === "no_show").length,
    closed: ls.filter(r => r.stage === "closed").length,
    open: ls.filter(r => r.stage === "to_vet").length,
  });
  const lines = [...by.entries()].map(([s, ls]) => ({ s, ...stat(ls) })).sort((a, b) => b.leads - a.leads);
  const tot = stat(list);
  const agents = new Map<string, Lead[]>();
  for (const r of list.filter(x => x.agentName && x.bookedAt)) agents.set(r.agentName!, [...(agents.get(r.agentName!) ?? []), r]);
  const th = "px-3 py-2 text-left text-sm font-semibold text-stone-600";
  const td = "px-3 py-2 text-[15px]";
  return (
    <div className="space-y-5" data-testid="desk-report">
      <div className="flex gap-1.5">
        {[[7, "7 days"], [30, "30 days"], [90, "90 days"], [0, "All time"]].map(([d, t]) => (
          <button key={d} type="button" onClick={() => setDays(d as number)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${days === d ? "bg-[#0A0A0A] text-white" : "ring-1 ring-stone-300"}`}>{t}</button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-[#ebe5da]">
        <table className="w-full min-w-[640px]">
          <thead className="bg-[#F7F5F1]"><tr><th className={th}>Source</th><th className={th}>Leads</th><th className={th}>Still to vet</th><th className={th}>Booked</th><th className={th}>Met</th><th className={th}>Signed</th><th className={th}>No-show</th><th className={th}>Closed</th></tr></thead>
          <tbody className="divide-y divide-[#f0ebe2]">
            {lines.map(x => (
              <tr key={x.s}><td className={`${td} font-semibold`}>{x.s}</td><td className={td}>{x.leads}</td><td className={td}>{x.open}</td><td className={td}>{x.booked}{x.leads ? <span className="text-stone-500"> ({Math.round((x.booked / x.leads) * 100)}%)</span> : null}</td><td className={td}>{x.met}</td><td className={td}>{x.signed}</td><td className={td}>{x.noShow}</td><td className={td}>{x.closed}</td></tr>
            ))}
            <tr className="bg-[#faf8f4] font-semibold"><td className={td}>Total</td><td className={td}>{tot.leads}</td><td className={td}>{tot.open}</td><td className={td}>{tot.booked}</td><td className={td}>{tot.met}</td><td className={td}>{tot.signed}</td><td className={td}>{tot.noShow}</td><td className={td}>{tot.closed}</td></tr>
          </tbody>
        </table>
      </div>
      {agents.size > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-[#ebe5da]">
          <table className="w-full min-w-[520px]">
            <thead className="bg-[#F7F5F1]"><tr><th className={th}>Agent</th><th className={th}>Booked</th><th className={th}>Accepted in 30 min</th><th className={th}>Met</th><th className={th}>Signed</th><th className={th}>Outcome missing</th></tr></thead>
            <tbody className="divide-y divide-[#f0ebe2]">
              {[...agents.entries()].sort((a, b) => b[1].length - a[1].length).map(([n, ls]) => (
                <tr key={n}><td className={`${td} font-semibold`}>{n}</td><td className={td}>{ls.length}</td><td className={td}>{ls.filter(r => r.respondedAt && r.bookedAt && r.respondedAt - r.bookedAt <= 30 * 60000 && !r.declineReason).length}</td><td className={td}>{ls.filter(r => r.outcome === "met" || r.outcome === "signed").length}</td><td className={td}>{ls.filter(r => r.outcome === "signed").length}</td><td className={td}>{ls.filter(r => !r.outcome && (r.apptStart ?? 0) < Date.now() && (r.stage === "accepted" || r.stage === "booked")).length}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Agents & hours ────────────────────────────────────────────────────
function AgentsTab({ agents }: { agents: Agent[] }) {
  const [edit, setEdit] = useState<string | null>(null);
  return (
    <div className="space-y-3" data-testid="desk-agents">
      <p className="text-[15px] text-stone-600">Agents set their own hours in <b>My appointments</b>. You can edit them here too. Slots = inside these hours and free on their Google Calendar.</p>
      <div className="divide-y divide-[#efe9df] overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe5da]">
        {agents.map(a => (
          <div key={a.email} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[16px] font-semibold ${a.active ? "" : "text-stone-400 line-through"}`}>{a.name}</span>
              {!a.hoursSet && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">default hours</span>}
              {a.languages.map(x => <span key={x} className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">{x}</span>)}
              <button type="button" onClick={() => setEdit(edit === a.email ? null : a.email)} className="ml-auto rounded-lg px-3 py-1 text-sm font-semibold ring-1 ring-stone-300">{edit === a.email ? "Close" : "Edit"}</button>
            </div>
            <div className="mt-0.5 text-sm text-stone-600">{hoursSummary(a.hours as Hours)}{a.areas ? ` · Areas: ${a.areas}` : ""}</div>
            {edit === a.email && <ProfileForm agent={a} onDone={() => setEdit(null)} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileFields({ hours, setHours, languages, setLanguages, areas, setAreas }: { hours: Hours; setHours: (h: Hours) => void; languages: string[]; setLanguages: (l: string[]) => void; areas: string; setAreas: (a: string) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <span className={label}>Bookable hours</span>
        <HoursEditor value={hours} onChange={setHours} />
      </div>
      <div className="space-y-3">
        <div>
          <span className={label}>Languages (besides English)</span>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.filter(x => x !== "English").map(x => (
              <button key={x} type="button" onClick={() => setLanguages(languages.includes(x) ? languages.filter(y => y !== x) : [...languages, x])} className={`rounded-full px-2.5 py-1 text-sm font-semibold ${languages.includes(x) ? "bg-sky-700 text-white" : "ring-1 ring-stone-300"}`}>{x}</button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className={label}>Areas you cover</span>
          <textarea rows={3} className={input} value={areas} onChange={e => setAreas(e.target.value)} placeholder="Zip codes, neighborhoods, suburbs, buildings (e.g. 60614, Lincoln Park, Evanston, Wilmette)" />
        </label>
      </div>
    </div>
  );
}

function ProfileForm({ agent, onDone }: { agent: Agent; onDone: () => void }) {
  const save = useMutation(api.desk.saveAgentProfile);
  const [hours, setHours] = useState<Hours>(agent.hours as Hours);
  const [languages, setLanguages] = useState<string[]>(agent.languages);
  const [areas, setAreas] = useState(agent.areas);
  const [active, setActive] = useState(agent.active);
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-[#F7F5F1] p-3">
      <ProfileFields hours={hours} setHours={setHours} languages={languages} setLanguages={setLanguages} areas={areas} setAreas={setAreas} />
      <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="size-4 accent-[#9C7434]" /> Takes Lead Desk appointments</label>
      <button type="button" onClick={() => save({ email: agent.email, hours: hours as Record<string, number[] | null>, languages, areas, active }).then(() => { toast.success("Saved"); onDone(); }).catch(e => toast.error(errMsg(e)))} className="rounded-lg bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white">Save</button>
    </div>
  );
}

