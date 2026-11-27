// Reel Studio (Michael 2026-10-28): agents order a the editor-edited Reel from their own clips,
// pay by Zelle up front, Michael confirms, our editor prepares, agent downloads one file per app.
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, CirclePlus, Clapperboard, ClipboardList, Copy, Download, ExternalLink, Film, Loader2, MessageSquare,
  ArrowDown, ArrowUp, Captions, Receipt, RefreshCw, Send, Sparkles, Upload, Wallet, X, XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  CLIP_ROLES, DEFAULT_OPTIONS, EXTRA_REVISION_PRICE, FORMATS, LENGTHS, PACES, PALETTES,
  CAPTION_SPOTS, spotOf, styleOf, PURPOSES, REEL_STAGES, REEL_TIERS, SAMPLE_MATCH, SAMPLE_MAX_MB, STYLES, ctasFor, formatOf, optionRows, tierOf, type Palette, type ReelOptions, type ReelStyle,
} from "@/lib/reelStudioDefinitions";
import { placeReel, reelAction, uploadReelClip, useReelAssets, type ReelConfigResult, useReelDrive, useReelFree, useReelQueue, useReels } from "@/lib/reelStudioApi";
import { LoadError } from "@/components/hub/FormState";
import { apiErrorMessage } from "@/lib/apiData";
import { ListingPicker, type PickedListing } from "@/components/hub/ListingPicker";
import { isIOS, useSaveVideo, videoFileName } from "@/lib/saveVideo";

const errMsg = apiErrorMessage;
const money = (n: number) => `$${n.toFixed(n % 1 ? 2 : 0)}`;
const day = (t?: number) => (t ? new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");
const mb = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1e6))} MB`);

type Clip = { id: string; name: string; link: string; size: number; role?: string };

const FONT: Record<ReelStyle["font"], string> = {
  sans: "Mada, system-ui, sans-serif",
  serif: "'Playfair Display', Georgia, serif",
  condensed: "'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue', sans-serif",
  rounded: "ui-rounded, 'SF Pro Rounded', Nunito, Mada, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, monospace",
  script: "'Brush Script MT', 'Segoe Script', cursive",
};

/** Tiny 9:16 preview drawn from the style's fields + chosen colors (no video files). */
function StylePreview({ st, p, spot = "low", captions = true }: { st: ReelStyle; p: { bg: string; accent: string; text: string }; spot?: "low" | "mid" | "high"; captions?: boolean }) {
  const words = ["Just", "listed", "in", "Lincoln", "Park"];
  // Captions never sit on the face (Michael 11-08): under it (chest) or above the head.
  const pos = spot === "high" ? "top-[9%]" : spot === "mid" ? "top-[67%]" : "bottom-[13%]";
  const txt = (w: string, hi: boolean) => (st.upper ? w.toUpperCase() : w) + (hi ? "" : "");
  const base: React.CSSProperties = { fontFamily: FONT[st.font], fontWeight: st.weight, letterSpacing: st.font === "serif" && st.upper ? "0.12em" : st.font === "condensed" ? "-0.01em" : undefined };
  const accentWord = (w: string) => <span style={{ color: p.accent }}>{txt(w, true)}</span>;
  let cap: React.ReactNode;
  switch (st.caption) {
    case "pop":
    case "karaoke":
      cap = <div style={{ ...base, fontSize: 15, lineHeight: 1.05, color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,.6)" }}>{txt("Just", false)} {accentWord("listed")}</div>;
      break;
    case "box":
      cap = <div className="inline-block rounded px-1.5 py-0.5" style={{ ...base, fontSize: 11, background: p.accent, color: p.bg === p.accent ? "#fff" : p.bg }}>{txt("Just listed", false)}</div>;
      break;
    case "underline":
      cap = <div style={{ ...base, fontSize: 11, color: "#fff" }}>{txt("Just listed", false)}<div className="mx-auto mt-0.5 h-px w-10" style={{ background: p.accent }} /></div>;
      break;
    case "outline":
      cap = <div style={{ ...base, fontSize: 15, color: "transparent", WebkitTextStroke: "1px #fff" }}>{txt("Just", false)} <span style={{ color: p.accent, WebkitTextStroke: "0" }}>{txt("listed", true)}</span></div>;
      break;
    case "typewriter":
      cap = <div style={{ ...base, fontSize: 10, color: "#fff" }}>{txt("Just listed in", false)}<span className="animate-pulse" style={{ color: p.accent }}>▍</span></div>;
      break;
    case "stack":
      cap = <div style={{ ...base, fontSize: 10, color: "#fff", lineHeight: 1.15 }}><div style={{ color: p.accent, fontSize: 18 }}>3</div>{txt("things buyers miss", false)}</div>;
      break;
    default:
      cap = <div style={{ ...base, fontSize: 10, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.7)" }}>{words.slice(0, 3).map(w => txt(w, false)).join(" ")}</div>;
  }
  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg" style={{ background: `linear-gradient(160deg, #6b5b4b 0%, #2c2620 55%, #121212 100%)` }} aria-hidden>
      {(st.key === "penthouse" || st.key === "storyteller") && (<><div className="absolute inset-x-0 top-0 h-[9%] bg-black" /><div className="absolute inset-x-0 bottom-0 h-[9%] bg-black" /></>)}
      {st.key === "split_screen" && <div className="absolute inset-x-0 top-1/2 h-1/2" style={{ background: "linear-gradient(180deg,#9aa49a,#4b544b)" }} />}
      {st.key === "warm_film" && <div className="absolute inset-0" style={{ background: "rgba(255,170,90,.18)" }} />}
      {st.key === "neon_night" && <div className="absolute inset-0" style={{ background: "rgba(10,0,40,.35)" }} />}
      <div className="absolute left-1/2 top-[28%] size-[38%] -translate-x-1/2 rounded-full bg-[#d9c3a6]/70" />
      <div className="absolute left-1/2 top-[58%] h-[40%] w-[70%] -translate-x-1/2 rounded-t-[40%] bg-[#d9c3a6]/45" />
      {captions && <div className={`absolute inset-x-1 ${pos} text-center`}>{cap}</div>}
      {st.key === "trending" && <div className="absolute left-1 top-1 flex items-center gap-0.5 rounded-sm bg-[#C9A15A] px-1 text-[7px] font-bold text-black"><Sparkles className="size-2" />NOW</div>}
      <div className="absolute right-1 top-1 rounded-sm px-1 text-[7px] font-bold" style={{ background: p.bg, color: p.accent }}>SM</div>
    </div>
  );
}

type Need = "done" | "needed" | "optional";

function Section({ n, title, sub, children, id, need, missing, flash }: {
  n: number; title: string; sub?: string; children: React.ReactNode; id?: string; need?: Need; missing?: string; flash?: boolean;
}) {
  const needed = need === "needed";
  return (
    <section
      id={id}
      data-need={need}
      className={`scroll-mt-24 rounded-2xl bg-white p-4 transition-shadow sm:p-5 ${needed ? "ring-2 ring-[#C2410C]/60" : "ring-1 ring-black/5"} ${flash ? "ring-4 ring-[#C2410C] shadow-[0_0_0_8px_rgba(194,65,12,0.15)]" : ""}`}
    >
      <div className="mb-3 flex items-start gap-2.5">
        {need === "done" ? (
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#9C7434] text-white" aria-label={`Step ${n} done`}><Check className="size-4" strokeWidth={3} /></span>
        ) : (
          <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${needed ? "bg-[#C2410C] text-white" : "bg-[#0A0A0A] text-[#D9BC8C]"}`}>{n}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-lg font-bold text-[#0A0A0A]">{title}</h2>
            {needed && <span className="rounded-full bg-[#FDECE3] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[#C2410C]">Needed</span>}
            {need === "optional" && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-500">Optional</span>}
          </div>
          {needed && missing && <p className="mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold text-[#C2410C]"><AlertTriangle className="size-4 shrink-0" /> {missing}</p>}
          {sub && <p className="text-[15px] text-stone-600">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Chips<T extends string>({ options, value, onChange, multi, label }: {
  options: { key: string; label: string; hint?: string }[];
  value: T | T[];
  onChange: (v: T) => void;
  multi?: boolean;
  label: string;
}) {
  const on = (k: string) => (multi ? (value as string[]).includes(k) : value === k);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map(o => (
        <button
          key={o.key}
          type="button"
          aria-pressed={on(o.key)}
          onClick={() => onChange(o.key as T)}
          className={`rounded-xl px-3.5 py-2 text-left text-[15px] ring-1 transition ${on(o.key) ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-[#F7F5F1] text-stone-800 ring-black/10 hover:ring-[#9C7434]"}`}
        >
          <span className="font-semibold">{o.label}</span>
          {o.hint && <span className={`block text-sm ${on(o.key) ? "text-stone-300" : "text-stone-500"}`}>{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-[#F7F5F1] px-3.5 py-2.5 text-[15px] ring-1 ring-black/10">
      <span className="font-medium text-stone-800">{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${on ? "bg-[#9C7434]" : "bg-stone-300"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/** Reference footage guides cuts and story structure. */
function SamplePicker({ sample, onChange, as }: { as?: string; sample: ReelOptions["sample"]; onChange: (s: ReelOptions["sample"]) => void }) {
  const [uploading, setUploading] = useState(false);
  const on = !!sample;
  const s = sample ?? { match: SAMPLE_MATCH.filter(m => m.key === "edit" || m.key === "story").map(m => m.key) };
  const upload = async (f?: File) => {
    if (!f) return;
    if (!/^video\//.test(f.type) && !/\.(mov|mp4|m4v|webm)$/i.test(f.name)) return toast.error("Pick a video file");
    if (f.size > SAMPLE_MAX_MB * 1e6) return toast.error(`Keep the sample under ${SAMPLE_MAX_MB} MB, or paste a link instead.`);
    setUploading(true);
    try {
      const { id: storageId } = await uploadReelClip(f, as);
      onChange({ ...s, link: undefined, storageId, fileName: f.name, size: f.size });
      toast.success("Sample uploaded");
    } catch {
      toast.error("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="rounded-xl bg-[#F7F5F1] p-3 ring-1 ring-black/10" data-testid="sample-picker">
      <Toggle on={on} set={b => onChange(b ? { ...s } : undefined)} label="Use a video as an editing reference" />
      {!on && <p className="mt-1.5 text-sm text-stone-500">Seen a Reel you love? Add it and our editor prepares yours the same way.</p>}
      {on && (
        <div className="mt-3 space-y-3">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 text-[15px] ring-1 ring-black/10">
              {uploading ? <Loader2 className="size-4 animate-spin text-[#9C7434]" /> : <Upload className="size-4 text-[#9C7434]" />}
              <span className="min-w-0 flex-1 truncate">{uploading ? "Uploading…" : s.fileName ? `${s.fileName} · ${mb(s.size ?? 0)}` : `Choose a video (screen recording is fine, up to ${SAMPLE_MAX_MB} MB)`}</span>
              <input type="file" accept="video/*" className="sr-only" disabled={uploading} onChange={e => upload(e.target.files?.[0])} aria-label="Upload sample video" />
            </label>
          <div>
            <div className="mb-1.5 text-sm font-semibold text-stone-700">What should match?</div>
            <Chips label="What to match" multi options={SAMPLE_MATCH.filter(m => m.key === "edit" || m.key === "story")} value={s.match} onChange={k => onChange({ ...s, match: s.match.includes(k) ? s.match.filter(x => x !== k) : [...s.match, k] })} />
          </div>
          <p className="text-sm text-stone-500">The reference helps guide the edit. The reel uses your footage and branding.</p>
        </div>
      )}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-black/10">
      <div className="min-w-0">
        <div className="text-sm text-stone-500">{label}</div>
        <div className="truncate text-[17px] font-bold text-[#0A0A0A]">{value}</div>
      </div>
      <button type="button" onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("Copied"))} className="flex shrink-0 items-center gap-1 rounded-lg bg-[#0A0A0A] px-3 py-2 text-sm font-semibold text-white">
        <Copy className="size-4" /> Copy
      </button>
    </div>
  );
}

// ---------- order form ----------

// ---------- direct phone upload (Michael 11-08: "the uploading is really confusing") ----------
// Each clip goes up in 16 MB parts, 3 at a time, each part retried, so big 4K files from a phone
// keep each storage upload small and retry individual parts.
const MAX_UPLOAD = 5 * 1024 ** 3;
type UpJob = { key: string; name: string; size: number; done: number; state: "uploading" | "done" | "error"; err?: string; clipId?: string; lowQ?: boolean };

function useClipUpload(as: string | undefined, onUploaded: (c: Clip) => void) {
  const [jobs, setJobs] = useState<UpJob[]>([]);
  const retryFiles = useRef(new Map<string, File>());
  const patch = (key: string, p: Partial<UpJob>) => setJobs(js => js.map(j => (j.key === key ? { ...j, ...p } : j)));
  const busy = jobs.some(j => j.state === "uploading");

  // Keep the screen awake and warn before leaving while a clip is going up.
  useEffect(() => {
    if (!busy) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then(l => { lock = l; }).catch(() => null);
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); lock?.release().catch(() => null); };
  }, [busy]);

  const uploadOne = async (file: File, key: string) => {
    const clip = await uploadReelClip(file, as, done => patch(key, { done }));
    retryFiles.current.delete(key);
    patch(key, { state: "done", done: file.size, clipId: clip.id });
    onUploaded(clip);
  };

  const start = (file: File, key: string) => {
    patch(key, { state: "uploading", done: 0, err: undefined });
    void uploadOne(file, key).catch(error => patch(key, { state: "error", err: errMsg(error) }));
  };
  const add = (files: FileList | null) => {
    const list = Array.from(files ?? []);
    for (const f of list) {
      const key = `${f.name}-${f.size}-${Date.now()}-${Math.random()}`;
      if (f.size > MAX_UPLOAD) {
        setJobs(js => [...js, { key, name: f.name, size: f.size, done: 0, state: "error", err: "Over 5 GB. Trim it on your phone first." }]);
        continue;
      }
      // WhatsApp/Messages copies are squashed; a few MB for a real clip usually means a copy.
      const lowQ = /whatsapp|^IMG-\d{8}-WA/i.test(f.name) || f.size < 4_000_000;
      setJobs(js => [...js, { key, name: f.name, size: f.size, done: 0, state: "uploading", lowQ }]);
      retryFiles.current.set(key, f);
      start(f, key);
    }
  };
  const retry = (key: string) => {
    const file = retryFiles.current.get(key);
    if (file) start(file, key);
  };
  const clear = (key: string) => {
    retryFiles.current.delete(key);
    setJobs(js => js.filter(j => j.key !== key));
  };
  const total = jobs.filter(j => j.state === "uploading").reduce((s, j) => s + j.size, 0);
  const done = jobs.filter(j => j.state === "uploading").reduce((s, j) => s + j.done, 0);
  return { jobs, add, retry, clear, canRetry: (key: string) => retryFiles.current.has(key), busy, pct: total ? Math.min(99, Math.round((done / total) * 100)) : 100, left: jobs.filter(j => j.state === "uploading").length };
}

function UploadBox({ up, picked }: { up: ReturnType<typeof useClipUpload>; picked: Clip[] }) {
  return (
    <div className="space-y-2" data-testid="clip-uploader">
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-[#C9A86A] bg-[#FBF6EC] px-4 py-4 transition hover:bg-[#F7EEDC]">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#0A0A0A]"><Upload className="size-6 text-[#D9BC8C]" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-bold text-[#0A0A0A]">Add videos from your phone</span>
          <span className="block text-sm text-stone-600">Opens your camera roll. Pick one or several. Full quality, big 4K files are fine.</span>
        </span>
        <input type="file" accept="video/*" multiple className="sr-only" onChange={e => { up.add(e.target.files); e.target.value = ""; }} aria-label="Add videos from your phone" />
      </label>
      {up.jobs.length > 0 && (
        <ul className="space-y-1.5">
          {up.jobs.map(j => {
            const pct = j.state === "done" ? 100 : Math.round((j.done / Math.max(1, j.size)) * 100);
            const inReel = j.clipId && picked.some(p => p.id === j.clipId);
            return (
              <li key={j.key} className="rounded-xl bg-[#F7F5F1] px-3 py-2.5 ring-1 ring-black/5" data-testid="upload-row">
                <div className="flex items-center gap-2.5">
                  {j.state === "uploading" ? <Loader2 className="size-5 shrink-0 animate-spin text-[#9C7434]" /> : j.state === "done" ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" /> : <XCircle className="size-5 shrink-0 text-[#C2410C]" />}
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{j.name}</span>
                  <span className="shrink-0 text-sm text-stone-500">
                    {j.state === "uploading" ? `${pct}% of ${mb(j.size)}` : j.state === "done" ? (inReel ? "Done · in your Reel" : "Done") : ""}
                  </span>
                  {j.state === "error" && up.canRetry(j.key) && <button type="button" onClick={() => up.retry(j.key)} className="shrink-0 text-sm font-semibold text-[#9C7434] underline">Retry</button>}
                  {j.state === "error" && <button type="button" onClick={() => up.clear(j.key)} className="shrink-0 text-sm text-stone-600 underline">Clear</button>}
                </div>
                {j.state === "uploading" && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-[#9C7434] transition-[width]" style={{ width: `${Math.max(3, pct)}%` }} /></div>
                )}
                {j.state === "error" && <p className="mt-1 text-sm text-[#C2410C]">{j.err}</p>}
                {j.lowQ && j.state !== "error" && <p className="mt-1 text-sm text-amber-700">This looks like a compressed copy. For the sharpest Reel, use the original from your camera roll.</p>}
              </li>
            );
          })}
        </ul>
      )}
      {up.busy && <p className="text-sm font-medium text-stone-600">Keep this screen open until every video says Done. You can keep filling in the steps below.</p>}
    </div>
  );
}

function NewReel({ as, testPayment, onPlaced }: { as?: string; testPayment: boolean; onPlaced: () => void }) {
  const { data: vids, reload: refresh, error: driveError } = useReelDrive(as);
  const freeInfo = useReelFree(as);
  const freeLeft = freeInfo?.left ?? 0;
  const isFree = !testPayment && freeLeft > 0;
  const [tierKey, setTierKey] = useState<"quick" | "signature">("signature");
  const [o, setO] = useState<ReelOptions>({ ...DEFAULT_OPTIONS, music: "none", broll: ["none"] });
  const [picked, setPicked] = useState<Clip[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const orderKey = useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const tier = tierOf(tierKey);
  const hubUps = useReelAssets(as);
  const maxRef = useRef(tier.maxClips);
  maxRef.current = tier.maxClips;
  // A finished phone upload goes straight into the Reel (in the order it finished).
  const up = useClipUpload(as, c =>
    setPicked(p => {
      if (p.some(x => x.id === c.id)) return p;
      if (p.length >= maxRef.current) {
        setTimeout(() => toast.message(`${c.name} uploaded. Your Reel already has ${maxRef.current} clip${maxRef.current === 1 ? "" : "s"}, so it's in the list below.`), 0);
        return p;
      }
      return [...p, { ...c, role: maxRef.current === 1 || p.length === 0 ? "talk" : undefined }];
    }),
  );
  const [flash, setFlash] = useState<string | null>(null);
  const set = <K extends keyof ReelOptions>(k: K, val: ReelOptions[K]) => setO(p => ({ ...p, [k]: val }));
  const toggleFormat = (key: string) => setO(p => ({ ...p, formats: p.formats.includes(key) ? p.formats.filter(format => format !== key) : [...p.formats, key] }));

  useEffect(() => {
    if (o.lengthSec > tier.maxSeconds) set("lengthSec", tier.maxSeconds);
    if (picked.length > tier.maxClips) setPicked(picked.slice(0, tier.maxClips));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierKey]);

  const doRefresh = () => {
    setRefreshing(true);
    refresh().finally(() => setRefreshing(false));
  };
  const driveFiles = (vids?.files ?? []).filter(f => /video|quicktime|mp4/i.test(f.mimeType) || /\.(mov|mp4|m4v)$/i.test(f.name));
  const files = [...(hubUps ?? []), ...driveFiles];
  const driveMessage = driveError ? "Team Drive is unavailable. You can still upload clips directly." : null;
  const pick = (f: Clip) => {
    if (picked.some(p => p.id === f.id)) return setPicked(picked.filter(p => p.id !== f.id));
    if (tier.maxClips === 1) return setPicked([{ ...f, role: "talk" }]);
    if (picked.length >= tier.maxClips) return toast.error(`Up to ${tier.maxClips} clips. Choose Signature for more.`);
    setPicked([...picked, { ...f, role: picked.length === 0 ? "talk" : undefined }]);
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= picked.length) return;
    const next = [...picked];
    [next[i], next[j]] = [next[j], next[i]];
    setPicked(next);
  };
  const needsAddress = ["just_listed", "just_sold", "open_house", "tour", "business"].includes(o.purpose);
  // "Use one of your listings" → Reel type, address and the price/MLS # for the editor.
  const fromListing = (l: PickedListing) => {
    setO(p => ({
      ...p,
      purpose: ["just_listed", "just_sold", "open_house", "tour"].includes(p.purpose) ? (l.status === "Closed" && p.purpose === "just_listed" ? "just_sold" : p.purpose) : l.status === "Closed" ? "just_sold" : "just_listed",
      address: l.address,
    }));
    const facts = [l.price && `List price ${l.price}`, l.mlsNumber && `MLS #${l.mlsNumber}`, l.website && `Property page ${l.website}`].filter(Boolean).join(" · ");
    if (facts) setNotes(n => (n.includes(l.address) ? n : `${n ? `${n}\n` : ""}${l.address}: ${facts}`));
    toast.success(`Filled in from ${l.address}`);
  };
  const [allStyles, setAllStyles] = useState(false);
  const shownStyles = allStyles ? STYLES : STYLES.filter(st => st.for.includes("all") || st.for.includes(o.purpose));
  const palNow: Palette = (() => {
    const p0 = PALETTES.find(p => p.key === o.palette) ?? PALETTES[0];
    return o.palette === "custom" ? { ...p0, bg: o.customBg ?? p0.bg, accent: o.customAccent ?? p0.accent } : p0;
  })();
  const ctas = ctasFor(o.purpose);
  useEffect(() => {
    if (!ctas.some(c => c.key === o.cta)) set("cta", "call");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.purpose]);
  const sampleOk = !o.sample || !!o.sample.storageId || /^https?:\/\/\S+$/i.test(o.sample.link?.trim() ?? "");
  const ctaOk = o.cta !== "custom" || !!o.ctaText?.trim();
  const fmtStep = 7;
  // What's still missing, in page order. Drives the step flags and the bottom bar.
  const missing: { key: string; label: string; section: string }[] = [];
  if (up.busy) missing.push({ key: "uploading", label: `Uploading ${up.left} video${up.left === 1 ? "" : "s"} · ${up.pct}%`, section: "reel-step-clips" });
  else if (!picked.length) missing.push({ key: "clips", label: "Add your videos (step 2)", section: "reel-step-clips" });
  if (!sampleOk) missing.push({ key: "sample", label: "Add the sample video (step 4)", section: "reel-step-look" });
  if (!ctaOk) missing.push({ key: "cta", label: "Write your call to action (step 6)", section: "reel-step-cta" });
  if (!o.formats.length) missing.push({ key: "formats", label: `Pick where you'll post (step ${fmtStep})`, section: "reel-step-formats" });
  const ready = missing.length === 0;
  const has = (k: string) => missing.some(m => m.key === k);
  const goTo = (section: string) => {
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlash(section);
    setTimeout(() => setFlash(f => (f === section ? null : f)), 1600);
  };

  const submit = async () => {
    if (!ready) {
      const first = missing[0];
      if (first.key !== "uploading") goTo(first.section);
      return toast.error(first.key === "uploading" ? "Your videos are still uploading. Order as soon as they say Done." : first.label.replace(/ \(step \d+\)/, ""));
    }
    setBusy(true);
    try {
      const { font, weight, upper, caption, motion } = styleOf(o.style)!;
      await placeReel({ requestId: orderKey.current ??= crypto.randomUUID(), testPayment, tier: tierKey, options: { ...o, renderStyle: { font, weight, upper, caption, motion, bg: palNow.bg, accent: palNow.accent, text: palNow.text } }, clips: picked.map(({ id, name, link, size, role }) => ({ id, name, link, size, role: o.autoOrder ? undefined : role })), notes: notes || undefined, as });
      toast.success(testPayment ? "Test request added. Mark the test payment as sent." : isFree ? `Free Reel ordered. It's in line for editing.${freeLeft > 1 ? ` ${freeLeft - 1} free left.` : ""}` : "Order placed. Send the Zelle to start.");
      onPlaced();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 pb-40 md:pb-28">
      {testPayment && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">
          <strong>Test reel request.</strong> Use the test payment on this order to exercise approval and editing without transferring money.
        </div>
      )}
      {isFree && (
        <div className="flex items-center gap-2 rounded-2xl bg-[#0A0A0A] px-4 py-3 text-[15px] text-white" data-testid="first-free">
          <span className="shrink-0 rounded-full bg-[#9C7434] px-2.5 py-0.5 text-sm font-bold">FREE</span>
          <span data-testid="free-left">
            {freeLeft === freeInfo?.total ? `Your first ${freeInfo.total} Reels are on us.` : `You have ${freeLeft} free Reel${freeLeft === 1 ? "" : "s"} left.`} Either package, no Zelle needed.
          </span>
        </div>
      )}
      {driveMessage && <p role="status" className="text-sm text-stone-600">{driveMessage}</p>}
      <Section n={1} need="done" title="Pick a package" sub={testPayment ? "This order uses a simulated payment." : isFree ? `${freeLeft} free left. After that, pay by Zelle before editing starts.` : "Pay by Zelle before editing starts."}>
        <div className="grid gap-2 sm:grid-cols-2">
          {REEL_TIERS.map(t => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tierKey === t.key}
              onClick={() => setTierKey(t.key)}
              className={`rounded-2xl p-4 text-left ring-2 transition ${tierKey === t.key ? "bg-[#0A0A0A] text-white ring-[#9C7434]" : "bg-[#F7F5F1] ring-transparent hover:ring-black/10"}`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-xl font-bold">{t.name}</span>
                <span className={`font-serif text-3xl font-bold ${tierKey === t.key ? "text-[#D9BC8C]" : "text-[#9C7434]"}`}>
                  {isFree ? <><s className="mr-1.5 text-lg font-normal opacity-60">{money(t.price)}</s>Free</> : money(t.price)}
                </span>
              </div>
              <p className={`mt-1 text-[15px] ${tierKey === t.key ? "text-stone-300" : "text-stone-600"}`}>{t.blurb}</p>
              <ul className="mt-2 space-y-1 text-[15px]">
                {t.includes.map(i => (
                  <li key={i} className="flex items-center gap-2"><Check className={`size-4 ${tierKey === t.key ? "text-[#D9BC8C]" : "text-[#9C7434]"}`} /> {i}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-stone-500">Every app size you pick is included. Extra revisions are {money(EXTRA_REVISION_PRICE)} each.</p>
      </Section>

      <Section
        n={2}
        id="reel-step-clips"
        flash={flash === "reel-step-clips"}
        need={has("clips") ? "needed" : has("uploading") ? undefined : "done"}
        missing="Add at least one video"
        title="Add your videos"
        sub={`Up to ${tier.maxClips}. Filmed in parts (in the car, arriving, the property, sitting down)? Add them all. The editor stitches them into one Reel.`}
      >
        <UploadBox up={up} picked={picked} />
        {(vids === undefined || files.length > 0) && (
          <div className="mt-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-stone-700">Or pick videos you already uploaded{picked.length > 0 ? ` · ${picked.length} in your Reel` : ""}</span>
              <button type="button" onClick={doRefresh} disabled={refreshing} className="flex items-center gap-1.5 rounded-lg bg-stone-100 px-2.5 py-1 text-sm font-semibold text-stone-700">
                {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Refresh
              </button>
            </div>
            {vids === undefined ? (
              <div className="h-20 animate-pulse rounded-xl bg-stone-100" />
            ) : (
              <ul className="grid max-h-80 gap-1.5 overflow-y-auto sm:grid-cols-2" data-testid="clip-list">
                {files.map(f => {
                  const on = picked.some(p => p.id === f.id);
                  return (
                    <li key={f.id}>
                      <button type="button" aria-pressed={on} onClick={() => pick(f)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left ring-1 ${on ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-[#F7F5F1] ring-black/10"}`}>
                        <span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${on ? "bg-[#9C7434]" : "bg-white ring-1 ring-black/15"}`}>{on && <Check className="size-4" />}</span>
                        <Film className={`size-4 shrink-0 ${on ? "text-[#D9BC8C]" : "text-stone-400"}`} />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{f.name}</span>
                        <span className={`shrink-0 text-sm ${on ? "text-stone-300" : "text-stone-500"}`}>{f.link === "hub" ? "Added here · " : ""}{mb(f.size)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        {picked.length > 0 && (
          <div className="mt-3 rounded-xl bg-[#F7F5F1] p-3 ring-1 ring-black/5" data-testid="clip-order">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-stone-700">Order in the Reel</span>
              {picked.length > 0 && (
                <button
                  type="button"
                  aria-pressed={!!o.autoOrder}
                  onClick={() => set("autoOrder", !o.autoOrder)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition ${o.autoOrder ? "bg-[#0A0A0A] text-[#D9BC8C] ring-[#0A0A0A]" : "bg-white text-stone-800 ring-[#C9A86A] hover:bg-[#FBF6EC]"}`}
                >
                  {o.autoOrder ? <Check className="size-4" /> : <Sparkles className="size-4 text-[#9C7434]" />}
                  {o.autoOrder ? "the editor will figure it out" : "Figure it out for me"}
                </button>
              )}
            </div>
            {o.autoOrder ? (
              <div className="space-y-2" data-testid="auto-order">
                <p className="rounded-lg bg-white px-3 py-2.5 text-[15px] text-stone-700 ring-1 ring-black/5">
                  I'll watch every clip, work out what each one is (you talking, driving, arriving, the walkthrough, shots of the place) and put them in the order that tells the best story. Use the box at the bottom if you want something specific.
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {picked.map(c => (
                    <li key={c.id} className="flex max-w-full items-center gap-1 rounded-full bg-white py-1 pl-3 pr-1 text-sm ring-1 ring-black/5">
                      <span className="truncate">{c.name}</span>
                      <button type="button" onClick={() => setPicked(picked.filter(p => p.id !== c.id))} className="rounded-full p-0.5 text-stone-400" aria-label={`Remove ${c.name}`}><X className="size-3.5" /></button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => set("autoOrder", false)} className="text-sm font-medium text-[#9C7434] underline underline-offset-2">I'd rather set the order myself</button>
              </div>
            ) : (
            <ol className="space-y-1.5">
              {picked.map((c, i) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-2 ring-1 ring-black/5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#0A0A0A] text-xs font-bold text-[#D9BC8C]">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{c.name}</span>
                  <select value={c.role ?? ""} onChange={e => setPicked(picked.map(p => (p.id === c.id ? { ...p, role: e.target.value || undefined } : p)))} className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-sm" aria-label={`What clip ${i + 1} is`}>
                    <option value="">Not sure (I'll figure it out)</option>
                    {CLIP_ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                  <span className="flex gap-0.5">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-stone-500 disabled:opacity-30" aria-label="Move up"><ArrowUp className="size-4" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === picked.length - 1} className="rounded p-1 text-stone-500 disabled:opacity-30" aria-label="Move down"><ArrowDown className="size-4" /></button>
                    <button type="button" onClick={() => setPicked(picked.filter(p => p.id !== c.id))} className="rounded p-1 text-stone-400" aria-label="Remove"><X className="size-4" /></button>
                  </span>
                </li>
              ))}
            </ol>
            )}
          </div>
        )}
      </Section>

      <Section n={3} need="done" title="What's it for?">
        <ListingPicker className="mb-3" label="For one of your listings?" onPick={fromListing} hint="Sets the Reel type and address, and adds the price and MLS # to your notes for the editor." />
        <Chips label="Reel type" options={PURPOSES} value={o.purpose} onChange={k => set("purpose", k)} />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-sm text-stone-600">Headline on screen (optional)
            <input value={o.title ?? ""} onChange={e => set("title", e.target.value)} maxLength={120} placeholder="e.g. 3 things buyers miss in Lincoln Park" className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[15px] text-[#0A0A0A]" />
          </label>
          {needsAddress && (
            <label className="text-sm text-stone-600">Property address
              <input value={o.address ?? ""} onChange={e => set("address", e.target.value)} maxLength={160} placeholder="2202 N Clybourn Ave #3" className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[15px] text-[#0A0A0A]" />
            </label>
          )}
        </div>
      </Section>

      <Section n={4} id="reel-step-look" flash={flash === "reel-step-look"} need={has("sample") ? "needed" : "done"} missing="Paste the sample link or upload it, or switch the sample off" title="Look & branding">
        <div className="space-y-4">
          <SamplePicker as={as} sample={o.sample} onChange={smp => set("sample", smp)} />
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-stone-700">Style · Trending now + {STYLES.length - 1} SpaceMatch originals</span>
              <span className="inline-flex rounded-full bg-stone-100 p-0.5 text-sm">
                <button type="button" onClick={() => setAllStyles(false)} className={`rounded-full px-3 py-1 ${!allStyles ? "bg-white font-semibold shadow-sm" : "text-stone-600"}`}>Best for this Reel</button>
                <button type="button" onClick={() => setAllStyles(true)} className={`rounded-full px-3 py-1 ${allStyles ? "bg-white font-semibold shadow-sm" : "text-stone-600"}`}>All styles</button>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6" role="group" aria-label="Style">
              {shownStyles.map(st => (
                <button key={st.key} type="button" aria-pressed={o.style === st.key} onClick={() => setO(prev => ({ ...prev, style: st.key, captionSpot: spotOf(st) }))} title={st.hint} className={`rounded-xl p-1.5 text-left ring-2 transition ${o.style === st.key ? "bg-white ring-[#9C7434]" : "bg-[#F7F5F1] ring-transparent hover:ring-black/10"}`}>
                  <StylePreview st={st} p={palNow} spot={o.style === st.key ? (o.captionSpot ?? spotOf(st)) : spotOf(st)} captions={o.captions} />
                  <div className="mt-1 truncate text-sm font-semibold">{st.label}</div>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-sm text-stone-600">The selected style sets the captions and title treatment.</p>
            {o.style === "trending" && (
              <div className="mt-2 rounded-xl bg-[#F7F5F1] px-3 py-2 text-sm text-stone-700" data-testid="trend-pick">
                Choose a style to guide the look of your reel.
              </div>
            )}
            {tier.broll && o.style !== "trending" && <p className="mt-1 text-sm text-stone-500">Add supporting footage in the clip picker and tag it as B-roll.</p>}
          </div>
          <div data-testid="caption-spot">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-stone-700">Captions</span>
              <span className="inline-flex rounded-full bg-stone-100 p-0.5 text-sm">
                <button type="button" aria-pressed={o.captions} onClick={() => set("captions", true)} className={`rounded-full px-3 py-1 ${o.captions ? "bg-white font-semibold shadow-sm" : "text-stone-600"}`}>On</button>
                <button type="button" aria-pressed={!o.captions} onClick={() => set("captions", false)} className={`rounded-full px-3 py-1 ${!o.captions ? "bg-white font-semibold shadow-sm" : "text-stone-600"}`}>Off</button>
              </span>
            </div>
            {o.captions ? (
              <>
                <Chips label="Where captions go" options={CAPTION_SPOTS} value={o.captionSpot ?? spotOf(styleOf(o.style))} onChange={k => set("captionSpot", k as "low" | "mid" | "high")} />
                <p className="mt-1.5 text-sm text-stone-500">Choose where the captions sit. You can fix their wording after delivery for free.</p>
              </>
            ) : (
              <p className="text-sm text-stone-500">No words on screen except titles and the end card.</p>
            )}
          </div>
          <div>
            <div className="mb-1.5 text-sm font-semibold text-stone-700">Colors · {palNow.label}</div>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9 md:grid-cols-13" role="group" aria-label="Colors">
              {PALETTES.map(p => (
                <button key={p.key} type="button" aria-pressed={o.palette === p.key} aria-label={p.label} title={p.label} onClick={() => set("palette", p.key)} className={`flex aspect-square overflow-hidden rounded-lg ring-2 ring-offset-1 ${o.palette === p.key ? "ring-[#9C7434]" : "ring-black/10"}`}>
                  {p.key === "custom" ? (
                    <span className="flex size-full items-center justify-center bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)] text-xs font-bold text-white [text-shadow:0_1px_2px_#000]">Mine</span>
                  ) : (<><span className="h-full w-1/2" style={{ background: p.bg }} /><span className="h-full w-1/2" style={{ background: p.accent }} /></>)}
                </button>
              ))}
            </div>
            {o.palette === "custom" && (
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-stone-600">
                <label className="flex items-center gap-2">Main color <input type="color" value={o.customBg ?? "#0A0A0A"} onChange={e => set("customBg", e.target.value)} className="h-9 w-12 rounded" /></label>
                <label className="flex items-center gap-2">Accent color <input type="color" value={o.customAccent ?? "#9C7434"} onChange={e => set("customAccent", e.target.value)} className="h-9 w-12 rounded" /></label>
              </div>
            )}
          </div>
          <div>
            <div className="mb-1.5 text-sm font-semibold text-stone-700">Branding</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle on={o.logo} set={b => set("logo", b)} label="SpaceMatch logo" />
              <Toggle on={o.headshot} set={b => set("headshot", b)} label="My headshot" />
              <Toggle on={o.nameBar} set={b => set("nameBar", b)} label="My name bar" />
              <Toggle on={o.endCard} set={b => set("endCard", b)} label="End card" />
            </div>
            <p className="mt-1.5 text-sm text-stone-500">The end card shows the office line (773) 985-7153, plus the line "SpaceMatch Inc. · a team of Real Broker, LLC".</p>
          </div>
        </div>
      </Section>

      <Section n={5} need="done" title="Length, pace & sound">
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-sm font-semibold text-stone-700">Length</div>
            <Chips label="Length" options={LENGTHS.filter(l => l <= tier.maxSeconds).map(l => ({ key: String(l), label: `${l} sec` }))} value={String(o.lengthSec)} onChange={k => set("lengthSec", Number(k))} />
          </div>
          <div>
            <div className="mb-1.5 text-sm font-semibold text-stone-700">Pace</div>
            <Chips label="Pace" options={PACES} value={o.pace} onChange={k => set("pace", k)} />
          </div>
          <div>
            <Chips label="Sound" options={[{ key: "none", label: "Original audio" }, { key: "none_trending", label: "Add music later in the posting app" }]} value={o.music} onChange={k => set("music", k)} />
          </div>
        </div>
      </Section>

      <Section n={6} id="reel-step-cta" flash={flash === "reel-step-cta"} need={has("cta") ? "needed" : "done"} missing="Type your own call to action, or pick one of the others" title="Call to action" sub="Shown at the end. Options change with the Reel type.">
        <Chips label="Call to action" options={ctas} value={o.cta} onChange={k => set("cta", k)} />
        {o.cta === "custom" && (
          <input value={o.ctaText ?? ""} onChange={e => set("ctaText", e.target.value)} maxLength={80} placeholder='e.g. Text me "LOFT" for the floor plan' className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[15px]" aria-label="Your call to action" />
        )}
      </Section>

      <Section n={fmtStep} id="reel-step-formats" flash={flash === "reel-step-formats"} need={has("formats") ? "needed" : "done"} missing="Pick at least one app" title="Where will you post it?" sub="You get a file sized for each one. All included.">
        <div className="grid gap-1.5 sm:grid-cols-2" role="group" aria-label="Formats">
          {FORMATS.map(f => {
            const on = o.formats.includes(f.key);
            return (
              <button key={f.key} type="button" aria-pressed={on} onClick={() => toggleFormat(f.key)} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left ring-1 ${on ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-[#F7F5F1] ring-black/10"}`}>
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${on ? "bg-[#9C7434]" : "bg-white ring-1 ring-black/15"}`}>{on && <Check className="size-4" />}</span>
                <span className="flex-1 text-[15px] font-semibold">{f.label}</span>
                <span className={`text-sm ${on ? "text-stone-300" : "text-stone-500"}`}>{f.size}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section n={fmtStep + 1} need={notes.trim() ? "done" : "optional"} title="Anything else you want, or want turned off?" sub="Optional. Describe the direction too: the story, the vibe, what to open with.">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={1500} rows={3} placeholder="e.g. Open on the drive up, then the front door. Make it feel like a movie trailer. Cut the part where I trip on the stairs." className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[15px]" aria-label="Anything else" />
      </Section>

      {/* Order bar. Sits above the phone tab bar (shown below md), so it never hides behind it (Michael 11-08). */}
      <div className="fixed inset-x-0 bottom-[calc(4.25rem_+_env(safe-area-inset-bottom))] z-30 px-3 md:bottom-4" data-testid="order-bar">
        <div className="mx-auto max-w-3xl rounded-2xl bg-[#0A0A0A] px-4 py-3 text-white shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold">{tier.name} · {picked.length || "no"} clip{picked.length === 1 ? "" : "s"} · {o.formats.length} format{o.formats.length === 1 ? "" : "s"}</div>
              {ready ? (
                <div className="flex items-center gap-1.5 text-sm text-emerald-300"><CheckCircle2 className="size-4" /> All set. {testPayment ? "Editing starts after test approval" : isFree ? "Free reel, queued when you submit" : "Editing starts after Zelle confirmation"}</div>
              ) : (
                <div className="text-sm text-[#F5B38F]" data-testid="missing-count">{missing.length === 1 ? "1 thing left" : `${missing.length} things left`}</div>
              )}
            </div>
            <button type="button" onClick={submit} disabled={busy} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 font-bold disabled:opacity-60 ${ready ? "bg-[#9C7434]" : "bg-stone-700 text-stone-200"}`} data-testid="place-order" data-ready={ready}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : ready ? <Wallet className="size-4" /> : <ArrowDown className="size-4" />} {ready ? testPayment ? "Add test request" : `Order · ${isFree ? "Free" : money(tier.price)}` : "What's left"}
            </button>
          </div>
          {!ready && (
            <div className="mt-2 flex flex-wrap gap-1.5" data-testid="missing-list">
              {missing.map(m => (
                <button key={m.key} type="button" onClick={() => goTo(m.section)} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-sm font-medium text-white ring-1 ring-white/15">
                  {m.key === "uploading" ? <Loader2 className="size-3.5 animate-spin" /> : <AlertTriangle className="size-3.5 text-[#F5B38F]" />} {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- order cards ----------

type MyOrder = NonNullable<ReturnType<typeof useMineType>>[number];
function useMineType() {
  return useReels().data;
}

const TONE: Record<string, string> = {
  awaiting_payment: "bg-amber-100 text-amber-900",
  revision_payment: "bg-amber-100 text-amber-900",
  payment_sent: "bg-sky-100 text-sky-900",
  queued: "bg-stone-200 text-stone-800",
  editing: "bg-[#D9BC8C]/40 text-[#5c4420]",
  needs_info: "bg-red-100 text-red-800",
  delivered: "bg-emerald-100 text-emerald-900",
  done: "bg-stone-100 text-stone-600",
  cancelled: "bg-stone-100 text-stone-500",
};
export function ReelStatus({ s, label }: { s: string; label: string }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold ${TONE[s] ?? "bg-stone-100"}`}>{label}</span>;
}

function PayCard({ o, zelleTo }: { o: MyOrder; zelleTo: string }) {
  const markSent = reelAction("sent");
  const p = o.openPayment;
  if (!p) return null;
  if (p.test) {
    return (
      <div className="mt-3 space-y-2 rounded-xl bg-amber-50 p-4 text-amber-900" data-testid="test-pay-card">
        <div className="font-semibold">Test payment · {money(p.amount)}</div>
        <p className="text-sm">{p.status === "sent" ? "Open Profile → Approve requests to review this payment." : "Simulate the transfer here. No money is required."}</p>
        {p.note && <p className="text-sm">{p.note}</p>}
        {p.status === "sent" ? (
          <Link to="/reels?tab=orders" className="inline-block text-sm font-semibold underline">Open approval queue</Link>
        ) : (
          <button type="button" className="rounded-lg bg-[#9C7434] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => markSent({ id: o._id }).then(() => toast.success("Test payment sent for approval.")).catch(e => toast.error(errMsg(e)))}
            data-testid="sent-test-payment">Mark test payment sent</button>
        )}
      </div>
    );
  }

  if (p.status === "sent")
    return (
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-[15px] text-sky-900">
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" /> Staff is checking for your {money(p.amount)} Zelle (memo {p.code}). You'll get an email when it's confirmed, and Editing starts editing right after.
      </div>
    );
  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-[#F7F5F1] p-4 ring-1 ring-[#9C7434]/30" data-testid="pay-card">
      <div className="flex items-baseline justify-between">
        <div className="font-bold text-[#0A0A0A]">Pay {money(p.amount)} by Zelle</div>
        <div className="text-sm text-stone-500">{p.kind === "revision" ? "Extra revision" : o.tierName}</div>
      </div>
      <CopyRow label="Send Zelle to" value={zelleTo} />
      <CopyRow label="Put this code in the memo" value={p.code} />
      <CopyRow label="Amount" value={money(p.amount)} />
      {o.statusNote && <div className="flex gap-2 rounded-xl bg-amber-50 p-2.5 text-sm text-amber-900"><AlertTriangle className="size-4 shrink-0" /> {o.statusNote}</div>}
      <button type="button" onClick={() => markSent({ id: o._id }).then(() => toast.success("Thanks! Michael will confirm it.")).catch(e => toast.error(errMsg(e)))} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9C7434] py-3 font-bold text-white" data-testid="sent-zelle">
        <Send className="size-4" /> I sent the Zelle
      </button>
      <p className="text-sm text-stone-500">Open your bank app, choose Zelle, and send to the address above with the memo code. Nothing is edited until the payment is confirmed.</p>
    </div>
  );
}

function CaptionEditor({ o }: { o: MyOrder }) {
  const edit = reelAction("captions");
  const lines = o.captionLines ?? [];
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [open, setOpen] = useState(false);
  if (!lines.length) return null;
  const changed = Object.entries(draft).filter(([i, t]) => lines.find(l => l.i === Number(i))?.text !== t);
  const ts = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <div className="pt-2">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-sm font-semibold text-[#9C7434]" data-testid="edit-captions">
        <Captions className="size-4" /> {open ? "Close caption editor" : "Edit captions (free)"}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {lines.map(l => (
              <label key={l.i} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-right font-mono text-xs text-stone-400">{ts(l.start)}</span>
                <input value={draft[l.i] ?? l.text} onChange={e => setDraft({ ...draft, [l.i]: e.target.value })} maxLength={200} className={`min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-[15px] ${draft[l.i] !== undefined && draft[l.i] !== l.text ? "border-[#9C7434] bg-[#F7F5F1]" : "border-stone-200"}`} aria-label={`Caption at ${ts(l.start)}`} />
              </label>
            ))}
          </div>
          <button type="button" disabled={!changed.length} onClick={() => edit({ id: o._id, edits: changed.map(([i, text]) => ({ i: Number(i), text })) }).then(() => { setDraft({}); setOpen(false); toast.success("Sent. The editor re-renders with your captions."); }).catch(e => toast.error(errMsg(e)))} className="rounded-lg bg-[#0A0A0A] px-4 py-2 font-semibold text-white disabled:opacity-50">
            Send {changed.length || ""} caption fix{changed.length === 1 ? "" : "es"}
          </button>
          <p className="text-sm text-stone-500">Caption fixes are free and don't use a revision.</p>
        </div>
      )}
    </div>
  );
}

const clock = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Live tracker (Michael 2026-10-29): queue spot + next check while waiting; steps + running timer while editing. */
function ReelProgress({ o }: { o: MyOrder }) {
  const now = useNow();
  const editing = o.status === "editing";
  const cur = editing ? Math.max(0, REEL_STAGES.findIndex(st => st.key === (o.stage ?? "clips"))) : -1;
  const waitingSince = o.queuedAt ?? o.createdAt;
  const ahead = o.queueAhead ?? 0;
  return (
    <div className="mt-3 rounded-xl bg-[#F7F5F1] p-3 ring-1 ring-black/5" data-testid="reel-progress">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-[#0A0A0A]">
          {editing ? <Loader2 className="size-4 animate-spin text-[#9C7434]" /> : <Clapperboard className="size-4 text-[#9C7434]" />}
          {editing ? "Editing your Reel" : ahead ? `In line · ${ahead} ahead of you` : "Waiting for an editor"}
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 font-mono text-sm tabular-nums text-stone-700 ring-1 ring-black/5" data-testid="reel-timer" aria-label={editing ? "Editing time" : "Waiting time"}>
          {editing ? "Editing " : "Waiting "}{clock(now - (editing ? o.pickedUpAt ?? now : waitingSince))}
        </span>
      </div>
      {!editing && (
        <p className="mt-1.5 text-sm text-stone-600">
          {o.free ? "Free Reel." : "Paid."} Editing starts when a worker is available.
        </p>
      )}
      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {REEL_STAGES.map((st, i) => {
          const done = i < cur, active = i === cur;
          return (
            <li key={st.key} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${active ? "bg-white font-semibold text-[#0A0A0A] ring-1 ring-[#C9A86A]" : done ? "text-stone-700" : "text-stone-400"}`} aria-current={active ? "step" : undefined}>
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${done ? "bg-[#9C7434] text-white" : active ? "bg-[#0A0A0A] text-[#D9BC8C]" : "bg-stone-200 text-stone-500"}`}>
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">{st.label}</span>
              {active && o.stageAt && <span className="font-mono text-xs tabular-nums text-stone-500">{clock(now - o.stageAt)}</span>}
            </li>
          );
        })}
      </ol>
      {editing && o.statusNote && o.statusNote !== "Editing your Reel" && <p className="mt-2 text-sm text-stone-600">{o.statusNote}</p>}
      <p className="mt-2 text-sm text-stone-500">You'll get an email when it's ready. You can close this page.</p>
    </div>
  );
}

// One file per app. A real Download button, because iPhone's video player has no Download item (Michael 11-12).
function OutputRow({ x, agentName }: { x: { format: string; url: string | null; size?: number }; agentName: string }) {
  const f = formatOf(x.format);
  const label = f?.label ?? x.format;
  const { state, pct, run } = useSaveVideo(x.url, videoFileName(agentName, "Reel", label), `${label} Reel`);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[#F7F5F1] py-2 pl-3 pr-2 ring-1 ring-black/10" data-testid="reel-output">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold leading-tight">{label}</div>
        <div className="whitespace-nowrap text-sm text-stone-600">{f?.size}{x.size ? ` · ${mb(x.size)}` : ""}</div>
      </div>
      {x.url && <a href={x.url} target="_blank" rel="noreferrer" aria-label={`Open ${label} in a new tab`} title="Open in a new tab" className="flex size-10 shrink-0 items-center justify-center rounded-lg text-stone-500 hover:bg-black/5 hover:text-stone-800 sm:size-11"><ExternalLink className="size-4" /></a>}
      <button type="button" disabled={!x.url || state === "loading"} data-testid="reel-download" data-state={state}
        onClick={() => run().catch(() => toast.error("Download failed. Check your connection and try again."))}
        className={`inline-flex h-11 min-w-[7.25rem] shrink-0 sm:min-w-[8.25rem] items-center justify-center gap-1.5 rounded-lg px-3 text-[15px] font-semibold disabled:opacity-70 ${state === "ready" ? "animate-pulse bg-[#9C7434] text-white" : "bg-[#0A0A0A] text-white"}`}>
        {state === "loading" ? <><Loader2 className="size-4 animate-spin" /> {pct ? `${pct}%` : "Preparing"}</>
          : state === "ready" ? <><Download className="size-4" /> Tap to save</>
          : state === "saved" ? <><Check className="size-4 text-[#D9BC8C]" /> Done</>
          : <><Download className="size-4 text-[#D9BC8C]" /> Download</>}
      </button>
    </div>
  );
}

function OrderCard({ o, zelleTo, open: open0 }: { o: MyOrder; zelleTo: string; open?: boolean }) {
  const [open, setOpen] = useState(!!open0);
  const [rev, setRev] = useState("");
  const [ans, setAns] = useState("");
  const requestRevision = reelAction("revision");
  const answer = reelAction("answer");
  const cancel = reelAction("cancel");
  const markDone = reelAction("done");
  const opts = o.options as ReelOptions;
  const vertical = o.outputs.find(x => formatOf(x.format)?.group === "vertical") ?? o.outputs[0];
  return (
    <li className="rounded-2xl bg-white p-4 ring-1 ring-black/5" data-testid="reel-order">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-[#0A0A0A]">{o.tierName}{opts.title ? ` · ${opts.title}` : ""}</div>
          <div className="text-sm text-stone-500">Ordered {day(o.createdAt)} · {o.testOrder ? "Test request" : o.free ? "Free Reel" : money(o.price)} · {o.clips.length} clip{o.clips.length === 1 ? "" : "s"}{o.version > 1 ? ` · version ${o.version}` : ""}</div>
        </div>
        <ReelStatus s={o.status} label={o.statusLabel} />
      </div>

      {(o.status === "awaiting_payment" || o.status === "revision_payment" || o.status === "payment_sent") && <PayCard o={o} zelleTo={zelleTo} />}
      {(o.status === "queued" || o.status === "editing") && <ReelProgress o={o} />}

      {o.status === "needs_info" && (
        <div className="mt-3 space-y-2 rounded-xl bg-red-50 p-3">
          <div className="flex gap-2 text-[15px] text-red-900"><MessageSquare className="mt-0.5 size-4 shrink-0" /> {o.question}</div>
          <textarea value={ans} onChange={e => setAns(e.target.value)} rows={2} className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-[15px]" placeholder="Your answer" aria-label="Your answer" />
          <button type="button" disabled={!ans.trim()} onClick={() => answer({ id: o._id, text: ans }).then(() => { setAns(""); toast.success("Sent. The editor picks it back up."); }).catch(e => toast.error(errMsg(e)))} className="rounded-lg bg-[#0A0A0A] px-4 py-2 font-semibold text-white disabled:opacity-50">Send answer</button>
        </div>
      )}

      {o.outputs.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
          {vertical?.url && <video src={vertical.url} controls playsInline preload="metadata" className="aspect-[9/16] w-full max-w-[220px] rounded-xl bg-black" />}
          <div className="space-y-1.5">
            {o.deliveryNote && <p className="text-[15px] text-stone-700">{o.deliveryNote}</p>}
            {o.outputs.map(x => <OutputRow key={x.format} x={x} agentName={o.agentName} />)}
            {isIOS() && <p className="text-sm text-stone-500" data-testid="reel-ios-hint">On iPhone: tap Download, then choose <b>Save Video</b> to put it in your Photos.</p>}
            {o.canEditCaptions && ["delivered", "done"].includes(o.status) && <CaptionEditor o={o} />}
            <div className="pt-2">
              <div className="mb-1 text-sm font-semibold text-stone-700">
                Ask for changes · {o.freeRevisionsLeft > 0 ? `${o.freeRevisionsLeft} free revision${o.freeRevisionsLeft > 1 ? "s" : ""} left` : `${money(EXTRA_REVISION_PRICE)} by Zelle`}
              </div>
              <textarea value={rev} onChange={e => setRev(e.target.value)} rows={2} maxLength={1500} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-[15px]" placeholder="What should change? e.g. cut the first sentence, bigger captions" aria-label="What should change" />
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button type="button" disabled={rev.trim().length < 3} onClick={() => requestRevision({ id: o._id, note: rev }).then(r => { setRev(""); toast.success(r.needsPayment ? `Send ${money(EXTRA_REVISION_PRICE)} by Zelle to start` : "Revision requested"); }).catch(e => toast.error(errMsg(e)))} className="rounded-lg bg-[#0A0A0A] px-4 py-2 font-semibold text-white disabled:opacity-50">Ask for changes</button>
                {o.status === "delivered" && <button type="button" onClick={() => markDone({ id: o._id }).then(() => toast.success("Marked done")).catch(e => toast.error(errMsg(e)))} className="rounded-lg bg-stone-100 px-4 py-2 font-semibold text-stone-700">Looks great, done</button>}
              </div>
            </div>
          </div>
        </div>
      )}
      {["cancelled", "failed"].includes(o.status) && o.statusNote && <p className="mt-2 text-sm text-stone-500">{o.statusNote}</p>}

      <button type="button" onClick={() => setOpen(!open)} className="mt-3 flex items-center gap-1 text-sm font-semibold text-stone-500">
        <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} /> {open ? "Hide" : "Show"} what you ordered
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-[15px]">
          <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1">
            {optionRows(opts).filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-stone-500">{k}</dt><dd className="text-stone-800">{v}</dd></div>
            ))}
            <dt className="text-stone-500">Clips</dt><dd className="text-stone-800">{o.clips.map(c => c.name).join(", ")}</dd>
            {(o.sampleUrl || opts.sample?.link) && (<><dt className="text-stone-500">Sample</dt><dd><a href={o.sampleUrl ?? opts.sample?.link} target="_blank" rel="noreferrer" className="font-semibold text-[#9C7434] underline">Watch the sample</a></dd></>)}
            {o.notes && (<><dt className="text-stone-500">Notes</dt><dd className="text-stone-800">{o.notes}</dd></>)}
          </dl>
          {o.revisions.length > 0 && (
            <ul className="space-y-1 text-sm text-stone-600">{o.revisions.map(r => <li key={r.n} className="whitespace-pre-line">{r.kind === "captions" ? "Caption fixes" : `Revision ${r.n}`} ({day(r.at)}{r.paid ? `, ${money(EXTRA_REVISION_PRICE)}` : ", free"}): {r.note}</li>)}</ul>
          )}
          {o.status === "awaiting_payment" && (
            <button type="button" onClick={() => cancel({ id: o._id }).then(() => toast.success("Cancelled")).catch(e => toast.error(errMsg(e)))} className="text-sm text-stone-500 underline">Cancel this order</button>
          )}
        </div>
      )}
    </li>
  );
}

function MyReels({ as, firstOpen, zelleTo }: { as?: string; firstOpen: boolean; zelleTo: string }) {
  const { data: rows, error, reload } = useReels(as);
  if (error && !rows) return <LoadError error={error} onRetry={() => void reload()} what="your reels" />;
  if (!rows) return <div className="h-32 animate-pulse rounded-2xl bg-stone-100" />;
  if (!rows.length) return <p className="rounded-2xl bg-white p-5 text-stone-600 ring-1 ring-black/5">No Reels yet. Start one on the New Reel tab.</p>;
  return <ul className="space-y-2">{rows.map((o, i) => <OrderCard key={o._id} o={o} zelleTo={zelleTo} open={firstOpen && i === 0} />)}</ul>;
}

// ---------- admin ----------

function AdminOrders() {
  const { data: q, error, reload } = useReelQueue();
  const confirm = reelAction("confirm");
  const adminCancel = reelAction("cancel");
  if (error && !q) return <LoadError error={error} onRetry={() => void reload()} what="reel orders" />;
  if (!q) return <div className="h-32 animate-pulse rounded-2xl bg-stone-100" />;
  const toConfirm = q.orders.flatMap(o => o.payments.filter(p => p.status === "sent").map(p => ({ o, p })));
  const run = (p: Promise<unknown>, msg: string) => p.then(() => toast.success(msg)).catch(e => toast.error(errMsg(e)));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Approve requests</h2>
        {q.canTestPayments && <Link to="/reels?tab=new&test=1" className="rounded-lg bg-[#0A0A0A] px-4 py-2 text-sm font-semibold text-white" data-testid="add-test-reel">Add test request</Link>}
      </div>
      <section>
        <h3 className="mb-2 font-semibold">Payments awaiting approval {toConfirm.length ? `(${toConfirm.length})` : ""}</h3>
        {toConfirm.length === 0 ? (
          <p className="text-[15px] text-stone-500">No payments are waiting for approval.</p>
        ) : (
          <ul className="space-y-2">
            {toConfirm.map(({ o, p }) => (
              <li key={p.code} className="rounded-2xl bg-white p-4 ring-2 ring-[#9C7434]/40" data-testid="confirm-row">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-[17px] font-bold">{money(p.amount)} from {o.agentName}{p.test && <span className="ml-2 text-sm text-amber-800">Test</span>}</div>
                  <div className="font-mono text-[15px] font-bold text-[#9C7434]">memo {p.code}</div>
                </div>
                <div className="text-sm text-stone-500">{p.kind === "order" ? o.tierName : "Extra revision"} · sent {day(p.sentAt)}</div>
                {(p.test ? q.canTestPayments : q.canConfirm) ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => run(confirm({ id: o._id, code: p.code, received: true }), "Confirmed. The reel is queued for editing.")} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white" data-testid="confirm-received"><CheckCircle2 className="size-4" /> {p.test ? "Approve test payment" : "Received"}</button>
                    <button type="button" onClick={() => run(confirm({ id: o._id, code: p.code, received: false }), p.test ? "Test payment rejected" : "Agent asked to check their Zelle")} className="flex items-center gap-1.5 rounded-xl bg-stone-100 px-4 py-2 font-semibold text-stone-700"><XCircle className="size-4" /> {p.test ? "Reject test payment" : "Not in my account"}</button>
                  </div>
                ) : <p className="mt-2 text-sm text-stone-500">Only designated staff can confirm payments.</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-lg font-bold">{q.isStaff ? "All orders" : "Your test requests"}</h2>
        {q.orders.length === 0 ? <p className="text-[15px] text-stone-500">No orders yet.</p> : (
          <ul className="space-y-1.5">
            {q.orders.map(o => (
              <li key={o._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-black/5">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold">{o.agentName} · {o.tierName}{(o.options as ReelOptions).title ? ` · ${(o.options as ReelOptions).title}` : ""}</div>
                  <div className="text-sm text-stone-500">{day(o.createdAt)} · {o.testOrder ? "test request" : o.free ? "free Reel" : `paid ${money(o.paid)}`} · cost {money(o.costUsd)}{o.version ? ` · v${o.version}` : ""}{o.revisions.length ? ` · ${o.revisions.length} revision${o.revisions.length > 1 ? "s" : ""}` : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  <ReelStatus s={o.status} label={o.statusLabel} />
                  {o.status === "failed" && <button type="button" onClick={() => run(reelAction("retry")({ id: o._id }), "Queued for another attempt")} className="text-sm font-semibold underline">Retry</button>}
                  {(q.isStaff ? !["cancelled", "done", "delivered"].includes(o.status) : o.status === "awaiting_payment") && (
                    <button type="button" onClick={() => window.confirm("Cancel this order?") && run(adminCancel({ id: o._id }), "Cancelled")} className="text-sm text-stone-400 underline">Cancel</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Ledger() {
  const { data: q, error, reload } = useReelQueue();
  if (error && !q) return <LoadError error={error} onRetry={() => void reload()} what="reel orders" />;
  if (!q) return <div className="h-32 animate-pulse rounded-2xl bg-stone-100" />;
  const t = q.totals;
  const rows = q.orders.filter(o => o.paid > 0 || o.costCredits > 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([["Collected", money(t.revenue)], ["Historical editing cost", money(t.cost)], ["Payments to review", money(t.owedToConfirm)]] as const).map(([k, val]) => (
          <div key={k} className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
            <div className="font-serif text-2xl font-bold">{val}</div>
            <div className="text-sm text-stone-500">{k}</div>
          </div>
        ))}
      </div>
      {t.owedToConfirm > 0 && <p className="text-[15px] text-amber-800">{money(t.owedToConfirm)} sent by agents, waiting for your confirmation.</p>}
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/5">
        <table className="w-full text-[15px]">
          <thead className="bg-stone-50 text-left text-sm text-stone-600">
            <tr><th className="p-2.5">Date</th><th className="p-2.5">Agent</th><th className="p-2.5">Package</th><th className="p-2.5">Paid</th><th className="p-2.5">Credits</th><th className="p-2.5">Cost</th><th className="p-2.5">Profit</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="p-4 text-stone-500">No paid orders yet.</td></tr>}
            {rows.map(o => {
              const profit = o.paid - o.costUsd;
              const flag = o.paid > 0 && o.costUsd > o.paid * 0.5;
              return (
                <tr key={o._id} className="border-t border-stone-100">
                  <td className="p-2.5">{day(o.createdAt)}</td>
                  <td className="p-2.5 font-medium">{o.agentName}</td>
                  <td className="p-2.5">{o.tierName}{o.free ? " (free)" : ""}{o.revisions.length ? ` + ${o.revisions.length} rev` : ""}</td>
                  <td className="p-2.5">{money(o.paid)}</td>
                  <td className="p-2.5">{o.costCredits.toLocaleString()}</td>
                  <td className="p-2.5">{o.costCredits ? money(o.costUsd) : "—"}</td>
                  <td className={`p-2.5 font-semibold ${flag ? "text-red-700" : "text-emerald-700"}`}>{money(profit)}{flag ? " ⚠" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-stone-500">Historical editing costs use the imported credit ledger. New worker costs are not included.</p>
    </div>
  );
}

// ---------- page ----------

export function ReelStudioPage() {
  const { data: cfg, error, reload } = useOutletContext<ReelConfigResult>();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "new";
  const testPayment = !!cfg?.canTestPayments && params.get("test") === "1";
  const [as, setAs] = useState<string | undefined>(undefined);
  const [justPlaced, setJustPlaced] = useState(false);
  const setTab = (t: string) => setParams(p => { p.set("tab", t); p.delete("test"); return p; }, { replace: true });
  const tabs = useMemo(() => {
    const t: { k: string; label: string; Icon: typeof Film; n?: number }[] = [
      { k: "new", label: "New Reel", Icon: CirclePlus },
      { k: "mine", label: "My Reels", Icon: Film },
    ];
    if (cfg?.isStaff || cfg?.canTestPayments) t.push({ k: "orders", label: "Orders", Icon: ClipboardList, n: cfg.toConfirm || undefined });
    if (cfg?.isAdmin) t.push({ k: "ledger", label: "Ledger", Icon: Receipt });
    return t;
  }, [cfg]);
  if (error && !cfg) return <LoadError error={error} onRetry={() => void reload()} what="Reel Studio" />;
  if (!cfg) return <div role="status" className="h-28 animate-pulse rounded-2xl bg-stone-100" aria-label="Loading Reel Studio" />;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#0A0A0A]"><Clapperboard className="size-6 text-[#D9BC8C]" /></span>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Reel Studio</h1>
          <p className="text-stone-600">Pick your clips, style and colors. Pay by Zelle, and our editor prepares a ready-to-post Reel sized for every app you use.</p>
        </div>
      </div>
      {!testPayment && cfg?.isStaff && cfg.agents.length > 0 && (tab === "new" || tab === "mine") && (
        <label className="flex items-center gap-2 text-sm text-stone-600">Order for
          <select value={as ?? ""} onChange={e => setAs(e.target.value || undefined)} className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[15px]" aria-label="Order for">
            <option value="">Me</option>
            {cfg.agents.map(a => <option key={a.email} value={a.email}>{a.name}</option>)}
          </select>
        </label>
      )}
      {/* Michael 11-12: the tab bar has to be noticeable. Black active pill on a white bar, icons, equal-width tabs. */}
      <div className="grid gap-1 rounded-2xl bg-white p-1.5 shadow-md ring-1 ring-[#e3dccd]" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} role="tablist" data-testid="reel-tabs">
        {tabs.map(({ k, label, Icon, n }) => {
          const on = tab === k;
          return (
            <button key={k} role="tab" aria-selected={on} aria-label={n ? `${label}, ${n} to confirm` : label} onClick={() => setTab(k)}
              className={`relative flex min-h-12 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[15px] font-semibold transition-colors sm:gap-2 sm:text-base ${tabs.length > 2 ? "max-sm:flex-col max-sm:text-sm" : ""} ${on ? "bg-[#0A0A0A] text-white shadow" : "text-stone-800 hover:bg-[#f4efe5]"}`}>
              <Icon className={`size-5 shrink-0 ${on ? "text-[#D9BC8C]" : "text-[#9C7434]"}`} aria-hidden />
              <span className="truncate">{label}</span>
              {n ? <span className="absolute right-1.5 top-1 rounded-full bg-red-600 px-1.5 text-xs font-bold leading-5 text-white sm:static" title={`${n} to confirm`}>{n}</span> : null}
            </button>
          );
        })}
      </div>
      {tab === "new" && <NewReel key={`${as ?? "self"}:${testPayment}`} as={testPayment ? undefined : as} testPayment={testPayment} onPlaced={() => { if (testPayment) setAs(undefined); setJustPlaced(true); setTab("mine"); window.scrollTo({ top: 0 }); }} />}
      {tab === "mine" && <MyReels as={as} firstOpen={justPlaced} zelleTo={cfg.zelleTo} />}
      {tab === "orders" && (cfg.isStaff || cfg.canTestPayments) && <AdminOrders />}
      {tab === "ledger" && cfg?.isAdmin && <Ledger />}
    </div>
  );
}
