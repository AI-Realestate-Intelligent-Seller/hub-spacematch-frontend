// Report builder: the agent's words, recommended price range, which sections the seller sees,
// preview, save as draft, publish (with confirmation) and the PDF.
import { Eye, Loader2, Save, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { apiErrorMessage } from "@/lib/apiData";
import { cmaBuilderApi, money, type Report, type ReportContent, type ReportFormat } from "@/lib/cmaBuilderApi";
import { btnGhost, btnGold, cardCls, inputCls, NumberField, ReportDownloadButton, ReportPreviewDialog } from "../shared";

const TEXTS: [keyof ReportContent, string, string][] = [
  ["executiveSummary", "Executive summary", "Two or three sentences the seller reads first."],
  ["propertyObservations", "Property observations", "What sets this home apart (condition, updates, layout, lot)."],
  ["pricingRecommendation", "Pricing recommendation", "Your recommended price and why, in plain words."],
  ["marketingRecommendations", "Marketing recommendations", "How you'll position the home against the competition."],
  ["comparableNotes", "Notes on the comparables", "Anything the seller should know about the sales you chose."],
];
const SECTIONS: [keyof NonNullable<ReportContent["sections"]>, string][] = [["overview", "Market overview"], ["comparables", "Comparable sales"], ["market", "Price charts"], ["adjustments", "Adjustments"], ["recommendations", "Recommendations"]];
const DEFAULT_SECTIONS = { overview: true, comparables: true, market: true, adjustments: true, recommendations: true };

/** Report text with unsaved-changes tracking (warns before leaving the page). */
export function useReportDraft(r: Report) {
  const [draft, setDraft] = useState<ReportContent>(r.content);
  const [base, setBase] = useState(JSON.stringify(r.content));
  // Pick up server changes when nothing is being edited.
  useEffect(() => {
    const incoming = JSON.stringify(r.content);
    if (incoming !== base && JSON.stringify(draft) === base) {
      setDraft(r.content);
      setBase(incoming);
    }
  }, [r.content, base, draft]);
  const dirty = JSON.stringify(draft) !== base;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
  return { draft, setDraft, dirty, markSaved: (c: ReportContent) => { setBase(JSON.stringify(c)); setDraft(c); } };
}

export function ReportTab({ r, draftState }: { r: Report; draftState: ReturnType<typeof useReportDraft> }) {
  const { draft, setDraft, dirty, markSaved } = draftState;
  const [busy, setBusy] = useState<"" | "save" | "publish">("");
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof ReportContent>(k: K, v: ReportContent[K]) => setDraft(d => ({ ...d, [k]: v }));
  const sections = draft.sections ?? DEFAULT_SECTIONS;
  const rangeErr = draft.recommendedLow && draft.recommendedHigh && draft.recommendedLow > draft.recommendedHigh ? "Low is above high." : undefined;

  const save = async () => {
    if (rangeErr) return toast.error(rangeErr);
    setBusy("save");
    try {
      const res = await cmaBuilderApi.update(r.id, { content: draft });
      markSaved(res.content);
      toast.success("Draft saved");
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e));
      return false;
    } finally {
      setBusy("");
    }
  };
  const showPreview = async () => {
    if (dirty && !(await save())) return;
    setPreview(true);
  };
  const publish = async () => {
    if (dirty && !(await save())) return;
    setBusy("publish");
    try {
      const res = await cmaBuilderApi.publish(r.id);
      toast.success(res.alreadyPublished ? "Already published" : "Published. Your seller can see it now. The PDF and PowerPoint are being prepared.");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy("");
      setConfirm(false);
    }
  };
  const loadReport = (format?: ReportFormat, download?: boolean) => cmaBuilderApi.pdf(r.id, format, download);

  const published = r.status === "published" || r.status === "superseded";
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <section className={cardCls} aria-labelledby="rec-h">
          <h3 id="rec-h" className="font-display text-lg">Recommended price</h3>
          <p className="text-xs text-stone-500">Leave empty to use the indicated range ({r.analysis?.valueRange ? `${money(r.analysis.valueRange.low)} – ${money(r.analysis.valueRange.high)}` : "none yet"}).</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumberField id="rc-low" label="Range low" prefix="$" step={1000} value={draft.recommendedLow} onChange={v => set("recommendedLow", v)} disabled={!r.editable} />
            <NumberField id="rc-high" label="Range high" prefix="$" step={1000} value={draft.recommendedHigh} onChange={v => set("recommendedHigh", v)} disabled={!r.editable} error={rangeErr} />
            <NumberField id="rc-list" label="List price" prefix="$" step={1000} value={draft.recommendedListPrice} onChange={v => set("recommendedListPrice", v)} disabled={!r.editable} />
          </div>
        </section>
        {TEXTS.map(([k, label, hint]) => (
          <label key={k} className={`${cardCls} block`}>
            <span className="font-display text-lg">{label}</span>
            <span className="block text-xs text-stone-500">{hint}</span>
            <textarea rows={k === "executiveSummary" || k === "pricingRecommendation" ? 4 : 3} maxLength={6000} disabled={!r.editable} className={`${inputCls} mt-2`} value={(draft[k] as string | null | undefined) ?? ""} onChange={e => set(k, e.target.value || null)} />
          </label>
        ))}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section className={cardCls} aria-labelledby="pub-h">
          <h3 id="pub-h" className="font-display text-lg">{published ? "Published" : "Publish to seller"}</h3>
          {published ? (
            <p className="mt-1 text-sm text-stone-600">Version {r.version} was published {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : ""} by {r.publishedByName}. Choose Edit CMA to change the report contents.</p>
          ) : (
            <p className="mt-1 text-sm text-stone-600">Your seller sees nothing until you publish. Publishing freezes this version and prepares the PDF and PowerPoint.</p>
          )}
          <div className="mt-3 grid gap-2">
            <button type="button" className={btnGhost} disabled={!!busy} onClick={() => void showPreview()}><Eye className="size-4" /> Preview report</button>
            {r.editable && <button type="button" className={btnGhost} disabled={!dirty || !!busy} onClick={() => void save()}>{busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {dirty ? "Save draft" : "Saved"}</button>}
            {r.editable && <button type="button" className={btnGold} disabled={!r.canPublish || !!busy} onClick={() => setConfirm(true)}><Send className="size-4" /> Publish</button>}
            {r.editable && !r.canPublish && <p className="text-xs text-amber-800">{r.analysis?.insufficientReason ?? "Needs a value first."} Or record an override with a reason (Adjustments).</p>}
            {(published || (r.editable && !dirty)) && <>
              <ReportDownloadButton load={loadReport} format="pdf" />
              <ReportDownloadButton load={loadReport} format="pptx" />
            </>}
          </div>
          {dirty && <p className="mt-2 text-xs font-semibold text-amber-800" role="status">Unsaved changes</p>}
        </section>
        <section className={cardCls} aria-labelledby="sec-h">
          <h3 id="sec-h" className="font-display text-lg">Sections</h3>
          <ul className="mt-2 space-y-2">
            {SECTIONS.map(([k, label]) => (
              <li key={k} className="flex items-center justify-between gap-2 text-sm">
                <label htmlFor={`sec-${k}`}>{label}</label>
                <Switch id={`sec-${k}`} disabled={!r.editable} checked={sections[k]} onCheckedChange={v => set("sections", { ...sections, [k]: v })} />
              </li>
            ))}
            <li className="flex items-center justify-between gap-2 border-t border-stone-100 pt-2 text-sm">
              <label htmlFor="sec-addr">Show comparable addresses to the seller</label>
              <Switch id="sec-addr" disabled={!r.editable} checked={draft.showCompAddressesToSeller !== false} onCheckedChange={v => set("showCompAddressesToSeller", v)} />
            </li>
          </ul>
        </section>
      </aside>

      <ReportPreviewDialog open={preview} onOpenChange={setPreview} load={loadReport} title={`Seller preview · version ${r.version}`} description="Uses the same report layout and included content as the downloaded seller PDF." />
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish version {r.version} to your seller?</AlertDialogTitle>
            <AlertDialogDescription>
              They'll see a value of <b>{money(r.estimatedValue)}</b>{r.range ? <> and a range of <b>{money(r.range.low)} – {money(r.range.high)}</b></> : null} on their page and in the weekly report. This version is then frozen.
              {r.comparables.some(c => c.selected && c.isFixture) ? " This report includes development fixture data." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "publish"}>Not yet</AlertDialogCancel>
            <AlertDialogAction className="bg-[#9C7434] hover:bg-[#8a6629]" disabled={busy === "publish"} onClick={e => { e.preventDefault(); void publish(); }}>{busy === "publish" ? "Publishing…" : "Publish"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
