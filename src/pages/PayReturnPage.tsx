// Where Stripe sends an agent after the card page. The Hub asks Stripe whether this payment went
// through (cardPay.returned) and shows the answer; the order itself is settled on the server.
import { useAction } from "convex/react";
import { CheckCircle2, Clock, Loader2, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api } from "../../convex/_generated/api";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
type Result = { status: string; code: string; label: string; amount: number; fee: number; total: number; backPath: string; kind: string; note: string } | null;
const NEXT: Record<string, string> = {
  list: "If this was a mailing, Lob is printing your cards now and you'll get an email when they're out.",
  lob: "Lob is printing your cards now. You'll get an email when they're out.",
  reel: "Your Reel is in line for editing. You'll get an email when it's ready.",
  ad: "Your ad order is marked paid.",
};

export function PayReturnPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("s") ?? "";
  const returned = useAction(api.cardPay.returned);
  const [r, setR] = useState<Result | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const tries = useRef(0);

  const ask = useCallback(async () => {
    setFailed(false);
    try {
      setR(await returned({ sessionId }));
    } catch {
      setFailed(true);
    }
  }, [returned, sessionId]);

  useEffect(() => { if (sessionId) void ask(); else setR(null); }, [ask, sessionId]);
  // Stripe can take a few seconds to mark a card payment paid: ask again a few times on our own.
  useEffect(() => {
    if (r?.status !== "open" || tries.current >= 5) return;
    const t = setTimeout(() => { tries.current += 1; void ask(); }, 4000);
    return () => clearTimeout(t);
  }, [r, ask]);

  const back = r?.backPath ?? "/home";
  const box = "mx-auto mt-8 max-w-md rounded-2xl bg-white p-6 text-center ring-1 ring-black/5";
  return (
    <div className="px-4 pb-24" data-testid="pay-return">
      {failed ? (
        <div className={box}>
          <TriangleAlert className="mx-auto size-10 text-amber-600" />
          <h1 className="mt-3 font-display text-2xl">We couldn't check your payment</h1>
          <p className="mt-2 text-[15px] text-stone-600">Your card may still have been charged. Tap below to check again. Don't pay a second time.</p>
          <button type="button" onClick={() => void ask()} className="mt-4 min-h-11 rounded-xl bg-[#0A0A0A] px-5 py-2.5 font-bold text-white">Check again</button>
        </div>
      ) : r === undefined ? (
        <div className={box}><Loader2 className="mx-auto size-10 animate-spin text-[#9C7434]" /><h1 className="mt-3 font-display text-2xl">Checking your payment…</h1></div>
      ) : r === null ? (
        <div className={box}>
          <TriangleAlert className="mx-auto size-10 text-amber-600" />
          <h1 className="mt-3 font-display text-2xl">We can't find that payment</h1>
          <p className="mt-2 text-[15px] text-stone-600">Open your order to see where it stands.</p>
          <Link to="/home" className="mt-4 inline-block min-h-11 rounded-xl bg-[#0A0A0A] px-5 py-2.5 font-bold text-white">Back to the Hub</Link>
        </div>
      ) : r.status === "paid" ? (
        <div className={box} data-testid="pay-paid">
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
          <h1 className="mt-3 font-display text-2xl">Paid. Thank you!</h1>
          <p className="mt-2 text-[15px] text-stone-700"><b>{money(r.total)}</b> by card for {r.label} (order {r.code}).</p>
          <p className="mt-2 text-[15px] text-stone-600">{NEXT[r.kind] ?? ""} Nothing else to do.</p>
          <Link to={back} className="mt-4 inline-block min-h-11 rounded-xl bg-[#0A0A0A] px-5 py-2.5 font-bold text-white" data-testid="pay-back">See my order</Link>
        </div>
      ) : r.status === "problem" ? (
        <div className={box} data-testid="pay-problem">
          <TriangleAlert className="mx-auto size-10 text-amber-600" />
          <h1 className="mt-3 font-display text-2xl">Your card was charged, but we need to look at this order</h1>
          <p className="mt-2 text-[15px] text-stone-600">Order {r.code} was already paid or cancelled. Michael has been emailed and will refund or fix it. Don't pay again.</p>
          <Link to={back} className="mt-4 inline-block min-h-11 rounded-xl bg-[#0A0A0A] px-5 py-2.5 font-bold text-white">See my order</Link>
        </div>
      ) : r.status === "expired" ? (
        <div className={box}>
          <Clock className="mx-auto size-10 text-stone-500" />
          <h1 className="mt-3 font-display text-2xl">That card page timed out</h1>
          <p className="mt-2 text-[15px] text-stone-600">You weren't charged. Open your order and tap Pay by card again.</p>
          <Link to={back} className="mt-4 inline-block min-h-11 rounded-xl bg-[#0A0A0A] px-5 py-2.5 font-bold text-white">Back to my order</Link>
        </div>
      ) : (
        <div className={box} data-testid="pay-open">
          <Loader2 className="mx-auto size-10 animate-spin text-[#9C7434]" />
          <h1 className="mt-3 font-display text-2xl">Waiting for Stripe to confirm…</h1>
          <p className="mt-2 text-[15px] text-stone-600">This usually takes a few seconds. If you closed the card page without paying, you weren't charged.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => void ask()} className="min-h-11 rounded-xl bg-[#0A0A0A] px-5 py-2.5 font-bold text-white">Check again</button>
            <Link to={back} className="min-h-11 rounded-xl bg-stone-100 px-5 py-2.5 font-bold text-stone-700">Back to my order</Link>
          </div>
        </div>
      )}
    </div>
  );
}
