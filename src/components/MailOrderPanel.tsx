// "Mail it for me" order card (Michael 2026-11-02): the agent's whole mailing in one place:
// cards being built → Lob proofs + one total → Zelle / "I sent it" (Michael: "Mail it now") → mailing progress
// → mailed, scans + replies → next card of a series.
import { PayByCard } from "./PayByCard";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Download, ExternalLink, Loader2, Repeat, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

const errMsg = (e: unknown) => String((e as Error).message ?? e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? String((e as Error).message ?? e);
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (t: number | string) => new Date(typeof t === "string" ? `${t}T12:00:00` : t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const STEPS = ["Building cards", "Proofs ready", "Paid", "Mailing", "Mailed"];
const stepOf = (status: string, paid: boolean) =>
  status === "mailed" ? 4 : status === "mailing" ? 3 : status === "ready" ? (paid ? 2 : 1) : status === "proofing" || status === "building" ? 0 : 0;

// Lob renders proof thumbnails a few seconds after the proof is created: show the design preview until it loads.
function ProofImg({ src, fallback, alt }: { src?: string; fallback: string; alt: string }) {
  const [tries, setTries] = useState(0);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!src || ok || tries > 6) return;
    const img = new Image();
    img.onload = () => setOk(true);
    img.onerror = () => setTimeout(() => setTries(t => t + 1), 5000);
    img.src = src;
  }, [src, ok, tries]);
  return <img src={ok && src ? src : fallback} alt={alt} className="aspect-[11/6] w-full bg-[#F7F5F1] object-cover" />;
}

type OrderRow = Omit<Doc<"sellerListOrders">, "files"> & { files: (Doc<"sellerListOrders">["files"][number] & { url: string | null })[] };

export function MailOrderPanel({ o, zelleTo }: { o: OrderRow; zelleTo: string }) {
  const data = useQuery(api.mailOrders.forOrder, { id: o._id });
  const cfg = useQuery(api.sellerLists.config, {});
  const markSent = useMutation(api.sellerLists.markSent);
  const waive = useMutation(api.sellerLists.waive);
  const stop = useMutation(api.mailOrders.stopSeries);
  const cancel = useMutation(api.mailOrders.cancelMailing);
  const retry = useMutation(api.mailOrders.retryDrop);
  const [busy, setBusy] = useState<string | null>(null);
  if (!data) return <div className="mt-3 text-sm text-stone-500">Loading…</div>;
  const run = async (k: string, f: () => Promise<unknown>, ok?: string) => {
    setBusy(k);
    try { await f(); if (ok) toast.success(ok); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };
  const p = o.payment;
  const series = data.mode === "series";
  const scheduled = data.drops.find(d => d.status === "scheduled");
  const active = [...data.drops].reverse().find(d => d.status !== "scheduled" && d.status !== "stopped") ?? data.drops[0];
  const totals = data.drops.reduce((a, d) => ({ sent: a.sent + (d.status === "mailed" ? d.sent ?? 0 : 0), scanned: a.scanned + d.campaigns.reduce((s, c) => s + c.scannedHouseholds, 0), leads: a.leads + d.campaigns.reduce((s, c) => s + c.leads, 0) }), { sent: 0, scanned: 0, leads: 0 });

  return (
    <div className="mt-3 space-y-3" data-testid="mail-order">
      {totals.sent > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[["Cards mailed", totals.sent], ["Homes that scanned", totals.scanned], ["Replies", totals.leads]].map(([l, n]) => (
            <div key={String(l)} className="rounded-xl bg-[#0A0A0A] p-2.5 text-white"><div className="font-display text-xl">{String(n)}</div><div className="text-[11px] text-[#D9BC8C]">{String(l)}</div></div>
          ))}
        </div>
      )}
      {[...data.drops].reverse().filter(d => d.status !== "scheduled").map(d => {
        const isActive = d.n === active?.n;
        const paid = !!d.payment || (isActive && (p?.status === "confirmed" || p?.status === "waived"));
        const step = stepOf(d.status, paid);
        const test = d.campaigns.some(c => c.lobMode && c.lobMode !== "live");
        const progress = d.campaigns.reduce((s, c) => s + c.lobSent + c.lobFailed, 0);
        return (
          <div key={d.n} className="rounded-xl bg-[#FBFAF7] p-3 ring-1 ring-[#ebe5da]" data-testid={`drop-${d.n}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">{series ? `Card ${d.n} of ${data.seriesDrops}` : "Your postcards"}{d.cards ? <span className="font-normal text-stone-500"> · {d.cards - (d.copies ?? 0)} home{d.cards - (d.copies ?? 0) === 1 ? "" : "s"}{d.copies ? ` + ${d.copies === 1 ? "your copy" : `${d.copies} copies for you`}` : ""}</span> : null}</div>
              {d.status === "mailed" && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{test ? "Test run done" : `Mailed ${d.mailedAt ? day(d.mailedAt) : ""}`}</span>}
              {d.status === "stopped" && <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">Not mailed</span>}
            </div>
            {d.status !== "stopped" && d.status !== "failed" && (
              <ol className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px] leading-tight" data-testid="drop-steps">
                {STEPS.map((label, i) => (
                  <li key={label} className={i < step || d.status === "mailed" ? "text-[#9C7434]" : i === step ? "font-semibold text-[#0A0A0A]" : "text-stone-400"}>
                    <span className="mx-auto mb-1 flex size-4 items-center justify-center">
                      {i < step || d.status === "mailed" ? <CheckCircle2 className="size-4" /> : i === step && (d.status === "building" || d.status === "proofing" || d.status === "mailing") ? <Loader2 className="size-4 animate-spin" /> : i === step ? <span className="size-2.5 rounded-full bg-[#9C7434]" /> : <span className="size-2 rounded-full bg-stone-300" />}
                    </span>
                    {label}
                  </li>
                ))}
              </ol>
            )}
            {(d.status === "building" || d.status === "proofing") && (
              <p className="mt-2 text-sm text-stone-600">{d.status === "building" ? "Building a card for every home, each with your photo and its own QR code…" : "Lob is making the proofs so you see exactly what will print…"} This page updates by itself, and you'll get an email when they're ready.</p>
            )}
            {d.status === "failed" && (
              <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" data-testid="drop-error">
                <b>Stopped:</b> {d.error ?? "Something went wrong."} {(d.sent ?? 0) > 0 ? `${d.sent} cards were already accepted and will mail.` : "Nothing was mailed."} Michael has been told{cfg?.canConfirm ? "" : " and will retry it"}.
                {cfg?.canConfirm && <div className="mt-2"><button type="button" disabled={!!busy} onClick={() => run("retry", () => retry({ id: o._id }), "Retrying")} className="rounded-lg bg-[#0A0A0A] px-3 py-1.5 text-xs font-semibold text-white">Retry</button></div>}
              </div>
            )}

            {d.campaigns.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {d.campaigns.map(c => {
                  const front = c.lobProofThumbs?.[0];
                  return (
                    <div key={c._id} className="overflow-hidden rounded-xl bg-white ring-1 ring-[#ebe5da]" data-testid="drop-card">
                      <ProofImg src={front} fallback={`/mailers/thumbs/${c.design}-front.jpg`} alt={c.title} />
                      <div className="p-2.5 text-[13px]">
                        <div className="font-semibold leading-snug">“{c.title}”</div>
                        <div className="text-stone-500">{c.households} home{c.households === 1 ? "" : "s"}{d.status === "mailed" ? ` · ${c.scannedHouseholds} scanned · ${c.leads} replied` : ""}{c.lobFailed ? ` · ${c.lobFailed} refused by Lob` : ""}</div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          {c.lobProofUrl && <a href={c.lobProofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#9C7434]"><Download className="size-3.5" /> Lob proof (PDF)</a>}
                          <Link to={`/mailers?open=${c._id}`} className="inline-flex items-center gap-1 font-semibold text-[#9C7434]"><ExternalLink className="size-3.5" /> Homes &amp; scans</Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {d.status === "ready" && d.campaigns.some(c => c.lobProofThumbs?.length) && <p className="mt-1.5 text-xs text-stone-500">Proofs show the first home. Every card gets that home's name and its own QR code. The white box is where Lob prints the address and postage.</p>}

            {d.cards > 0 && d.status !== "stopped" && (
              <table className="mt-3 w-full text-[13px]" data-testid="drop-total">
                <tbody>
                  {d.listAmount > 0 && <tr><td className="py-0.5 text-stone-600">List ({o.zips.length} ZIP{o.zips.length > 1 ? "s" : ""})</td><td className="py-0.5 text-right">{money(d.listAmount)}</td></tr>}
                  {d.n === 1 && d.listAmount === 0 && o.free && <tr><td className="py-0.5 text-stone-600">List (your first is free)</td><td className="py-0.5 text-right">$0.00</td></tr>}
                  <tr><td className="py-0.5 text-stone-600">{d.cards} cards × {money(data.price)} (print + postage){d.copies ? <span className="block text-[11px] text-stone-500">incl. {d.copies === 1 ? "1 copy" : `${d.copies} copies`} mailed to you, one per design</span> : null}</td><td className="py-0.5 text-right">{money(d.cardAmount)}</td></tr>
                  <tr className="border-t border-[#ebe5da] font-semibold"><td className="pt-1">Total</td><td className="pt-1 text-right">{money(d.amount)}</td></tr>
                </tbody>
              </table>
            )}

            {isActive && d.status === "ready" && p && (
              <div className={`mt-3 rounded-xl p-3 text-sm ${p.status === "confirmed" || p.status === "waived" ? "bg-emerald-50 text-emerald-800" : "bg-[#0A0A0A] text-white"}`} data-testid="mail-pay">
                {data.own && p.status === "awaiting" ? (
                  <div className="space-y-2">
                    <div>Your own mailing: no Zelle needed. {money(d.amount)} is logged as its cost.</div>
                    <button type="button" disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-[#D9BC8C] px-3 py-1.5 font-semibold text-[#0A0A0A]" data-testid="mail-now"
                      onClick={() => { if (window.confirm(`Mail ${d.cards} cards with Lob now? This can't be undone.`)) run("now", () => waive({ id: o._id }), "Mailing started"); }}>
                      {busy === "now" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Mail it now
                    </button>
                  </div>
                ) : p.status === "sent" ? (
                  <>You sent {money(p.amount)}. Lob starts mailing as soon as Michael confirms it.</>
                ) : p.status === "awaiting" ? (
                  <div className="space-y-2">
                    <div>To mail them, Zelle <b className="text-[#D9BC8C]">{money(p.amount)}</b> to <b>{zelleTo}</b> with memo <b className="text-[#D9BC8C]">{p.code}</b>.</div>
                    {p.note && <div className="text-amber-200">{p.note}</div>}
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" disabled={!!busy} className="rounded-lg bg-[#D9BC8C] px-3 py-1.5 font-semibold text-[#0A0A0A]" onClick={() => run("sent", () => markSent({ id: o._id }), "Thanks! Michael will confirm, then Lob mails your cards.")} data-testid="mail-i-sent-it">I sent it</button>
                      {d.n === 1 && <button type="button" disabled={!!busy} className="text-xs text-stone-300 underline" onClick={() => { if (window.confirm(d.listAmount ? `Don't mail these cards? You'll only pay ${money(d.listAmount)} for the list.` : "Don't mail these cards?")) run("cancel", () => cancel({ id: o._id }), "Mailing cancelled"); }}>Don't mail these</button>}
                    </div>
                    <PayByCard kind="list" id={o._id} amount={p.amount} dark after="Lob starts mailing as soon as the card goes through." />
                  </div>
                ) : null}
              </div>
            )}
            {d.status === "mailing" && (
              <div className="mt-3" data-testid="drop-mailing">
                <div className="mb-1 flex justify-between text-xs text-stone-600"><span className="flex items-center gap-1"><Loader2 className="size-3.5 animate-spin" /> Sending cards to Lob…</span><span>{progress} of {d.cards - (d.copies ?? 0)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-[#efe9df]"><div className="h-full bg-[#9C7434] transition-all" style={{ width: `${Math.round((progress / Math.max(1, d.cards - (d.copies ?? 0))) * 100)}%` }} /></div>
              </div>
            )}
            {d.status === "mailed" && (
              <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200" data-testid="drop-mailed">
                {test ? <b>Test run: Lob rendered {d.sent} cards, nothing printed.</b> : <><b>{d.sent} cards on their way.</b>{d.expected ? ` Expected in mailboxes by ${day(d.expected)}.` : ""}</>}
                {(d.refused ?? 0) > 0 && <span className="text-xs text-red-800"> {d.refused} address{d.refused === 1 ? " was" : "es were"} refused by Lob (not mailed, not charged).</span>}
                <div className="text-xs text-emerald-800">Replies land in your Hub inbox and Lofty (tag “Mailer”). Call within the hour, and knock on homes that scanned but didn't reply.</div>
                {d.campaigns.some(c => c.copyLobId || c.copyError) && (
                  <div className="mt-1 text-xs text-emerald-800" data-testid="drop-copy">
                    {d.campaigns.filter(c => c.copyLobId).length ? `Your copy (${d.campaigns.filter(c => c.copyLobId).length} card${d.campaigns.filter(c => c.copyLobId).length > 1 ? "s" : ""}) is on its way to ${d.campaigns.find(c => c.copyTo)?.copyTo}.` : ""}
                    {d.campaigns.filter(c => c.copyError).map(c => <span key={c._id} className="block text-red-800">Your copy of “{c.title}” wasn't mailed: {c.copyError}</span>)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {series && !data.stopped && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F7F5F1] px-3 py-2 text-sm" data-testid="series-next">
          <span className="inline-flex items-center gap-1.5 text-stone-700"><Repeat className="size-4 text-[#9C7434]" />
            {scheduled?.scheduledFor ? `Card ${scheduled.n} is built ${day(scheduled.scheduledFor)} for the same homes. You'll see it and its total before anything is mailed.` : `Series: ${data.seriesDrops} cards, ${Math.round(data.gapDays / 7)} weeks apart. The next card is scheduled once this one mails.`}
          </span>
          <button type="button" disabled={!!busy} className="text-xs font-semibold text-stone-600 underline" onClick={() => { if (window.confirm("Stop the series? Cards already mailed aren't affected.")) run("stop", () => stop({ id: o._id }), "Series stopped"); }} data-testid="stop-series">Stop the series</button>
        </div>
      )}
      {series && data.stopped && <p className="text-xs text-stone-500">Series stopped. No more cards will be built.</p>}
      <div className="flex flex-wrap gap-3 text-xs">
        {o.files.map(f => f.url && (
          <a key={f.kind} href={f.url} download={f.name} className="font-semibold text-stone-500 underline" data-testid={`download-${f.kind}`}>{f.kind === "xlsx" ? "Your list (Excel)" : "Your list (CSV)"}</a>
        ))}
      </div>
    </div>
  );
}
