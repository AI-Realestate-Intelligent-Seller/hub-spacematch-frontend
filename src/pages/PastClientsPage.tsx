import { Check, Loader2, Mail, MessageSquare, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useSession } from "@/auth/session";
import { EmptyState, FieldError, LoadError, Skeleton, errorBorder } from "@/components/hub/FormState";
import { btnDark, btnGold, btnLight, Card, CopyBtn, H2, input, label, PageHead } from "@/components/hub/mm";
import { apiErrorMessage, fieldErrors, useApiData } from "@/lib/apiData";
import { check, fieldRules, orNull, typeEmail, typeName, typePhone } from "@/lib/formRules";
import { type PastClient, pastClientsApi } from "@/lib/marketApi";
import { chicagoToday, mailLink, prettyDate, smsLink, touchesFor } from "@/lib/marketMe";
import { z } from "zod";

// /past-clients — each agent's own past clients + what to send this month (anniversaries, holidays,
// quarterly market updates, review ask a week after closing). Only the agent sees their list.
const SIDES = [
  { v: "buyer", l: "Buyer" },
  { v: "seller", l: "Seller" },
  { v: "renter", l: "Renter" },
  { v: "landlord", l: "Landlord" },
];
const empty = { name: "", phone: "", email: "", address: "", closedOn: "", side: "buyer" };
const err = (e: unknown) => toast.error(apiErrorMessage(e));

/** Same rules as the backend (past-client.validation.ts). */
const clientSchema = z.object({
  name: z.string().trim().min(1, "Type the client's name.").min(2, "Name is too short.").max(80, "Name is too long (80 characters max).").regex(/^[\p{L}][\p{L}\s.'&,-]*$/u, "Use letters only (spaces, & . ' - are fine)."),
  closedOn: z.string().min(1, "Pick the closing date.").refine(v => v >= "1950-01-01", "That date looks too far back.").refine(v => Date.parse(`${v}T12:00:00Z`) <= Date.now() + 180 * 864e5, "Closing date can't be more than 6 months ahead."),
  side: z.enum(["buyer", "seller", "renter", "landlord"], { error: "Pick who they were." }),
  phone: fieldRules.phone,
  email: fieldRules.email,
  address: fieldRules.text(160, "Address"),
});

export function PastClientsPage() {
  const { user } = useSession();
  const { data, error, reload } = useApiData("past-clients", () => pastClientsApi.list());
  const rows = data?.items;
  const [f, setFState] = useState<typeof empty & { id?: string }>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // "save" or a client id
  const setF = (next: typeof f) => {
    setFState(next);
    if (Object.values(errors).some(Boolean)) {
      const e = check(clientSchema, next);
      setErrors(err => Object.fromEntries(Object.keys(err).map(k => [k, e[k] ?? ""])));
    }
  };
  if (!rows) return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6" data-testid="pc-page">
      <PageHead title="Past clients" sub="Add the people you've helped. Each month you see who to text and what to say." />
      {error ? <LoadError error={error} onRetry={() => void reload()} what="your past clients" /> : <Skeleton label="Loading past clients" rows={3} className="h-28" />}
    </div>
  );
  const agentFirst = user?.name.split(/\s+/)[0] || "your agent";
  const due = rows.flatMap(c => touchesFor(c, agentFirst).map(t => ({ c, t }))).sort((a, b) => a.t.due.localeCompare(b.t.due));

  const edit = (c: PastClient) => {
    setErrors({});
    setFState({ id: c._id, name: c.name, phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "", closedOn: c.closedOn, side: c.side });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const submit = async () => {
    const errs = check(clientSchema, f);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy("save");
    try {
      const body = { name: f.name.trim(), phone: orNull(f.phone), email: orNull(f.email), address: orNull(f.address), closedOn: f.closedOn, side: f.side };
      if (f.id) await pastClientsApi.update(f.id, body); else await pastClientsApi.add(body);
      toast.success(f.id ? "Saved" : "Client added");
      setFState(empty);
      setFormOpen(false);
    } catch (e) {
      setErrors(fieldErrors(e));
      err(e);
    } finally {
      setBusy(null);
    }
  };
  const run = (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    fn().then(() => toast.success(ok)).catch(err).finally(() => setBusy(null));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6" data-testid="pc-page">
      <PageHead title="Past clients" sub="Add the people you've helped. Each month you see who to text and what to say." />
      <button type="button" className={btnGold} onClick={() => { setFState(empty); setErrors({}); setFormOpen(v => !v); }} data-testid="pc-add-toggle"><UserPlus className="size-[18px]" /> Add a client</button>

      {formOpen && (
        <Card testid="pc-form">
          <H2>{f.id ? "Edit client" : "New past client"}</H2>
          <label className={label} htmlFor="pc-name">Name</label>
          <input id="pc-name" className={`${input} ${errorBorder(errors.name)}`} maxLength={80} aria-invalid={!!errors.name} value={f.name} onChange={e => setF({ ...f, name: typeName(e.target.value, 80) })} data-testid="pc-name" />
          <FieldError msg={errors.name} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className={label} htmlFor="pc-closed">Closing date</label>
              <input id="pc-closed" type="date" min="1950-01-01" max={new Date(Date.parse(`${chicagoToday()}T12:00:00Z`) + 180 * 864e5).toISOString().slice(0, 10)} className={`${input} ${errorBorder(errors.closedOn)}`} aria-invalid={!!errors.closedOn} value={f.closedOn} onChange={e => setF({ ...f, closedOn: e.target.value })} data-testid="pc-closed" />
              <FieldError msg={errors.closedOn} />
            </div>
            <div>
              <label className={label} htmlFor="pc-side">They were my</label>
              <select id="pc-side" className={input} value={f.side} onChange={e => setF({ ...f, side: e.target.value })} data-testid="pc-side">
                {SIDES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className={label} htmlFor="pc-phone">Cell</label>
              <input id="pc-phone" type="tel" inputMode="tel" placeholder="(312) 555-0100" className={`${input} ${errorBorder(errors.phone)}`} aria-invalid={!!errors.phone} value={f.phone} onChange={e => setF({ ...f, phone: typePhone(e.target.value) })} data-testid="pc-phone" />
              <FieldError msg={errors.phone} />
            </div>
            <div>
              <label className={label} htmlFor="pc-email">Email</label>
              <input id="pc-email" type="email" maxLength={200} className={`${input} ${errorBorder(errors.email)}`} aria-invalid={!!errors.email} value={f.email} onChange={e => setF({ ...f, email: typeEmail(e.target.value) })} />
              <FieldError msg={errors.email} />
            </div>
          </div>
          <label className={`${label} mt-3`} htmlFor="pc-address">Property address (optional)</label>
          <input id="pc-address" maxLength={160} className={`${input} ${errorBorder(errors.address)}`} aria-invalid={!!errors.address} value={f.address} onChange={e => setF({ ...f, address: e.target.value })} />
          <FieldError msg={errors.address} />
          <button type="button" disabled={busy === "save"} className={`${btnGold} mt-3 w-full disabled:opacity-60`} onClick={submit} data-testid="pc-save">{busy === "save" && <Loader2 className="size-[18px] animate-spin" />}{busy === "save" ? "Saving…" : f.id ? "Save changes" : "Add client"}</button>
        </Card>
      )}

      <Card testid="pc-due">
        <H2>Send this month ({due.length})</H2>
        {due.length === 0 ? (
          <p className="text-[16px] text-stone-700">{rows.length ? "Nothing due right now. Nice." : "Add your past clients and their touches show up here."}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {due.map(({ c, t }) => (
              <li key={c._id + t.key} className="py-3" data-testid="pc-touch">
                <div className="text-[17px] font-bold text-[#0A0A0A]">{c.name} · {t.title}</div>
                <div className="text-[15px] text-stone-700">Due {prettyDate(t.due)}</div>
                <p className="mt-1.5 rounded-xl bg-[#F7F5F1] p-3 text-[16px] leading-snug text-[#1c1917]">{t.text}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.phone && <a href={smsLink(t.text, c.phone)} className={btnDark}><MessageSquare className="size-[18px]" /> Text</a>}
                  {c.email && <a href={mailLink(t.title, t.text, c.email)} className={c.phone ? btnLight : btnDark}><Mail className="size-[18px]" /> Email</a>}
                  {!c.phone && !c.email && <CopyBtn text={t.text} label="Copy" />}
                  {t.to && <Link to={t.to} className={btnLight}>{t.toLabel}</Link>}
                  <button type="button" disabled={busy === c._id} className={`${btnLight} disabled:opacity-60`} onClick={() => run(c._id, () => pastClientsApi.markTouch(c._id, t.key, true), "Marked done")} data-testid="pc-done"><Check className="size-[18px]" /> Done</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card testid="pc-list">
        <H2>All my past clients ({rows.length})</H2>
        {rows.length === 0 ? (
          <EmptyState icon={<Users className="size-8" />} title="No past clients yet"
            action={<button type="button" className={btnGold} onClick={() => { setFState(empty); setErrors({}); setFormOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}><UserPlus className="size-[18px]" /> Add your first client</button>}>
            Add the buyers and sellers you've closed with. Anniversaries, holidays and review asks then show up above each month.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-stone-100">
            {rows.map(c => (
              <li key={c._id} className="flex items-center gap-2 py-2.5" data-testid="pc-row">
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-semibold text-[#0A0A0A]">{c.name}</div>
                  <div className="text-[15px] text-stone-700">{SIDES.find(s => s.v === c.side)?.l} · closed {prettyDate(c.closedOn)}</div>
                </div>
                <button type="button" aria-label={`Edit ${c.name}`} className="grid size-11 place-items-center rounded-xl bg-[#F7F5F1]" onClick={() => edit(c)}><Pencil className="size-5" /></button>
                <button type="button" aria-label={`Remove ${c.name}`} disabled={busy === c._id} className="grid size-11 place-items-center rounded-xl bg-[#F7F5F1] disabled:opacity-60" onClick={() => { if (confirm(`Remove ${c.name}?`)) run(c._id, () => pastClientsApi.remove(c._id), "Client removed"); }}>{busy === c._id ? <Loader2 className="size-5 animate-spin" /> : <Trash2 className="size-5" />}</button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
