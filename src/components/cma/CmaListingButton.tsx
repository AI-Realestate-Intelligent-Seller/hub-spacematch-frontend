// The listing page's CMA button. Its label and action follow the CMA's status: request → progress →
// builder → published. Polls quickly while collection runs, slowly otherwise.
import { ArrowRight, FileBarChart, Loader2, RotateCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiErrorMessage, useApiData } from "@/lib/apiData";
import { ACTIVE, BUTTON_LABEL, cmaBuilderApi, type CmaStatusResponse, money } from "@/lib/cmaBuilderApi";
import { RequestCmaDialog } from "./RequestCmaDialog";
import { btnGhost, btnPrimary, ProgressStepper, StatusPill } from "./shared";

function ProgressDialog({ s, open, onOpenChange, onRequestNew }: { s: CmaStatusResponse; open: boolean; onOpenChange: (o: boolean) => void; onRequestNew: () => void }) {
  const r = s.current;
  const [busy, setBusy] = useState<"" | "cancel" | "retry">("");
  if (!r) return null;
  const act = async (kind: "cancel" | "retry") => {
    setBusy(kind);
    try {
      if (kind === "cancel") await cmaBuilderApi.cancel(r.id);
      else await cmaBuilderApi.retry(r.id);
      toast.success(kind === "cancel" ? "CMA request cancelled" : "Retrying collection");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy("");
    }
  };
  const running = ["queued", "collecting", "normalizing", "analyzing"].includes(r.status);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-normal">CMA version {r.version} <StatusPill status={s.status === "refreshing" ? "refreshing" : r.status} /></DialogTitle>
          <DialogDescription>
            {s.status === "refreshing" && s.published ? `Your seller keeps seeing version ${s.published.version} (${money(s.published.estimatedValue)}) until you publish the update.` : "You'll get an email when it's ready for review. You can close this."}
          </DialogDescription>
        </DialogHeader>
        <div aria-live="polite"><ProgressStepper report={r} /></div>
        <DialogFooter className="gap-2 sm:justify-between">
          {running ? (
            <button type="button" className={btnGhost} disabled={!!busy} onClick={() => void act("cancel")}>{busy === "cancel" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Cancel request</button>
          ) : r.status === "failed" ? (
            <div className="flex flex-wrap gap-2">
              {r.provider !== "browser:mred" && <button type="button" className={btnPrimary} disabled={!!busy} onClick={() => void act("retry")}>{busy === "retry" ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />} Retry</button>}
              <button type="button" className={btnGhost} onClick={onRequestNew}>Use another source</button>
            </div>
          ) : <span />}
          <Link to={`/listings/${s.listingId}/cma`} className={btnGhost}>Open CMA Builder <ArrowRight className="size-4" /></Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CmaListingButton({ listingId, className = "" }: { listingId: string; className?: string }) {
  const navigate = useNavigate();
  const [poll, setPoll] = useState(30_000);
  const { data, error } = useApiData(`cma:status:${listingId}`, () => cmaBuilderApi.status(listingId), { pollMs: poll });
  const [requestOpen, setRequestOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const status = data?.status;
  const active = !!status && ACTIVE.includes(status);
  useEffect(() => {
    if (data) setPoll(active ? 4000 : 30_000);
  }, [active, data]);

  const onClick = () => {
    if (!status || status === "not_requested" || status === "cancelled") setRequestOpen(true);
    else if (active || status === "failed") setProgressOpen(true);
    else navigate(`/listings/${listingId}/cma`);
  };
  const label = error && !data ? "Request CMA" : status ? BUTTON_LABEL[status] : "CMA";
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={!data && !error}
        data-testid="cma-button"
        data-status={status ?? "loading"}
        className={`flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-sm font-semibold ring-1 ring-black/10 transition hover:ring-[#9C7434] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9C7434] disabled:opacity-60 ${className}`}
      >
        {!data && !error ? <Loader2 className="size-4 animate-spin text-[#9C7434]" /> : active ? <Loader2 className="size-4 animate-spin text-[#9C7434]" /> : <FileBarChart className="size-4 text-[#9C7434]" />}
        {label}
        {status === "published" && data?.published?.estimatedValue ? <span className="font-normal text-stone-500">· {money(data.published.estimatedValue)}</span> : null}
      </button>
      <RequestCmaDialog
        listingId={listingId}
        open={requestOpen}
        onOpenChange={setRequestOpen}
        onRequested={() => {
          setRequestOpen(false);
          setPoll(4000);
          setProgressOpen(true);
        }}
      />
      {data && (
        <ProgressDialog
          s={data}
          open={progressOpen}
          onOpenChange={setProgressOpen}
          onRequestNew={() => {
            setProgressOpen(false);
            setRequestOpen(true);
          }}
        />
      )}
    </>
  );
}
