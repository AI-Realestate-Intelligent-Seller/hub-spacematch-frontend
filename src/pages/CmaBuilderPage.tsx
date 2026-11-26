// CMA Builder for one listing (/listings/:id/cma): review the collected comparables, adjust, write
// the report and publish it to the seller's page. Shows the open version (or the published one).
import { ArrowLeft, FileBarChart, Loader2, Pencil, RefreshCw, RotateCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AdjustmentsTab } from "@/components/cma/builder/AdjustmentsTab";
import { ComparablesTab } from "@/components/cma/builder/ComparablesTab";
import { HistoryTab } from "@/components/cma/builder/HistoryTab";
import { MarketTab } from "@/components/cma/builder/MarketTab";
import { OverviewTab } from "@/components/cma/builder/OverviewTab";
import { ReportTab, useReportDraft } from "@/components/cma/builder/ReportTab";
import { AgentPropertyResearch } from "@/components/cma/PropertyResearch";
import { RequestCmaDialog } from "@/components/cma/RequestCmaDialog";
import { btnGhost, btnPrimary, ProgressStepper, StatusPill } from "@/components/cma/shared";
import { LoadError } from "@/components/hub/FormState";
import { Skeleton as Placeholder } from "@/components/ui/skeleton";
import { apiErrorMessage, useApiData } from "@/lib/apiData";
import { ACTIVE, cmaBuilderApi, dateTime, type Report } from "@/lib/cmaBuilderApi";

type Tab = "research" | "overview" | "comparables" | "adjustments" | "market" | "report" | "history";
const TABS: [Tab, string][] = [["overview", "Overview"], ["research", "Property research"], ["comparables", "Comparables"], ["adjustments", "Adjustments"], ["market", "Market analysis"], ["report", "Report"], ["history", "History"]];

function Actions({ r, onRevised }: { r: Report; onRevised: (id: string) => void }) {
  const [busy, setBusy] = useState<"" | "revise" | "refresh" | "switch-source" | "retry" | "cancel">("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const listingId = r.listing.id;
  const canRecollect = r.editable || ["published", "superseded", "failed", "cancelled"].includes(r.status);
  const { data: sources } = useApiData(canRecollect ? `cma:providers:${listingId}` : null, () => cmaBuilderApi.providers(listingId));
  const sourceAvailable = sources?.items.some(source => source.id === r.provider && source.available);
  const switchSource = sourceAvailable === false;
  const fallbackSource = sources?.items.find(source => source.available && !source.isFixture && source.kind === "api")
    ?? sources?.items.find(source => source.available && source.id === "manual");
  const run = async (kind: "revise" | "refresh" | "switch-source" | "retry" | "cancel") => {
    setBusy(kind);
    try {
      if (kind === "revise") {
        const draft = await cmaBuilderApi.revise(r.id);
        onRevised(draft.id);
        toast.success(`Draft version ${draft.version} is ready to edit.`);
      } else if (kind === "refresh" || kind === "switch-source") {
        const res = await cmaBuilderApi.refresh(r.id, kind === "switch-source" ? fallbackSource?.id : undefined);
        toast.success(res.id === r.id ? "Collecting fresh data into this draft" : `Version ${res.version} started. Your seller keeps the published version until you publish again.`);
      } else if (kind === "retry") {
        await cmaBuilderApi.retry(r.id);
        toast.success("Retrying collection");
      } else {
        await cmaBuilderApi.cancel(r.id);
        toast.success("Cancelled");
      }
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy("");
      setConfirmCancel(false);
    }
  };
  const collecting = ["queued", "collecting", "normalizing", "analyzing"].includes(r.status);
  return (
    <div className="flex flex-wrap gap-2">
      {(r.status === "published" || r.status === "superseded") && (
        <button type="button" className={btnPrimary} disabled={!!busy} onClick={() => void run("revise")}>{busy === "revise" ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />} Edit CMA</button>
      )}
      {r.status === "failed" && !switchSource && r.provider !== "browser:mred" && <button type="button" className={btnPrimary} disabled={!!busy} onClick={() => void run("retry")}>{busy === "retry" ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />} Retry</button>}
      {!switchSource && r.provider !== "browser:mred" && (r.editable || ((r.status === "published" || r.status === "superseded") && r.provider !== "manual")) && (
        <button type="button" className={btnGhost} disabled={!!busy} onClick={() => void run("refresh")} title={r.editable ? "Collect fresh comparables into this draft (your own comparables and adjustments stay)" : "Start a new draft version with fresh data"}>
          {busy === "refresh" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} {r.editable ? r.provider === "manual" ? "Refresh research" : "Re-collect" : "Refresh data"}
        </button>
      )}
      {r.provider === "manual" && (r.status === "published" || r.status === "superseded") && <button type="button" className={btnGhost} disabled={!!busy} onClick={() => void run("refresh")}><RefreshCw className="size-4" /> Refresh research</button>}
      {canRecollect && switchSource && fallbackSource && (
        <button type="button" className={btnGhost} disabled={!!busy} onClick={() => void run("switch-source")}>{busy === "switch-source" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} {fallbackSource.kind === "manual" ? "Continue with manual entry / CSV" : `Re-collect with ${fallbackSource.label}`}</button>
      )}
      {(collecting || r.editable) && <button type="button" className={btnGhost} disabled={!!busy} onClick={() => setConfirmCancel(true)}><X className="size-4" /> {collecting ? "Cancel" : "Discard draft"}</button>}
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{collecting ? "Cancel this CMA request?" : `Discard draft version ${r.version}?`}</AlertDialogTitle>
            <AlertDialogDescription>{collecting ? "Collection stops and the browser session closes." : "Your edits on this version are kept in History but it can't be published."} Anything already published stays on your seller's page.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void run("cancel")}>{collecting ? "Cancel request" : "Discard"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Builder({ r, reload, initialTab }: { r: Report; reload: () => void; initialTab: Tab }) {
  const [tab, setTab] = useState(initialTab);
  const [researchSaving, setResearchSaving] = useState(false);
  const draftState = useReportDraft(r);
  const collecting = ["queued", "collecting", "normalizing", "analyzing"].includes(r.status);
  const go = (t: Tab) => {
    if (tab === "research" && t !== tab && researchSaving) {
      toast("Property research selections are still saving.");
      return;
    }
    if (tab === "report" && t !== "report" && draftState.dirty && !window.confirm("You have unsaved report changes. Leave this tab anyway? (They stay here until you reload.)")) return;
    setTab(t);
  };
  return (
    <>
      {(collecting || r.status === "failed" || r.status === "cancelled") && (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-black/5" aria-live="polite">
          <h2 className="font-display text-xl">{collecting ? "Preparing CMA" : r.status === "failed" ? "Collection stopped" : "Cancelled"}</h2>
          <p className="mb-4 text-sm text-stone-600">{collecting ? `From ${r.providerLabel}. This page updates by itself, and you'll get an email when it's ready.` : r.status === "failed" ? "Use the available collection actions above to try again. You can also add comparables by hand." : "Nothing from this version reaches your seller."}</p>
          <ProgressStepper report={r} />
        </section>
      )}
      {r.provider === "browser:mred" && r.activity.some(entry => entry.kind === "collection") && (
        <details className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
          <summary className="cursor-pointer text-sm font-semibold">MRED collection activity</summary>
          <ul className="mt-2 space-y-1 text-sm text-stone-600">
            {r.activity.filter(entry => entry.kind === "collection").map(entry => (
              <li key={entry.id}>{dateTime(entry.createdAt)} · {entry.message}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-full bg-stone-100 p-1 text-sm shadow-[0_6px_12px_-10px_rgba(0,0,0,0.3)] [scrollbar-width:none]" role="tablist" aria-label="CMA Builder sections">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} id={`tab-${k}`} aria-controls={`panel-${k}`} onClick={() => go(k)} className={`shrink-0 rounded-full px-4 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9C7434] ${tab === k ? "bg-white font-semibold shadow-sm" : "text-stone-600 hover:text-stone-900"}`}>
            {label}{k === "comparables" ? ` (${r.comparables.filter(c => c.selected).length})` : ""}{k === "report" && draftState.dirty ? " •" : ""}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="animate-in fade-in-0 duration-200">
        {tab === "overview" && <OverviewTab r={r} />}
        {tab === "research" && <AgentPropertyResearch report={r} reload={reload} onSavingChange={setResearchSaving} />}
        {tab === "comparables" && <ComparablesTab r={r} />}
        {tab === "adjustments" && <AdjustmentsTab r={r} />}
        {tab === "market" && <MarketTab r={r} />}
        {tab === "report" && <ReportTab r={r} draftState={draftState} />}
        {tab === "history" && <HistoryTab r={r} />}
      </div>
    </>
  );
}

export function CmaBuilderPage() {
  const { id = "" } = useParams();
  const [poll, setPoll] = useState(30_000);
  const { data, error, notFound, reload } = useApiData(`cma:builder:${id}`, () => cmaBuilderApi.current(id), { pollMs: poll });
  const [requestOpen, setRequestOpen] = useState(false);
  const [revisedId, setRevisedId] = useState<string>();
  const active = !!data && ACTIVE.includes(data.status);
  useEffect(() => {
    if (data) setPoll(active ? 3000 : 30_000);
  }, [active, data]);
  useEffect(() => {
    if (data?.report) document.title = `CMA · ${data.report.listing.address.split(",")[0]} · SpaceMatch`;
  }, [data?.report]);

  const back = <Link to={`/listings/${id}`} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"><ArrowLeft className="size-4" /> Listing</Link>;
  if (notFound) return <div className="space-y-3">{back}<div className="rounded-2xl bg-white p-6 text-center ring-1 ring-black/5"><h1 className="font-display text-xl">Listing not found</h1><p className="mt-1 text-sm text-stone-500">It may have been deleted, or it belongs to another agent.</p></div></div>;
  if (error && !data) return <div className="space-y-3">{back}<LoadError error={error} onRetry={() => void reload()} what="the CMA" /></div>;
  if (!data) {
    return (
      <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading CMA Builder">
        <Placeholder className="h-4 w-20 bg-stone-200" />
        <Placeholder className="h-9 w-72 max-w-full bg-stone-200" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Placeholder key={i} className="h-24 rounded-2xl bg-stone-200" />)}</div>
        <Placeholder className="h-10 rounded-full bg-stone-200" />
        <Placeholder className="h-64 rounded-2xl bg-stone-200" />
      </div>
    );
  }
  const r = data.report;
  if (!r) {
    return (
      <div className="space-y-4">
        {back}
        <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white/60 p-10 text-center">
          <FileBarChart className="mx-auto size-10 text-[#9C7434]" />
          <h1 className="mt-2 font-display text-2xl">No CMA for this listing yet</h1>
          <p className="mx-auto mt-1 max-w-md text-[15px] text-stone-600">Request one to collect comparable sales, review the value and publish a market analysis to your seller's page.</p>
          <button type="button" className={`${btnPrimary} mt-4`} onClick={() => setRequestOpen(true)}>Request CMA</button>
        </div>
        <RequestCmaDialog listingId={id} open={requestOpen} onOpenChange={setRequestOpen} onRequested={() => { setRequestOpen(false); void reload(); }} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {back}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9C7434]">CMA Builder · version {r.version}</p>
          <h1 className="font-display text-2xl sm:text-3xl">{r.listing.address.split(",")[0]}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-stone-500">
            <StatusPill status={r.status} />
            {data.status === "refreshing" && data.published && data.published.id !== r.id && <span>Seller sees v{data.published.version}</span>}
            <span>Updated {dateTime(r.updatedAt)}</span>
            {r.comparables.some(c => c.isFixture) && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">Contains test data</span>}
          </p>
        </div>
        <Actions r={r} onRevised={draftId => { setRevisedId(draftId); void reload(); }} />
      </header>
      <p className="rounded-xl bg-[#F7F5F1] px-3 py-2 text-xs text-stone-600 ring-1 ring-[#D9BC8C]/40">An agent-reviewed comparative market analysis, not an appraisal. Values come only from the comparables shown here.</p>
      <Builder key={r.id} r={r} initialTab={r.id === revisedId ? "comparables" : "overview"} reload={() => void reload()} />
    </div>
  );
}
