import { useQuery } from "convex/react";
import { ArrowRight, CalendarCheck, Headset, Inbox } from "lucide-react";
import { Link } from "react-router";
import { api } from "../../../convex/_generated/api";
import { fmtWhen } from "../../../convex/deskDefs";

// Home: Lead Desk tile for admins/ops + "My appointments" card for agents with bookings.
export function DeskTile() {
  const c = useQuery(api.desk.homeCounts);
  const nl = useQuery(api.leadTrack.homeCount);
  if (!c) return null;
  const d = c.desk;
  const agentCard = (c.pending > 0 || c.outcomeDue > 0 || c.next) && (
    <Link to="/appointments" data-testid="appt-tile"
      className={`group flex items-center gap-4 rounded-2xl p-4 ring-1 transition-all hover:-translate-y-0.5 hover:shadow-lg md:p-5 ${c.pending ? "bg-emerald-800 text-white ring-emerald-800" : "bg-white ring-[#ebe5da]"}`}>
      <CalendarCheck className={`size-7 shrink-0 ${c.pending ? "text-white" : "text-[#9C7434]"}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold leading-tight">
          {c.pending ? `${c.pending} appointment${c.pending > 1 ? "s" : ""} to accept` : c.outcomeDue ? "How did your appointment go?" : "My appointments"}
        </span>
        <span className={`mt-0.5 block text-[14px] ${c.pending ? "text-white/80" : "text-stone-600"}`}>
          {c.next ? `Next: ${c.next.name} · ${fmtWhen(c.next.at)}` : c.outcomeDue ? "One tap to log the outcome" : ""}
        </span>
      </span>
      <ArrowRight className="size-5 shrink-0" />
    </Link>
  );
  return (
    <>
      {d && (
        <Link to="/desk" data-testid="desk-tile"
          className="group flex items-center gap-4 rounded-2xl bg-white p-4 ring-2 ring-[#9C7434] transition-all hover:-translate-y-0.5 hover:shadow-lg md:p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#9C7434] text-white"><Headset className="size-6" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold leading-tight">Lead Desk <span className="text-sm font-normal text-stone-500">· admins & ops</span></span>
            <span className="mt-0.5 block text-[14px] text-stone-700">
              {[d.toVet && `${d.toVet} to vet`, d.waiting && `${d.waiting} waiting for agent`, d.rebook && `${d.rebook} to rebook`, d.followup && `${d.followup} need an outcome`].filter(Boolean).join(" · ") || "Vet a lead and book an agent on their calendar"}
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-[#9C7434]" />
        </Link>
      )}
      {nl && (
        <Link to="/new-leads" data-testid="new-leads-tile"
          className={`group flex items-center gap-4 rounded-2xl p-4 ring-2 transition-all hover:-translate-y-0.5 hover:shadow-lg md:p-5 ${nl.urgent ? "bg-red-700 text-white ring-red-700" : "bg-white ring-[#9C7434]"}`}>
          <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${nl.urgent ? "bg-white/20" : "bg-[#9C7434]"} text-white`}><Inbox className="size-6" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold leading-tight">
              {nl.urgent ? `${nl.urgent} new lead${nl.urgent > 1 ? "s" : ""} need${nl.urgent > 1 ? "" : "s"} a call now` : "New Leads"}
            </span>
            <span className={`mt-0.5 block text-[14px] ${nl.urgent ? "text-white/85" : "text-stone-700"}`}>
              {[`${nl.today} in the last 24 h`, nl.todo && `${nl.todo} to follow up`].filter(Boolean).join(" · ")} · what happened and what to do next
            </span>
          </span>
          <ArrowRight className={`size-5 shrink-0 ${nl.urgent ? "" : "text-[#9C7434]"}`} />
        </Link>
      )}
      {agentCard}
    </>
  );
}
