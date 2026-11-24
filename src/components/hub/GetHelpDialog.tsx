import { useQuery } from "convex/react";
import { ArrowRight, MessageSquare, Phone } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Person, smsHref, TEAM, telHref } from "@/lib/hub";
import { api } from "../../../convex/_generated/api";
import { RequestHelpDialog } from "./RequestHelpDialog";

// One "Get help" picker (Michael 2026-10-29): pick what you need, we route it to the right person.
// Replaces the five support-team cards that used to sit on Home.
export function GetHelpDialog({ onClose }: { onClose: () => void }) {
  const [person, setPerson] = useState<Person | null>(null);
  const wa = useQuery(api.help.whatsapp) ?? {};
  if (person) return <RequestHelpDialog person={person} onClose={onClose} />;
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden" data-testid="get-help">
        <DialogHeader className="px-5 pt-5 pb-3 pr-12 text-left">
          <DialogTitle className="font-['Playfair_Display'] text-2xl">What do you need help with?</DialogTitle>
          <p className="text-[15px] text-stone-600">Tap a line to send a request. They get it by email and you can track it.</p>
        </DialogHeader>
        <ul className="divide-y divide-stone-100 border-t border-stone-100">
          {TEAM.map(p => {
            const w = p.whatsapp ? wa[p.email ?? ""] : undefined;
            return (
              <li key={p.name} className="flex items-center gap-3 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setPerson(p)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  data-testid={`help-pick-${p.initials}`}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#0A0A0A] text-sm font-semibold text-[#D9BC8C]">
                    {p.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold leading-tight">{p.does.split(",").slice(0, 3).join(",")}</span>
                    <span className="block text-sm text-stone-500">{p.name.replace(/ “.*”/, "")} · {p.role}</span>
                  </span>
                </button>
                {p.phone && (
                  <>
                    <a href={telHref(p.phone)} aria-label={`Call ${p.name}`} className="rounded-lg bg-[#F7F5F1] p-2.5"><Phone className="size-4" /></a>
                    <a href={smsHref(p.phone)} aria-label={`Text ${p.name}`} className="rounded-lg bg-[#F7F5F1] p-2.5"><MessageSquare className="size-4" /></a>
                  </>
                )}
                {w && (
                  <a href={`https://wa.me/${w}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${p.name}`} className="rounded-lg bg-[#25D366] px-2.5 py-2 text-xs font-bold text-white">WA</a>
                )}
              </li>
            );
          })}
        </ul>
        <Link to="/help" onClick={onClose} className="flex items-center justify-between bg-[#F7F5F1] px-5 py-3 text-sm font-semibold text-[#7a5a26]">
          See my open help requests <ArrowRight className="size-4" />
        </Link>
      </DialogContent>
    </Dialog>
  );
}
