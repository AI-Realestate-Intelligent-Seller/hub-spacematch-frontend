import { OFFICE_ADDRESS } from "../../convex/officeDefs";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { api } from "../../convex/_generated/api";
import { OUTCOMES, detailLines, fmtWhen, kindLabel, outcomeLabel } from "../../convex/deskDefs";
import { errMsg } from "@/components/hub/DeskBits";

// One-tap page from the agent's email/push: /a/:token?do=accept|decline or ?outcome=met…
export function AgentApptPage() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const l = useQuery(api.desk.byToken, { token });
  const respond = useMutation(api.desk.respondByToken);
  const logOutcome = useMutation(api.desk.outcomeByToken);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState(params.get("do") === "decline");
  const autoDone = useRef(false);

  const accept = () => respond({ token, action: "accept" }).then(() => setMsg("Accepted. It's on your Google Calendar. See you there!")).catch(e => setErr(errMsg(e)));
  const outcome = (o: string) => logOutcome({ token, outcome: o }).then(() => setMsg(`Logged: ${outcomeLabel(o)}. Thanks!`)).catch(e => setErr(errMsg(e)));

  useEffect(() => {
    if (!l || autoDone.current) return;
    autoDone.current = true;
    if (params.get("do") === "accept" && l.stage === "booked") void accept();
    const o = params.get("outcome");
    if (o && OUTCOMES.some(x => x.id === o) && (l.stage === "booked" || l.stage === "accepted") && !l.outcome) void outcome(o);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l]);

  if (l === undefined) return null;
  if (l === null) return <Shell><p className="text-[16px]">This link is no longer valid.</p></Shell>;
  const ended = (l.apptStart ?? 0) + (l.apptMinutes ?? 60) * 60000 < Date.now();
  const where = l.apptKind === "phone" ? `Call ${l.phone ?? ""}` : l.apptKind === "office" ? OFFICE_ADDRESS : (l.apptLocation ?? l.details.address ?? "");
  return (
    <Shell>
      <div className="text-sm font-semibold uppercase text-[#9C7434]">Lead Desk appointment</div>
      <h1 className="mt-1 font-['Playfair_Display'] text-3xl font-bold">{l.name}</h1>
      <p className="mt-1 text-[17px] font-semibold">{fmtWhen(l.apptStart ?? 0)} · {kindLabel(l.apptKind ?? "")}</p>
      {where && <p className="text-[16px] text-stone-700">{where}</p>}
      {msg && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-[16px] font-semibold text-emerald-900" data-testid="appt-msg">{msg}</p>}
      {err && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-[16px] text-amber-900">{err}</p>}
      {!msg && l.stage === "booked" && !declining && (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={accept} className="flex-1 rounded-xl bg-emerald-700 px-4 py-3.5 text-[17px] font-semibold text-white" data-testid="a-accept">Accept</button>
          <button type="button" onClick={() => setDeclining(true)} className="flex-1 rounded-xl px-4 py-3.5 text-[17px] font-semibold ring-1 ring-stone-300">Can't make it</button>
        </div>
      )}
      {!msg && declining && l.stage === "booked" && (
        <div className="mt-4 space-y-2">
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Why? (e.g. at a closing, I can do Thu 2pm)" className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-[16px]" />
          <button type="button" onClick={() => respond({ token, action: "decline", reason }).then(() => setMsg("Sent back to ops. They'll rebook it.")).catch(e => setErr(errMsg(e)))} className="w-full rounded-xl bg-[#0A0A0A] px-4 py-3 text-[16px] font-semibold text-white" data-testid="a-decline">Send back to ops</button>
        </div>
      )}
      {!msg && l.stage === "accepted" && !ended && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-[16px] text-emerald-900">You accepted this one. It's on your calendar.</p>}
      {!msg && (l.stage === "accepted" || l.stage === "booked") && ended && !l.outcome && (
        <div className="mt-4">
          <div className="mb-2 text-[16px] font-semibold">How did it go?</div>
          <div className="grid gap-2">
            {OUTCOMES.map(o => <button key={o.id} type="button" onClick={() => outcome(o.id)} className="rounded-xl px-4 py-3 text-left text-[16px] font-semibold ring-1 ring-stone-300">{o.label}</button>)}
          </div>
        </div>
      )}
      {l.stage === "needs_agent" && !msg && <p className="mt-4 text-[16px] text-stone-700">Ops is rebooking this one.</p>}
      <dl className="mt-5 divide-y divide-[#f0ebe2] rounded-xl bg-white text-[15px] ring-1 ring-[#ebe5da]">
        {[["Phone", l.phone ?? ""], ["Email", l.email ?? ""], ...detailLines({ ...l, source: l.source })].filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[40%_1fr] gap-2 px-3 py-2"><dt className="text-stone-600">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>
        ))}
      </dl>
      {l.phone && <a href={`tel:${l.phone}`} className="mt-4 block rounded-xl bg-[#9C7434] px-4 py-3 text-center text-[16px] font-semibold text-white">Call {l.name.split(" ")[0]}</a>}
      <p className="mt-4 text-sm text-stone-500">Booked by {l.bookedByName}. All your appointments: hub.spacematchinc.com/appointments</p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F5F1]">
      <div className="bg-[#0A0A0A] px-5 py-4"><img src="/logo-white.png" alt="SpaceMatch" className="h-7" /></div>
      <div className="mx-auto max-w-xl px-5 py-6 text-[#0A0A0A]">{children}</div>
    </div>
  );
}
