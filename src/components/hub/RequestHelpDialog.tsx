import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Person } from "@/lib/hub";
import { api } from "../../../convex/_generated/api";

const errMsg = (e: unknown) => String(e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? "Couldn't send. Try again.";
const WHEN = [
  { id: "now", label: "Urgent (within the hour)" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
];

export function RequestHelpDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  const create = useMutation(api.help.create);
  const [topic, setTopic] = useState("");
  const [details, setDetails] = useState("");
  const [urgency, setUrgency] = useState("today");
  const [busy, setBusy] = useState(false);
  const first = person.name.split(" ")[0];

  const send = async () => {
    if (!topic) return toast.error("Pick what you need help with");
    setBusy(true);
    try {
      await create({ toEmail: person.email ?? "", topic, details, urgency });
      toast.success(`Sent to ${first}. You'll see it under Help requests.`);
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
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
                  onClick={() => setTopic(t)}
                  className={`rounded-full px-3.5 py-2 text-[15px] ring-1 ${topic === t ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-800 ring-stone-300"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[15px] font-semibold">Details</span>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={4}
              placeholder="Address, client, deadline, what you've tried…"
              className="w-full rounded-xl border border-stone-300 p-3 text-[16px] outline-none focus:border-[#9C7434]"
            />
          </label>
          <div>
            <div className="mb-2 text-[15px] font-semibold">When?</div>
            <div className="flex flex-wrap gap-2">
              {WHEN.map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setUrgency(w.id)}
                  className={`rounded-full px-3.5 py-2 text-[15px] ring-1 ${urgency === w.id ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-800 ring-stone-300"}`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={send}
            className="w-full rounded-xl bg-[#9C7434] py-3 text-[16px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Sending…" : `Send to ${first}`}
          </button>
          <p className="text-sm text-stone-600">{first} gets an email, and the request is logged so nothing gets lost.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
