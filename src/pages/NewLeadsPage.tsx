import { useAction, useMutation, useQuery } from "convex/react";
import { Bot, CalendarCheck, FileBarChart, ChevronDown, ChevronLeft, ExternalLink, Inbox, MessageSquare, Phone, PhoneIncoming, RefreshCw, Send, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { useApiData } from "@/lib/apiData";
import { cmaApi } from "@/lib/cmaApi";
import { CALL_RESULTS, type Kind, PLAYBOOKS, TONE, annaTexting, nextStep, quickText } from "../../convex/leadTrackDefs";
import { fmtWhen } from "../../convex/deskDefs";
import { ago, errMsg, input, label } from "@/components/hub/DeskBits";
import { telHref } from "@/lib/hub";

// New Leads (Michael 2026-11-08): every new Lofty lead, what already happened, what to do next.
type Board = NonNullable<ReturnType<typeof useBoard>>;
type Row = Board["rows"][number];
const useBoard = () => useQuery(api.leadTrack.board);
const LOFTY = (id: string) => `https://crm.lofty.com/admin/home/lead/detail/${id}`;

const TABS = [
  { id: "now", label: "Needs someone" },
  { id: "waiting", label: "Waiting / being worked" },
  { id: "closed", label: "Handled & closed" },
  { id: "all", label: "All" },
] as const;

const TYPE: Record<number, string> = { 1: "Seller", 2: "Buyer", 5: "Renter", 6: "Investor", 8: "Homeowner", 7: "Agent", [-1]: "Other" };
const typeOf = (r: Row) => r.leadTypes.map(n => TYPE[n]).filter(Boolean).join(" + ") || "";

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(i);
  }, []);
  return now;
}

const tabOf = (tone: string, id: string) => (tone === "red" || tone === "amber" ? "now" : ["closed", "optout", "done"].includes(id) ? "closed" : "waiting");

function lastLine(r: Row) {
  const sorted = [...r.comms].sort((a, b) => b.at - a.at);
  const reply = sorted.find(c => c.kind === "text_in");
  const human = sorted.find(c => !["auto_text", "text_in", "call_in"].includes(c.kind));
  if (reply && (!human || human.at < reply.at)) return `They replied · ${ago(reply.at)}: "${(reply.text ?? "").slice(0, 80)}"`;
  const c = sorted[0];
  if (!c) return "No texts or calls yet";
  const who = c.kind === "auto_text" ? "Anna texted" : c.kind === "text_in" ? "They replied" : c.kind === "call_in" ? "They called" : c.kind === "text_out" || c.kind === "hub_text" ? `${c.by ?? "Team"} texted` : `${c.by ?? "Team"} called`;
  const st = c.kind === "auto_text" && /undeliver|fail/i.test(c.status ?? "") ? " (didn't go through)" : c.kind.includes("call") && c.status ? ` (${c.status})` : "";
  return `${who}${st} · ${ago(c.at)}${c.kind === "text_in" && c.text ? `: "${c.text.slice(0, 70)}"` : ""}`;
}

export function NewLeadsPage() {
  const board = useBoard();
  const me = useQuery(api.hubMe.me);
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "now";
  const open = params.get("open");
  const [src, setSrc] = useState("");
  const syncNow = useAction(api.leadTrackActions.syncNow);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => (board?.rows ?? []).map(r => ({ r, step: nextStep(r as never, now) })), [board, now]);
  if (me && !me.canNewLeads) return <p className="text-[15px] text-stone-700">New Leads is for Michael, Cristina, Anthony and the developers.</p>;
  if (!board) return null;
  const set = (k: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [a, b] of Object.entries(k)) b === null ? p.delete(a) : p.set(a, b);
    setParams(p);
  };
  const sources = [...new Set(board.rows.map(r => r.source))].sort();
  const inTab = (x: (typeof rows)[number], t: string) => t === "all" || tabOf(x.step.tone, x.step.id) === t;
  const shown = rows
    .filter(x => inTab(x, tab) && (!src || x.r.source === src))
    .sort((a, b) => (tab === "now" ? (a.step.tone === b.step.tone ? b.r.createdAt - a.r.createdAt : a.step.tone === "red" ? -1 : 1) : b.r.createdAt - a.r.createdAt));
  const selected = open ? rows.find(x => x.r._id === open) : undefined;
  const refresh = () => {
    setBusy(true);
    syncNow({})
      .then(r => (r.error ? toast.error(r.error) : toast(r.ran ? "Updated from Lofty" : "Already up to date (updated in the last minute)")))
      .catch(e => toast.error(errMsg(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-5" data-testid="new-leads-page">
      <div className="flex flex-wrap items-center gap-3">
        <Inbox className="size-7 text-[#9C7434]" />
        <h1 className="font-['Playfair_Display'] text-3xl font-bold">New Leads</h1>
        <span className="text-[15px] text-stone-600">Every new lead, what's already happened, and the next step.</span>
        <span className="ml-auto flex items-center gap-2 text-sm text-stone-500">
          {board.sync ? (board.sync.ok ? `Updated ${ago(board.sync.at)}` : <span className="text-red-700">Lofty sync failed: {board.sync.error}</span>) : "Not synced yet"}
          <button type="button" onClick={refresh} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 font-semibold text-stone-800 ring-1 ring-[#ebe5da]" data-testid="nl-refresh">
            <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} /> Refresh
          </button>
        </span>
      </div>

      {selected ? (
        <div>
          <button type="button" onClick={() => set({ open: null })} className="mb-3 flex items-center gap-1 text-[15px] font-semibold text-[#7a5a26]">
            <ChevronLeft className="size-4" /> Back to the list
          </button>
          <Detail key={selected.r._id} row={selected.r} step={selected.step} />
        </div>
      ) : (
        <>
          <HowItWorks />
          <div className="flex flex-wrap items-center gap-1.5">
            {TABS.map(t => {
              const n = rows.filter(x => inTab(x, t.id) && (!src || x.r.source === src)).length;
              const red = t.id === "now" && rows.some(x => x.step.tone === "red");
              return (
                <button key={t.id} type="button" onClick={() => set({ tab: t.id })} data-testid={`nl-tab-${t.id}`}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[15px] font-semibold ${tab === t.id ? "bg-[#9C7434] text-white" : "bg-white text-stone-700 ring-1 ring-[#ebe5da]"}`}>
                  {t.label}
                  {n ? <span className={`ml-1.5 rounded-full px-1.5 text-xs ${tab === t.id ? "bg-white/25" : red ? "bg-red-600 text-white" : "bg-stone-200"}`}>{n}</span> : null}
                </button>
              );
            })}
            <select aria-label="Source" value={src} onChange={e => setSrc(e.target.value)} className="ml-auto rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm">
              <option value="">All sources</option>
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {shown.length ? (
            <div className="divide-y divide-[#efe9df] overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe5da]">
              {shown.map(({ r, step }) => (
                <button key={r._id} type="button" onClick={() => set({ open: r._id })} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 p-4 text-left hover:bg-[#faf8f4]" data-testid="nl-row">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONE[step.tone]}`}>{step.title}</span>
                      <span className="text-[16px] font-semibold">{r.name}</span>
                      <span className="text-sm text-stone-600">{typeOf(r)}</span>
                      {r.cma && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.cma.status === "ready" ? "bg-emerald-100 text-emerald-900" : "bg-[#F3EBDD] text-[#7a5a26]"}`} data-testid="nl-cma-badge">{r.cma.status === "ready" ? "CMA ready" : r.cma.status === "needs_info" || r.cma.status === "failed" ? "CMA needs info" : "CMA building"}</span>}
                    </span>
                    <span className="mt-1 block truncate text-sm text-stone-600">{lastLine(r)}</span>
                  </span>
                  <span className="text-right text-sm text-stone-500">
                    <span className="block">{r.source}</span>
                    <span className="block">{ago(r.createdAt)}{r.agentName ? ` · ${r.agentName}` : ""}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-white p-6 text-[15px] text-stone-600 ring-1 ring-[#ebe5da]">
              {tab === "now" ? "Nothing needs a person right now. New leads, replies and bounced texts show up here on their own." : "Nothing here."}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function HowItWorks() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-[#F7F5F1] p-4 ring-1 ring-[#ebe5da]">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left text-[15px] font-semibold">
        <Bot className="size-5 text-[#9C7434]" /> How new leads are handled automatically
        <ChevronDown className={`ml-auto size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-[15px] text-stone-700">
          <li><b>Lead lands in Lofty.</b> Website, Zillow, Realtor.com, BizBuySell, Crexi and the other sources go straight in. Peak Presence YouTube leads only arrive by email, so the Hub adds them to Lofty within 5 minutes.</li>
          <li><b>Anna texts them right away.</b> Lofty's AI assistant sends the first text within about 2 minutes, 8 AM–8 PM (overnight leads get it at 8 AM). If she didn't, or the text bounced, the lead shows up here in red.</li>
          <li><b>Replies ping you.</b> When a lead texts back, Michael, Cris and Anthony get an email and a phone notification within 5 minutes. A person should call.</li>
          <li><b>"What's it worth?" starts a CMA.</b> When a seller lead texts back asking for a value or more information, the Hub starts a CMA for their address and pings the three of you. It shows up on the lead's page in about an hour (5 a day at most). The CMA is for whoever calls, not something to send the lead.</li>
          <li><b>Someone calls and logs it here.</b> Each lead page has the playbook for its source: what to check, the questions to ask, and a ready-to-send text from the office line.</li>
          <li><b>Book it.</b> A real appointment goes on the Lead Desk so the agent gets the calendar invite.</li>
        </ol>
      )}
    </div>
  );
}

function Detail({ row, step }: { row: Row; step: ReturnType<typeof nextStep> }) {
  const pb = PLAYBOOKS[row.kind as Kind] ?? PLAYBOOKS.other;
  const sendText = useAction(api.leadTrackActions.sendText);
  const logCall = useMutation(api.leadTrack.logCall);
  const setHandled = useMutation(api.leadTrack.setHandled);
  const toDesk = useMutation(api.leadTrack.toDesk);
  const nav = useNavigate();
  const [text, setText] = useState(() => quickText(row.kind as Kind, row.name, row.street));
  const [result, setResult] = useState<string>(CALL_RESULTS[0]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const optedOut = step.id === "optout";
  const comms = [...row.comms].sort((a, b) => b.at - a.at);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-semibold" data-testid="nl-name">{row.name}</h2>
              <p className="mt-0.5 text-[15px] text-stone-600">
                {[typeOf(row), row.source, `came in ${fmtWhen(row.createdAt)}`].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-0.5 text-[15px] text-stone-600">
                {[row.phone, row.email, row.street].filter(Boolean).join(" · ")}
                {row.agentName ? ` · Lofty owner: ${row.agentName}` : ""} · Stage: {row.stage}
              </p>
            </div>
            <a href={LOFTY(row.loftyLeadId)} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-[#ebe5da]">
              Open in Lofty <ExternalLink className="size-3.5" />
            </a>
          </div>
          <div className={`mt-4 rounded-xl p-4 ${step.tone === "red" ? "bg-red-50 ring-1 ring-red-200" : step.tone === "amber" ? "bg-amber-50 ring-1 ring-amber-200" : "bg-stone-50 ring-1 ring-stone-200"}`} data-testid="nl-step">
            <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Next step</p>
            <p className="mt-1 text-[18px] font-semibold">{step.title}</p>
            <p className="mt-1 text-[15px] text-stone-700">{step.detail}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {row.phone && (
              <a href={telHref(row.phone)} className="flex items-center gap-1.5 rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-[15px] font-semibold text-white"><Phone className="size-4" /> Call {row.phone}</a>
            )}
            {row.deskId ? (
              <Link to={`/desk?open=${row.deskId}`} className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[15px] font-semibold ring-1 ring-[#ebe5da]"><CalendarCheck className="size-4" /> On the Lead Desk</Link>
            ) : (
              <button type="button" onClick={() => toDesk({ id: row._id }).then(id => nav(`/desk?open=${id}`)).catch(e => toast.error(errMsg(e)))} className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[15px] font-semibold ring-1 ring-[#ebe5da]" data-testid="nl-desk">
                <CalendarCheck className="size-4" /> Book an agent (Lead Desk)
              </button>
            )}
            {row.handled ? (
              <button type="button" onClick={() => setHandled({ id: row._id, handled: "" })} className="rounded-xl bg-white px-4 py-2.5 text-[15px] font-semibold ring-1 ring-[#ebe5da]">Reopen</button>
            ) : (
              <>
                <button type="button" onClick={() => setHandled({ id: row._id, handled: "done" }).then(() => toast("Marked handled"))} className="rounded-xl bg-white px-4 py-2.5 text-[15px] font-semibold ring-1 ring-[#ebe5da]" data-testid="nl-done">Mark handled</button>
                <button type="button" onClick={() => setHandled({ id: row._id, handled: "not_lead" }).then(() => toast("Marked not a real lead"))} className="rounded-xl bg-white px-4 py-2.5 text-[15px] font-semibold text-stone-600 ring-1 ring-[#ebe5da]">Not a real lead</button>
              </>
            )}
          </div>
          <CmaCard row={row} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]">
            <h3 className="flex items-center gap-2 text-[17px] font-semibold"><MessageSquare className="size-5 text-[#9C7434]" /> Quick text</h3>
            <p className="mt-1 text-sm text-stone-600">Sends from the office line (773) 985-7153 and adds a note in Lofty. Replies come in as office-line cards.</p>
            {optedOut || row.cannotText || annaTexting(row.comms) ? (
              <p className="mt-3 rounded-lg bg-stone-100 p-3 text-[15px] text-stone-700" data-testid="nl-no-text">{optedOut ? "They texted STOP. Don't text them." : row.cannotText ? "Lofty has texting off for this lead. Call instead." : "Anna (Lofty AI) is already texting this lead, so no text from the office line. Call instead."}</p>
            ) : (
              <>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={5} className={`${input} mt-3`} data-testid="nl-text" />
                <button type="button" disabled={sending || !row.phone}
                  onClick={() => {
                    if (!window.confirm(`Text ${row.name} at ${row.phone} now?`)) return;
                    setSending(true);
                    sendText({ id: row._id, text }).then(() => toast("Text sent")).catch(e => toast.error(errMsg(e))).finally(() => setSending(false));
                  }}
                  className="mt-2 flex items-center gap-1.5 rounded-xl bg-[#9C7434] px-4 py-2.5 text-[15px] font-semibold text-white disabled:opacity-50" data-testid="nl-send">
                  <Send className="size-4" /> {sending ? "Sending…" : "Send text"}
                </button>
              </>
            )}
          </div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]">
            <h3 className="flex items-center gap-2 text-[17px] font-semibold"><Phone className="size-5 text-[#9C7434]" /> Log a call</h3>
            <p className="mt-1 text-sm text-stone-600">Calls made in Lofty are picked up on their own. Log calls from your cell here.</p>
            <label className={`${label} mt-3`}>Result</label>
            <select value={result} onChange={e => setResult(e.target.value)} className={input} data-testid="nl-result">
              {CALL_RESULTS.map(r => <option key={r}>{r}</option>)}
            </select>
            <label className={`${label} mt-2`}>Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} className={input} placeholder="Selling in spring, wants a CMA" data-testid="nl-note" />
            <button type="button" onClick={() => logCall({ id: row._id, result, note }).then(() => { toast("Call logged (also noted in Lofty)"); setNote(""); }).catch(e => toast.error(errMsg(e)))}
              className="mt-2 rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-[15px] font-semibold text-white" data-testid="nl-log">Log call</button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]">
          <h3 className="text-[17px] font-semibold">What's happened</h3>
          {comms.length ? (
            <ul className="mt-3 space-y-2.5" data-testid="nl-timeline">
              {comms.map((c, i) => (
                <li key={i} className="flex gap-3 text-[15px]">
                  <span className="mt-0.5 shrink-0">{c.kind === "auto_text" ? <Bot className="size-4 text-stone-500" /> : c.kind === "text_in" ? <Smartphone className="size-4 text-red-600" /> : c.kind === "call_in" ? <PhoneIncoming className="size-4 text-red-600" /> : c.kind.includes("call") ? <Phone className="size-4 text-stone-500" /> : <MessageSquare className="size-4 text-stone-500" />}</span>
                  <span className="min-w-0">
                    <span className="font-semibold">
                      {c.kind === "auto_text" ? "Anna (Lofty AI) texted" : c.kind === "text_in" ? "They texted" : c.kind === "call_in" ? "They called" : c.kind.includes("text") ? `${c.by ?? "Team"} texted` : `${c.by ?? "Team"} called`}
                    </span>
                    <span className="text-stone-500"> · {fmtWhen(c.at)}{c.status ? ` · ${c.status}` : ""}</span>
                    {c.text && <span className="block text-stone-700">"{c.text}"</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[15px] text-stone-600">No texts or calls yet.</p>
          )}
          {row.history.length > 0 && (
            <p className="mt-3 border-t border-[#efe9df] pt-3 text-sm text-stone-500">
              {row.history.slice(-5).map(h => `${fmtWhen(h.at)} ${h.by}: ${h.text}`).join(" · ")}
            </p>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-2xl bg-[#0A0A0A] p-5 text-white" data-testid="nl-playbook">
        <p className="text-xs font-bold uppercase tracking-wide text-[#D9BC8C]">Playbook</p>
        <h3 className="mt-1 font-['Playfair_Display'] text-xl font-semibold">{pb.label}</h3>
        <p className="mt-2 text-[15px] text-white/80">{pb.who}</p>
        <p className="mt-3 text-[15px]"><b className="text-[#D9BC8C]">Goal:</b> {pb.goal}</p>
        <p className="mt-1 text-[15px]"><b className="text-[#D9BC8C]">Speed:</b> {pb.speed}</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] text-white/90">
          {pb.steps.map(s => <li key={s}>{s}</li>)}
        </ol>
        <p className="mt-4 text-sm font-bold uppercase tracking-wide text-[#D9BC8C]">Ask on the call</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-white/90">
          {pb.ask.map(s => <li key={s}>{s}</li>)}
        </ul>
      </aside>
    </div>
  );
}

const money = (n: number | null) => (n ? `$${Math.round(n).toLocaleString("en-US")}` : "");

/** CMA for this lead: started automatically on a "what's it worth / more info" reply, or by the button. */
function CmaCard({ row }: { row: Row }) {
  const orderCma = useMutation(api.leadTrack.orderCma);
  const me = useApiData("cma:me", () => cmaApi.me()).data; // new backend
  const [busy, setBusy] = useState(false);
  const c = row.cma;
  const order = () => {
    setBusy(true);
    orderCma({ id: row._id }).then(() => toast("CMA started. It shows up here in about an hour.")).catch(e => toast.error(errMsg(e))).finally(() => setBusy(false));
  };
  return (
    <div className="mt-4 rounded-xl bg-[#FBF8F2] p-4 ring-1 ring-[#ebe5da]" data-testid="nl-cma">
      <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-stone-500"><FileBarChart className="size-4 text-[#9C7434]" /> CMA</p>
      {c ? (
        <>
          <p className="mt-1 text-[17px] font-semibold" data-testid="nl-cma-status">
            {c.status === "ready" ? `Ready: ${c.address}` : c.status === "needs_info" ? `Needs info: ${c.address}` : c.status === "failed" ? `Couldn't build: ${c.address}` : c.status === "approval" ? `Waiting for Michael: ${c.address}` : `Building: ${c.address}`}
          </p>
          {c.valueLow && c.valueHigh ? (
            <p className="mt-1 text-[15px] text-stone-800">Value {money(c.valueLow)}–{money(c.valueHigh)}{c.listPrice ? ` · suggested list ${money(c.listPrice)}` : ""}</p>
          ) : null}
          {c.statusNote && <p className="mt-1 text-[15px] text-stone-600">{c.statusNote}</p>}
          {c.status !== "ready" && c.status !== "needs_info" && c.status !== "failed" && <p className="mt-1 text-sm text-stone-500">Usually ready in about an hour (7 AM–9 PM). You'll get an email and a phone notification.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {c.pdfUrl && <a href={c.pdfUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#0A0A0A] px-4 py-2 text-[15px] font-semibold text-white" data-testid="nl-cma-pdf">Open CMA (PDF)</a>}
            {c.xlsxUrl && <a href={c.xlsxUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-2 text-[15px] font-semibold ring-1 ring-[#ebe5da]">Comps workbook</a>}
            {me?.isAdmin && <Link to={`/requests/${c.id}/edit`} className="rounded-xl bg-white px-4 py-2 text-[15px] font-semibold ring-1 ring-[#ebe5da]">Fix details (beds, condition, city)</Link>}
          </div>
          <p className="mt-2 text-sm text-stone-500">For whoever calls. Walk the seller through it on the phone; don't send the PDF to the lead without Michael's OK.</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-[15px] text-stone-700">
            {row.cmaAuto === "no_address"
              ? "They asked what it's worth, but Lofty has no address. Get it on the call, add it in Lofty, then tap Order CMA."
              : row.cmaAuto === "daily_cap"
                ? "They asked what it's worth, but today's limit of 5 automatic CMAs was reached. Tap Order CMA to start one anyway."
                : "Starts automatically when a seller texts back asking for a value or more information. You can also start one now."}
          </p>
          <button type="button" disabled={busy} onClick={order} className="mt-3 rounded-xl bg-white px-4 py-2 text-[15px] font-semibold ring-1 ring-[#ebe5da] disabled:opacity-50" data-testid="nl-cma-order">
            Order CMA{row.street ? ` for ${row.street.split(",")[0]}` : ""}
          </button>
        </>
      )}
    </div>
  );
}
