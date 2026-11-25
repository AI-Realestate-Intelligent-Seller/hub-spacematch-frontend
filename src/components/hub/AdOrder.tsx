import { Check, Copy, Loader2, Megaphone, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { priceOf, type AdKit, type AdPricing } from "../../../convex/adKit";
import { FieldError, LoadError, Skeleton } from "./FormState";
import { apiErrorMessage, useApiData } from "@/lib/apiData";
import { adOrdersApi } from "@/lib/listingsApi";

export const money = (n: number) => `$${n.toLocaleString()}`;
const errMsg = apiErrorMessage;

export const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  requested: { label: "Waiting for approval", tone: "bg-amber-100 text-amber-900" },
  approved: { label: "Approved — setting up", tone: "bg-sky-100 text-sky-900" },
  live: { label: "Ads live", tone: "bg-emerald-100 text-emerald-800" },
  done: { label: "Finished", tone: "bg-stone-100 text-stone-600" },
  declined: { label: "Declined", tone: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelled", tone: "bg-stone-100 text-stone-500" },
};
export const PAY_STATUS: Record<string, string> = { unpaid: "Not paid yet", paid: "Paid", deducted: "Deducted at closing", rolled: "Carried to next closing" };

export function StatusTag({ s }: { s: string }) {
  const st = ORDER_STATUS[s] ?? ORDER_STATUS.requested;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${st.tone}`}>{st.label}</span>;
}

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <button type="button" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Copied"))} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1 text-sm font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-stone-200">
      <Copy className="size-3.5" /> {label}
    </button>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
      <div className="mb-2 font-semibold text-[#0A0A0A]">{title}</div>
      <div className="space-y-2 text-[15px] text-stone-700">{children}</div>
    </div>
  );
}

function Line({ text }: { text: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="whitespace-pre-line">{text}</p>
      <CopyBtn text={text} />
    </div>
  );
}

export function AdKitView({ kit }: { kit: AdKit }) {
  return (
    <div className="space-y-3" data-testid="ad-kit">
      <Block title="Campaigns (use these names exactly)">
        {kit.campaigns.map(c => (
          <div key={c.name} className="rounded-lg bg-white p-2.5 ring-1 ring-stone-200">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-sm text-[#0A0A0A]">{c.name}</div>
                <div className="text-sm text-stone-500">{c.channel} · {money(c.budget)} over 14 days</div>
              </div>
              <CopyBtn text={c.name} label="Name" />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="truncate font-mono text-xs text-stone-500">{c.url}</div>
              <CopyBtn text={c.url} label="Link" />
            </div>
          </div>
        ))}
      </Block>
      <Block title="Instagram + Facebook ad copy">
        {kit.meta.primary.map(t => <Line key={t} text={t} />)}
        <div className="text-sm text-stone-500">Headlines</div>
        {kit.meta.headlines.map(t => <Line key={t} text={t} />)}
      </Block>
      <Block title="Google search ad">
        <div className="text-sm text-stone-500">Headlines (30 characters max)</div>
        {kit.google.headlines.map(t => <Line key={t} text={t} />)}
        <div className="text-sm text-stone-500">Descriptions</div>
        {kit.google.descriptions.map(t => <Line key={t} text={t} />)}
        <Line text={kit.google.keywords.join("\n")} />
      </Block>
      <Block title="YouTube video">
        <Line text={kit.youtube.title} />
        <Line text={kit.youtube.script} />
      </Block>
      <Block title="Instagram caption"><Line text={kit.instagram.caption} /></Block>
      <Block title="Just Listed / Just Sold">
        <Line text={`${kit.justListed.headline}\n${kit.justListed.text}`} />
        <Line text={`${kit.justSold.headline}\n${kit.justSold.text}`} />
        {kit.openHouse && <Line text={`${kit.openHouse.headline}\n${kit.openHouse.text}`} />}
      </Block>
      <Block title="Fair-housing checklist">
        <ul className="list-disc space-y-1 pl-5">{kit.checklist.map(c => <li key={c}>{c}</li>)}</ul>
      </Block>
    </div>
  );
}

function OrderDialog({ listingId, pricing, onClose }: { listingId: string; pricing: AdPricing; onClose: () => void }) {
  const [tier, setTier] = useState("essential");
  const [oh, setOh] = useState(false);
  const [payment, setPayment] = useState<"ahead" | "closing">("closing");
  const [ok, setOk] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [noteErr, setNoteErr] = useState("");
  const p = priceOf(pricing, tier, oh, payment);
  const submit = async () => {
    if (note.trim().length > 500) return setNoteErr("Note is too long (500 characters max).");
    if (!ok) return toast.error("Tick the box to authorize the charge.");
    setBusy(true);
    try {
      await adOrdersApi.place({ listingId, tier, openHouse: oh, payment, authorized: true, note: note.trim() || null });
      toast.success("Ad order sent — admins will approve it");
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-label="Order ads">
      <div className="max-h-[92svh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-[#F7F5F1] p-4 sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl">Order listing ads</h2>
            <p className="text-stone-600">14 days on Instagram, Facebook, Google and YouTube. SpaceMatch sets it all up; your seller sees results live.</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="rounded-full p-1.5 hover:bg-stone-200"><X className="size-5" /></button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {pricing.tiers.map(t => (
            <button key={t.key} type="button" onClick={() => setTier(t.key)} aria-pressed={tier === t.key}
              className={`rounded-xl bg-white p-3 text-left ring-2 transition ${tier === t.key ? "ring-[#9C7434]" : "ring-transparent hover:ring-stone-300"}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t.name}</span>
                {tier === t.key && <Check className="size-4 text-[#9C7434]" />}
              </div>
              <div className="font-display text-2xl">{money(t.spend + t.fee)}</div>
              <div className="text-sm text-stone-500">{t.blurb}</div>
              <ul className="mt-2 space-y-0.5 text-sm text-stone-600">{t.includes.map(i => <li key={i}>· {i}</li>)}</ul>
            </button>
          ))}
        </div>

        <label className="mt-3 flex items-center gap-2 rounded-xl bg-white p-3">
          <input type="checkbox" checked={oh} onChange={e => setOh(e.target.checked)} className="size-4 accent-[#9C7434]" />
          <span>Add open-house ads (+{money(pricing.openHouse.spend + pricing.openHouse.fee)})</span>
        </label>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {([["closing", "Take it from my commission", `Deducted at closing (+${money(pricing.closingSurcharge)}). If this listing doesn't close, it comes out of your next closing.`], ["ahead", "Pay ahead", "Zelle or check. An admin marks it paid."]] as const).map(([k, t, d]) => (
            <label key={k} className={`cursor-pointer rounded-xl bg-white p-3 ring-2 ${payment === k ? "ring-[#9C7434]" : "ring-transparent"}`}>
              <div className="flex items-center gap-2 font-semibold">
                <input type="radio" name="payment" checked={payment === k} onChange={() => setPayment(k)} className="accent-[#9C7434]" /> {t}
              </div>
              <div className="mt-1 text-sm text-stone-500">{d}</div>
            </label>
          ))}
        </div>

        <textarea value={note} maxLength={500} onChange={e => { setNote(e.target.value); if (noteErr) setNoteErr(""); }} aria-invalid={!!noteErr} placeholder="Anything we should know? (optional — open-house date, what you promised the seller)" className={`mt-3 w-full rounded-xl border bg-white p-3 text-[15px] ${noteErr ? "border-red-400" : "border-stone-200"}`} rows={2} />
        <div className="flex justify-between gap-3"><FieldError msg={noteErr} /><span className="ml-auto text-xs text-stone-400">{note.length}/500</span></div>

        <div className="mt-3 rounded-xl bg-white p-3 text-[15px]">
          <div className="flex justify-between"><span>Ad spend</span><span>{money(p.spend)}</span></div>
          <div className="flex justify-between"><span>SpaceMatch setup & management</span><span>{money(p.fee)}</span></div>
          {p.surcharge > 0 && <div className="flex justify-between"><span>Pay-at-closing</span><span>{money(p.surcharge)}</span></div>}
          <div className="mt-1 flex justify-between border-t border-stone-200 pt-1 font-semibold"><span>Total</span><span data-testid="order-total">{money(p.total)}</span></div>
        </div>

        <label className="mt-3 flex items-start gap-2">
          <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} className="mt-1 size-4 accent-[#9C7434]" aria-label="Authorize charge" />
          <span className="text-[15px]">I authorize SpaceMatch Inc. to charge me {money(p.total)} for this package{payment === "closing" ? ", deducted from my commission at closing (or my next closing if this listing doesn't close)" : ", paid ahead by Zelle or check"}.</span>
        </label>

        <button disabled={!ok || busy} onClick={submit} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#9C7434] py-3 font-semibold text-white disabled:opacity-40">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? "Sending…" : `Send order · ${money(p.total)}`}
        </button>
      </div>
    </div>
  );
}

export function ListingAdOrder({ listingId }: { listingId: string }) {
  const cfgRes = useApiData("ad-orders:config", () => adOrdersApi.config());
  const res = useApiData(`ad-orders:listing:${listingId}`, () => adOrdersApi.forListing(listingId));
  const cfg = cfgRes.data;
  const data = res.data;
  const [open, setOpen] = useState(false);
  const [showKit, setShowKit] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const loadError = cfgRes.error ?? res.error;
  if ((cfg === undefined || data === undefined) && loadError) return <LoadError error={loadError} onRetry={() => { void cfgRes.reload(); void res.reload(); }} what="ad orders" />;
  if (cfg === undefined || data === undefined) return <Skeleton label="Loading ad orders" rows={1} />;
  const cancel = (id: string) => {
    if (!confirm("Cancel this ad order?")) return;
    setCancelling(true);
    adOrdersApi.cancel(id).then(() => toast.success("Order cancelled")).catch(e => toast.error(errMsg(e))).finally(() => setCancelling(false));
  };
  const cur = data.orders.find(o => ["requested", "approved", "live"].includes(o.status));
  const last = data.orders[0];
  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-black/5" data-testid="ad-order">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Megaphone className="size-5 text-[#9C7434]" />
          <h3 className="font-semibold">Ad package</h3>
          {cur && <StatusTag s={cur.status} />}
        </div>
        {!cur && (
          <button onClick={() => setOpen(true)} className="rounded-xl bg-[#9C7434] px-4 py-2 font-semibold text-white">Order ads</button>
        )}
      </div>
      {!cur && (
        <p className="mt-2 text-stone-600">
          Promised your seller advertising? Order a package and we set up Instagram, Facebook, Google and YouTube for you.
          Pay ahead or take it from your commission at closing.
          {last?.status === "declined" && <span className="mt-1 block text-red-700">Last order was declined{last.adminNote ? `: ${last.adminNote}` : ""}.</span>}
        </p>
      )}
      {cur && (
        <div className="mt-2 space-y-2 text-[15px]">
          <div className="text-stone-700">
            {cur.tierName}{cur.openHouse ? " + open house" : ""} · <b>{money(cur.total)}</b> · {cur.payment === "ahead" ? "pay ahead" : "from commission at closing"} · {PAY_STATUS[cur.paymentStatus]}
          </div>
          {cur.status === "requested" && (
            <div className="flex items-center gap-3 text-stone-500">
              Admins got an email and will approve shortly.
              <button disabled={cancelling} onClick={() => cancel(cur._id)} className="text-sm underline disabled:opacity-50">{cancelling ? "Cancelling…" : "Cancel order"}</button>
            </div>
          )}
          {cur.adminNote && <div className="text-stone-500">Admin note: {cur.adminNote}</div>}
          {cur.kit && (
            <>
              <button onClick={() => setShowKit(s => !s)} className="rounded-lg bg-[#0A0A0A] px-3 py-1.5 text-sm font-semibold text-white">{showKit ? "Hide ad kit" : "Open ad kit"}</button>
              {showKit && <AdKitView kit={cur.kit as AdKit} />}
            </>
          )}
        </div>
      )}
      {cfg.isAdmin && <Link to="/ad-orders" className="mt-2 inline-block text-sm text-[#9C7434] underline">All ad orders & ledger</Link>}
      {open && <OrderDialog listingId={listingId} pricing={cfg.pricing} onClose={() => setOpen(false)} />}
    </section>
  );
}
