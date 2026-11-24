// "Your copy" (Michael 2026-11-12): every Lob mailing also mails one card per design to the agent, billed like
// any other card. Their mailing address is required before ordering; saved once per agent (convex/agentCopy.ts).
import { useMutation, useQuery } from "convex/react";
import { Home, Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";

const errMsg = (e: unknown) => String((e as Error).message ?? e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? String((e as Error).message ?? e);
const input = "rounded-xl border border-stone-200 bg-white px-3 py-2 text-[15px]";

/** True once the agent's copy address is on file (parents use it to enable their order button). */
export function useCopyAddress(agentEmail?: string) {
  const r = useQuery(api.agentCopy.get, { agentEmail });
  return { loading: r === undefined, address: r?.address ?? null, allowed: r?.allowed ?? true };
}

export function AgentCopyAddress({ agentEmail, cardPrice, perDesign }: { agentEmail?: string; cardPrice: number; perDesign?: boolean }) {
  const { loading, address, allowed } = useCopyAddress(agentEmail);
  const save = useMutation(api.agentCopy.save);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ line1: "", line2: "", city: "", state: "IL", zip: "" });
  useEffect(() => {
    if (address) setF({ line1: address.line1, line2: address.line2 ?? "", city: address.city, state: address.state, zip: address.zip });
  }, [address]);
  if (loading) return null;
  const price = `$${cardPrice.toFixed(2)}`;
  const note = `You get your own copy of ${perDesign ? "each card design" : "this card"} in the mail, so you see exactly what homeowners get. It's billed like any other card (${price}).`;
  if (!allowed) return <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" data-testid="copy-address-locked">This agent needs to add their mailing address for their own copy before mailing.</div>;

  async function submit() {
    setBusy(true);
    try {
      await save({ agentEmail, address: { line1: f.line1, line2: f.line2 || undefined, city: f.city, state: f.state, zip: f.zip } });
      setEdit(false);
      toast.success("Address saved");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  if (address && !edit) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-[#F7F5F1] p-3 text-sm ring-1 ring-[#ebe5da]" data-testid="copy-address">
        <Home className="mt-0.5 size-4 shrink-0 text-[#9C7434]" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Your copy goes to</div>
          <div className="text-stone-700">{address.line1}{address.line2 ? ` ${address.line2}` : ""}, {address.city}, {address.state} {address.zip}</div>
          <div className="mt-0.5 text-xs text-stone-500">{note}</div>
        </div>
        <button type="button" onClick={() => setEdit(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#9C7434]" data-testid="copy-address-edit"><Pencil className="size-3.5" /> Change</button>
      </div>
    );
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="rounded-xl bg-[#F7F5F1] p-3 text-sm ring-1 ring-[#ebe5da]" data-testid="copy-address-form">
      <div className="flex items-center gap-2 font-semibold"><Home className="size-4 text-[#9C7434]" /> Where should your copy go? <span className="text-xs font-normal text-red-700">Required</span></div>
      <p className="mt-0.5 text-xs text-stone-500">{note}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-6">
        <input value={f.line1} onChange={set("line1")} placeholder="Street address" autoComplete="address-line1" aria-label="Street address" data-testid="copy-line1" className={`${input} sm:col-span-4`} />
        <input value={f.line2} onChange={set("line2")} placeholder="Apt / unit" autoComplete="address-line2" aria-label="Apartment or unit" data-testid="copy-line2" className={`${input} sm:col-span-2`} />
        <input value={f.city} onChange={set("city")} placeholder="City" autoComplete="address-level2" aria-label="City" data-testid="copy-city" className={`${input} sm:col-span-3`} />
        <input value={f.state} onChange={e => setF({ ...f, state: e.target.value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() })} placeholder="IL" autoComplete="address-level1" aria-label="State" data-testid="copy-state" className={`${input} sm:col-span-1`} />
        <input value={f.zip} onChange={e => setF({ ...f, zip: e.target.value.replace(/[^\d-]/g, "").slice(0, 10) })} inputMode="numeric" placeholder="ZIP" autoComplete="postal-code" aria-label="ZIP code" data-testid="copy-zip" className={`${input} sm:col-span-2`} />
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy} onClick={submit} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A0A0A] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50" data-testid="copy-save">{busy && <Loader2 className="size-4 animate-spin" />} Save address</button>
        {address && <button type="button" onClick={() => setEdit(false)} className="text-sm font-semibold text-stone-600">Cancel</button>}
      </div>
    </div>
  );
}
