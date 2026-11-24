// Agent Videos (Michael 2026-10-26): agents upload high-quality raw clips to their own Drive folder
// for our editor (Vidchops), with a why, a tutorial, filming ideas and a "Tell the editor" note.
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle, ArrowLeft, Camera, CheckCircle2, ChevronDown, Clapperboard, ExternalLink, FileVideo, Lightbulb,
  FolderOpen, Loader2, MessageSquarePlus, RefreshCw, Sparkles, Trash2, Upload, Users, XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CHECK_DO, CHECK_DONT, FAIR_HOUSING, IDEAS, STEPS, WHY, driveHref, fmtSize, qualityFlag, type Phone,
} from "@/lib/agentVideos";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const KINDS = [
  "Intro / about me", "Why I joined SpaceMatch", "Listing walkthrough", "Neighborhood spot", "Market update",
  "Seller tip", "Buyer tip", "Just listed / just sold", "Client story", "Behind the scenes", "Other",
];
const USE_FOR = ["Team Instagram", "My own socials", "Listing Reel", "Website / agent page", "YouTube"];
const TUT_KEY = "hub-videos-tutorial-seen";

const ago = (iso: string | number) => {
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (!t) return "";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const errMsg = (e: unknown) => /Uncaught Error: ([^\n]+)/.exec(String((e as Error)?.message ?? e))?.[1] ?? "Something went wrong. Try again.";

function SectionTitle({ icon: Icon, children, id }: { icon: typeof Camera; children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mb-3 flex items-center gap-2 font-serif text-[22px] font-bold text-[#0A0A0A]">
      <Icon className="size-5 text-[#9C7434]" /> {children}
    </h2>
  );
}

function PhoneToggle({ phone, setPhone }: { phone: Phone; setPhone: (p: Phone) => void }) {
  return (
    <div className="inline-flex rounded-full bg-stone-100 p-1 text-sm font-semibold" role="tablist" aria-label="Your phone">
      {(["iphone", "android"] as Phone[]).map(p => (
        <button
          key={p}
          type="button"
          role="tab"
          aria-selected={phone === p}
          onClick={() => setPhone(p)}
          className={`rounded-full px-4 py-1.5 ${phone === p ? "bg-[#0A0A0A] text-white" : "text-stone-600"}`}
        >
          {p === "iphone" ? "iPhone" : "Android"}
        </button>
      ))}
    </div>
  );
}

function BriefDialog({
  open, onClose, files, as,
}: {
  open: boolean;
  onClose: () => void;
  files: { id: string; name: string; size: number; createdTime: string }[];
  as?: string;
}) {
  const submit = useMutation(api.agentVideos.submitBrief);
  const [kind, setKind] = useState(KINDS[0]);
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [useFor, setUseFor] = useState<string[]>(["Team Instagram"]);
  const [notes, setNotes] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      // Preselect clips uploaded in the last 24 hours.
      const day = Date.now() - 86400000;
      setPicked(files.filter(f => Date.parse(f.createdTime) > day).map(f => f.name));
    }
  }, [open, files]);
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const go = async () => {
    setBusy(true);
    try {
      await submit({ as, kind, title, address: address || undefined, useFor, notes: notes || undefined, files: picked });
      toast.success("Sent to the editor's video log");
      setTitle(""); setAddress(""); setNotes(""); setPicked([]);
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Tell the editor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-[15px]">
          <div>
            <div className="mb-1.5 font-semibold">Which clips?</div>
            {files.length === 0 ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                No uploads found yet. Upload to your folder first, then tap Refresh on this page.
              </p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl ring-1 ring-stone-200 p-2" data-testid="brief-files">
                {files.map(f => (
                  <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-stone-50">
                    <input type="checkbox" className="size-4 accent-[#9C7434]" checked={picked.includes(f.name)} onChange={() => setPicked(p => toggle(p, f.name))} />
                    <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                    <span className="shrink-0 text-xs text-stone-500">{fmtSize(f.size)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <label className="block">
            <span className="mb-1.5 block font-semibold">What kind of video?</span>
            <select value={kind} onChange={e => setKind(e.target.value)} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5">
              {KINDS.map(k => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Short title</span>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. 3 things to do before you list" className="w-full rounded-xl border border-stone-300 px-3 py-2.5" data-testid="brief-title" />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Listing address or area <span className="font-normal text-stone-500">(optional)</span></span>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. 1420 Elmwood Ave, Evanston" className="w-full rounded-xl border border-stone-300 px-3 py-2.5" />
          </label>
          <div>
            <div className="mb-1.5 font-semibold">Use it for</div>
            <div className="flex flex-wrap gap-2">
              {USE_FOR.map(u => (
                <button key={u} type="button" onClick={() => setUseFor(x => toggle(x, u))} className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${useFor.includes(u) ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-700 ring-stone-300"}`}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Notes for the editor <span className="font-normal text-stone-500">(optional)</span></span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Best take, what to cut, the hook you want, which B-roll to mix in…" className="w-full rounded-xl border border-stone-300 px-3 py-2.5" />
          </label>
          <button type="button" onClick={go} disabled={busy || picked.length === 0 || !title.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9C7434] px-4 py-3 font-bold text-white disabled:opacity-50" data-testid="brief-send">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <MessageSquarePlus className="size-4" />} Send to the editor
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TeamPanel({ logUrl }: { logUrl: string | null }) {
  const team = useQuery(api.agentVideos.team);
  const refresh = useAction(api.agentVideos.refresh);
  const setStatus = useMutation(api.agentVideos.setStatus);
  const [busy, setBusy] = useState(false);
  if (!team) return null;
  const all = async () => {
    setBusy(true);
    try {
      const r = await refresh({ all: true });
      const bad = r.filter(x => !x.ok).length;
      toast[bad ? "error" : "success"](bad ? `${bad} folder(s) couldn't be read` : "All folders checked");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <section className="rounded-3xl bg-white p-4 ring-1 ring-[#ebe5da] md:p-6" data-testid="videos-team">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SectionTitle icon={Users}>Team uploads</SectionTitle>
        <button type="button" onClick={all} disabled={busy} className="mb-3 ml-auto inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-sm font-semibold">
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} /> Check all folders
        </button>
      </div>
      <p className="mb-3 text-sm text-stone-600">
        Every agent can see the whole AGENT UPLOADS team folder and uploads into their own subfolder. The editor gets the whole VIDEOS- Team folder once it&apos;s shared with them.
        {logUrl && <> · <a href={logUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#9C7434]">Open the editor's video log</a></>}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500">
            <tr><th className="py-2 pr-3 font-semibold">Agent</th><th className="py-2 pr-3 font-semibold">Clips</th><th className="py-2 pr-3 font-semibold">Last upload</th><th className="py-2 pr-3 font-semibold">New notes</th><th className="py-2 font-semibold">Folder</th></tr>
          </thead>
          <tbody>
            {team.rows.map(r => (
              <tr key={r.email} className="border-t border-stone-100">
                <td className="py-2 pr-3 font-semibold">{r.name}</td>
                <td className="py-2 pr-3">{r.checkedAt ? r.files : "–"}</td>
                <td className="py-2 pr-3 text-stone-600">{r.latest ? ago(r.latest) : "–"}</td>
                <td className="py-2 pr-3">{r.briefsNew ? <span className="rounded-full bg-[#9C7434] px-2 py-0.5 text-xs font-bold text-white">{r.briefsNew}</span> : "–"}</td>
                <td className="py-2"><a href={r.folderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#9C7434]">Open <ExternalLink className="size-3.5" /></a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {team.briefs.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 font-semibold">Latest notes to the editor</div>
          <div className="space-y-2">
            {team.briefs.slice(0, 15).map(b => (
              <div key={b._id} className="flex flex-wrap items-center gap-2 rounded-xl bg-stone-50 p-3 text-sm">
                <span className="font-semibold">{b.agentName}</span>
                <span className="text-stone-600">{b.kind}: {b.title}</span>
                <span className="text-xs text-stone-400">{ago(b.createdAt)}</span>
                <select
                  aria-label="Status"
                  value={b.status}
                  onChange={e => setStatus({ id: b._id as Id<"agentVideoBriefs">, status: e.target.value as "new" | "editing" | "posted" }).catch(err => toast.error(errMsg(err)))}
                  className="ml-auto rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                >
                  <option value="new">New</option><option value="editing">Editing</option><option value="posted">Posted</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function AgentVideosPage() {
  const [as, setAs] = useState<string | undefined>(undefined);
  const data = useQuery(api.agentVideos.mine, { as });
  const refresh = useAction(api.agentVideos.refresh);
  const removeBrief = useMutation(api.agentVideos.removeBrief);
  const [phone, setPhone] = useState<Phone>(() => (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent) ? "android" : "iphone"));
  const [refreshing, setRefreshing] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [tutOpen, setTutOpen] = useState(() => typeof localStorage === "undefined" || !localStorage.getItem(TUT_KEY));
  const autoRef = useRef<string | null>(null);

  const doRefresh = async (quiet = false) => {
    setRefreshing(true);
    try {
      const [r] = await refresh({ as });
      if (!quiet) r?.ok ? toast.success(`Found ${r.count} clip${r.count === 1 ? "" : "s"}`) : toast.error(r?.error ?? "Couldn't read your folder");
    } catch (e) {
      if (!quiet) toast.error(errMsg(e));
    } finally {
      setRefreshing(false);
    }
  };
  // Check the folder on open (and when staff switch agents) if the list is >5 min old.
  useEffect(() => {
    if (!data?.folderId) return;
    const key = data.email;
    if (autoRef.current === key) return;
    autoRef.current = key;
    if (!data.checkedAt || Date.now() - data.checkedAt > 5 * 60000) void doRefresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.email, data?.folderId]);

  const closeTut = () => { setTutOpen(false); try { localStorage.setItem(TUT_KEY, "1"); } catch { /* ignore */ } };
  const flagged = useMemo(() => (data?.files ?? []).filter(f => qualityFlag(f)).length, [data?.files]);

  if (data === undefined) {
    return <div className="flex justify-center py-24"><Loader2 className="size-6 animate-spin text-stone-400" /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16" data-testid="videos-page">
      <Link to="/home" className="inline-flex items-center gap-1 text-sm font-semibold text-stone-600"><ArrowLeft className="size-4" /> Home</Link>

      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-[#0A0A0A] p-5 text-white md:p-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#D9BC8C]"><Clapperboard className="size-4" /> Agent videos</div>
        <h1 className="mt-2 font-serif text-[30px] font-bold leading-tight md:text-[40px]">You film it. Our editor turns it into Reels.</h1>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-stone-300">
          Upload high-quality raw clips to your own folder. Our editor (Vidchops) mixes them with our team B-roll into
          finished Reels for the SpaceMatch page, your listings and your own socials.
        </p>
        {data.isStaff && data.agents.length > 0 && (
          <label className="mt-4 inline-flex items-center gap-2 text-sm text-stone-300">
            View as
            <select aria-label="View as agent" value={as ?? ""} onChange={e => setAs(e.target.value || undefined)} className="rounded-lg bg-white/10 px-2 py-1 text-white ring-1 ring-white/20">
              <option value="" className="text-black">Me</option>
              {data.agents.map(a => <option key={a.email} value={a.email} className="text-black">{a.name}</option>)}
            </select>
          </label>
        )}
        {data.folderUrl ? (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <a href={driveHref(data.folderUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D9BC8C] px-5 py-3.5 text-[16px] font-bold text-black" data-testid="upload-folder">
              <Upload className="size-5" /> Upload to my folder
            </a>
            <button type="button" onClick={() => setBriefOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-3.5 text-[16px] font-semibold ring-1 ring-white/20" data-testid="open-brief">
              <MessageSquarePlus className="size-5" /> Tell the editor
            </button>
            <a href={driveHref(data.teamFolderUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-3.5 text-[16px] font-semibold ring-1 ring-white/20" data-testid="team-folder">
              <FolderOpen className="size-5" /> Team folder (all agents)
            </a>
          </div>
        ) : (
          <p className="mt-5 rounded-xl bg-amber-500/15 p-3 text-sm text-amber-100 ring-1 ring-amber-400/30" data-testid="no-folder">
            This login has no upload folder. Agents sign in with their own @spacematchinc.com email to get theirs.
          </p>
        )}
        <p className="mt-3 text-xs text-stone-400">Upload into your own folder so the editor knows who filmed what. Every agent can open the team folder to watch, download and share each other&apos;s clips. Files stay full quality.</p>
      </section>

      {/* Tutorial */}
      <section className="rounded-3xl bg-white p-4 ring-1 ring-[#ebe5da] md:p-6" data-testid="videos-tutorial">
        <button type="button" onClick={() => (tutOpen ? closeTut() : setTutOpen(true))} className="flex w-full items-center gap-2 text-left" aria-expanded={tutOpen}>
          <h2 className="flex flex-1 items-center gap-2 font-serif text-[22px] font-bold"><Camera className="size-5 text-[#9C7434]" /> How to film & upload (2 min)</h2>
          <ChevronDown className={`size-5 text-stone-500 transition-transform ${tutOpen ? "rotate-180" : ""}`} />
        </button>
        {tutOpen && (
          <div className="mt-4">
            <PhoneToggle phone={phone} setPhone={setPhone} />
            <ol className="mt-4 space-y-4">
              {STEPS.map((s, i) => (
                <li key={s.t} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0A0A0A] font-bold text-[#D9BC8C]">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[17px]">{s.t}</div>
                    <p className="mt-1 leading-relaxed text-stone-700">{s.d}</p>
                    {s[phone] && <p className="mt-2 rounded-xl bg-stone-50 p-3 text-[15px] text-stone-800 ring-1 ring-stone-200"><b>{phone === "iphone" ? "iPhone" : "Android"}:</b> {s[phone]}</p>}
                    {s.tip && <p className="mt-2 text-[15px] text-[#7a5a26]"><Lightbulb className="mr-1 inline size-4 -translate-y-px" />{s.tip}</p>}
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" onClick={closeTut} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0A0A0A] px-4 py-2.5 font-semibold text-white" data-testid="tutorial-done">
              <CheckCircle2 className="size-4" /> Got it
            </button>
          </div>
        )}
      </section>

      {/* My uploads */}
      {data.folderUrl && (
        <section className="rounded-3xl bg-white p-4 ring-1 ring-[#ebe5da] md:p-6" data-testid="videos-mine">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <SectionTitle icon={FileVideo}>{as ? `${data.name}'s uploads` : "My uploads"}</SectionTitle>
            <button type="button" onClick={() => doRefresh()} disabled={refreshing} className="mb-3 ml-auto inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-sm font-semibold" data-testid="videos-refresh">
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
          <p className="mb-3 text-sm text-stone-500">
            {data.checkedAt ? `Checked ${ago(data.checkedAt)}` : "Not checked yet"}
            {data.checkError ? " · couldn't read the folder last time, tap Refresh" : ""}
          </p>
          {data.files.length === 0 ? (
            <div className="rounded-2xl bg-stone-50 p-5 text-center text-stone-600" data-testid="videos-empty">
              No clips yet. Tap <b>Upload to my folder</b>, add your videos in Drive, then come back and tap Refresh.
            </div>
          ) : (
            <>
              {flagged > 0 && (
                <p className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {flagged} file{flagged === 1 ? " looks" : "s look"} low quality. The editor can only use original, full-size videos.
                </p>
              )}
              <ul className="divide-y divide-stone-100" data-testid="videos-files">
                {data.files.map(f => {
                  const flag = qualityFlag(f);
                  return (
                    <li key={f.id} className="flex items-center gap-3 py-2.5">
                      <FileVideo className={`size-5 shrink-0 ${flag ? "text-amber-600" : "text-[#9C7434]"}`} />
                      <div className="min-w-0 flex-1">
                        <a href={f.link} target="_blank" rel="noreferrer" className="block truncate font-semibold hover:underline">{f.name}</a>
                        <div className="text-xs text-stone-500">{fmtSize(f.size)} · {ago(f.createdTime)}{flag && <span className="ml-1 font-semibold text-amber-700">· {flag}</span>}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {data.briefs.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 font-semibold">Notes sent to the editor</div>
              <div className="space-y-2" data-testid="videos-briefs">
                {data.briefs.map(b => (
                  <div key={b._id} className="flex items-start gap-3 rounded-xl bg-stone-50 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{b.kind}: {b.title}</div>
                      <div className="text-stone-500">{b.files.length} clip{b.files.length === 1 ? "" : "s"} · {ago(b.createdAt)}{b.address ? ` · ${b.address}` : ""}</div>
                      {b.postedUrl && <a href={b.postedUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#9C7434]">See the post</a>}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${b.status === "posted" ? "bg-emerald-100 text-emerald-800" : b.status === "editing" ? "bg-sky-100 text-sky-800" : "bg-stone-200 text-stone-700"}`}>
                      {b.status === "posted" ? "Posted" : b.status === "editing" ? "Editing" : "Sent"}
                    </span>
                    {b.status === "new" && (
                      <button type="button" aria-label="Remove note" onClick={() => removeBrief({ id: b._id }).catch(e => toast.error(errMsg(e)))} className="shrink-0 text-stone-400 hover:text-red-600"><Trash2 className="size-4" /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Why */}
      <section data-testid="videos-why">
        <SectionTitle icon={Sparkles}>Why film for the team?</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map(w => (
            <div key={w.t} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da]">
              <div className="font-semibold text-[17px]">{w.t}</div>
              <p className="mt-1.5 leading-relaxed text-stone-700">{w.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quality checklist */}
      <section className="grid gap-3 md:grid-cols-2" data-testid="videos-checklist">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da]">
          <div className="mb-2 font-semibold text-[17px]">High quality only: do</div>
          <ul className="space-y-1.5">{CHECK_DO.map(c => <li key={c} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />{c}</li>)}</ul>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da]">
          <div className="mb-2 font-semibold text-[17px]">Don't</div>
          <ul className="space-y-1.5">{CHECK_DONT.map(c => <li key={c} className="flex gap-2"><XCircle className="mt-0.5 size-4 shrink-0 text-red-500" />{c}</li>)}</ul>
        </div>
      </section>

      {/* Ideas */}
      <section data-testid="videos-ideas">
        <SectionTitle icon={Lightbulb}>What to film</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {IDEAS.map(i => (
            <div key={i.t} className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da]">
              <div className="flex items-baseline gap-2">
                <div className="font-semibold text-[17px]">{i.t}</div>
                <span className="text-sm text-stone-500">{i.len}</span>
              </div>
              <p className="mt-1.5 leading-relaxed text-stone-700">{i.say}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-2xl bg-stone-100 p-4 text-[15px] leading-relaxed text-stone-700">{FAIR_HOUSING}</p>
      </section>

      {data.isStaff && <TeamPanel logUrl={data.logUrl} />}

      {data.folderUrl && (
        <BriefDialog open={briefOpen} onClose={() => setBriefOpen(false)} files={data.files} as={as} />
      )}
    </div>
  );
}
