// History: every version of this listing's CMA, with its value, the asking price at the time and
// the change from the version published before it. Earlier versions open read-only.
import { Eye } from "lucide-react";
import { useState } from "react";
import { LoadError, Skeleton } from "@/components/hub/FormState";
import { useApiData } from "@/lib/apiData";
import { cmaBuilderApi, money, type Report, shortDate } from "@/lib/cmaBuilderApi";
import { ReportDownloadButton, ReportPreviewDialog, StatusPill } from "../shared";

export function HistoryTab({ r }: { r: Report }) {
  const { data, error, reload } = useApiData(`cma:history:${r.listing.id}`, () => cmaBuilderApi.history(r.listing.id));
  const [view, setView] = useState<{ id: string; version: number } | null>(null);
  if (error && !data) return <LoadError error={error} onRetry={() => void reload()} what="the history" />;
  if (!data) return <Skeleton rows={3} className="h-14" label="Loading history" />;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/5">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-[#F7F5F1] text-left text-[11px] uppercase tracking-wider text-stone-500">
            <tr><th className="p-3">Version</th><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3 text-right">Value</th><th className="p-3 text-right">Change</th><th className="p-3 text-right">Asking then</th><th className="p-3 text-right">Sold comps</th><th className="p-3">Agent</th><th className="p-3"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {data.items.map(v => (
              <tr key={v.id} className={v.id === r.id ? "bg-[#F7F5F1]/60" : ""}>
                <td className="p-3 font-semibold">v{v.version}{v.id === r.id && <span className="ml-1 text-xs font-normal text-stone-500">(open)</span>}<div className="text-xs font-normal capitalize text-stone-500">{v.trigger === "refresh" ? "Weekly refresh" : v.trigger === "revision" ? "Revision" : "Request"}</div></td>
                <td className="p-3 whitespace-nowrap">{shortDate(v.publishedAt ?? v.createdAt)}</td>
                <td className="p-3"><StatusPill status={v.status} /></td>
                <td className="p-3 text-right tabular-nums">{money(v.estimatedValue)}{v.overridden && <span className="ml-1 text-xs text-sky-700" title="Agent override">*</span>}</td>
                <td className={`p-3 text-right tabular-nums ${v.changePct == null ? "text-stone-400" : v.changePct > 0 ? "text-emerald-700" : v.changePct < 0 ? "text-red-700" : ""}`}>{v.changePct == null ? "–" : `${v.changePct > 0 ? "+" : ""}${v.changePct}%`}</td>
                <td className="p-3 text-right tabular-nums">{money(v.askingPrice)}</td>
                <td className="p-3 text-right tabular-nums">{v.soldCount}</td>
                <td className="p-3">{v.publishedByName ?? v.reviewedByName ?? v.requestedByName}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    {(v.status === "draft" || v.status === "ready_for_review" || v.status === "published" || v.status === "superseded") && <>
                      <button type="button" className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-100" aria-label={`View version ${v.version}`} onClick={() => setView({ id: v.id, version: v.version })}><Eye className="size-4" /></button>
                      <ReportDownloadButton load={(format, download) => cmaBuilderApi.pdf(v.id, format, download)} format="pdf" />
                      <ReportDownloadButton load={(format, download) => cmaBuilderApi.pdf(v.id, format, download)} format="pptx" />
                    </>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500">* agent override. Published versions are kept exactly as the seller saw them.</p>
      {view && <ReportPreviewDialog open onOpenChange={o => !o && setView(null)} load={() => cmaBuilderApi.pdf(view.id)} title={`Version ${view.version}`} />}
    </div>
  );
}
