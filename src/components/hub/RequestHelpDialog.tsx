import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiErrorMessage, fieldErrors } from "@/lib/apiData";
import { helpApi } from "@/lib/helpApi";
import type { Person } from "@/lib/hub";
import { FieldError } from "./FormState";

const MAX_DETAILS = 2000;
const WHEN = [
  { id: "now", label: "Urgent (within the hour)" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
];

export function RequestHelpDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  const [topic, setTopic] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [details, setDetails] = useState("");
  const [urgency, setUrgency] = useState("today");
  const [busy, setBusy] = useState(false);
  const first = person.name.split(" ")[0];

  const send = async () => {
    const errs: Record<string, string> = {};
    if (!topic) errs.topic = "Pick what you need help with.";
    if (topic === "Other" && !details.trim()) errs.details = "Say what you need help with.";
    if (details.trim().length > MAX_DETAILS) errs.details = `Details are too long (${MAX_DETAILS} characters max).`;
    if (!urgency) errs.urgency = "Pick when you need it.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!person.email) return toast.error(`${first} can't receive requests yet.`);
    setBusy(true);
    try {
      await helpApi.create({ toEmail: person.email, topic, details: details.trim(), urgency });
      toast.success(`Sent to ${first}. You'll see it under Help requests.`);
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Ask {first} for help</DialogTitle>
        </DialogHeader>
        <div className="space-y-4" data-testid="help-dialog">
          <div>
            <div className="mb-2 text-[15px] font-semibold">What do you need?</div>
            <div className="flex flex-wrap gap-2">
              {person.topics.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTopic(t); setErrors(e => ({ ...e, topic: "", details: t === "Other" ? e.details : "" })); }}
                  aria-pressed={topic === t}
                  className={`rounded-full px-3.5 py-2 text-[15px] ring-1 ${topic === t ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-800 ring-stone-300"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <FieldError msg={errors.topic} />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[15px] font-semibold">Details{topic === "Other" ? " *" : ""}</span>
            <textarea
              value={details}
              onChange={e => { setDetails(e.target.value.slice(0, MAX_DETAILS)); if (errors.details) setErrors(x => ({ ...x, details: "" })); }}
              maxLength={MAX_DETAILS}
              aria-invalid={!!errors.details}
              rows={4}
              placeholder="Address, client, deadline, what you've tried…"
              className={`w-full rounded-xl border p-3 text-[16px] outline-none focus:border-[#9C7434] ${errors.details ? "border-red-400" : "border-stone-300"}`}
            />
            <span className="flex justify-between text-xs text-stone-500"><FieldError msg={errors.details} /><span className="ml-auto mt-1">{details.length}/{MAX_DETAILS}</span></span>
          </label>
          <div>
            <div className="mb-2 text-[15px] font-semibold">When?</div>
            <div className="flex flex-wrap gap-2">
              {WHEN.map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => { setUrgency(w.id); setErrors(e => ({ ...e, urgency: "" })); }}
                  aria-pressed={urgency === w.id}
                  className={`rounded-full px-3.5 py-2 text-[15px] ring-1 ${urgency === w.id ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-800 ring-stone-300"}`}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <FieldError msg={errors.urgency} />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={send}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#9C7434] py-3 text-[16px] font-semibold text-white disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}{busy ? "Sending…" : `Send to ${first}`}
          </button>
          <p className="text-sm text-stone-600">{first} gets an email, and the request is logged so nothing gets lost.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
