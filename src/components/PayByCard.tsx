// "Pay by card" next to Zelle (Michael 2026-11-10). Shows only once Michael has connected Stripe in
// Settings. Opens Stripe's own payment page for this order's exact amount; the Hub confirms the payment
// with Stripe when the agent comes back (/pay/return), so nobody has to tap Received.
import { useAction, useQuery } from "convex/react";
import { CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { cardFee, cardTotal, type CardKind } from "../../convex/cardDefs";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const errMsg = (e: unknown) => String((e as Error)?.message ?? e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? "The card page couldn't open. Try again.";

export function PayByCard({ kind, id, amount, dark, after }: { kind: CardKind; id: string; amount: number; dark?: boolean; after: string }) {
  const info = useQuery(api.cardPay.info);
  const start = useAction(api.cardPay.start);
  const [busy, setBusy] = useState(false);
  if (!info?.enabled) return null;
  const fee = cardFee(amount, info.feePct);
  const go = async () => {
    setBusy(true);
    try {
      const { url } = await start({ kind, id });
      window.location.assign(url);
    } catch (e) {
      toast.error(errMsg(e));
      setBusy(false);
    }
  };
  return (
    <div className={`rounded-xl p-3 ${dark ? "bg-white/10 ring-1 ring-white/15" : "bg-white ring-1 ring-[#ebe5da]"}`} data-testid="pay-by-card">
      <div className={`text-xs font-semibold uppercase tracking-wide ${dark ? "text-stone-300" : "text-stone-500"}`}>Or pay by card</div>
      <button type="button" disabled={busy} onClick={go} data-testid="pay-by-card-btn"
        className={`mt-1.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-[15px] font-bold disabled:opacity-60 sm:w-auto ${dark ? "bg-white text-[#0A0A0A]" : "bg-[#0A0A0A] text-white"}`}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />} Pay {money(cardTotal(amount, info.feePct))} by card
      </button>
      <div className={`mt-1.5 text-xs ${dark ? "text-stone-300" : "text-stone-500"}`}>
        {fee > 0 ? `${money(amount)} + ${money(fee)} card fee (${info.feePct}%). Zelle has no fee. ` : "No extra fee. "}
        {after}
      </div>
    </div>
  );
}
