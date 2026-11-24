import { useMutation, useQuery } from "convex/react";
import { CalendarPlus, QrCode, Trash2, UserCheck, UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { btnDark, btnGold, btnLight, Card, H2, input, label, LinkBtn, PageHead , toastErr } from "@/components/hub/mm";
import { chicagoToday } from "@/lib/marketMe";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

// /open-houses — team open house calendar: add a slot on a team listing, anyone can host an open one.
const fmtDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const err = toastErr;

export function OpenHousesPage() {
  const d = useQuery(api.marketMe.openHouses);
  const add = useMutation(api.marketMe.addOpenHouse);
  const claim = useMutation(api.marketMe.claimOpenHouse);
  const remove = useMutation(api.marketMe.removeOpenHouse);
  const [open, setOpen] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [f, setF] = useState({ listingId: "", address: "", date: "", start: "11:00", end: "13:00", hostMe: true, notes: "" });
  if (!d) return <div className="p-6 text-[17px] text-stone-700">Loading…</div>;
  const slots = d.slots.filter(s => !onlyMine || s.mine);
  const days = [...new Set(slots.map(s => s.date))];
  const openCount = d.slots.filter(s => !s.hostEmail).length;

  const submit = () =>
    add({
      listingId: f.listingId && f.listingId !== "other" ? (f.listingId as Id<"listings">) : undefined,
      address: f.listingId === "other" ? f.address : undefined,
      date: f.date,
      start: f.start,
      end: f.end,
      hostMe: f.hostMe,
      notes: f.notes || undefined,
    })
      .then(() => {
        toast.success(f.hostMe ? "Added. You're the host." : "Added. Agents can now claim it.");
        setOpen(false);
        setF({ ...f, date: "", notes: "" });
      })
      .catch(err);

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6" data-testid="oh-page">
      <PageHead title="Open house calendar" sub="Host an open house on a team listing to meet buyers. Grab an open slot, or add your own." />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnGold} onClick={() => setOpen(v => !v)} data-testid="oh-add-toggle"><CalendarPlus className="size-[18px]" /> Add an open house</button>
        <button type="button" className={onlyMine ? btnDark : btnLight} onClick={() => setOnlyMine(v => !v)} data-testid="oh-mine">{onlyMine ? "Showing mine" : "Only mine"}</button>
        <LinkBtn to="/forms?open=open-house-signin" light icon={QrCode}>Sign-in QR</LinkBtn>
      </div>

      {open && (
        <Card testid="oh-form">
          <H2>New open house</H2>
          <label className={label} htmlFor="oh-listing">Listing</label>
          <select id="oh-listing" className={input} value={f.listingId} onChange={e => setF({ ...f, listingId: e.target.value })} data-testid="oh-listing">
            <option value="">Pick a team listing…</option>
            {d.listings.map(l => (
              <option key={l._id} value={l._id}>{l.address} ({l.agentName})</option>
            ))}
            <option value="other">Another address</option>
          </select>
          {f.listingId === "other" && (
            <input className={`${input} mt-2`} placeholder="Address" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} data-testid="oh-address" />
          )}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <label className={label} htmlFor="oh-date">Date</label>
              <input id="oh-date" type="date" min={chicagoToday()} className={input} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} data-testid="oh-date" />
            </div>
            <div>
              <label className={label} htmlFor="oh-start">Start</label>
              <input id="oh-start" type="time" className={input} value={f.start} onChange={e => setF({ ...f, start: e.target.value })} data-testid="oh-start" />
            </div>
            <div>
              <label className={label} htmlFor="oh-end">End</label>
              <input id="oh-end" type="time" className={input} value={f.end} onChange={e => setF({ ...f, end: e.target.value })} data-testid="oh-end" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className={f.hostMe ? btnDark : btnLight} onClick={() => setF({ ...f, hostMe: true })} data-testid="oh-host-me">I'm hosting</button>
            <button type="button" className={!f.hostMe ? btnDark : btnLight} onClick={() => setF({ ...f, hostMe: false })} data-testid="oh-host-open">Needs a host</button>
          </div>
          <input className={`${input} mt-3`} placeholder="Notes (lockbox, parking…) optional" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
          <button type="button" className={`${btnGold} mt-3 w-full`} onClick={submit} data-testid="oh-save">Save open house</button>
        </Card>
      )}

      {openCount > 0 && !onlyMine && (
        <p className="rounded-2xl bg-[#FBF4E6] p-3 text-[16px] font-semibold text-[#0A0A0A] ring-1 ring-[#D9BC8C]">{openCount} open house{openCount > 1 ? "s need" : " needs"} a host.</p>
      )}

      {days.length === 0 && (
        <Card><p className="text-[17px] text-stone-700">{onlyMine ? "You're not hosting any open houses yet." : "No open houses on the calendar yet. Add the first one."}</p></Card>
      )}
      {days.map(day => (
        <section key={day}>
          <h2 className="mb-2 text-[18px] font-bold text-[#7a5a26]">{fmtDay(day)}</h2>
          <div className="space-y-2">
            {slots.filter(s => s.date === day).map(s => (
              <Card key={s._id} testid="oh-slot">
                <div className="text-[17px] font-bold text-[#0A0A0A]">{s.address}</div>
                <div className="text-[16px] text-stone-700">{fmtTime(s.start)}–{fmtTime(s.end)} · listing agent {s.listingAgent}</div>
                {s.notes && <div className="mt-1 text-[15px] text-stone-700">{s.notes}</div>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {s.hostEmail ? (
                    <span className="rounded-full bg-[#F7F5F1] px-3 py-1.5 text-[15px] font-semibold text-[#0A0A0A]" data-testid="oh-host">Host: {s.mine ? "You" : s.hostName}</span>
                  ) : (
                    <button type="button" className={btnGold} onClick={() => claim({ id: s._id, claim: true }).then(() => toast.success("You're hosting it")).catch(err)} data-testid="oh-claim"><UserCheck className="size-[18px]" /> Host it</button>
                  )}
                  {s.hostEmail && (s.mine || d.isStaff) && (
                    <button type="button" className={btnLight} onClick={() => claim({ id: s._id, claim: false }).then(() => toast("Slot is open again")).catch(err)} data-testid="oh-unclaim"><UserMinus className="size-[18px]" /> Give it up</button>
                  )}
                  {s.canEdit && (
                    <button type="button" className={btnLight} onClick={() => { if (confirm("Remove this open house?")) remove({ id: s._id }).catch(err); }} data-testid="oh-remove"><Trash2 className="size-[18px]" /> Remove</button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
