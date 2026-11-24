// Settings → Card payments (Stripe). Michael only (PAYMENT_CONFIRMERS). He pastes his Stripe key once and
// picks who pays the card fee; agents then see "Pay by card" next to Zelle. The key is checked with
// Stripe before it's saved and is never shown again (only its last 4 characters).
import { useAction, useMutation, useQuery } from "convex/react";
import { CheckCircle2, CreditCard, Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "../../../convex/_generated/api";
import type { FeeMode } from "../../../convex/cardDefs";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (t: number) => new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const errMsg = (e: unknown) => String((e as Error)?.message ?? e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? "Something went wrong. Try again.";

function FeeChoice({ value, onChange, pct, disabled }: { value: FeeMode | ""; onChange: (m: FeeMode) => void; pct: number; disabled?: boolean }) {
  const opts: [FeeMode, string, string][] = [
    ["agent", `Agent pays a ${pct}% card fee`, `A $100.00 order is $${(100 + pct).toFixed(2)} by card. Zelle stays free.`],
    ["absorb", "I cover the fee", "Card price = Zelle price. Stripe keeps about 2.9% + 30¢ of each payment."],
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Who pays the card fee">
      {opts.map(([k, t, d]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} disabled={disabled} onClick={() => onChange(k)} data-testid={`fee-${k}`}
          className={`min-h-11 rounded-lg border p-3 text-left text-sm ${value === k ? "border-[#9C7434] bg-[#F7F5F1] ring-1 ring-[#9C7434]" : "border-stone-200 bg-white"}`}>
          <div className="font-semibold">{t}</div>
          <div className="text-xs text-muted-foreground">{d}</div>
        </button>
      ))}
    </div>
  );
}

export function StripeCard() {
  const info = useQuery(api.cardPay.info);
  const connect = useAction(api.cardPay.connect);
  const setFee = useMutation(api.cardPay.setFee);
  const disconnect = useMutation(api.cardPay.disconnect);
  const [key, setKey] = useState("");
  const [fee, setFeeLocal] = useState<FeeMode | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const a = info?.admin;
  if (!info?.canManage || !a) return null;
  const showForm = !a.connected || editing;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const feeMode = fee || (a.feeMode as FeeMode | "");
    if (!feeMode) return setError("Pick who pays the card fee first.");
    setBusy(true);
    try {
      const r = await connect({ apiKey: key, feeMode });
      toast.success(r.mode === "live" ? "Stripe connected. Agents now see Pay by card." : "Test key saved. Agents won't see Pay by card until you paste the live key.");
      setKey("");
      setEditing(false);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="stripe-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><CreditCard className="size-5" /> Card payments (Stripe)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Adds a “Pay by card” button next to Zelle on seller lists, postcards, Reels and pay-ahead ad orders. When an agent pays, Stripe confirms it and the
          order moves on by itself (cards mail, Reels go in line). You don't tap Received for card payments. The money lands in your Stripe account.
        </p>

        {a.connected && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3" data-testid="stripe-connected">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {a.hiddenTestKey ? <TriangleAlert className="size-4 text-amber-600" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
              {a.hiddenTestKey ? "Test key saved (not live)" : "On. Agents see Pay by card."}
              <span className="text-xs font-normal text-muted-foreground">key {a.keyHint} · saved by {a.savedBy}, {when(a.savedAt)}</span>
            </div>
            {a.hiddenTestKey && <p className="text-xs text-amber-700">This is a Stripe test key, so no real money would move. Pay by card stays hidden from agents until you paste the live key (starts with rk_live_ or sk_live_).</p>}
            <div>
              <div className="mb-1.5 text-sm font-medium">Who pays the card fee?</div>
              <FeeChoice value={a.feeMode as FeeMode} pct={a.feePct} onChange={m => { if (m !== a.feeMode) setFee({ feeMode: m }).then(() => toast.success("Saved")).catch(e => toast.error(errMsg(e))); }} />
            </div>
            {!editing && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Change key</Button>
                <Button size="sm" variant="ghost" data-testid="stripe-off" onClick={() => { if (window.confirm("Turn off Pay by card? Agents go back to Zelle only.")) disconnect({}).then(() => toast.success("Pay by card is off")).catch(e => toast.error(errMsg(e))); }}>Turn off</Button>
              </div>
            )}
          </div>
        )}

        {showForm && (
          <form onSubmit={save} className="space-y-3">
            {!a.connected && (
              <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-700">
                <li>Sign in at <a className="font-medium underline" href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer">dashboard.stripe.com/apikeys</a> (live, not a test or sandbox account).</li>
                <li>Tap <b>Create a secret key</b>. Name it “SpaceMatch Hub”.</li>
                <li>If Stripe lets you limit what the key can do, set <b>Checkout Sessions</b> to <b>Write</b> and leave the rest off. If it doesn't ask, that's fine.</li>
                <li>Copy the new key (starts with <span className="font-mono">sk_live_</span> or <span className="font-mono">rk_live_</span>) and paste it here. Not the publishable key (<span className="font-mono">pk_live_</span>).</li>
              </ol>
            )}
            {!a.connected && (
              <div>
                <div className="mb-1.5 text-sm font-medium">Who pays the card fee?</div>
                <FeeChoice value={fee} pct={a.feePct} onChange={setFeeLocal} disabled={busy} />
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder="sk_live_… or rk_live_…" aria-label="Stripe key" data-testid="stripe-key" className="font-mono" />
              <Button type="submit" disabled={busy || key.trim().length < 12} data-testid="stripe-connect">{busy ? <Loader2 className="size-4 animate-spin" /> : null} {a.connected ? "Save new key" : "Connect Stripe"}</Button>
              {editing && <Button type="button" variant="ghost" onClick={() => { setEditing(false); setKey(""); setError(""); }}>Cancel</Button>}
            </div>
            <p className="text-xs text-muted-foreground">The Hub checks the key with Stripe before saving (it opens and closes a $1 test payment page; nobody is charged). The key stays on the Hub's server and is never shown again, only its last 4 characters.</p>
            {error && <p className="flex items-start gap-1.5 text-sm text-red-700" data-testid="stripe-error"><TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}</p>}
          </form>
        )}

        {a.payments.length > 0 && (
          <div data-testid="stripe-payments">
            <div className="mb-1.5 text-sm font-medium">Latest card payments</div>
            <ul className="divide-y rounded-lg border text-sm">
              {a.payments.map(p => (
                <li key={p.id} className="p-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium">{p.agentName} · {p.code}</span>
                    <span>{money(p.total)}{p.fee > 0 ? ` (incl. ${money(p.fee)} fee)` : ""} · {when(p.at)}</span>
                  </div>
                  <div className={`text-xs ${p.status === "problem" ? "text-red-700" : "text-muted-foreground"}`}>{p.label}. {p.note}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
