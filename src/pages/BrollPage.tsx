// B-Roll Library (Michael 2026-10-24): team B-roll for agents' own Reels — preview, download, Drive folder.
import { useQuery } from "convex/react";
import { ArrowLeft, Download, ExternalLink, Film, Loader2, Play, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { BROLL, BROLL_CATS, BROLL_DRIVE_URL, type BrollClip } from "@/lib/broll";
import { useSaveVideo } from "@/lib/saveVideo";

type Urls = Record<string, { url: string | null; size: number }>;

const mb = (n: number) => `${(n / 1e6).toFixed(n > 1e7 ? 0 : 1)} MB`;

function Tile({ c, onOpen }: { c: BrollClip; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="group text-left" data-testid="broll-tile">
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-[#0A0A0A] ring-1 ring-[#ebe5da]">
        <img src={`/media/broll/${c.cid}.jpg`} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex size-11 items-center justify-center rounded-full bg-black/60 text-white"><Play className="size-5 fill-white" /></span>
        </div>
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {c.isNew && <span className="rounded-full bg-[#9C7434] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">New</span>}
          {c.green && <span className="rounded-full bg-[#00B140] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Green screen</span>}
        </div>
        <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">{c.dur}s</span>
      </div>
      <div className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug">{c.title}</div>
    </button>
  );
}

function Viewer({ c, src, onClose }: { c: BrollClip; src?: { url: string | null; size: number }; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  // Shared with Reel Studio: share sheet on phones (iPhone "Save Video"), file download on a computer.
  const { state, pct, run } = useSaveVideo(src?.url, c.file, c.title);
  const busy = state === "loading";
  const go = () => run().catch(() => toast.error("Download failed. Try again, or use the Drive folder."));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center" onClick={onClose} role="dialog" aria-label={c.title}>
      <div className="flex max-h-[100svh] w-full max-w-3xl flex-col gap-4 overflow-y-auto bg-[#0A0A0A] p-4 text-white sm:flex-row sm:rounded-3xl sm:p-5" onClick={e => e.stopPropagation()}>
        <div className="relative mx-auto w-[min(62vw,300px)] shrink-0 sm:w-[280px]">
          {src?.url ? (
            <video key={c.cid} src={src.url} poster={`/media/broll/${c.cid}.jpg`} className="aspect-[9/16] w-full rounded-2xl bg-black" autoPlay loop muted playsInline controls />
          ) : (
            <div className="flex aspect-[9/16] w-full items-center justify-center rounded-2xl bg-stone-900 text-sm text-stone-400">Video is uploading…</div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start gap-2">
            <h2 className="flex-1 font-serif text-xl font-bold leading-tight">{c.title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-stone-400 hover:bg-white/10 hover:text-white"><X className="size-5" /></button>
          </div>
          <p className="mt-2 text-sm text-stone-300">{c.desc}</p>
          {c.use && <p className="mt-3 rounded-xl bg-white/5 p-3 text-[13px] text-stone-300"><span className="font-semibold text-[#D9BC8C]">Use it: </span>{c.use}</p>}
          {c.green && (
            <p className="mt-3 rounded-xl bg-[#00B140]/10 p-3 text-[13px] text-stone-300 ring-1 ring-[#00B140]/30">
              <span className="font-semibold text-[#5be08f]">Green screen: </span>in CapCut add it as an <b>Overlay</b> on top of your video, then tap <b>Remove BG → Chroma key</b> and pick the green.
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <button type="button" onClick={go} disabled={!src?.url || busy} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#D9BC8C] px-4 py-3 text-sm font-bold text-black disabled:opacity-50" data-testid="broll-download">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {busy ? `Preparing…${pct ? ` ${pct}%` : ""}` : state === "ready" ? "Ready · tap to save" : `Download${src?.size ? ` · ${mb(src.size)}` : ""}`}
            </button>
            <a href={BROLL_DRIVE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold"><ExternalLink className="size-4" /> Drive</a>
          </div>
          <p className="mt-2 text-[11px] text-stone-500">1080×1920 MP4 · {c.file}</p>
        </div>
      </div>
    </div>
  );
}

export function BrollPage() {
  const me = useQuery(api.hubMe.me);
  const rows = useQuery(api.broll.list);
  const [sp, setSp] = useSearchParams();
  const cat = sp.get("cat") ?? "all";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const urls: Urls = useMemo(() => Object.fromEntries((rows ?? []).map(r => [r.cid, { url: r.url, size: r.size }])), [rows]);
  const myName = me?.name ?? "";
  const agents = useMemo(() => [...new Set(BROLL.filter(c => c.agent).map(c => c.agent as string))].sort(), []);
  const [agent, setAgent] = useState<string>("");
  const who = agent || (agents.includes(myName) ? myName : "");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return BROLL.filter(c => {
      if (cat !== "all" && c.cat !== cat) return false;
      if (c.agent && who && c.agent !== who) return false;
      if (c.agent && !who && cat !== "personal") return false;
      if (s && !`${c.title} ${c.desc} ${c.use}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [cat, q, who]);
  const openClip = BROLL.find(c => c.cid === open);
  const newCount = BROLL.filter(c => c.isNew).length;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 lg:px-6">
      <Link to="/home" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"><ArrowLeft className="size-4" /> Home</Link>
      <div className="mt-3 overflow-hidden rounded-3xl bg-[#0A0A0A] p-5 text-white sm:p-7">
        <div className="text-[10px] font-semibold tracking-[0.25em] text-[#D9BC8C]">FOR YOUR REELS</div>
        <h1 className="mt-1 font-serif text-3xl font-bold">B-Roll Library</h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-300">
          {BROLL.length} branded clips ({newCount} new) to cut to while you talk: title cards, your own name bar and end card, seller and buyer plans, team stats, areas, the Hub app and more. All 1080×1920, ready for Instagram, TikTok and YouTube Shorts.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={BROLL_DRIVE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#D9BC8C] px-4 py-2.5 text-sm font-bold text-black"><Film className="size-4" /> Open the Drive folder</a>
        </div>
        <ul className="mt-4 grid gap-1.5 text-[13px] text-stone-400 sm:grid-cols-3">
          <li><Sparkles className="mr-1 inline size-3.5 text-[#D9BC8C]" />Cut away for 2–4 seconds when you mention the thing on screen.</li>
          <li><Sparkles className="mr-1 inline size-3.5 text-[#D9BC8C]" />Start with your name bar, end with your end card.</li>
          <li><Sparkles className="mr-1 inline size-3.5 text-[#D9BC8C]" />App numbers and "sample" figures are demo data; don't present them as real results.</li>
        </ul>
      </div>

      <div className="sticky top-16 z-30 -mx-4 mt-4 bg-background/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search: sold, buyer, CMA, open house…" className="h-11 w-full rounded-xl bg-white pl-9 pr-3 text-[15px] ring-1 ring-[#ebe5da] outline-none focus:ring-[#9C7434]" data-testid="broll-search" />
        </div>
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[{ key: "all", label: "All" }, ...BROLL_CATS].map(c => (
            <button key={c.key} type="button" onClick={() => setSp(c.key === "all" ? {} : { cat: c.key }, { replace: true })}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${cat === c.key ? "bg-[#9C7434] text-white" : "bg-white text-stone-600 ring-1 ring-[#ebe5da]"}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {(cat === "personal" || cat === "all") && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-[#ebe5da]">
          <span className="text-sm font-semibold">Your name bar &amp; end card:</span>
          <select value={who} onChange={e => setAgent(e.target.value)} className="h-9 rounded-lg bg-[#F7F5F1] px-2 text-sm ring-1 ring-[#ebe5da]" data-testid="broll-agent">
            <option value="">{cat === "personal" ? "Everyone" : "Pick your name"}</option>
            {agents.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="text-xs text-stone-500">Not on the list? Use Suggest a fix and we'll make yours.</span>
        </div>
      )}

      {BROLL_CATS.filter(g => cat === "all" || g.key === cat).map(g => {
        const items = list.filter(c => c.cat === g.key);
        if (!items.length) return null;
        return (
          <section key={g.key} className="mt-6">
            <h2 className="mb-2 flex items-baseline gap-2 font-serif text-lg font-bold">{g.label}<span className="font-sans text-xs font-normal text-stone-400">{items.length}</span></h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {items.map(c => <Tile key={c.cid} c={c} onOpen={() => setOpen(c.cid)} />)}
            </div>
          </section>
        );
      })}
      {!list.length && <p className="mt-10 text-center text-sm text-stone-500">No clips match that search.</p>}
      {openClip && <Viewer c={openClip} src={urls[openClip.cid]} onClose={() => setOpen(null)} />}
    </div>
  );
}
