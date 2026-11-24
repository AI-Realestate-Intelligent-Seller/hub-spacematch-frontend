import { useMutation, useQuery } from "convex/react";
import { Check, Mail, MessageSquare, Pencil, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { btnDark, btnGold, btnLight, Card, CopyBtn, H2, input, label, PageHead , toastErr } from "@/components/hub/mm";
import { mailLink, prettyDate, smsLink, touchesFor } from "@/lib/marketMe";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

// /past-clients — each agent's own past clients + what to send this month (anniversaries, holidays,
// quarterly market updates, review ask a week after closing). Only the agent sees their list.
const SIDES = [
  { v: "buyer", l: "Buyer" },
  { v: "seller", l: "Seller" },
  { v: "renter", l: "Renter" },
  { v: "landlord", l: "Landlord" },
];
const empty = { name: "", phone: "", email: "", address: "", closedOn: "", side: "buyer" };
const err = toastErr;

export function PastClientsPage() {
  const me = useQuery(api.hubMe.me);
  const rows = useQuery(api.marketMe.myClients);
  const save = useMutation(api.marketMe.saveClient);
  const remove = useMutation(api.marketMe.removeClient);
  const mark = useMutation(api.marketMe.markTouch);
  const [f, setF] = useState<typeof empty & { id?: Id<"pastClients"> }>(empty);
  const [formOpen, setFormOpen] = useState(false);
  if (!rows || !me) return <div className="p-6 text-[17px] text-stone-700">Loading…</div>;
  const agentFirst = me.firstName || "your agent";
  const due = rows.flatMap(c => touchesFor(c, agentFirst).map(t => ({ c, t }))).sort((a, b) => a.t.due.localeCompare(b.t.due));

  const edit = (c: Doc<"pastClients">) => {
    setF({ id: c._id, name: c.name, phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "", closedOn: c.closedOn, side: c.side });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const submit = () =>
    save({ ...f, phone: f.phone || undefined, email: f.email || undefined, address: f.address || undefined })
      .then(() => {
        toast.success(f.id ? "Saved" : "Client added");
        setF(empty);
        setFormOpen(false);
      })
      .catch(err);

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6" data-testid="pc-page">
      <PageHead title="Past clients" sub="Add the people you've helped. Each month you see who to text and what to say." />
      <button type="button" className={btnGold} onClick={() => { setF(empty); setFormOpen(v => !v); }} data-testid="pc-add-toggle"><UserPlus className="size-[18px]" /> Add a client</button>

      {formOpen && (
        <Card testid="pc-form">
          <H2>{f.id ? "Edit client" : "New past client"}</H2>
          <label className={label} htmlFor="pc-name">Name</label>
          <input id="pc-name" className={input} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} data-testid="pc-name" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className={label} htmlFor="pc-closed">Closing date</label>
              <input id="pc-closed" type="date" className={input} value={f.closedOn} onChange={e => setF({ ...f, closedOn: e.target.value })} data-testid="pc-closed" />
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
              <input id="pc-phone" type="tel" className={input} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} data-testid="pc-phone" />
            </div>
            <div>
              <label className={label} htmlFor="pc-email">Email</label>
              <input id="pc-email" type="email" className={input} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
            </div>
          </div>
          <label className={`${label} mt-3`} htmlFor="pc-address">Property address (optional)</label>
          <input id="pc-address" className={input} value={f.address} onChange={e => setF({ ...f, address: e.target.value })} />
          <button type="button" className={`${btnGold} mt-3 w-full`} onClick={submit} data-testid="pc-save">{f.id ? "Save changes" : "Add client"}</button>
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
                  <button type="button" className={btnLight} onClick={() => mark({ id: c._id, key: t.key, done: true }).then(() => toast.success("Marked done"))} data-testid="pc-done"><Check className="size-[18px]" /> Done</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card testid="pc-list">
        <H2>All my past clients ({rows.length})</H2>
        {rows.length === 0 ? (
          <p className="text-[16px] text-stone-700">None yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {rows.map(c => (
              <li key={c._id} className="flex items-center gap-2 py-2.5" data-testid="pc-row">
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-semibold text-[#0A0A0A]">{c.name}</div>
                  <div className="text-[15px] text-stone-700">{SIDES.find(s => s.v === c.side)?.l} · closed {prettyDate(c.closedOn)}</div>
                </div>
                <button type="button" aria-label={`Edit ${c.name}`} className="grid size-11 place-items-center rounded-xl bg-[#F7F5F1]" onClick={() => edit(c)}><Pencil className="size-5" /></button>
                <button type="button" aria-label={`Remove ${c.name}`} className="grid size-11 place-items-center rounded-xl bg-[#F7F5F1]" onClick={() => { if (confirm(`Remove ${c.name}?`)) remove({ id: c._id }).catch(err); }}><Trash2 className="size-5" /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
