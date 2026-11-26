import { hasConvexDeployment } from "@/auth/convexClient";
import { useMutation, useQuery } from "convex/react";
import { FileText, Image as ImageIcon, Mail, MessageSquare, Phone, Video } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AGENTS } from "@/lib/agents";
import { apiErrorMessage, useApiData } from "@/lib/apiData";
import { formsApi, type FormSubmission, type FormSubmissionStatus } from "@/lib/formsApi";
import { smsHref, telHref } from "@/lib/hub";
import { formById } from "../../convex/formDefs";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

const STATUS = {
  new: { label: "New", cls: "bg-orange-100 text-orange-800" },
  contacted: { label: "Contacted", cls: "bg-sky-100 text-sky-800" },
  done: { label: "Done", cls: "bg-emerald-100 text-emerald-800" },
} as const;

const when = (t: number) => new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

type InboxRow = FormSubmission | Doc<"formSubmissions">;

function Detail({ s, agents, update, assign, onClose }: {
  s: InboxRow;
  agents: { id: string; name: string }[];
  update: (status: FormSubmissionStatus, notes: string) => Promise<unknown>;
  assign?: (id: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(s.notes ?? "");
  const def = formById(s.formId);
  const rows = (def ? def.fields.map(f => [f.label, s.answers[f.id]] as const) : Object.entries(s.answers)).filter(([, v]) => v);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try { await action(); toast.success(message); }
    catch (error) { toast.error(apiErrorMessage(error)); }
    finally { setBusy(false); }
  };
  const save = (status: FormSubmissionStatus) => void run(() => update(status, notes), `Marked ${STATUS[status].label.toLowerCase()}`);

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-['Playfair_Display'] text-xl">{s.contactName}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-stone-500 -mt-2">{s.formTitle} · {when(s._creationTime)}{s.agentName ? ` · ${s.agentName}` : " · Team"}</div>
        <div className="grid grid-cols-3 gap-2">
          <a href={telHref(s.contactPhone ?? undefined)} className={`flex flex-col items-center gap-1 rounded-xl p-3 text-sm font-medium ring-1 ring-stone-200 ${s.contactPhone ? "" : "pointer-events-none opacity-40"}`}><Phone className="size-5 text-[#9C7434]" />Call</a>
          <a href={smsHref(s.contactPhone ?? undefined)} className={`flex flex-col items-center gap-1 rounded-xl p-3 text-sm font-medium ring-1 ring-stone-200 ${s.contactPhone ? "" : "pointer-events-none opacity-40"}`}><MessageSquare className="size-5 text-[#9C7434]" />Text</a>
          <a href={s.contactEmail ? `mailto:${s.contactEmail}` : undefined} className={`flex flex-col items-center gap-1 rounded-xl p-3 text-sm font-medium ring-1 ring-stone-200 ${s.contactEmail ? "" : "pointer-events-none opacity-40"}`}><Mail className="size-5 text-[#9C7434]" />Email</a>
        </div>
        <div className="rounded-xl bg-[#F7F5F1] divide-y divide-stone-200/70">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-5 gap-3 px-3 py-2 text-sm">
              <div className="col-span-2 text-stone-500">{k}</div>
              <div className="col-span-3 whitespace-pre-wrap text-[#0A0A0A]">{v}</div>
            </div>
          ))}
        </div>
        {"attachments" in s && !!s.attachments?.length && <Files id={s._id} />}
        <label className="text-sm font-medium">
          Notes
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 p-3 min-h-[70px]" placeholder="Called, left voicemail…" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => save("contacted")} className="rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white">Mark contacted</button>
          <button type="button" disabled={busy} onClick={() => save("done")} className="rounded-xl bg-[#9C7434] px-4 py-2.5 text-sm font-semibold text-white">Done</button>
          {s.status !== "new" && <button type="button" disabled={busy} onClick={() => save("new")} className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold">Back to new</button>}
        </div>
        {assign && (
          <label className="text-sm font-medium">
            Assign to agent
            <select defaultValue={agents.find(a => a.name === s.agentName)?.id ?? ""} disabled={busy}
              onChange={e => { const id = e.target.value; if (id) void run(() => assign(id), "Response assigned"); }} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5">
              <option value="">—</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}
        {"escalatedAt" in s && s.escalatedAt && <p className="text-xs text-orange-700">Escalated to Michael & Cris after 1 hour without contact.</p>}
      </DialogContent>
    </Dialog>
  );
}

function Files({ id }: { id: Id<"formSubmissions"> }) {
  const files = useQuery(api.forms.files, { id });
  if (!files) return <div className="text-sm text-stone-500">Loading files…</div>;
  const images = files.filter(f => f.contentType?.startsWith("image/") && f.url);
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Files from the client ({files.length})</div>
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map(f => (
            <a key={f.url} href={f.url ?? undefined} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg ring-1 ring-stone-200">
              <img src={f.url ?? undefined} alt={f.name} className="h-full w-full object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      <ul className="divide-y divide-stone-200/70 rounded-xl ring-1 ring-stone-200">
        {files.map(f => {
          const Icon = f.contentType?.startsWith("image/") ? ImageIcon : f.contentType?.startsWith("video/") ? Video : FileText;
          return (
            <li key={f.url ?? f.name}>
              <a href={f.url ?? undefined} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-stone-50">
                <Icon className="size-4 shrink-0 text-[#9C7434]" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="shrink-0 text-stone-500">{(f.size / 1048576).toFixed(1)} MB</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LegacyDetail({ row, canAssign, onClose }: { row: Doc<"formSubmissions">; canAssign: boolean; onClose: () => void }) {
  const setStatus = useMutation(api.forms.setStatus);
  const assign = useMutation(api.forms.assign);
  return <Detail s={row} agents={AGENTS.map(a => ({ id: a.name, name: a.name }))} onClose={onClose}
    update={(status, notes) => setStatus({ id: row._id, status, notes })}
    assign={canAssign ? agentName => assign({ id: row._id, agentName }) : undefined} />;
}

export function InboxPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<"new" | "contacted" | "done" | "all">("new");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const openId = params.get("open");
  const legacy = hasConvexDeployment && (params.get("source") === "legacy" || Boolean(openId && !openId.includes("-")));
  const legacyData = useQuery(api.forms.inbox, legacy ? { scope } : "skip");
  const { data: backend, error, reload } = useApiData(legacy ? null : `forms:inbox:${scope}`, () => formsApi.inbox(scope), { pollMs: 15_000 });
  const data = legacy ? legacyData : backend;
  const rows: InboxRow[] = data?.rows ?? [];
  const shown = rows.filter(r => tab === "all" || r.status === tab);
  const elevated = Boolean(data?.me.isAdmin || data?.me.isOps);
  const { data: agents } = useApiData(!legacy && elevated ? "forms:agents" : null, formsApi.agents);
  const open = backend?.rows.find(row => row._id === openId);
  const legacyOpen = legacyData?.rows.find(row => row._id === openId);
  const selectResponse = (id?: string) => setParams({ ...(legacy ? { source: "legacy" } : {}), ...(id ? { open: id } : {}) });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-['Playfair_Display'] text-3xl font-bold text-[#0A0A0A]">Inbox</h1>
        <p className="text-stone-500 mt-1">Review responses to your shared forms.</p>
      </div>
      {hasConvexDeployment && <button type="button" className="text-sm font-semibold text-[#9C7434]" onClick={() => setParams(legacy ? {} : { source: "legacy" })}>{legacy ? "Current form responses" : "Legacy responses"}</button>}
      <div className="flex flex-wrap items-center gap-2">
        {(["new", "contacted", "done", "all"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm ring-1 ${tab === t ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-600 ring-stone-200"}`}>
            {t === "all" ? "All" : STATUS[t].label} <span className="opacity-60">{t === "all" ? rows.length : rows.filter(r => r.status === t).length}</span>
          </button>
        ))}
        {elevated && (
          <select value={scope} onChange={e => setScope(e.target.value as "all" | "mine")} className="ml-auto rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-stone-200">
            <option value="all">Whole team</option>
            <option value="mine">Only mine</option>
          </select>
        )}
      </div>
      <div className="rounded-2xl bg-white ring-1 ring-[#ebe5da] divide-y divide-stone-100">
        {error && !legacy && <div role="alert" className="p-5 text-sm text-red-800">{apiErrorMessage(error)} <button type="button" className="underline" onClick={() => void reload()}>Retry</button></div>}
        {data === undefined && !error && <div className="p-5 text-sm text-stone-500">Loading…</div>}
        {data && shown.length === 0 && (
          <div className="p-6 text-sm text-stone-500">Nothing here yet. Send a form from <b>Forms</b> — answers show up here and in your email.</div>
        )}
        {shown.map(r => (
          <button key={r._id} type="button" onClick={() => selectResponse(r._id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-[#F7F5F1]">
            <span className={`size-2.5 rounded-full shrink-0 ${r.status === "new" ? (r.isLead ? "bg-[#c2410c]" : "bg-[#D9BC8C]") : "bg-stone-200"}`} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{r.contactName}</div>
              <div className="text-xs text-stone-500 truncate">{r.formTitle}{r.propertyAddress ? ` · ${r.propertyAddress}` : ""}{elevated && r.agentName ? ` · ${r.agentName}` : ""}</div>
            </div>
            <div className="text-right shrink-0">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
              <div className="text-[11px] text-stone-400 mt-1">{when(r._creationTime)}</div>
            </div>
          </button>
        ))}
      </div>
      {legacy && legacyOpen && <LegacyDetail key={legacyOpen._id} row={legacyOpen} canAssign={elevated} onClose={() => selectResponse()} />}
      {!legacy && open && <Detail key={open._id} s={open} agents={agents?.items ?? []} onClose={() => selectResponse()}
        update={(status, notes) => formsApi.setStatus(open._id, status, notes)}
        assign={elevated ? id => formsApi.assign(open._id, id) : undefined} />}
    </div>
  );
}
