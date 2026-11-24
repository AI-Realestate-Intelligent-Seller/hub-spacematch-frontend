import { useMutation, useQuery } from "convex/react";
import { CalendarCheck, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { type Hours, OUTCOMES, detailLines, fmtWhen, kindLabel, outcomeLabel } from "../../convex/deskDefs";
import { ProfileFields } from "./DeskPage";
import { StageChip, errMsg, hoursSummary } from "@/components/hub/DeskBits";

type Lead = Doc<"deskLeads">;

function ApptCard({ l }: { l: Lead }) {
  const respond = useMutation(api.desk.respond);
  const outcome = useMutation(api.desk.myOutcome);
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const ended = (l.apptStart ?? 0) + (l.apptMinutes ?? 60) * 60000 < Date.now();
  const where = l.apptKind === "phone" ? `Call ${l.phone ?? ""}` : (l.apptLocation ?? l.details.address ?? "");
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da] md:p-5" data-testid="appt-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold">{l.name}</span>
        <StageChip s={l.stage} />
      </div>
      <div className="mt-0.5 text-[15px] font-semibold text-[#7a5a26]">{fmtWhen(l.apptStart ?? 0)} · {kindLabel(l.apptKind ?? "")} · {l.apptMinutes} min</div>
      {where && <div className="text-[15px] text-stone-700">{where}</div>}
      <dl className="mt-3 divide-y divide-[#f0ebe2] text-[15px]">
        {[["Phone", l.phone ?? ""], ["Email", l.email ?? ""], ...detailLines(l)].filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[40%_1fr] gap-2 py-1.5"><dt className="text-stone-600">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>
        ))}
      </dl>
      <div className="mt-3 text-sm text-stone-500">Booked by {l.bookedByName}</div>
      {l.stage === "booked" && !declining && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => respond({ id: l._id, action: "accept" }).then(() => toast.success("Accepted. See you there!")).catch(e => toast.error(errMsg(e)))} className="flex-1 rounded-xl bg-emerald-700 px-4 py-3 text-[16px] font-semibold text-white" data-testid="appt-accept">Accept</button>
          <button type="button" onClick={() => setDeclining(true)} className="flex-1 rounded-xl px-4 py-3 text-[16px] font-semibold ring-1 ring-stone-300">Can't make it</button>
        </div>
      )}
      {declining && (
        <div className="mt-3 space-y-2">
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Why? (e.g. at a closing, suggest Thu 2pm)" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-[15px]" />
          <button type="button" onClick={() => respond({ id: l._id, action: "decline", reason }).then(() => toast("Sent back to ops to rebook")).catch(e => toast.error(errMsg(e)))} className="rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-[15px] font-semibold text-white">Send back to ops</button>
        </div>
      )}
      {(l.stage === "accepted" || l.stage === "booked") && ended && (
        <div className="mt-3">
          <div className="mb-1.5 text-[15px] font-semibold">How did it go?</div>
          <div className="flex flex-wrap gap-1.5">
            {OUTCOMES.map(o => <button key={o.id} type="button" onClick={() => outcome({ id: l._id, outcome: o.id }).then(() => toast.success("Logged, thanks!")).catch(e => toast.error(errMsg(e)))} className="rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-stone-300">{o.label}</button>)}
          </div>
        </div>
      )}
      {l.outcome && <div className="mt-2 text-[15px] text-stone-700">Outcome: {outcomeLabel(l.outcome)}</div>}
    </div>
  );
}

export function AppointmentsPage() {
  const data = useQuery(api.desk.myAppointments);
  const save = useMutation(api.desk.saveMyProfile);
  const [hours, setHours] = useState<Hours | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const [areas, setAreas] = useState("");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (data && hours === null) {
      setHours(data.profile.hours as Hours);
      setLanguages(data.profile.languages);
      setAreas(data.profile.areas);
    }
  }, [data, hours]);
  if (!data) return null;
  const upcoming = data.rows.filter(r => r.stage === "booked" || r.stage === "accepted");
  const past = data.rows.filter(r => !(r.stage === "booked" || r.stage === "accepted"));
  return (
    <div className="space-y-6" data-testid="appointments-page">
      <div className="flex flex-wrap items-center gap-3">
        <CalendarCheck className="size-7 text-[#9C7434]" />
        <h1 className="font-['Playfair_Display'] text-3xl font-bold">My appointments</h1>
        {data.isDesk && <Link to="/desk" className="ml-auto rounded-xl bg-[#0A0A0A] px-4 py-2 text-[15px] font-semibold text-white">Open the Lead Desk</Link>}
      </div>
      <p className="text-[15px] text-stone-700">Appointments ops booked for you from the Lead Desk. They're also on your Google Calendar. Please accept within 30 minutes.</p>

      {data.isAgent && hours && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe5da] md:p-5" data-testid="my-hours">
          <div className="flex flex-wrap items-center gap-2">
            <Clock className="size-5 text-[#9C7434]" />
            <h2 className="text-lg font-semibold">When ops can book you</h2>
            {!data.profile.hoursSet && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Not set yet: using Mon–Sat 9am–7pm</span>}
            <button type="button" onClick={() => setEditing(!editing)} className="ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-stone-300" data-testid="hours-edit">{editing ? "Close" : "Edit"}</button>
          </div>
          <p className="mt-1 text-[15px] text-stone-700">{hoursSummary(hours)}{data.profile.areas ? ` · ${data.profile.areas}` : ""}</p>
          <p className="mt-1 text-sm text-stone-600">Ops only sees times inside these hours that are free on your Google Calendar, so block personal time there too.</p>
          {editing && (
            <div className="mt-3 space-y-3">
              <ProfileFields hours={hours} setHours={setHours} languages={languages} setLanguages={setLanguages} areas={areas} setAreas={setAreas} />
              <button type="button" onClick={() => save({ hours: hours as Record<string, number[] | null>, languages, areas }).then(() => { toast.success("Saved"); setEditing(false); }).catch(e => toast.error(errMsg(e)))} className="rounded-xl bg-[#9C7434] px-5 py-2.5 text-[15px] font-semibold text-white" data-testid="hours-save">Save</button>
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Upcoming & to confirm</h2>
        {upcoming.length ? upcoming.map(l => <ApptCard key={l._id} l={l} />) : <p className="rounded-2xl bg-white p-5 text-[15px] text-stone-600 ring-1 ring-[#ebe5da]">Nothing booked right now.</p>}
      </section>
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Past 30 days</h2>
          {past.map(l => <ApptCard key={l._id} l={l} />)}
        </section>
      )}
    </div>
  );
}
