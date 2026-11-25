import { Loader2, Megaphone } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { PAY_STATUS, StatusTag, money } from "../components/hub/AdOrder";
import { EmptyState, FieldError, LoadError, Skeleton } from "@/components/hub/FormState";
import { apiErrorMessage, useApiData } from "@/lib/apiData";
import { type AdOrder, adOrdersApi } from "@/lib/listingsApi";

const errMsg = apiErrorMessage;
type Order = AdOrder;
const useQueue = () => useApiData("ad-orders:queue", () => adOrdersApi.queue(), { pollMs: 60_000 });
const useConfig = () => useApiData("ad-orders:config", () => adOrdersApi.config());
const day = (t?: number) => (t ? new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");

function OrderCard({ o }: { o: Order }) {
  const [tier, setTier] = useState(o.tier);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const noteErr = note.trim().length > 500 ? "Note is too long (500 characters max)." : "";
  const run = (fn: () => Promise<unknown>, msg: string) => {
    if (noteErr) return;
    setBusy(true);
    fn().then(() => toast.success(msg)).catch(e => toast.error(errMsg(e))).finally(() => setBusy(false));
  };
  const decide = ({ action, tier: t, note: n }: { action: "approve" | "decline"; tier?: string; note?: string }) => () => adOrdersApi.decide(o._id, action, t, n?.trim() || null);
  const setStatus = ({ status }: { status: "live" | "done" | "approved" }) => () => adOrdersApi.setStatus(o._id, status);
  const setPayment = ({ paymentStatus, note: n }: { paymentStatus: "unpaid" | "paid" | "deducted" | "rolled"; note?: string }) => () => adOrdersApi.setPayment(o._id, paymentStatus, n);
  const billable = ["approved", "live", "done"].includes(o.status);
  return (
    <li className="rounded-2xl bg-white p-4 ring-1 ring-black/5" data-testid="order-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {o.listingId ? <Link to={`/listings/${o.listingId}`} className="font-semibold hover:underline">{o.address.split(",")[0]}</Link> : <span className="font-semibold">{o.address.split(",")[0]} <span className="text-sm font-normal text-stone-400">(listing deleted)</span></span>}
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
            <input value={note} maxLength={501} onChange={e => setNote(e.target.value)} aria-label="Note to agent" aria-invalid={!!noteErr} placeholder="Note to agent (optional)" className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-sm ${noteErr ? "border-red-400" : "border-stone-200"}`} />
          </div>
          <FieldError msg={noteErr} />
          <div className={`flex items-center gap-2 ${busy ? "pointer-events-none opacity-60" : ""}`}>
            <button onClick={() => run(decide({ action: "approve", tier, note }), "Approved — kit sent to agent")} className="rounded-xl bg-[#9C7434] px-4 py-2 font-semibold text-white">Approve{tier !== o.tier ? " (new package)" : ""}</button>
            <button onClick={() => confirm("Decline this order?") && run(decide({ action: "decline", note }), "Declined")} className="rounded-xl bg-stone-100 px-4 py-2 font-semibold text-stone-700">Decline</button>
            {busy && <Loader2 className="size-4 animate-spin text-stone-400" />}
          </div>
        </div>
      )}
      {billable && (
        <div className={`mt-3 flex flex-wrap items-center gap-2 text-sm ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy && <Loader2 className="size-4 animate-spin text-stone-400" />}
          {o.status === "approved" && <button onClick={() => run(setStatus({ status: "live" }), "Marked live — seller page shows Ads live")} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white">Mark ads live</button>}
          {o.status === "live" && <button onClick={() => run(setStatus({ status: "done" }), "Marked finished")} className="rounded-lg bg-stone-800 px-3 py-1.5 font-semibold text-white">Mark finished</button>}
          {o.paymentStatus !== "paid" && o.paymentStatus !== "deducted" && (
            o.payment === "ahead"
              ? <button onClick={() => run(setPayment({ paymentStatus: "paid" }), "Marked paid")} className="rounded-lg bg-[#0A0A0A] px-3 py-1.5 font-semibold text-white">Mark paid (Zelle/check)</button>
              : <button onClick={() => run(setPayment({ paymentStatus: "deducted" }), "Marked deducted")} className="rounded-lg bg-[#0A0A0A] px-3 py-1.5 font-semibold text-white">Mark deducted at closing</button>
          )}
          {o.payment === "closing" && o.paymentStatus === "unpaid" && (
            <button onClick={() => run(setPayment({ paymentStatus: "rolled", note: "Listing didn't close" }), "Carried to next closing")} className="rounded-lg bg-stone-100 px-3 py-1.5 font-semibold text-stone-700">Didn't close → next closing</button>
          )}
          {(o.paymentStatus === "paid" || o.paymentStatus === "deducted") && (
            <button onClick={() => run(setPayment({ paymentStatus: "unpaid", note: "Undo" }), "Back to unpaid")} className="text-stone-500 underline">Undo payment</button>
          )}
        </div>
      )}
      {o.paymentNote && <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-stone-500">{o.paymentNote}</pre>}
    </li>
  );
}

function Ledger() {
  const { data: q, error, reload } = useQueue();
  if (!q) return error ? <LoadError error={error} onRetry={() => void reload()} what="the ledger" /> : <Skeleton label="Loading ledger" rows={2} />;
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
  const { data: cfg, error, reload } = useConfig();
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);
  if (!cfg) return error ? <LoadError error={error} onRetry={() => void reload()} what="prices" /> : <Skeleton label="Loading prices" rows={2} />;
  const p = cfg.pricing;
  const init: Record<string, number> = { ohSpend: p.openHouse.spend, ohFee: p.openHouse.fee, closingSurcharge: p.closingSurcharge };
  p.tiers.forEach(t => { init[`${t.key}.spend`] = t.spend; init[`${t.key}.fee`] = t.fee; });
  const d = draft ?? init;
  const bad = (k: string) => !Number.isInteger(d[k]) || d[k] < 0 || d[k] > 50_000;
  const field = (k: string, label: string) => (
    <label className="block text-sm text-stone-600">{label}
      <input inputMode="numeric" value={Number.isFinite(d[k]) ? String(d[k]) : ""} onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 5); setDraft({ ...d, [k]: v === "" ? Number.NaN : Number(v) }); }} aria-invalid={bad(k)} className={`mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-[15px] text-[#0A0A0A] ${bad(k) ? "border-red-400" : "border-stone-200"}`} />
      <FieldError msg={bad(k) ? "Enter whole dollars, 0 to 50,000." : undefined} />
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
        disabled={busy || Object.keys(d).some(bad)}
        onClick={() => {
          setBusy(true);
          adOrdersApi.savePricing({ tiers: p.tiers.map(t => ({ key: t.key, spend: d[`${t.key}.spend`], fee: d[`${t.key}.fee`] })), ohSpend: d.ohSpend, ohFee: d.ohFee, closingSurcharge: d.closingSurcharge })
            .then(() => { setDraft(null); toast.success("Prices saved"); }).catch(e => toast.error(errMsg(e))).finally(() => setBusy(false));
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-[#9C7434] px-4 py-2 font-semibold text-white disabled:opacity-50">{busy && <Loader2 className="size-4 animate-spin" />}{busy ? "Saving…" : "Save prices"}</button>
      <p className="text-sm text-stone-500">New prices apply to new orders. Existing orders keep the price the agent authorized.</p>
    </div>
  );
}

function AdminView() {
  const { data: q, error, reload } = useQueue();
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
        !q ? (error ? <LoadError error={error} onRetry={() => void reload()} what="ad orders" /> : <Skeleton label="Loading ad orders" rows={3} />) :
        q.orders.length === 0 ? <EmptyState icon={<Megaphone className="size-8" />} title="No ad orders yet">Agents order ads from a listing's “Ads & web” tab. New orders show up here to approve.</EmptyState> :
        <ul className="space-y-2">{[...q.orders].sort((a, b) => Number(b.status === "requested") - Number(a.status === "requested")).map(o => <OrderCard key={o._id} o={o as Order} />)}</ul>
      )}
      {tab === "ledger" && <Ledger />}
      {tab === "prices" && <Prices />}
    </>
  );
}

function AgentView() {
  const { data: q, error, reload } = useApiData("ad-orders:mine", () => adOrdersApi.mine());
  if (!q) return error ? <LoadError error={error} onRetry={() => void reload()} what="your ad orders" /> : <Skeleton label="Loading your ad orders" rows={2} />;
  return (
    <div className="space-y-3">
      {q.ledger && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5"><div className="font-display text-2xl">{money(q.ledger.owedClosing)}</div><div className="text-sm text-stone-500">Comes out of your next closing</div></div>
          <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5"><div className="font-display text-2xl">{money(q.ledger.owedAhead)}</div><div className="text-sm text-stone-500">To pay by Zelle/check</div></div>
        </div>
      )}
      {q.orders.length === 0 ? <EmptyState icon={<Megaphone className="size-8" />} title="No ad orders yet">Open a listing → “Ads & web” → Order ads.</EmptyState> : (
        <ul className="space-y-2">
          {q.orders.map(o => (
            <li key={o._id} className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-2">
                {o.listingId ? <Link to={`/listings/${o.listingId}`} className="font-semibold hover:underline">{o.address.split(",")[0]}</Link> : <span className="font-semibold">{o.address.split(",")[0]}</span>}
                <StatusTag s={o.status} />
              </div>
              <div className="text-[15px] text-stone-600">{o.tierName}{o.openHouse ? " + open house" : ""} · {money(o.total)} · {o.payment === "ahead" ? "pay ahead" : "at closing"} · {PAY_STATUS[o.paymentStatus]}</div>
              {o.payment === "ahead" && o.paymentStatus === "unpaid" && ["approved", "live", "done"].includes(o.status) && (
                <p className="mt-2 text-[15px] text-stone-600">Please send {money(o.total)} by Zelle or check. An admin marks it paid.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdOrdersPage() {
  const { data: cfg, error, reload } = useConfig();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl">Listing ad orders</h1>
        <p className="text-stone-600">{cfg?.isAdmin ? "Approve agent ad orders, track what each agent owes, and set package prices." : "Your ad orders and what you owe."}</p>
      </div>
      {cfg === undefined ? (error ? <LoadError error={error} onRetry={() => void reload()} what="ad orders" /> : <Skeleton label="Loading ad orders" rows={2} />) : cfg.isAdmin ? <AdminView /> : <AgentView />}
    </div>
  );
}
