// Small shared pieces for the CMA Builder screens (agent side).
import { AlertTriangle, Check, Download, Loader2, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/apiData";
import { dateTime, type ReportFile, type ReportFormat, type ListingCmaStatus, PIPELINE, type ReportStatus, type ReportSummary, STATUS_LABEL } from "@/lib/cmaBuilderApi";

export const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-[15px] outline-none transition focus:border-[#9C7434] focus:ring-2 focus:ring-[#9C7434]/20 disabled:bg-stone-50 disabled:text-stone-500";
export const labelCls = "mb-1 block text-[13px] font-semibold text-stone-700";
export const cardCls = "rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5";
export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black/85 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9C7434] focus-visible:ring-offset-2";
export const btnGold =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#9C7434] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#8a6629] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9C7434] focus-visible:ring-offset-2";
export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold ring-1 ring-black/10 transition hover:ring-[#9C7434] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9C7434]";

const TONE: Partial<Record<ListingCmaStatus | ReportStatus, string>> = {
  published: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  ready_for_review: "bg-amber-50 text-amber-800 ring-amber-200",
  draft: "bg-sky-50 text-sky-800 ring-sky-200",
  failed: "bg-red-50 text-red-800 ring-red-200",
  cancelled: "bg-stone-100 text-stone-600 ring-stone-200",
  superseded: "bg-stone-100 text-stone-600 ring-stone-200",
  not_requested: "bg-stone-100 text-stone-600 ring-stone-200",
};

export function StatusPill({ status }: { status: ListingCmaStatus | ReportStatus }) {
  const busy = ["queued", "collecting", "normalizing", "analyzing", "refreshing"].includes(status);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${TONE[status] ?? "bg-[#F7F5F1] text-[#7a5a26] ring-[#D9BC8C]/60"}`}>
      {busy && <Loader2 className="size-3 animate-spin" aria-hidden />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "gold" | "dark" }) {
  return (
    <div className={`rounded-2xl p-4 ring-1 ${tone === "dark" ? "bg-[#0A0A0A] text-white ring-black" : tone === "gold" ? "bg-[#F7F5F1] ring-[#D9BC8C]/60" : "bg-white ring-black/5"}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${tone === "dark" ? "text-[#D9BC8C]" : "text-stone-500"}`}>{label}</div>
      <div className="mt-1.5 font-display text-2xl leading-tight">{value}</div>
      {sub && <div className={`mt-1 text-xs ${tone === "dark" ? "text-white/60" : "text-stone-500"}`}>{sub}</div>}
    </div>
  );
}

/** Collection stages with timestamps, from the report's stage history. */
export function ProgressStepper({ report }: { report: Pick<ReportSummary, "status" | "stages" | "progressNote" | "errorMessage"> }) {
  const reached = (key: string) => report.stages.filter(s => s.stage === key).at(-1);
  const order = PIPELINE.map(p => p.key);
  const currentIdx = order.indexOf(report.status as ReportStatus);
  const failed = report.status === "failed";
  const cancelled = report.status === "cancelled";
  return (
    <div>
      <ol className="space-y-0" aria-label="CMA progress">
        {PIPELINE.map((p, i) => {
          const at = reached(p.key);
          const done = currentIdx > i || (["draft", "published", "superseded"].includes(report.status) && !!at) || (report.status === p.key && p.key === "ready_for_review");
          const active = report.status === p.key && p.key !== "ready_for_review";
          return (
            <li key={p.key} className="relative flex gap-3 pb-4 last:pb-0">
              {i < PIPELINE.length - 1 && <span className={`absolute left-[13px] top-7 h-[calc(100%-18px)] w-0.5 ${done ? "bg-[#9C7434]" : "bg-stone-200"}`} aria-hidden />}
              <span className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition ${done ? "bg-[#9C7434] text-white" : active ? "bg-white text-[#9C7434] ring-2 ring-[#9C7434]" : "bg-stone-100 text-stone-400"}`}>
                {done ? <Check className="size-4" /> : active ? <Loader2 className="size-4 animate-spin" /> : i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <div className={`text-sm font-semibold ${done || active ? "text-[#0A0A0A]" : "text-stone-400"}`}>{p.label}</div>
                <div className="text-xs text-stone-500">{at ? dateTime(at.at) : ""}{active && report.progressNote ? `${at ? " · " : ""}${report.progressNote}` : ""}</div>
              </div>
            </li>
          );
        })}
      </ol>
      {failed && (
        <div role="alert" className="mt-3 flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {report.errorMessage ?? "Collection stopped."}
        </div>
      )}
      {cancelled && (
        <div className="mt-3 flex gap-2 rounded-xl bg-stone-100 p-3 text-sm text-stone-700">
          <X className="mt-0.5 size-4 shrink-0" /> This request was cancelled.
        </div>
      )}
    </div>
  );
}

type LoadReportFile = (format?: ReportFormat, download?: boolean) => Promise<ReportFile>;

async function waitForReport(load: () => Promise<ReportFile>, signal?: AbortSignal) {
  // Stop polling when the worker reports an error or the wait expires.
  for (let attempt = 0; attempt < 60 && !signal?.aborted; attempt++) {
    const result = await load().catch(error => {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new Error("The report server took too long to respond. Try again shortly.");
      }
      throw error;
    });
    if (result.url) return result.url;
    await new Promise(resolve => window.setTimeout(resolve, 2000));
  }
  throw new Error("The report is still being prepared. Please try again shortly.");
}

export function ReportDownloadButton({ load, format, className = btnGhost }: { load: LoadReportFile; format: ReportFormat; className?: string }) {
  const [busy, setBusy] = useState(false);
  const label = format === "pdf" ? "PDF" : "PowerPoint";
  const download = async () => {
    setBusy(true);
    try {
      const url = await waitForReport(() => load(format, true));
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return <button type="button" className={className} disabled={busy} onClick={() => void download()}>
    {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download {label}
  </button>;
}

function ReportPreview({ load, title }: { load: LoadReportFile; title: string }) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const controller = new AbortController();
    void waitForReport(() => loadRef.current(), controller.signal).then(
      src => { if (!controller.signal.aborted) setUrl(src); },
      err => { if (!controller.signal.aborted) setError(apiErrorMessage(err)); },
    );
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert" className="p-4 text-sm text-red-700">{error}</p>;
  if (!url) return <p role="status" className="flex items-center gap-2 p-4 text-sm"><Loader2 className="size-4 animate-spin" /> Preparing report…</p>;
  return <>
    <iframe title={title} src={url} className="min-h-0 w-full flex-1 rounded-xl bg-white ring-1 ring-black/10" />
    <a href={url} target="_blank" rel="noopener noreferrer" className="self-end text-sm underline">Open PDF in a new tab</a>
  </>;
}

export function ReportPreviewDialog({ open, onOpenChange, load, title, description }: { open: boolean; onOpenChange: (o: boolean) => void; load: LoadReportFile; title: string; description?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92svh] max-w-[min(960px,calc(100%-1rem))] flex-col gap-3 p-3 sm:max-w-[960px] sm:p-4">
        <DialogHeader className="px-1">
          <DialogTitle className="font-display text-xl font-normal">{title}</DialogTitle>
          <DialogDescription>{description ?? "Report preview for this CMA version."}</DialogDescription>
        </DialogHeader>
        {open && <ReportPreview load={load} title={title} />}
      </DialogContent>
    </Dialog>
  );
}

/** Number input that keeps the typed text and reports a number (or null when empty). */
export function NumberField({ id, label, value, onChange, prefix, suffix, step, min, max, error, placeholder, disabled }: {
  id: string; label: string; value: number | null | undefined; onChange: (v: number | null) => void; prefix?: string; suffix?: string; step?: number; min?: number; max?: number; error?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className={labelCls}>{label}</span>
      <span className="relative block">
        {prefix && <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-500">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          value={value ?? ""}
          onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={`${inputCls} ${prefix ? "pl-7" : ""} ${suffix ? "pr-12" : ""} ${error ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : ""}`}
        />
        {suffix && <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">{suffix}</span>}
      </span>
      {error && <span id={`${id}-err`} role="alert" className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
