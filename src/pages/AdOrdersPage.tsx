import { PayByCard } from "../components/PayByCard";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { PAY_STATUS, StatusTag, money } from "../components/hub/AdOrder";

const errMsg = (e: unknown) => String((e as Error)?.message ?? e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? "Something went wrong";
type Order = Doc<"adOrders"> & { tierName: string; hasKit: boolean };
const day = (t?: number) => (t ? new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");

function OrderCard({ o }: { o: Order }) {
  const decide = useMutation(api.adOrders.decide);
  const setStatus = useMutation(api.adOrders.setStatus);
  const setPayment = useMutation(api.adOrders.setPayment);
  const [tier, setTier] = useState(o.tier);
  const [note, setNote] = useState("");
  const run = (p: Promise<unknown>, msg: string) => p.then(() => toast.success(msg)).catch(e => toast.error(errMsg(e)));
  const billable = ["approved", "live", "done"].includes(o.status);
  return (
    <li className="rounded-2xl bg-white p-4 ring-1 ring-black/5" data-testid="order-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link to={`/listings/${o.listingId}`} className="font-semibold hover:underline">{o.address.split(",")[0]}</Link>
          <div className="text-sm text-stone-500">{o.agentName} · ordered {day(o.createdAt)}</div>
        </div>
        <StatusTag s={o.status} />
      </div>
      <div className="mt-2 text-[15px] text-stone-700">
        {o.tierName}{o.openHouse ? " + open house" : ""} · spend {money(o.spend)} · SpaceMatch {money(o.fee + o.surcharge)} · <b>total {money(o.total)}</b>
      </div>
      <div className="text-[15px] text-stone-600">
        {o.payment === "ahead" ? "Pay ahead (Zelle/check)" : "From commission at closing"} · <span className="font-medium">{PAY_STATUS[o.paymentStatus]}</span>
      </div>
      {o.note && <div className="mt-1 text-[15px] text-stone-600">Agent: “{o.note}”</div>}
      {o.metaCampaignId && <div className="mt-1 text-sm text-emerald-700">Paused Meta draft created ({o.metaCampaignId})</div>}
      {o.draftError && <div className="mt-1 text-sm text-red-700">Meta draft failed: {o.draftError}</div>}

      {o.status === "requested" && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-stone-600">Package</label>
            <select aria-label="Change tier" value={tier} onChange={e => setTier(e.target.value)} className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm">
              <option value="essential">Essential</option>
              <option value="signature">Signature</option>
              <option value="luxury">Luxury</option>
            </select>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note to agent (optional)" className="min-w-0 flex-1 rounded-lg border border-stone-200 px-2 py-1.5 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => run(decide({ id: o._id, action: "approve", tier, note: note || undefined }), "Approved — kit sent to agent")} className="rounded-xl bg-[#9C7434] px-4 py-2 font-semibold text-white">Approve{tier !== o.tier ? " (new package)" : ""}</button>
            <button onClick={() => run(decide({ id: o._id, action: "decline", note: note || undefined }), "Declined")} className="rounded-xl bg-stone-100 px-4 py-2 font-semibold text-stone-700">Decline</button>
          </div>
        </div>
      )}
      {billable && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {o.status === "approved" && <button onClick={() => run(setStatus({ id: o._id, status: "live" }), "Marked live — seller page shows Ads live")} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white">Mark ads live</button>}
          {o.status === "live" && <button onClick={() => run(setStatus({ id: o._id, status: "done" }), "Marked finished")} className="rounded-lg bg-stone-800 px-3 py-1.5 font-semibold text-white">Mark finished</button>}
          {o.paymentStatus !== "paid" && o.paymentStatus !== "deducted" && (
            o.payment === "ahead"
              ? <button onClick={() => run(setPayment({ id: o._id, paymentStatus: "paid" }), "Marked paid")} className="rounded-lg bg-[#0A0A0A] px-3 py-1.5 font-semibold text-white">Mark paid (Zelle/check)</button>
              : <button onClick={() => run(setPayment({ id: o._id, paymentStatus: "deducted" }), "Marked deducted")} className="rounded-lg bg-[#0A0A0A] px-3 py-1.5 font-semibold text-white">Mark deducted at closing</button>
          )}
          {o.payment === "closing" && o.paymentStatus === "unpaid" && (
            <button onClick={() => run(setPayment({ id: o._id, paymentStatus: "rolled", note: "Listing didn't close" }), "Carried to next closing")} className="rounded-lg bg-stone-100 px-3 py-1.5 font-semibold text-stone-700">Didn't close → next closing</button>
          )}
          {(o.paymentStatus === "paid" || o.paymentStatus === "deducted") && (
            <button onClick={() => run(setPayment({ id: o._id, paymentStatus: "unpaid", note: "Undo" }), "Back to unpaid")} className="text-stone-500 underline">Undo payment</button>
          )}
        </div>
      )}
      {o.paymentNote && <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-stone-500">{o.paymentNote}</pre>}
    </li>
  );
}

function Ledger() {
  const q = useQuery(api.adOrders.queue);
  if (!q) return <div className="h-32 animate-pulse rounded-2xl bg-stone-100" />;
  const t = q.ledger.totals;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([["Agents owe", t.owed], ["Collected", t.paid], ["SpaceMatch fees earned", t.feesEarned], ["SpaceMatch fees pending", t.feesPending]] as const).map(([k, val]) => (
          <div key={k} className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
            <div className="font-display text-2xl">{money(val)}</div>
            <div className="text-sm text-stone-500">{k}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/5">
        <table className="w-full text-[15px]">
          <thead className="bg-stone-50 text-left text-sm text-stone-600">
            <tr><th className="p-2.5">Agent</th><th className="p-2.5">Orders</th><th className="p-2.5">Deduct at closing</th><th className="p-2.5">Awaiting Zelle/check</th><th className="p-2.5">Paid</th><th className="p-2.5">SM fees</th></tr>
          </thead>
          <tbody>
            {q.ledger.list.length === 0 && <tr><td colSpan={6} className="p-4 text-stone-500">No approved orders yet.</td></tr>}
            {q.ledger.list.map(r => (
              <tr key={r.agentEmail} className="border-t border-stone-100">
                <td className="p-2.5 font-medium">{r.agentName}</td>
                <td className="p-2.5">{r.orders}</td>
                <td className="p-2.5">{money(r.owedClosing)}</td>
                <td className="p-2.5">{money(r.owedAhead)}</td>
                <td className="p-2.5">{money(r.paid)}</td>
                <td className="p-2.5">{money(r.feesEarned)} <span className="text-stone-400">+ {money(r.feesPending)} pending</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-stone-500">“Deduct at closing” goes on the agent's next commission sheet (TC gets an email when a pay-at-closing order is approved). Mark each order deducted or paid on the Orders tab to settle it.</p>
    </div>
  );
}

function Prices() {
  const cfg = useQuery(api.adOrders.config);
  const save = useMutation(api.adOrders.savePricing);
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  if (!cfg) return null;
  const p = cfg.pricing;
  const init: Record<string, number> = { ohSpend: p.openHouse.spend, ohFee: p.openHouse.fee, closingSurcharge: p.closingSurcharge };
  p.tiers.forEach(t => { init[`${t.key}.spend`] = t.spend; init[`${t.key}.fee`] = t.fee; });
  const d = draft ?? init;
  const field = (k: string, label: string) => (
    <label className="block text-sm text-stone-600">{label}
      <input type="number" min={0} value={d[k]} onChange={e => setDraft({ ...d, [k]: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[15px] text-[#0A0A0A]" />
    </label>
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {p.tiers.map(t => (
          <div key={t.key} className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-black/5">
            <div className="font-semibold">{t.name} · {money((d[`${t.key}.spend`] ?? 0) + (d[`${t.key}.fee`] ?? 0))}</div>
            {field(`${t.key}.spend`, "Ad spend")}
            {field(`${t.key}.fee`, "SpaceMatch fee")}
          </div>
        ))}
      </div>
      <div className="grid gap-2 rounded-2xl bg-white p-3 ring-1 ring-black/5 sm:grid-cols-3">
        {field("ohSpend", "Open house: ad spend")}
        {field("ohFee", "Open house: SpaceMatch fee")}
        {field("closingSurcharge", "Pay-at-closing surcharge")}
      </div>
      <button
        onClick={() => save({ tiers: p.tiers.map(t => ({ key: t.key, spend: d[`${t.key}.spend`], fee: d[`${t.key}.fee`] })), ohSpend: d.ohSpend, ohFee: d.ohFee, closingSurcharge: d.closingSurcharge })
          .then(() => { setDraft(null); toast.success("Prices saved"); }).catch(e => toast.error(errMsg(e)))}
        className="rounded-xl bg-[#9C7434] px-4 py-2 font-semibold text-white">Save prices</button>
      <p className="text-sm text-stone-500">New prices apply to new orders. Existing orders keep the price the agent authorized.</p>
    </div>
  );
}

function AdminView() {
  const q = useQuery(api.adOrders.queue);
  const [tab, setTab] = useState<"orders" | "ledger" | "prices">("orders");
  const pending = q?.orders.filter(o => o.status === "requested").length ?? 0;
  return (
    <>
      <div className="flex gap-1 overflow-x-auto rounded-full bg-stone-100 p-1 text-sm">
        {([["orders", pending ? `Orders (${pending} to approve)` : "Orders"], ["ledger", "Ledger"], ["prices", "Prices"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-4 py-1.5 ${tab === k ? "bg-white font-semibold shadow-sm" : "text-stone-600"}`}>{label}</button>
        ))}
      </div>
      {tab === "orders" && (
        !q ? <div className="h-32 animate-pulse rounded-2xl bg-stone-100" /> :
        q.orders.length === 0 ? <p className="text-stone-500">No ad orders yet. Agents order from a listing's “Ads & web” tab.</p> :
        <ul className="space-y-2">{[...q.orders].sort((a, b) => Number(b.status === "requested") - Number(a.status === "requested")).map(o => <OrderCard key={o._id} o={o as Order} />)}</ul>
      )}
      {tab === "ledger" && <Ledger />}
      {tab === "prices" && <Prices />}
    </>
  );
}

function AgentView() {
  const q = useQuery(api.adOrders.mine);
  if (!q) return <div className="h-32 animate-pulse rounded-2xl bg-stone-100" />;
  return (
    <div className="space-y-3">
      {q.ledger && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5"><div className="font-display text-2xl">{money(q.ledger.owedClosing)}</div><div className="text-sm text-stone-500">Comes out of your next closing</div></div>
          <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5"><div className="font-display text-2xl">{money(q.ledger.owedAhead)}</div><div className="text-sm text-stone-500">To pay by Zelle/check</div></div>
        </div>
      )}
      {q.orders.length === 0 ? <p className="text-stone-500">No ad orders yet. Open a listing → “Ads & web” → Order ads.</p> : (
        <ul className="space-y-2">
          {q.orders.map(o => (
            <li key={o._id} className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/listings/${o.listingId}`} className="font-semibold hover:underline">{o.address.split(",")[0]}</Link>
                <StatusTag s={o.status} />
              </div>
              <div className="text-[15px] text-stone-600">{o.tierName}{o.openHouse ? " + open house" : ""} · {money(o.total)} · {o.payment === "ahead" ? "pay ahead" : "at closing"} · {PAY_STATUS[o.paymentStatus]}</div>
              {o.payment === "ahead" && o.paymentStatus === "unpaid" && ["approved", "live", "done"].includes(o.status) && (
                <div className="mt-2"><PayByCard kind="ad" id={o._id} amount={o.total} after="It's marked paid as soon as the card goes through." /></div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdOrdersPage() {
  const cfg = useQuery(api.adOrders.config);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl">Listing ad orders</h1>
        <p className="text-stone-600">{cfg?.isAdmin ? "Approve agent ad orders, track what each agent owes, and set package prices." : "Your ad orders and what you owe."}</p>
      </div>
      {cfg === undefined ? null : cfg.isAdmin ? <AdminView /> : <AgentView />}
    </div>
  );
}
