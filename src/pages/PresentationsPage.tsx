import { useQuery } from "convex/react";
import { BookOpen, Download, Eye, Loader2, Presentation, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { AGENTS, agentByEmail } from "@/lib/agents";
import { OPS_EMAILS } from "../../convex/agentsData";
import { DECKS, REAL_START, buildDeck, chicagoToday, deckFileName, defaultEdition, hasAgentPage, prettyDate, realOnly, type DeckKind, type Edition } from "@/lib/deckBuilder";
import { api } from "../../convex/_generated/api";
import { GUIDES, buildGuide, guideFileName, type GuideKind } from "@/lib/guideBuilder";

const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[15px]";

export function PresentationsPage() {
  const me = useQuery(api.cma.me);
  const mine = agentByEmail(me?.email);
  // Agents are locked to themselves; staff (and logins not on the agent list yet) pick a name.
  const canPick = !!me && (me.isAdmin || OPS_EMAILS.includes(me.email) || !mine);
  const [agentName, setAgentName] = useState("");
  const [seller, setSeller] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(chicagoToday());
  const [edition, setEdition] = useState<Edition>(defaultEdition());
  const [busy, setBusy] = useState<string | null>(null);
  const [client, setClient] = useState("");
  const [params] = useSearchParams();
  const focusGuide = params.get("guide") as GuideKind | null;
  const guidesRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focusGuide && me) setTimeout(() => guidesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [focusGuide, me]);

  useEffect(() => {
    if (!agentName && me) setAgentName(mine?.name ?? "Michael Kang");
  }, [me, mine, canPick, agentName]);

  const agent = useMemo(() => AGENTS.find(a => a.name === agentName), [agentName]);
  const canShare = typeof navigator !== "undefined" && "canShare" in navigator;

  async function run(kind: DeckKind | GuideKind, mode: "download" | "preview" | "share") {
    if (!agent) { toast.error("Pick the agent first"); return; }
    setBusy(`${kind}:${mode}`);
    const preview = mode === "preview" ? window.open("", "_blank") : null;
    try {
      let pdf: Uint8Array;
      let name: string;
      if (kind === "buyer" || kind === "seller") {
        const gi = { kind, edition, agent, client };
        pdf = await buildGuide(gi);
        name = guideFileName(gi);
      } else {
        const input = { kind, edition, agent, seller, address, date };
        pdf = await buildDeck(input);
        name = deckFileName(input);
      }
      const blob = new Blob([pdf as BlobPart], { type: "application/pdf" });
      if (mode === "share") {
        const file = new File([blob], name, { type: "application/pdf" });
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
        mode = "download";
      }
      const url = URL.createObjectURL(blob);
      if (preview) preview.location.href = url;
      else {
        const a = document.createElement("a");
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        toast.success(`${name} downloaded`);
      }
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (e) {
      preview?.close();
      if ((e as Error).name !== "AbortError") toast.error(`Couldn't build the PDF: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  const Buttons = ({ k }: { k: DeckKind | GuideKind }) => (
    <div className="mt-4 flex gap-2">
      <button type="button" disabled={!!busy || !agent} onClick={() => run(k, "download")} data-testid={`dl-${k}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {busy === `${k}:download` ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download
      </button>
      <button type="button" disabled={!!busy || !agent} onClick={() => run(k, "preview")} aria-label="Preview" className="rounded-xl bg-[#F7F5F1] px-3 py-2.5 disabled:opacity-50">
        {busy === `${k}:preview` ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
      </button>
      {canShare && (
        <button type="button" disabled={!!busy || !agent} onClick={() => run(k, "share")} aria-label="Share" className="rounded-xl bg-[#F7F5F1] px-3 py-2.5 disabled:opacity-50">
          {busy === `${k}:share` ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
        </button>
      )}
    </div>
  );

  if (me === undefined) return <div className="p-6 text-sm text-stone-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-['Playfair_Display'] text-3xl">Decks &amp; client guides</h1>
        <p className="text-sm text-stone-500">
          Every deck and guide downloads branded for {agent ? <b className="text-stone-700">{agent.name}</b> : "you"}: name, photo, bio, phone and email on the cover, the “Your agent” page and the back page. Nothing to edit.
        </p>
      </div>

      <section className="rounded-2xl bg-white p-4 md:p-5 ring-1 ring-[#ebe5da] space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="block text-sm">
            <span className="mb-1 block font-semibold">Branded for</span>
            {canPick ? (
              <select value={agentName} onChange={e => setAgentName(e.target.value)} className={inputCls}>
                {AGENTS.map(a => <option key={a.name}>{a.name}</option>)}
              </select>
            ) : (
              <div className={`${inputCls} bg-[#F7F5F1]`}>{agent?.name} · {agent?.phone}</div>
            )}
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Date on the cover</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Seller name <span className="font-normal text-stone-400">(optional)</span></span>
            <input value={seller} onChange={e => setSeller(e.target.value)} placeholder="e.g. Jane & Tom Smith" className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Property address <span className="font-normal text-stone-400">(optional)</span></span>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. 1641 Alexis Ct, Glenview" className={inputCls} />
          </label>
        </div>
        <p className="text-xs text-stone-500">Leave seller and address empty to get blank lines you can fill in by hand.</p>
        {!realOnly() && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">Brokerage:</span>
            {(["cb", "real"] as Edition[]).map(e => (
              <button key={e} type="button" onClick={() => setEdition(e)} className={`rounded-full px-3.5 py-1.5 ${edition === e ? "bg-[#9C7434] text-white" : "bg-white ring-1 ring-[#ebe5da] text-stone-700"}`}>
                {e === "cb" ? "Coldwell Banker (through Nov 9)" : "Real Broker (from Nov 10)"}
              </button>
            ))}
            <span className="text-xs text-stone-500">Presenting on or after {prettyDate(REAL_START)}? Use Real Broker. After that date this switches automatically.</span>
          </div>
        )}
        {agent && !hasAgentPage(agent.name) && (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">No photo/bio slide on file for {agent.name} yet, so the deck uses a simple contact slide. Send Cris a headshot and a short bio to get the full slide.</p>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {DECKS.map(d => (
          <div key={d.kind} className="flex flex-col rounded-2xl bg-white p-5 ring-1 ring-[#ebe5da]">
            <Presentation className="size-7 text-[#9C7434]" />
            <div className="mt-3 font-semibold text-[17px]">{d.title}</div>
            <div className="text-xs font-semibold text-[#9C7434]">{d.pages} slides · {d.when}</div>
            <p className="mt-2 flex-1 text-[13px] text-stone-500">{d.note}</p>
            <Buttons k={d.kind} />
          </div>
        ))}
      </section>
      <p className="text-xs text-stone-500">How to use them: email the Pre-Listing Package 24–48 hours before you meet, present the Appointment Deck in person, and use the Full Master Deck when the seller didn't get the package first.</p>

      <section ref={guidesRef} id="guides" className="space-y-3 scroll-mt-20" data-testid="guides">
        <div>
          <h2 className="font-['Playfair_Display'] text-2xl">Buyer &amp; Seller guides</h2>
          <p className="text-sm text-stone-500">17-page client guides with your photo, bio and contact info built in. Add the client's name for the cover, or leave it blank to get a line you can fill in by hand.</p>
        </div>
        <label className="block max-w-md text-sm">
          <span className="mb-1 block font-semibold">Client name on the cover <span className="font-normal text-stone-400">(optional)</span></span>
          <input value={client} onChange={e => setClient(e.target.value)} placeholder="e.g. Jane & Tom Smith" className={inputCls} data-testid="guide-client" />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          {GUIDES.map(g => (
            <div key={g.kind} className={`flex flex-col rounded-2xl bg-white p-5 ring-1 ${focusGuide === g.kind ? "ring-2 ring-[#9C7434]" : "ring-[#ebe5da]"}`}>
              <BookOpen className="size-7 text-[#9C7434]" />
              <div className="mt-3 font-semibold text-[17px]">{g.title}</div>
              <div className="text-xs font-semibold text-[#9C7434]">{g.pages} pages · {g.when}</div>
              <p className="mt-2 flex-1 text-[13px] text-stone-500">{g.note}</p>
              <Buttons k={g.kind} />
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
