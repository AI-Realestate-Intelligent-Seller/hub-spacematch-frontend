import { CalendarDays, CalendarPlus, Loader2, QrCode, Trash2, UserCheck, UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, FieldError, LoadError, Skeleton, errorBorder } from "@/components/hub/FormState";
import { btnDark, btnGold, btnLight, Card, H2, input, label, LinkBtn, PageHead } from "@/components/hub/mm";
import { apiErrorMessage, fieldErrors, useApiData } from "@/lib/apiData";
import { openHousesApi } from "@/lib/marketApi";
import { chicagoToday } from "@/lib/marketMe";

// /open-houses — team open house calendar: add a slot on a team listing, anyone can host an open one.
const fmtDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const err = (e: unknown) => toast.error(apiErrorMessage(e));
const inAYear = () => new Date(Date.parse(`${chicagoToday()}T12:00:00Z`) + 365 * 864e5).toISOString().slice(0, 10);

/** Same rules as the backend (open-house.validation.ts). */
function checkSlot(f: { listingId: string; address: string; date: string; start: string; end: string; notes: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.listingId) e.listingId = "Pick a listing or choose Another address.";
  if (f.listingId === "other") {
    if (!f.address.trim()) e.address = "Type the address.";
    else if (!/\d/.test(f.address)) e.address = "The address needs a street number.";
    else if (f.address.trim().length > 160) e.address = "Address is too long (160 characters max).";
  }
  if (!f.date) e.date = "Pick a date.";
  else if (f.date < chicagoToday()) e.date = "Pick a date from today on.";
  else if (f.date > inAYear()) e.date = "Pick a date within the next year.";
  if (!f.start) e.start = "Pick a start time.";
  if (!f.end) e.end = "Pick an end time.";
  else if (f.start && f.end <= f.start) e.end = "End time must be after the start time.";
  if (f.notes.trim().length > 300) e.notes = "Notes are too long (300 characters max).";
  return e;
}

export function OpenHousesPage() {
  const { data: d, error, reload } = useApiData("open-houses", () => openHousesApi.list(), { pollMs: 120_000 });
  const [open, setOpen] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [f, setFState] = useState({ listingId: "", address: "", date: "", start: "11:00", end: "13:00", hostMe: true, notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null); // "save" or a slot id
  const setF = (next: typeof f) => {
    setFState(next);
    if (Object.values(errors).some(Boolean)) {
      const e = checkSlot(next);
      setErrors(x => Object.fromEntries(Object.keys(x).map(k => [k, e[k] ?? ""])));
    }
  };
  const run = (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    fn().then(() => toast.success(ok)).catch(err).finally(() => setBusy(null));
  };
  if (!d) return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6" data-testid="oh-page">
      <PageHead title="Open house calendar" sub="Host an open house on a team listing to meet buyers. Grab an open slot, or add your own." />
      {error ? <LoadError error={error} onRetry={() => void reload()} what="the open house calendar" /> : <Skeleton rows={3} className="h-28" />}
    </div>
  );
  const slots = d.slots.filter(s => !onlyMine || s.mine);
  const days = [...new Set(slots.map(s => s.date))];
  const openCount = d.slots.filter(s => !s.hostEmail).length;

  const submit = async () => {
    const errs = checkSlot(f);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy("save");
    try {
      await openHousesApi.add({
        listingId: f.listingId && f.listingId !== "other" ? f.listingId : null,
        address: f.listingId === "other" ? f.address.trim() : null,
        date: f.date,
        start: f.start,
        end: f.end,
        hostMe: f.hostMe,
        notes: f.notes.trim() || null,
      });
      toast.success(f.hostMe ? "Added. You're the host." : "Added. Agents can now claim it.");
      setOpen(false);
      setFState({ ...f, date: "", notes: "" });
    } catch (e) {
      setErrors(fieldErrors(e));
      err(e);
    } finally {
      setBusy(null);
    }
  };

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
          <select id="oh-listing" className={`${input} ${errorBorder(errors.listingId)}`} aria-invalid={!!errors.listingId} value={f.listingId} onChange={e => setF({ ...f, listingId: e.target.value })} data-testid="oh-listing">
            <option value="">Pick a team listing…</option>
            {d.listings.map(l => (
              <option key={l._id} value={l._id}>{l.address} ({l.agentName})</option>
            ))}
            <option value="other">Another address</option>
          </select>
          <FieldError msg={errors.listingId} />
          {d.listings.length === 0 && <p className="mt-1 text-[14px] text-stone-600">No team listings are Active or Coming soon right now. Pick Another address.</p>}
          {f.listingId === "other" && (
            <>
              <input className={`${input} mt-2 ${errorBorder(errors.address)}`} maxLength={160} aria-label="Address" aria-invalid={!!errors.address} placeholder="Address, e.g. 1234 N Main St" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} data-testid="oh-address" />
              <FieldError msg={errors.address} />
            </>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <label className={label} htmlFor="oh-date">Date</label>
              <input id="oh-date" type="date" min={chicagoToday()} max={inAYear()} className={`${input} ${errorBorder(errors.date)}`} aria-invalid={!!errors.date} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} data-testid="oh-date" />
              <FieldError msg={errors.date} />
            </div>
            <div>
              <label className={label} htmlFor="oh-start">Start</label>
              <input id="oh-start" type="time" className={`${input} ${errorBorder(errors.start)}`} aria-invalid={!!errors.start} value={f.start} onChange={e => setF({ ...f, start: e.target.value })} data-testid="oh-start" />
              <FieldError msg={errors.start} />
            </div>
            <div>
              <label className={label} htmlFor="oh-end">End</label>
              <input id="oh-end" type="time" className={`${input} ${errorBorder(errors.end)}`} aria-invalid={!!errors.end} value={f.end} onChange={e => setF({ ...f, end: e.target.value })} data-testid="oh-end" />
              <FieldError msg={errors.end} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className={f.hostMe ? btnDark : btnLight} onClick={() => setF({ ...f, hostMe: true })} data-testid="oh-host-me">I'm hosting</button>
            <button type="button" className={!f.hostMe ? btnDark : btnLight} onClick={() => setF({ ...f, hostMe: false })} data-testid="oh-host-open">Needs a host</button>
          </div>
          <input className={`${input} mt-3 ${errorBorder(errors.notes)}`} maxLength={300} aria-label="Notes" aria-invalid={!!errors.notes} placeholder="Notes (lockbox, parking…) optional" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
          <FieldError msg={errors.notes} />
          <button type="button" disabled={busy === "save"} className={`${btnGold} mt-3 w-full disabled:opacity-60`} onClick={submit} data-testid="oh-save">{busy === "save" && <Loader2 className="size-[18px] animate-spin" />}{busy === "save" ? "Saving…" : "Save open house"}</button>
        </Card>
      )}

      {openCount > 0 && !onlyMine && (
        <p className="rounded-2xl bg-[#FBF4E6] p-3 text-[16px] font-semibold text-[#0A0A0A] ring-1 ring-[#D9BC8C]">{openCount} open house{openCount > 1 ? "s need" : " needs"} a host.</p>
      )}

      {days.length === 0 && (
        <EmptyState icon={<CalendarDays className="size-8" />} title={onlyMine ? "You're not hosting any open houses yet" : "No open houses on the calendar yet"}
          action={!open && <button type="button" className={btnGold} onClick={() => setOpen(true)}><CalendarPlus className="size-[18px]" /> Add an open house</button>}>
          {onlyMine ? "Grab an open slot from the full calendar, or add your own." : "Add the first one, or ask the listing agents when they're holding one."}
        </EmptyState>
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
                    <button type="button" disabled={busy === s._id} className={`${btnGold} disabled:opacity-60`} onClick={() => run(s._id, () => openHousesApi.claim(s._id, true), "You're hosting it")} data-testid="oh-claim"><UserCheck className="size-[18px]" /> Host it</button>
                  )}
                  {s.hostEmail && (s.mine || d.isStaff) && (
                    <button type="button" disabled={busy === s._id} className={`${btnLight} disabled:opacity-60`} onClick={() => run(s._id, () => openHousesApi.claim(s._id, false), "Slot is open again")} data-testid="oh-unclaim"><UserMinus className="size-[18px]" /> Give it up</button>
                  )}
                  {s.canEdit && (
                    <button type="button" disabled={busy === s._id} className={`${btnLight} disabled:opacity-60`} onClick={() => { if (confirm("Remove this open house?")) run(s._id, () => openHousesApi.remove(s._id), "Open house removed"); }} data-testid="oh-remove"><Trash2 className="size-[18px]" /> Remove</button>
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
