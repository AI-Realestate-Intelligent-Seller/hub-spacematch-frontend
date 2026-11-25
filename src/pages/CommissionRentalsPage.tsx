// 100% commission rentals (Michael 2026-11-10): Chicago rental buildings that pay the tenant's agent
// a full month's rent or more. Agents add buildings; the office stamps them Verified.
// Second list "Doesn't pay" (Michael 11-10): no broker commission, under a full month, or didn't pay on a deal.
import { BadgeCheck, Ban, Building2, ChevronDown, EyeOff, ExternalLink, Flag, Globe, Loader2, Mail, MapPin, Pencil, Phone, Plus, Search, SearchX, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, FieldError, LoadError, Skeleton, errorBorder } from "@/components/hub/FormState";
import { apiErrorMessage, fieldErrors, useApiData } from "@/lib/apiData";
import { check, fieldRules, orNull, typeEmail, typePhone } from "@/lib/formRules";
import { telHref } from "@/lib/hub";
import { type Building, type RentalsData, rentalsApi } from "@/lib/rentalsApi";
import { z } from "zod";

type Data = RentalsData;
function useBuildings() { return useApiData("rentals:list", () => rentalsApi.list(), { pollMs: 120_000 }); }

// A stamp older than this asks for a fresh check: building commissions change with the leasing season.
const STALE_DAYS = 90;
const DAY = 864e5;
const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const today = () => new Date().toLocaleDateString("en-CA");
const errText = apiErrorMessage;
const href = (u: string) => (u.startsWith("http") ? u : `https://${u}`);
const mapHref = (a: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;

type ListId = "pays" | "nopay";
const isNoPay = (b: { status?: string }) => b.status === "no_pay";
const REASONS = [
  { id: "none", label: "No broker commission", head: "No commission", sub: "to the tenant's agent" },
  { id: "under", label: "Pays less than a full month", head: "", sub: "of one month's rent" },
  { id: "unpaid", label: "Didn't pay an agent on a deal", head: "Didn't pay", sub: "on an agent's deal" },
] as const;
const reasonOf = (b: Building) => REASONS.find(r => r.id === b.noPayReason) ?? REASONS[0];

type State = "verified" | "recheck" | "unverified";
function stateOf(b: Building): State {
  if (!b.verified) return "unverified";
  const stale = (b.verifiedAt ?? 0) < Date.now() - STALE_DAYS * DAY;
  const ended = !!b.offerEnds && b.offerEnds < today();
  return stale || ended || b.flagNote ? "recheck" : "verified";
}

const inputCls = "mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[15px] font-normal";
const btnCls = "inline-flex items-center gap-1.5 rounded-xl bg-[#F7F5F1] px-3.5 py-2.5 text-sm font-semibold text-[#2B2A27] ring-1 ring-[#E6E1D8]";

function Stamp({ b }: { b: Building }) {
  const s = stateOf(b);
  const noPay = isNoPay(b);
  if (s === "unverified") {
    return (
      <span data-testid="stamp-unverified" className="shrink-0 rounded-md border border-dashed border-stone-300 px-2 py-1 text-center text-[11px] font-semibold uppercase leading-tight tracking-wide text-stone-500">
        {noPay ? "Not confirmed" : "Not verified"}<br />yet
      </span>
    );
  }
  // Gold is kept for buildings that pay. A confirmed "doesn't pay" is stamped in dark ink.
  const ink = s !== "verified" ? "border-stone-400 text-stone-500" : noPay ? "border-[#2B2A27] text-[#2B2A27]" : "border-[#9C7434] text-[#9C7434]";
  return (
    <span
      data-testid={s === "verified" ? "stamp-verified" : "stamp-recheck"}
      title={`${b.verifiedHow ?? "Verified"} · ${b.verifiedByName ?? ""}`}
      className={`shrink-0 -rotate-3 rounded-md border-2 p-0.5 ${ink}`}
    >
      <span className={`flex flex-col items-center rounded-[3px] border px-2 py-1 leading-none ${ink}`}>
        <span className="flex items-center gap-1 text-[12px] font-extrabold uppercase tracking-[0.14em]">
          <BadgeCheck className="size-3.5" />{s !== "verified" ? "Re-check" : noPay ? "Confirmed" : "Verified"}
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider">{b.verifiedAt ? fmtDate(b.verifiedAt) : ""}</span>
      </span>
    </span>
  );
}

const empty = {
  name: "", address: "", neighborhood: "", manager: "", commissionPct: "100", bonus: "", keyRule: "", terms: "",
  phone: "", email: "", brokerUrl: "", website: "", sourceNote: "", sourceUrl: "", offerEnds: "",
  status: "pays", noPayReason: "none",
};
const emptyNoPay = { ...empty, status: "no_pay", commissionPct: "50" };
type Draft = typeof empty;

/** Same rules as the backend (commission-building.validation.ts). */
function checkBuilding(d: Draft, isNew: boolean): Record<string, string> {
  const shape = z.object({
    address: z.string().trim().min(1, "Add the building's street address.").max(200, "Address is too long (200 characters max).").refine(v => /\d/.test(v), "The address needs a street number."),
    name: fieldRules.text(120, "Building name"),
    neighborhood: fieldRules.text(160, "Neighborhood"),
    manager: fieldRules.text(160, "Management company"),
    bonus: fieldRules.text(160, "Bonus"),
    keyRule: fieldRules.text(160, "Rule"),
    terms: fieldRules.text(1500, "How to get paid"),
    phone: fieldRules.phone,
    email: fieldRules.email,
    brokerUrl: fieldRules.website,
    sourceNote: fieldRules.text(400, "How you know"),
    sourceUrl: fieldRules.website,
  });
  const e = check(shape, d);
  const noPay = d.status === "no_pay";
  const pct = Number(d.commissionPct);
  const needsPct = !noPay || d.noPayReason === "under";
  if (needsPct) {
    if (!/^\d+$/.test(d.commissionPct)) e.commissionPct = "Enter a whole number.";
    else if (noPay && (pct < 1 || pct >= 100)) e.commissionPct = "Enter what it pays as a percent of one month's rent, from 1 to 99. If it pays 100% or more, add it to the 100% list.";
    else if (!noPay && pct < 100) e.commissionPct = "This list is only for buildings paying 100% of a month's rent or more. If it pays less, add it under Doesn't pay.";
    else if (!noPay && pct > 400) e.commissionPct = `${pct}% looks too high. Enter the percent of one month's rent (100 = a full month).`;
  }
  if (!noPay && d.offerEnds && Number.isNaN(Date.parse(`${d.offerEnds}T12:00:00Z`))) e.offerEnds = "Use a real date.";
  if (isNew && !d.sourceNote.trim() && !d.sourceUrl.trim()) e.sourceNote = "Tell the team how you know: a link, a broker email, a call or a deal you closed there.";
  return e;
}

function BuildingForm({ initial, id, canVerify, verifyHow, confirmHow, onClose }: { initial: Draft; id?: string; canVerify: boolean; verifyHow: readonly string[]; confirmHow: readonly string[]; onClose: () => void }) {
  const [d, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Re-check fields that already show an error as the person fixes them.
  const setD = (next: Draft) => {
    setDraft(next);
    if (Object.values(errors).some(Boolean)) {
      const e = checkBuilding(next, !id);
      setErrors(err => Object.fromEntries(Object.keys(err).map(k => [k, e[k] ?? ""])));
    }
  };
  const [stamp, setStamp] = useState(false);
  const noPay = d.status === "no_pay";
  const hows = noPay ? confirmHow : verifyHow;
  const [howPick, setHow] = useState("");
  const how = hows.includes(howPick) ? howPick : hows[0] ?? "";
  const [busy, setBusy] = useState(false);
  const filters: Partial<Record<keyof Draft, (v: string) => string>> = {
    phone: typePhone, email: typeEmail, commissionPct: v => v.replace(/\D/g, "").slice(0, 3), brokerUrl: v => v.trim(), sourceUrl: v => v.trim(),
  };
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setD({ ...d, [k]: (filters[k] ?? (v => v))(e.target.value) });
  const ec = (k: string) => `${inputCls} ${errorBorder(errors[k])}`;
  // Office moving a building to the other list: give the percent a value that list accepts.
  const setList = (status: string) => setD({ ...d, status, commissionPct: status === "no_pay" ? (Number(d.commissionPct) < 100 ? d.commissionPct : "50") : (Number(d.commissionPct) >= 100 ? d.commissionPct : "100") });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = checkBuilding(d, !id);
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error("Fix the highlighted fields first.");
    setBusy(true);
    try {
      const body = {
        name: orNull(d.name), address: d.address.trim(), commissionPct: noPay && d.noPayReason !== "under" ? 0 : Number(d.commissionPct),
        status: noPay ? ("no_pay" as const) : ("pays" as const),
        noPayReason: noPay ? (d.noPayReason as "none" | "under" | "unpaid") : null,
        neighborhood: orNull(d.neighborhood), manager: orNull(d.manager), bonus: noPay ? null : orNull(d.bonus), keyRule: orNull(d.keyRule), terms: noPay ? null : orNull(d.terms),
        phone: orNull(d.phone), email: orNull(d.email), brokerUrl: noPay ? null : orNull(d.brokerUrl), website: orNull(d.website),
        sourceNote: orNull(d.sourceNote), sourceUrl: orNull(d.sourceUrl), offerEnds: noPay ? null : orNull(d.offerEnds),
      };
      if (id) await rentalsApi.update(id, body);
      else await rentalsApi.add({ ...body, verify: stamp, verifiedHow: stamp ? how : null });
      toast.success(id ? "Saved" : stamp ? `Added with the ${noPay ? "Confirmed" : "Verified"} stamp` : `Added. The office will check it and stamp it ${noPay ? "Confirmed" : "Verified"}`);
      onClose();
    } catch (x) {
      setErrors(fieldErrors(x));
      toast.error(errText(x));
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90svh] max-w-lg overflow-y-auto" data-testid="building-form">
        <DialogHeader><DialogTitle className="font-['Playfair_Display'] text-xl">{id ? "Edit building" : noPay ? "Add a building that doesn't pay" : "Add a building that pays 100% or more"}</DialogTitle></DialogHeader>
        <form onSubmit={save} noValidate className="grid grid-cols-2 gap-3 text-sm font-medium">
          {id && canVerify && (
            <label className="col-span-2">Which list
              <select name="status" value={d.status} onChange={e => setList(e.target.value)} className={inputCls}>
                <option value="pays">Pays 100% or more</option>
                <option value="no_pay">Doesn't pay</option>
              </select>
              {d.status !== initial.status && <span className="mt-1 block font-normal text-stone-500">Moving it takes the stamp off until you check it again.</span>}
            </label>
          )}
          <label className="col-span-2">Street address *<input name="address" value={d.address} onChange={set("address")} className={ec("address")} placeholder="1212 S Michigan Ave, Chicago, IL 60605" /><FieldError msg={errors.address} /></label>
          <label className="col-span-2">Building name<input name="name" value={d.name} onChange={set("name")} className={ec("name")} placeholder="Park Michigan (leave blank to use the address)" /><FieldError msg={errors.name} /></label>
          <label>Neighborhood<input name="neighborhood" value={d.neighborhood} onChange={set("neighborhood")} className={ec("neighborhood")} placeholder="South Loop" /><FieldError msg={errors.neighborhood} /></label>
          <label>Management company<input name="manager" value={d.manager} onChange={set("manager")} className={ec("manager")} /><FieldError msg={errors.manager} /></label>
          {noPay ? (
            <>
              <label className="col-span-2">What's the story? *
                <select name="noPayReason" value={d.noPayReason} onChange={set("noPayReason")} className={inputCls}>
                  {REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </label>
              {d.noPayReason === "under" && (
                <label className="col-span-2">What it pays: percent of one month's rent * <span className="font-normal text-stone-500">(50 = half a month)</span>
                  <input name="commissionPct" value={d.commissionPct} onChange={set("commissionPct")} inputMode="numeric" maxLength={2} className={ec("commissionPct")} /><FieldError msg={errors.commissionPct} />
                </label>
              )}
              <label className="col-span-2">What agents should know<input name="keyRule" value={d.keyRule} onChange={set("keyRule")} className={ec("keyRule")} placeholder="Leases only through its own leasing office" /><FieldError msg={errors.keyRule} /></label>
            </>
          ) : (
            <>
          <label className="col-span-2">Commission: percent of one month's rent * <span className="font-normal text-stone-500">(100 = a full month, 150 = a month and a half)</span>
            <input name="commissionPct" value={d.commissionPct} onChange={set("commissionPct")} inputMode="numeric" maxLength={3} className={ec("commissionPct")} /><FieldError msg={errors.commissionPct} />
          </label>
          <label className="col-span-2">Extra bonus on top<input name="bonus" value={d.bonus} onChange={set("bonus")} className={ec("bonus")} placeholder="$500 gift card" /><FieldError msg={errors.bonus} /></label>
          <label className="col-span-2">Offer ends (if it's a limited promo)<input name="offerEnds" value={d.offerEnds} onChange={set("offerEnds")} type="date" className={ec("offerEnds")} /><FieldError msg={errors.offerEnds} /></label>
          <label className="col-span-2">The one rule agents must know<input name="keyRule" value={d.keyRule} onChange={set("keyRule")} className={ec("keyRule")} placeholder="Register your client before the tour" /><FieldError msg={errors.keyRule} /></label>
          <label className="col-span-2">How to get paid<textarea name="terms" value={d.terms} onChange={set("terms")} className={`${ec("terms")} min-h-[70px]`} placeholder="Who to invoice, by when, what they need from you" /><FieldError msg={errors.terms} /></label>
            </>
          )}
          <label>Leasing or broker phone<input name="phone" value={d.phone} onChange={set("phone")} type="tel" inputMode="tel" placeholder="(312) 555-0100" className={ec("phone")} /><FieldError msg={errors.phone} /></label>
          <label>Broker contact email<input name="email" value={d.email} onChange={set("email")} type="email" className={ec("email")} /><FieldError msg={errors.email} /></label>
          {!noPay && (
          <label className="col-span-2">Broker page or sign-up link<input name="brokerUrl" value={d.brokerUrl} onChange={set("brokerUrl")} className={ec("brokerUrl")} placeholder="https://" /><FieldError msg={errors.brokerUrl} /></label>
          )}
          <label className="col-span-2">{noPay ? "How do you know? *" : "How do you know it pays this? *"}<input name="sourceNote" value={d.sourceNote} onChange={set("sourceNote")} className={ec("sourceNote")} placeholder={noPay ? "Leasing office told me on Nov 8 / my October lease there was never paid" : "Broker email from the building on Nov 8 / I closed a lease there in October"} /><FieldError msg={errors.sourceNote} /></label>
          <label className="col-span-2">Link to proof (optional)<input name="sourceUrl" value={d.sourceUrl} onChange={set("sourceUrl")} className={ec("sourceUrl")} placeholder="https://" /><FieldError msg={errors.sourceUrl} /></label>
          {!id && canVerify && (
            <div className="col-span-2 rounded-xl bg-[#F7F5F1] p-3">
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={stamp} onChange={e => setStamp(e.target.checked)} /> I confirmed this myself. Add the {noPay ? "Confirmed" : "Verified"} stamp</label>
              {stamp && (
                <select aria-label="How you confirmed it" value={how} onChange={e => setHow(e.target.value)} className={inputCls}>{hows.map(h => <option key={h}>{h}</option>)}</select>
              )}
            </div>
          )}
          <button disabled={busy} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] py-3 font-semibold text-white disabled:opacity-60">{busy && <Loader2 className="size-4 animate-spin" />}{busy ? "Saving…" : id ? "Save" : "Add building"}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VerifyDialog({ b, verifyHow, onClose }: { b: Building; verifyHow: readonly string[]; onClose: () => void }) {
  const noPay = isNoPay(b);
  const [how, setHow] = useState(verifyHow[0] ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="verify-dialog">
        <DialogHeader><DialogTitle className="font-['Playfair_Display'] text-xl">{noPay ? "Confirm" : "Verify"} {b.name}</DialogTitle></DialogHeader>
        <p className="text-[15px] text-[#3A3833]">The stamp tells agents the office confirmed <b>{noPay ? (b.noPayReason === "under" ? `it pays only ${b.commissionPct}% of one month's rent` : reasonOf(b).label.toLowerCase()) : `${b.commissionPct}% of one month's rent`}</b> with the building. It shows your name and today's date.</p>
        <label className="text-sm font-medium">How did you confirm it?
          <select value={how} onChange={e => setHow(e.target.value)} className={inputCls}>{verifyHow.map(h => <option key={h}>{h}</option>)}</select>
        </label>
        <button
          type="button" disabled={busy}
          onClick={async () => {
            setBusy(true);
            try { await rentalsApi.verify(b._id, true, how); toast.success(noPay ? "Confirmed stamp added" : "Verified stamp added"); onClose(); }
            catch (x) { toast.error(errText(x)); } finally { setBusy(false); }
          }}
          className={`rounded-xl py-3 font-semibold text-white disabled:opacity-60 ${noPay ? "bg-[#0A0A0A]" : "bg-[#9C7434]"}`}
        >{busy ? "Saving…" : `Add the ${noPay ? "Confirmed" : "Verified"} stamp`}</button>
      </DialogContent>
    </Dialog>
  );
}

function ReportDialog({ b, onClose }: { b: Building; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="report-dialog">
        <DialogHeader><DialogTitle className="font-['Playfair_Display'] text-xl">Report a change at {b.name}</DialogTitle></DialogHeader>
        <p className="text-[15px] text-[#3A3833]">{isNoPay(b) ? "Did it start paying agents, or is this wrong?" : "Did the commission drop, a promo end, or the rules change?"} Every agent sees your note until the office re-checks it.</p>
        <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 400))} maxLength={400} aria-label="What changed" className={`${inputCls} min-h-[90px]`} placeholder={isNoPay(b) ? "They paid me a full month on a lease last week" : "Leasing office told me today it's 50% now"} />
        <button
          type="button" disabled={busy || note.trim().length < 4}
          onClick={async () => {
            setBusy(true);
            try { await rentalsApi.report(b._id, note.trim()); toast.success("Thanks. The office will re-check it"); onClose(); }
            catch (x) { toast.error(errText(x)); } finally { setBusy(false); }
          }}
          className="rounded-xl bg-[#0A0A0A] py-3 font-semibold text-white disabled:opacity-50"
        >{busy ? "Sending…" : "Send report"}</button>
        <p className="-mt-1 text-right text-xs text-stone-500">{note.trim().length < 4 ? "Say what changed (4 characters or more)." : `${note.length}/400`}</p>
      </DialogContent>
    </Dialog>
  );
}

function BuildingCard({ b, viewer, highlight, onEdit, onVerify, onReport }: {
  b: Building; viewer: Data["viewer"]; highlight: boolean; onEdit: () => void; onVerify: () => void; onReport: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    fn().then(() => toast.success(ok)).catch(e => toast.error(errText(e))).finally(() => setBusy(false));
  };
  const verify = ({ id, verified }: { id: string; verified: boolean }) => run(() => rentalsApi.verify(id, verified), "Stamp removed");
  const moderate = ({ id, remove, ...m }: { id: string; hidden?: boolean; clearReport?: boolean; remove?: boolean }) =>
    run(() => (remove ? rentalsApi.remove(id) : rentalsApi.moderate(id, m)), remove ? "Building removed" : "Saved");
  const s = stateOf(b);
  const own = b.addedByEmail === viewer.email;
  const canEdit = viewer.canVerify || (own && !b.verified);
  const ended = !!b.offerEnds && b.offerEnds < today();
  const noPay = isNoPay(b);
  const why = reasonOf(b);
  const meta = "inline-flex items-center gap-0.5 hover:text-stone-800";
  return (
    <div id={b._id} data-testid="building-card" className={`flex flex-col rounded-2xl bg-white p-4 ring-1 ${highlight ? "ring-2 ring-[#9C7434]" : "ring-[#ebe5da]"} ${b.hidden ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        {noPay ? (
          <div data-testid="nopay-head">
            <div className={`flex items-center gap-1.5 font-['Playfair_Display'] font-bold leading-none text-red-800 ${why.id === "under" ? "text-[34px]" : "whitespace-nowrap text-[21px] sm:text-[24px]"}`}>
              {why.id !== "under" && <Ban className="size-5 shrink-0" />}{why.id === "under" ? `${b.commissionPct}%` : why.head}
            </div>
            <div className="mt-1 text-xs font-medium text-stone-500">{why.sub}</div>
          </div>
        ) : (
          <div>
            <div className="font-['Playfair_Display'] text-[34px] font-bold leading-none text-[#0A0A0A]">{b.commissionPct}%</div>
            <div className="mt-1 text-xs font-medium text-stone-500">of one month's rent</div>
          </div>
        )}
        <Stamp b={b} />
      </div>
      <div className="mt-3 text-lg font-bold leading-snug text-[#1F1E1B]">{b.name}</div>
      <a href={mapHref(b.address)} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-start gap-1 text-[15px] text-[#3A3833] underline decoration-stone-300 underline-offset-2">
        <MapPin className="mt-0.5 size-4 shrink-0 text-[#9C7434]" />{b.address}
      </a>
      <div className="mt-1 text-sm text-stone-600">{[b.neighborhood, b.manager].filter(Boolean).join(" · ")}</div>

      {b.bonus && <div className="mt-2 text-sm font-semibold text-emerald-700">+ {b.bonus}</div>}
      {b.offerEnds && <div className={`mt-1 text-sm font-medium ${ended ? "text-red-700" : "text-stone-600"}`}>{ended ? "Offer ended" : "Offer ends"} {fmtDate(new Date(`${b.offerEnds}T12:00:00`).getTime())}</div>}
      {b.keyRule && <p className="mt-2 rounded-lg bg-[#F7F5F1] px-3 py-2 text-sm leading-snug text-[#2B2A27]"><b>Know this:</b> {b.keyRule}</p>}
      {b.flagNote && (
        <p data-testid="report-note" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm leading-snug text-red-800">
          <b>{b.flaggedByName} reported{b.flaggedAt ? ` ${fmtDate(b.flaggedAt)}` : ""}:</b> {b.flagNote}
        </p>
      )}
      {b.terms && (
        <details className="group mt-2 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-1 font-semibold text-[#9C7434]">How to get paid<ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary>
          <p className="mt-1.5 whitespace-pre-line leading-relaxed text-[#3A3833]">{b.terms}</p>
        </details>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {b.brokerUrl && <a href={href(b.brokerUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#9C7434] px-3.5 py-2.5 text-sm font-semibold text-white"><ExternalLink className="size-4" />Broker page</a>}
        {b.phone && <a href={telHref(b.phone)} className={btnCls}><Phone className="size-4" />Call</a>}
        {b.email && <a href={`mailto:${b.email}`} className={btnCls}><Mail className="size-4" />Email</a>}
        {b.website && <a href={href(b.website)} target="_blank" rel="noreferrer" className={btnCls}><Globe className="size-4" />Building</a>}
      </div>

      <div className="mt-auto pt-3 text-xs leading-relaxed text-stone-500">
        {s === "unverified" ? (
          <span>Added by {b.addedByName}{b.sourceNote ? `: “${b.sourceNote}”` : ""}. {noPay ? "One agent's report. The office has not confirmed it yet." : "Confirm with the building before you tour."}</span>
        ) : (
          <span>
            {s === "recheck" && !b.flagNote ? "Due for a fresh check. " : ""}
            Checked by {b.verifiedByName}{b.verifiedHow ? ` · ${b.verifiedHow}` : ""}
          </span>
        )}
        {b.sourceUrl && <> · <a href={href(b.sourceUrl)} target="_blank" rel="noreferrer" className="underline">Source</a></>}
      </div>
      <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 ${busy ? "pointer-events-none opacity-60" : ""}`} aria-busy={busy}>
        {busy && <Loader2 className="size-3 animate-spin" />}
        <button type="button" onClick={onReport} className={meta}><Flag className="size-3" />Report a change</button>
        {viewer.canVerify && s !== "verified" && <button type="button" onClick={onVerify} className={`${meta} font-bold text-[#9C7434]`}><BadgeCheck className="size-3.5" />{noPay ? (b.verified ? "Confirm again" : "Confirm") : b.verified ? "Verify again" : "Verify"}</button>}
        {viewer.canVerify && b.verified && <button type="button" onClick={() => confirm(`Take the stamp off ${b.name}?`) && verify({ id: b._id, verified: false })} className={meta}>Remove stamp</button>}
        {viewer.canVerify && b.flagNote && <button type="button" onClick={() => moderate({ id: b._id, clearReport: true })} className={meta}>Clear report</button>}
        {canEdit && <button type="button" onClick={onEdit} className={`${meta} ml-auto`}><Pencil className="size-3" />Edit</button>}
        {viewer.canVerify && <button type="button" onClick={() => moderate({ id: b._id, hidden: !b.hidden })} className={meta}><EyeOff className="size-3" />{b.hidden ? "Show" : "Hide"}</button>}
        {canEdit && <button type="button" aria-label={`Remove ${b.name}`} onClick={() => confirm(`Remove ${b.name} from the list?`) && moderate({ id: b._id, remove: true })} className={`${meta} hover:text-red-600`}><Trash2 className="size-3" /></button>}
      </div>
    </div>
  );
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "verified", label: "Verified" },
  { id: "over", label: "Over 100%" },
  { id: "check", label: "Needs a check" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];
const LISTS = [
  { id: "pays", label: "Pays 100% or more" },
  { id: "nopay", label: "Doesn't pay" },
] as const;

export function CommissionRentalsPage() {
  const { data, error, reload } = useBuildings();
  const [params] = useSearchParams();
  const [list, setListId] = useState<ListId>(params.get("list") === "nopay" ? "nopay" : "pays");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [hood, setHood] = useState("");
  const [editing, setEditing] = useState<{ id?: string; d: Draft } | null>(null);
  const [verifying, setVerifying] = useState<Building | null>(null);
  const [reporting, setReporting] = useState<Building | null>(null);
  const focus = params.get("b");
  const everything = useMemo(() => data?.items ?? [], [data]);
  const noPayCount = everything.filter(isNoPay).length;
  const listCount = { pays: everything.length - noPayCount, nopay: noPayCount };
  const all = useMemo(() => everything.filter(b => isNoPay(b) === (list === "nopay")), [everything, list]);
  const nopay = list === "nopay";
  const pickList = (id: ListId) => { setListId(id); setFilter("all"); setHood(""); };
  // A link to one building (search, staff email) opens the list that building is on.
  const focused = focus ? everything.find(b => b._id === focus) : undefined;
  const focusNoPay = focused ? isNoPay(focused) : undefined;
  useEffect(() => { if (focusNoPay !== undefined) setListId(focusNoPay ? "nopay" : "pays"); }, [focusNoPay]);

  // Arriving from a scrolled Home page: start at the title and search box.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on mount only
  useEffect(() => { if (!focus) window.scrollTo({ top: 0 }); }, []);
  useEffect(() => { if (focus && data && list) setTimeout(() => document.getElementById(focus)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300); }, [focus, data, list]);

  const hoods = useMemo(() => [...new Set(all.map(b => b.neighborhood).filter(Boolean) as string[])].sort(), [all]);
  const counts = useMemo(() => ({
    all: all.length,
    verified: all.filter(b => stateOf(b) === "verified").length,
    over: all.filter(b => b.commissionPct > 100 || !!b.bonus).length,
    check: all.filter(b => stateOf(b) !== "verified").length,
  }), [all]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const rank = { verified: 0, recheck: 1, unverified: 2 };
    return all
      .filter(b => !hood || b.neighborhood === hood)
      .filter(b => filter === "all" || (filter === "verified" && stateOf(b) === "verified") || (filter === "over" && (b.commissionPct > 100 || !!b.bonus)) || (filter === "check" && stateOf(b) !== "verified"))
      .filter(b => { const hay = [b.name, b.address, b.neighborhood, b.manager, b.bonus, b.keyRule].join(" ").toLowerCase(); return words.every(w => hay.includes(w)); })
      .sort((a, b) => rank[stateOf(a)] - rank[stateOf(b)] || b.commissionPct - a.commissionPct || (a.neighborhood ?? "").localeCompare(b.neighborhood ?? "") || a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [all, q, filter, hood]);

  const toDraft = (b: Building): Draft => ({
    ...empty,
    ...Object.fromEntries(Object.entries(b).filter(([k]) => k in empty).map(([k, val]) => [k, val == null ? "" : String(val)])),
  });

  return (
    <div className="space-y-5" data-testid="commission-rentals-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <h1 className="font-['Playfair_Display'] text-3xl font-bold text-[#0A0A0A]">100% commission rentals</h1>
          <p className="mt-1 max-w-2xl text-stone-600">{nopay
            ? "Chicago rental buildings that pay the tenant's agent nothing, pay less than a full month, or didn't pay one of us on a deal. Check here before you tour so you know what to expect."
            : "Chicago rental buildings that pay you a full month's rent or more when you bring the tenant. The gold stamp means the office confirmed it with the building."}</p>
        </div>
        <button type="button" onClick={() => setEditing({ d: nopay ? emptyNoPay : empty })} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#9C7434] px-4 py-3 text-sm font-semibold text-white sm:py-2.5">
          <Plus className="size-4" />Add building
        </button>
      </div>

      <div role="tablist" aria-label="Which list" className="grid grid-cols-2 gap-1 rounded-2xl bg-[#EFEBE3] p-1 sm:inline-grid sm:min-w-[420px]">
        {LISTS.map(l => (
          <button key={l.id} type="button" role="tab" aria-selected={list === l.id} data-testid={`list-${l.id}`} onClick={() => pickList(l.id)}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[15px] font-semibold ${list === l.id ? "bg-white text-[#0A0A0A] shadow-sm" : "text-stone-600"}`}>
            {l.id === "nopay" && <Ban className="size-4 text-red-800" />}{l.label} {data && <span className="font-normal opacity-60">{listCount[l.id]}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-stone-200">
          <Search className="size-4 text-stone-400" />
          <input value={q} onChange={e => setQ(e.target.value.slice(0, 100))} aria-label="Search buildings" placeholder="Search building, street, neighborhood or management company" className="w-full bg-transparent outline-none" />
        </div>
        <select aria-label="Neighborhood" value={hood} onChange={e => setHood(e.target.value)} className="rounded-xl bg-white px-3 py-2.5 text-[15px] ring-1 ring-stone-200">
          <option value="">All neighborhoods</option>
          {hoods.map(h => <option key={h}>{h}</option>)}
        </select>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.filter(f => !(nopay && f.id === "over")).map(f => (
          <button key={f.id} type="button" data-testid={`filter-${f.id}`} onClick={() => setFilter(f.id)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ring-1 ${filter === f.id ? "bg-[#0A0A0A] text-white ring-[#0A0A0A]" : "bg-white text-stone-700 ring-stone-200"}`}>
            {nopay && f.id === "verified" ? "Confirmed" : f.label} {data && <span className="opacity-60">{counts[f.id]}</span>}
          </button>
        ))}
      </div>

      {data === undefined && error ? (
        <LoadError error={error} onRetry={() => void reload()} what="the buildings" />
      ) : data === undefined ? (
        <Skeleton label="Loading commission rental buildings" rows={6} className="h-36" grid="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" />
      ) : shown.length === 0 ? (
        all.length === 0 ? (
          <EmptyState icon={nopay ? <Ban className="size-8" /> : <Building2 className="size-8" />} title={nopay ? "Nothing on this list yet" : "No buildings yet"}
            action={<button type="button" onClick={() => setEditing({ d: nopay ? emptyNoPay : empty })} className="inline-flex items-center gap-1.5 rounded-xl bg-[#9C7434] px-4 py-2.5 text-sm font-semibold text-white"><Plus className="size-4" />Add building</button>}>
            {nopay ? "Know a building that doesn't pay agents, pays under a full month, or didn't pay you? Add it so nobody gets surprised." : "Know one that pays 100% or more? Add it and the office will verify it."}
          </EmptyState>
        ) : (
          <EmptyState icon={<SearchX className="size-8" />} title="No building matches that"
            action={<button type="button" onClick={() => { setQ(""); setFilter("all"); setHood(""); }} className="rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ring-stone-300">Clear search and filters</button>}>
            Try another word, neighborhood or filter.
          </EmptyState>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(b => (
            <BuildingCard key={b._id} b={b} viewer={data.viewer} highlight={focus === b._id}
              onEdit={() => setEditing({ id: b._id, d: toDraft(b) })} onVerify={() => setVerifying(b)} onReport={() => setReporting(b)} />
          ))}
        </div>
      )}

      {nopay && (
        <p data-testid="nopay-note" className="rounded-xl bg-white px-3.5 py-3 text-sm leading-relaxed text-[#3A3833] ring-1 ring-[#ebe5da]">
          A building on this list can still be the right home for your client. Show it if it fits, and agree on your fee with the client in writing before you tour.
        </p>
      )}
      <p className="text-xs leading-relaxed text-stone-500">
        Commissions are a percent of one month's rent and buildings change them often, so confirm with the leasing office before you tour and register your client the way the building asks.
        A stamp older than {STALE_DAYS} days turns grey until the office checks it again. Show clients the buildings that fit them, and tell them when a building pays your fee.
      </p>

      {editing && <BuildingForm initial={editing.d} id={editing.id} canVerify={!!data?.viewer.canVerify} verifyHow={data?.verifyHow ?? []} confirmHow={data?.confirmHow ?? []} onClose={() => setEditing(null)} />}
      {verifying && <VerifyDialog b={verifying} verifyHow={(isNoPay(verifying) ? data?.confirmHow : data?.verifyHow) ?? []} onClose={() => setVerifying(null)} />}
      {reporting && <ReportDialog b={reporting} onClose={() => setReporting(null)} />}
    </div>
  );
}
