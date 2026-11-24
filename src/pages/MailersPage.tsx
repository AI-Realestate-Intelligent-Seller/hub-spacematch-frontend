// Seller mailers: pick a design → upload the ATN Title list → download the agent-branded
// print PDF (one unique QR per home) → send to print → watch scans and leads come in.
import { OFFICE_ADDRESS } from "../../convex/officeDefs";
import { PayByCard } from "@/components/PayByCard";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2, ChevronDown, Download, Eye, FileSpreadsheet, GraduationCap, Loader2, Mail, Printer, QrCode, RotateCw, Send, Trash2, Upload,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { AGENTS, agentSlug } from "@/lib/agents";
import {
  DESIGNS, SAMPLE_HOUSEHOLD, SEQUENCE, buildMailers, download, fileSafe, mailingListCsv, wisePelicanCsv, type DesignId, type Household, type MailerAgent,
} from "@/lib/mailerBuilder";
import { type WpKind, buildWisePelicanPng } from "@/lib/wisePelican";
import { FIELD_LABELS, cleanRows, detectColumns, guessLastFirst, readSheet, type Field } from "@/lib/mailerList";
import { api } from "../../convex/_generated/api";
import { LOB_CARD_PRICE, LOB_MAIL_LABEL, lobAmount } from "../../convex/lobDefs";
import { AgentCopyAddress, useCopyAddress } from "@/components/AgentCopyAddress";
import type { Doc, Id } from "../../convex/_generated/dataModel";

const card = "rounded-2xl bg-white p-4 md:p-5 ring-1 ring-[#ebe5da]";
const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[15px]";
const btnDark = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
const btnLight = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7F5F1] px-4 py-2.5 text-sm font-semibold text-[#0A0A0A] ring-1 ring-[#ebe5da] disabled:opacity-50";
const TUTORIAL_KEY = "hub-mailers-tutorial-seen";
const designTitle = (id: string) => DESIGNS.find(d => d.id === id)?.title ?? id;
const errMsg = (e: unknown) => String((e as Error).message ?? e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? String((e as Error).message ?? e);

function Tutorial({ onClose }: { onClose?: () => void }) {
  const steps: [string, string][] = [
    ["Pick how to mail", "Easiest: “Mail it for me”. Pick up to 3 ZIPs and we pull the homeowners, put the best card on each home, and Lob mails them after one Zelle. Or bring your own list (ATN Title, past clients), use Wise Pelican, or print it yourself. The steps below are for your own list."],
    ["Pick a design", "Choose a seller story, a specific offer or a verified team-sale spotlight. Each card carries your agent branding; sale spotlights also identify the actual listing agent and closing date. Tap “Sample proof” to see the complete front and back before you mail."],
    ["Upload the list", "Drop the file in. The Hub finds the columns, fixes names (SMITH, JOHN & MARY → John & Mary Smith), sends LLCs and banks to “Current Homeowner” or skips them, and removes duplicate mailboxes. Check the preview, then create the mailing."],
    ["Mail it", `Open the mailing and use “Mail it with Lob”: Lob prints and mails every card for $${LOB_CARD_PRICE.toFixed(2)} each once Michael confirms your Zelle. Or use “Wise Pelican options” (a 6×9 version of your design and a ready-to-upload list), or download the print PDF for any printer or the office. Mark it mailed when it drops.`],
    ["Follow up on scans and replies", "Every card has its own QR code. When a homeowner scans, you see which home scanned. When they ask for a value, it lands in your Hub inbox and Lofty (tag “Mailer”), and you get an email. Call within the hour, and knock on the doors of homes that scanned but didn't reply."],
  ];
  return (
    <section className={`${card} border-l-4 border-[#9C7434]`} data-testid="mailer-tutorial">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#9C7434]"><GraduationCap className="size-5" /><span className="font-semibold">How seller mailers work</span></div>
          <p className="mt-1 text-sm text-stone-500">“Mail it for me” takes about a minute. Your own list takes about 10 minutes the first time.</p>
        </div>
        {onClose && <button type="button" onClick={onClose} className="text-sm font-semibold text-[#9C7434]">Got it</button>}
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-5">
        {steps.map(([t, d], i) => (
          <li key={t} className="rounded-xl bg-[#F7F5F1] p-3">
            <div className="font-['Playfair_Display'] text-2xl text-[#9C7434]">{i + 1}</div>
            <div className="mt-1 font-semibold">{t}</div>
            <p className="mt-1 text-[13px] leading-snug text-stone-600">{d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-3 text-[13px] text-stone-600 md:grid-cols-3">
        <p><b className="text-stone-800">What works in mail:</b> the same homes, again and again. Mail one farm every 3–4 weeks, in this order: {SEQUENCE.map(designTitle).map(t => t.split(/[.?]/)[0]).join(" → ")}. Swap the spring card in from December to February. Then repeat monthly and add Just Sold cards.</p>
        <p><b className="text-stone-800">Expect:</b> most replies come after the 3rd–6th card. Judge a farm after 3 drops, not 1. The Hub shows scans, replies and cost per lead for each mailing.</p>
        <p><b className="text-stone-800">Rules:</b> don't mail homes that are listed with another broker (the card says so too), keep the brokerage line and your license on the card (both are built in: "SpaceMatch Inc. is a team of Real Broker, LLC"), and never promise a value on the phone before you've pulled comps.</p>
      </div>
    </section>
  );
}

function DesignPicker({ value, onChange, onProof, busy }: { value: DesignId; onChange: (d: DesignId) => void; onProof: (d: DesignId) => void; busy: string | null }) {
  const [side, setSide] = useState<Record<string, "front" | "back">>({});
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {DESIGNS.map(d => {
        const s = side[d.id] ?? "front";
        const on = value === d.id;
        return (
          <div key={d.id} className={`flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ${on ? "ring-2 ring-[#9C7434]" : "ring-[#ebe5da]"}`} data-testid={`design-${d.id}`}>
            <button type="button" onClick={() => setSide({ ...side, [d.id]: s === "front" ? "back" : "front" })} className="relative block" aria-label="Flip card">
              <img src={`/mailers/thumbs/${d.id}-${s}.jpg`} alt={`${d.title} ${s}`} className="aspect-[1080/600] w-full object-cover" />
              <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-xs text-white"><RotateCw className="size-3" /> {s === "front" ? "See back" : "See front"}</span>
            </button>
            <div className="flex flex-1 flex-col p-4">
              {d.offer && <span className="mb-1.5 inline-flex w-fit items-center rounded-full bg-[#9C7434]/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#9C7434]" data-testid={`offer-${d.id}`}>Call to action · {d.offer}</span>}
              <div className="font-semibold leading-snug">{d.title}</div>
              <p className="mt-1 text-[13px] text-stone-600"><b className="text-stone-700">Solves:</b> {d.problem}</p>
              <p className="mt-1 flex-1 text-[13px] text-stone-500"><b className="text-stone-600">Best for:</b> {d.best}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => onChange(d.id)} className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${on ? "bg-[#9C7434] text-white" : "bg-[#F7F5F1] ring-1 ring-[#ebe5da]"}`}>{on ? "✓ Selected" : "Use this"}</button>
                <button type="button" disabled={!!busy} onClick={() => onProof(d.id)} className={btnLight} data-testid={`proof-${d.id}`}>
                  {busy === `proof:${d.id}` ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />} Sample proof
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Parsed = { fileName: string; headers: string[]; rows: Record<string, string>[] };
type Path = "own" | "wp" | "print";

// The 4 ways to mail (Michael 2026-11-02: done-for-you first, the others clearly visible next to it).
function Choices({ path, setPath }: { path: Path | null; setPath: (p: Path) => void }) {
  const price = `$${LOB_CARD_PRICE.toFixed(2)}`;
  const items: { key: Path | "mail"; title: string; best: string; price: string; icon: ReactNode }[] = [
    { key: "mail", title: "Mail it for me", best: "Pick up to 3 ZIPs. We pull the homeowners most likely to sell, put the best card on each home, and Lob mails them. You review and pay once.", price: `$5 per ZIP + ${price} a card`, icon: <Send className="size-5" /> },
    { key: "own", title: "I have my own list", best: "Upload an ATN Title or past-client list. Pick a design and Lob prints and mails it.", price: `${price} a card`, icon: <Upload className="size-5" /> },
    { key: "wp", title: "Send through Wise Pelican", best: "Already use Wise Pelican? Get our designs as 6×9 cards and order them there.", price: "From $1.04 a card, paid to Wise Pelican", icon: <QrCode className="size-5" /> },
    { key: "print", title: "Print it myself", best: "Download a print-ready PDF and mailing list for any printer, or send it to the office.", price: "Free", icon: <Printer className="size-5" /> },
  ];
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="mail-choices">
      {items.map((it, i) => {
        const featured = i === 0;
        const on = path === it.key;
        const inner = (
          <>
            <div className="flex items-center gap-2">
              <span className={`flex size-9 items-center justify-center rounded-xl ${featured ? "bg-[#D9BC8C] text-[#0A0A0A]" : "bg-[#F7F5F1] text-[#9C7434]"}`}>{it.icon}</span>
              {featured && <span className="rounded-full bg-[#D9BC8C] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0A0A0A]">Recommended</span>}
            </div>
            <div className={`mt-3 font-display text-xl ${featured ? "text-white" : ""}`}>{it.title}</div>{featured && <div className="text-xs font-semibold text-[#D9BC8C]">Done for you</div>}
            <p className={`mt-1 flex-1 text-[13px] leading-snug ${featured ? "text-stone-300" : "text-stone-600"}`}><b className={featured ? "text-white" : "text-stone-800"}>Best for:</b> {it.best}</p>
            <div className={`mt-3 text-sm font-semibold ${featured ? "text-[#D9BC8C]" : "text-[#9C7434]"}`}>{it.price}</div>
            <div className={`mt-3 rounded-xl px-3 py-2 text-center text-sm font-semibold ${featured ? "bg-[#D9BC8C] text-[#0A0A0A]" : on ? "bg-[#9C7434] text-white" : "bg-[#F7F5F1] ring-1 ring-[#ebe5da]"}`}>{featured ? "Start: pick ZIPs" : on ? "✓ Selected" : "Choose"}</div>
          </>
        );
        const cls = `flex flex-col rounded-2xl p-4 text-left ring-1 transition ${featured ? "bg-[#0A0A0A] ring-[#0A0A0A]" : on ? "bg-white ring-2 ring-[#9C7434]" : "bg-white ring-[#ebe5da] hover:ring-[#9C7434]/50"}`;
        return it.key === "mail"
          ? <Link key={it.key} to="/seller-lists?tab=new&mode=mail" className={cls} data-testid="choice-mail">{inner}</Link>
          : <button key={it.key} type="button" onClick={() => setPath(it.key as Path)} className={cls} data-testid={`choice-${it.key}`}>{inner}</button>;
      })}
    </section>
  );
}

function NewMailing({ agentName, setAgentName, canPick, onCreated, preload, path }: { agentName: string; setAgentName: (n: string) => void; canPick: boolean; onCreated: (id: Id<"mailCampaigns">) => void; preload?: { listId: string; group?: string }; path: Path }) {
  const create = useMutation(api.mailers.create);
  const addHouseholds = useMutation(api.mailers.addHouseholds);
  const wisePelicanCode = useMutation(api.mailers.wisePelicanCode);
  const [design, setDesign] = useState<DesignId>("value");
  const [busy, setBusy] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [map, setMap] = useState<Partial<Record<Field, string>>>({});
  const [lastFirst, setLastFirst] = useState(true);
  const [skipCorporate, setSkipCorporate] = useState(true);
  const [skipTrusts, setSkipTrusts] = useState(true);
  const [ownerOccOnly, setOwnerOccOnly] = useState(false);
  const [showCols, setShowCols] = useState(false);
  const [name, setName] = useState("");
  const [progress, setProgress] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const agent = AGENTS.find(a => a.name === agentName);
  // One tap from Seller lists: /mailers?list=<order>&group=<design> preloads that group of homes + its suggested design.
  const listFile = useQuery(api.sellerLists.csvFor, preload ? { id: preload.listId as Id<"sellerListOrders"> } : "skip");
  const loadedList = useRef("");
  useEffect(() => {
    if (!preload || !listFile?.url || loadedList.current === `${preload.listId}:${preload.group ?? ""}`) return;
    loadedList.current = `${preload.listId}:${preload.group ?? ""}`;
    (async () => {
      setBusy("parse");
      try {
        const blob = await (await fetch(listFile.url!)).blob();
        const { headers, rows } = await readSheet(new File([blob], listFile.name));
        const g = preload.group && DESIGNS.some(d => d.id === preload.group) ? (preload.group as DesignId) : null;
        const picked = g ? rows.filter(r => r["Design Id"] === g) : rows;
        const m = detectColumns(headers);
        setMap(m);
        setLastFirst(false);
        setParsed({ fileName: `Seller list ${listFile.code}${g ? ` · ${designTitle(g)}` : ""}`, headers, rows: picked });
        if (g) setDesign(g);
        if (canPick && listFile.agentName) setAgentName(listFile.agentName);
        setName(`${listFile.buildings?.length ? (listFile.buildings.length === 1 ? listFile.buildings[0].address : `${listFile.buildings.length} buildings`) : `ZIP ${listFile.zips.join(", ")}`}${g ? ` · ${designTitle(g).split(/[.?]/)[0]}` : ""}`.slice(0, 60));
        toast.success(`Loaded ${picked.length} homes from your seller list${g ? " with the suggested design" : ""}. Check them, then create the mailing.`);
      } catch (e) {
        toast.error(`Couldn't load the seller list: ${errMsg(e)}`);
      } finally {
        setBusy(null);
      }
    })();
  }, [preload, listFile, canPick, setAgentName]);

  const result = useMemo(() => (parsed ? cleanRows(parsed.rows, { map, lastFirst, skipCorporate, skipTrusts, ownerOccOnly }) : null), [parsed, map, lastFirst, skipCorporate, skipTrusts, ownerOccOnly]);
  const missing = parsed && !(map.mailAddr || map.propAddr) ? "a mailing or property address column" : parsed && !(map.mailZip || map.mailCsz || map.propZip) ? "a ZIP column" : "";

  async function proof(d: DesignId) {
    if (!agent) return toast.error("Pick the agent first");
    setBusy(`proof:${d}`);
    const w = window.open("", "_blank");
    try {
      const pdf = await buildMailers({ design: d, agent, households: [SAMPLE_HOUSEHOLD], baseUrl: `${window.location.origin}/v/`, qrQuery: `?d=${d}&a=${agentSlug(agent.name)}` });
      const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
      if (w) w.location.href = url; else download(pdf, `Mailer_proof_${d}_${fileSafe(agent.name)}.pdf`, "application/pdf");
    } catch (e) {
      w?.close();
      toast.error(`Couldn't build the proof: ${errMsg(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function onFile(file?: File) {
    if (!file) return;
    setBusy("parse");
    try {
      const { headers, rows } = await readSheet(file);
      const m = detectColumns(headers);
      setMap(m);
      setLastFirst(guessLastFirst(rows, m.ownerFull));
      setParsed({ fileName: file.name, headers, rows });
      setShowCols(!(m.mailAddr || m.propAddr));
      if (!name) setName(file.name.replace(/\.(csv|xlsx?|txt)$/i, "").replace(/[_-]+/g, " ").slice(0, 60));
    } catch (e) {
      toast.error(`Couldn't read that file: ${errMsg(e)}`);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function createWpOnly() {
    if (!agent) return toast.error("Pick the agent first");
    setBusy("wp");
    try {
      const { id } = await create({ name: name || `${designTitle(design)} · Wise Pelican`, design, agentName: agent.name });
      await wisePelicanCode({ campaignId: id });
      toast.success("Wise Pelican mailing created. Download your 6×9 front from it.");
      setName("");
      onCreated(id);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  }

  async function createMailing() {
    if (!agent || !result?.households.length) return;
    const wantPdf = path === "print";
    setBusy("create");
    try {
      const { id } = await create({ name: name || `${designTitle(design)}`, design, agentName: agent.name });
      const all: Household[] = [];
      let baseUrl = "";
      const rows = result.households;
      for (let i = 0; i < rows.length; i += 400) {
        setProgress(`Saving homes ${Math.min(i + 400, rows.length)} of ${rows.length}…`);
        const chunk = rows.slice(i, i + 400);
        const r = await addHouseholds({ campaignId: id, rows: chunk });
        baseUrl = r.baseUrl;
        chunk.forEach((h, k) => all.push({ ...h, code: r.codes[k] }));
      }
      if (wantPdf) {
        const pdf = await buildMailers({ design, agent, households: all, baseUrl, onProgress: (d, t) => setProgress(`Building the print PDF: ${d} of ${t} cards…`) });
        download(pdf, `Mailer_${fileSafe(name || design)}_${fileSafe(agent.name)}_${all.length}_homes.pdf`, "application/pdf");
        toast.success(`Mailing created: ${all.length} homes. Your print PDF is downloading.`);
      } else {
        toast.success(path === "wp" ? `Mailing created: ${all.length} homes. Next: download your 6×9 front and the Wise Pelican list.` : `Mailing created: ${all.length} homes. Next: see Lob's free proof, then request the mailing.`);
      }
      setParsed(null); setName(""); setProgress("");
      onCreated(id);
    } catch (e) {
      toast.error(errMsg(e));
      setProgress("");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-[#9C7434]">Step 1</div>
            <h2 className="font-['Playfair_Display'] text-xl">Pick a design</h2>
          </div>
          <div className="w-full max-w-xs text-sm">
            <span className="mb-1 block font-semibold">Branded for</span>
            {canPick ? (
              <select value={agentName} onChange={e => setAgentName(e.target.value)} className={inputCls} aria-label="Branded for">
                {AGENTS.map(a => <option key={a.name}>{a.name}</option>)}
              </select>
            ) : <div className={`${inputCls} bg-[#F7F5F1]`}>{agent?.name} · {agent?.phone}</div>}
          </div>
        </div>
        <DesignPicker value={design} onChange={setDesign} onProof={proof} busy={busy} />
        <p className="mt-3 text-xs text-stone-500">Previews show Michael's sample. Your proof and every printed card use your photo, name, phone, email and license automatically.</p>
      </section>

      <section className={card}>
        <div className="text-xs font-semibold text-[#9C7434]">Step 2</div>
        <h2 className="font-['Playfair_Display'] text-xl">{path === "wp" ? "Upload your list (optional)" : "Upload your list"}</h2>
        <p className="mt-1 text-sm text-stone-500">{path === "wp" ? "Upload it here and the Hub cleans it, so you skip Wise Pelican's 10¢/address list fee. No list? Use “Wise Pelican only” in step 3." : "Excel (.xlsx) or CSV, straight from ATN Title or your CRM. No cleanup needed."}</p>
        <p className="mt-1 text-sm text-stone-600">No list yet? <Link to="/seller-lists?tab=new&mode=list" className="font-semibold text-[#9C7434] underline">Get one from Seller lists</Link>, or let us do all of it with <Link to="/seller-lists?tab=new&mode=mail" className="font-semibold text-[#9C7434] underline">Mail it for me</Link>.</p>
        <label
          className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#d9cdb8] bg-[#F7F5F1] px-4 py-8 text-center"
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
        >
          {busy === "parse" ? <Loader2 className="size-7 animate-spin text-[#9C7434]" /> : <Upload className="size-7 text-[#9C7434]" />}
          <span className="font-semibold">{parsed ? `${parsed.fileName} · ${parsed.rows.length} rows` : "Drop the file here or tap to choose"}</span>
          <span className="text-xs text-stone-500">{parsed ? "Tap to pick a different file" : ".xlsx, .xls or .csv"}</span>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={e => onFile(e.target.files?.[0])} data-testid="mailer-file" />
        </label>

        {parsed && result && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5" data-testid="mailer-stats">
              {[
                ["Homes to mail", result.stats.kept, true],
                ["Duplicate mailboxes", result.stats.duplicates],
                ["LLC / bank owners", result.stats.corporate],
                [skipTrusts ? "Trusts / estates skipped" : "Trusts → “Homeowner”", result.stats.trusts],
                ["Missing address", result.stats.noAddress + result.stats.absenteeSkipped],
              ].map(([l, n, big]) => (
                <div key={String(l)} className={`rounded-xl p-3 ${big ? "bg-[#0A0A0A] text-white" : "bg-[#F7F5F1]"}`}>
                  <div className="font-['Playfair_Display'] text-2xl">{String(n)}</div>
                  <div className={`text-xs ${big ? "text-[#D9BC8C]" : "text-stone-500"}`}>{String(l)}{l === "Missing address" && ownerOccOnly ? " / absentee" : ""}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={skipCorporate} onChange={e => setSkipCorporate(e.target.checked)} /> Skip LLC, bank and corporate owners</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={skipTrusts} onChange={e => setSkipTrusts(e.target.checked)} /> Skip trusts and estates</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={ownerOccOnly} onChange={e => setOwnerOccOnly(e.target.checked)} /> Only owner-occupied homes</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={lastFirst} onChange={e => setLastFirst(e.target.checked)} /> Names are listed last name first (SMITH JOHN)</label>
            </div>
            {missing && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Couldn't find {missing}. Open “Check columns” and pick it.</div>}
            <div className="overflow-x-auto rounded-xl ring-1 ring-[#ebe5da]">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#F7F5F1] text-stone-500"><tr><th className="px-3 py-2">On the card</th><th className="px-3 py-2">“Prepared for”</th><th className="px-3 py-2">Mailing address</th><th className="px-3 py-2">Property</th></tr></thead>
                <tbody>
                  {result.households.slice(0, 8).map((h, i) => (
                    <tr key={i} className="border-t border-[#f0ebe2]"><td className="px-3 py-2 font-medium">{h.nameLine}</td><td className="px-3 py-2">{h.who}</td><td className="px-3 py-2">{h.mailAddr}, {h.mailCity} {h.mailState} {h.mailZip}</td><td className="px-3 py-2">{h.propAddr}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-stone-500">Names look backwards? Flip “last name first”. Wrong column? Fix it below.</p>
            <button type="button" onClick={() => setShowCols(!showCols)} className="inline-flex items-center gap-1 text-sm font-semibold text-[#9C7434]"><ChevronDown className={`size-4 transition ${showCols ? "rotate-180" : ""}`} /> Check columns</button>
            {showCols && (
              <div className="grid gap-2 md:grid-cols-3">
                {(Object.keys(FIELD_LABELS) as Field[]).map(f => (
                  <label key={f} className="text-xs">
                    <span className="mb-0.5 block font-semibold text-stone-600">{FIELD_LABELS[f]}</span>
                    <select value={map[f] ?? ""} onChange={e => setMap({ ...map, [f]: e.target.value || undefined })} className={`${inputCls} py-1.5 text-sm`}>
                      <option value="">—</option>
                      {parsed.headers.map(h => <option key={h}>{h}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className={card}>
        <div className="text-xs font-semibold text-[#9C7434]">Step 3</div>
        <h2 className="font-['Playfair_Display'] text-xl">Create the mailing</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="text-sm">
            <span className="mb-1 block font-semibold">Mailing name</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Glenview farm · card 1" className={inputCls} data-testid="mailer-name" />
          </label>
          <button type="button" disabled={!!busy || !result?.households.length || !!missing} onClick={createMailing} className={`${btnDark} py-3`} data-testid="mailer-create">
            {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : path === "print" ? <Printer className="size-4" /> : <Send className="size-4" />}
            {!result?.households.length ? "Upload a list first" : path === "print" ? `Create & download ${result.households.length} cards` : `Create mailing (${result.households.length} homes)`}
          </button>
        </div>
        {progress && <p className="mt-2 text-sm text-stone-600" data-testid="mailer-progress">{progress}</p>}
        <p className="mt-2 text-xs text-stone-500">{path === "own" ? `Each home gets its own QR code. Next you'll see Lob's free proof and the total ($${LOB_CARD_PRICE.toFixed(2)} a card), then pay by Zelle and Lob mails it.` : "Each home gets its own QR code and a 6-character code. Big lists take a minute to build; keep this tab open."}</p>
        {path === "wp" && <div className="mt-3"><WisePelicanPanel onCreateWp={createWpOnly} creating={busy === "wp"} defaultOpen /></div>}
      </section>
    </div>
  );
}

function CampaignRow({ c, open, onToggle, showAgent }: { c: Doc<"mailCampaigns">; open: boolean; onToggle: () => void; showAgent: boolean }) {
  const rate = c.households ? Math.round((c.scannedHouseholds / c.households) * 1000) / 10 : 0;
  const lobLabel = c.lobStatus === "requested" ? " · Lob: waiting for payment" : c.lobStatus === "sending" ? " · Lob: mailing…" : c.lobStatus === "failed" ? " · Lob: stopped" : c.lobStatus === "sent" && c.lobMode !== "live" ? " · Lob test run" : "";
  const statusLabel = (c.status === "draft" ? "Ready to print" : c.status === "print_requested" ? "Sent to print" : `Mailed ${c.mailedOn ?? ""}`) + lobLabel;
  return (
    <div className={card} data-testid="mailer-campaign">
      <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 text-left">
        <img src={`/mailers/thumbs/${c.design}-front.jpg`} alt="" className="h-12 w-[86px] rounded object-cover ring-1 ring-[#ebe5da]" />
        <div className="min-w-[180px] flex-1">
          <div className="font-semibold">{c.name}</div>
          <div className="text-xs text-stone-500">{showAgent ? `${c.agentName} · ` : ""}{designTitle(c.design)} · {statusLabel}{c.wpCode ? ` · 6×9 QR: ${c.wpScans ?? 0} scan${c.wpScans === 1 ? "" : "s"}` : ""}</div>
        </div>
        {[
          ["Homes", c.households],
          ["Scanned", `${c.scannedHouseholds}${c.households ? ` · ${rate}%` : ""}`],
          ["Replies", c.leads],
          ["Cost / lead", c.cost && c.leads ? `$${Math.round(c.cost / c.leads)}` : "—"],
        ].map(([l, v]) => (
          <div key={String(l)} className="text-right"><div className="font-['Playfair_Display'] text-xl">{String(v)}</div><div className="text-[11px] text-stone-500">{String(l)}</div></div>
        ))}
        <ChevronDown className={`size-5 text-stone-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <CampaignDetail id={c._id} />}
    </div>
  );
}

// Wise Pelican route: self-serve 6×9 postcards, printed + mailed by Wise Pelican. The Hub makes the
// agent-branded 6×9 front (+ optional back panel) with ONE QR per mailing (→ /v/<wpCode>, tracked here;
// the landing page asks for the address and matches it to the list). Prices: help.wisepelican.com, 2026-10-26.
const WP_PRICES: [string, string][] = [
  ["Postcard, all-in (print + postage + mailing)", "$1.04 each · no minimum"],
  ["Their own Home Value QR (not needed with the Hub front)", "$1.09 each"],
  ["First-class mail instead of standard", "+$0.23 each"],
  ["Their mailing list", "$0.10/address · free if you upload the Hub list"],
  ["Optional plans", "$500/mo → 99¢ · $1,000/mo → 94¢ · $3,000/mo → 88¢ (lower if paid yearly)"],
  ["Custom design by Wise Pelican", "$129 one time · not needed"],
  ["Printed and shipped to you (door-knocking)", "from $0.86 each, 100–5,000"],
];

type WpCampaign = { id: Id<"mailCampaigns">; name: string; design: DesignId; wpCode?: string; wpScans?: number };

function WpDownloads({ campaign, agent }: { campaign: WpCampaign; agent: MailerAgent }) {
  const getCode = useMutation(api.mailers.wisePelicanCode);
  const [busy, setBusy] = useState<string | null>(null);
  async function get(kind: WpKind) {
    setBusy(kind);
    try {
      const { code, baseUrl } = await getCode({ campaignId: campaign.id });
      const png = await buildWisePelicanPng({ kind, agent, code, baseUrl });
      const label = kind === "back" ? "back_panel_4x5" : `front_${kind}_8.5x5.5`;
      download(new Uint8Array(await png.arrayBuffer()), `WisePelican_${label}_${fileSafe(agent.name)}_${code}.png`, "image/png");
    } catch (e) { toast.error(`Couldn't build the image: ${errMsg(e)}`); } finally { setBusy(null); }
  }
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-[#ebe5da]" data-testid="mailer-wp-files">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex gap-2">
          <img src={`/mailers/wp/thumbs/${campaign.design}.jpg`} alt="6×9 front" className="w-[62%] rounded ring-1 ring-[#ebe5da]" />
          <img src="/mailers/wp/thumbs/back.jpg" alt="Back panel" className="w-[30%] self-start rounded ring-1 ring-[#ebe5da]" />
        </div>
        <div className="flex flex-col gap-2 sm:w-56">
          <button type="button" disabled={!!busy} onClick={() => get(campaign.design)} className={btnDark} data-testid="mailer-wp-front">{busy === campaign.design ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} 6×9 front (PNG)</button>
          <button type="button" disabled={!!busy} onClick={() => get("back")} className={btnLight} data-testid="mailer-wp-back">{busy === "back" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Back panel (PNG)</button>
          <p className="text-xs text-stone-500">Previews show Michael's sample. Your files carry your name, phone, photo and license, plus this mailing's QR code.</p>
          {campaign.wpCode && <p className="text-xs text-stone-600">QR code <b className="font-mono" data-testid="mailer-wp-code">{campaign.wpCode}</b> · {campaign.wpScans ?? 0} scan{campaign.wpScans === 1 ? "" : "s"}</p>}
        </div>
      </div>
    </div>
  );
}

export function WisePelicanPanel({ households, campaign, agent, onCreateWp, creating, defaultOpen }: {
  households?: Household[]; campaign?: WpCampaign; agent?: MailerAgent; onCreateWp?: () => void; creating?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const n = households?.length ?? 0;
  const inMailing = !!campaign;
  const steps = [
    !inMailing ? "Upload your ATN list above and create the mailing (or tap “Wise Pelican only” below if you'll use Wise Pelican's list). Then open it under My mailings." : n ? `Download the Wise Pelican list below. It holds the same ${n} cleaned homes (no LLCs, banks or duplicate mailboxes), so you skip the 10¢/address list fee.` : "No list in this mailing: build one in Wise Pelican (10¢/address), or create a new mailing from your ATN list.",
    "Download your 6×9 front and the back panel below. They're branded for you and carry one QR code for this whole mailing. Scans and replies come back to the Hub.",
    "In Wise Pelican: Templates → Upload My Own Design → Front Only → pick a template → Edit Design. Upload the front PNG and drag it onto the front. Scroll to the back and place the back panel on the left, clear of the address and postage area. Skip their Home Value QR.",
    "Upload the list (map Full Name, Address, City, State, Zip Code) and order. Standard mail is fine. For the next card in 3–4 weeks, make a new mailing with the next design and repeat.",
    "Back here: tap “Mark mailed today” and enter the cost. When a homeowner scans and asks for a value, it lands in your Hub inbox and Lofty (tag “Mailer”), and the Hub matches the address to your list. Call within the hour.",
  ];
  return (
    <div className="rounded-xl bg-[#F7F5F1] p-3 ring-1 ring-[#ebe5da]" data-testid="mailer-wp">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="text-sm font-semibold">Wise Pelican options <span className="font-normal text-stone-500">· our designs on 6×9 cards, mailed for you from $1.04 a card</span></span>
        <ChevronDown className={`size-4 text-stone-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-stone-600">Wise Pelican prints and mails 6×9 postcards. The Hub makes a 6×9 version of this design, branded for you, that you upload as your own design. Wise Pelican can't print a different QR code on every card, so the 6×9 card has one QR code for the whole mailing. The homeowner types their address when they reply.</p>
          {campaign && agent && <WpDownloads campaign={campaign} agent={agent} />}
          <table className="w-full text-left text-[13px]">
            <tbody>{WP_PRICES.map(([k, v]) => <tr key={k} className="border-t border-[#ebe5da]"><td className="py-1.5 pr-3">{k}</td><td className="py-1.5 text-right font-semibold whitespace-nowrap">{v}</td></tr>)}</tbody>
          </table>
          <ol className="list-decimal space-y-1.5 pl-5 text-stone-700">{steps.map(t => <li key={t}>{t}</li>)}</ol>
          <p className="text-xs text-stone-500">Brand kit in Wise Pelican: office (773) 985-7153 and {OFFICE_ADDRESS}. Brokerage line: SpaceMatch Inc. · a team of Real Broker, LLC.</p>
          <div className="flex flex-wrap gap-2">
            {households && n > 0 && <button type="button" onClick={() => download(wisePelicanCsv(households), `WisePelican_list_${fileSafe(campaign?.name ?? "mailing")}_${n}_homes.csv`, "text/csv")} className={btnDark} data-testid="mailer-wp-csv"><FileSpreadsheet className="size-4" /> Wise Pelican list (CSV)</button>}
            {onCreateWp && <button type="button" disabled={creating} onClick={onCreateWp} className={btnDark} data-testid="mailer-wp-only">{creating ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />} Wise Pelican only (no list)</button>}
            <a href="https://wisepelican.com" target="_blank" rel="noreferrer" className={btnLight}>Open Wise Pelican</a>
          </div>
          <p className="text-xs text-stone-500">Prices from Wise Pelican's help center as of Oct 26, 2026. Check the checkout total before you pay.</p>
        </div>
      )}
    </div>
  );
}

// Lob print + mail (Michael 2026-11-01): free test proof → request → Zelle → Michael approves → Lob mails.
function LobPanel({ c, total }: { c: Doc<"mailCampaigns">; total: number }) {
  const info = useQuery(api.lob.info);
  const proof = useMutation(api.lob.proof);
  const request = useMutation(api.lob.request);
  const cancel = useMutation(api.lob.cancel);
  const approve = useMutation(api.lob.approve);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(!!c.lobStatus || (c.status === "draft" && !c.wpCode));
  const copyAddr = useCopyAddress(c.agentEmail);
  if (!info) return null;
  if (c.orderId) {
    return (
      <div className="rounded-xl bg-[#FBFAF7] p-3 text-sm ring-1 ring-[#ebe5da]" data-testid="lob-order-note">
        <b>Part of a “Mail it for me” order{c.lobMemo ? ` (${c.lobMemo.replace(/-\d+$/, "")})` : ""}.</b> Proofs, payment and mailing are handled there. <Link to="/seller-lists?tab=mine" className="font-semibold text-[#9C7434] underline">Open my orders</Link>
        {c.lobStatus === "sent" && <span className="ml-1 text-emerald-700">· {c.lobMode === "live" ? `Mailed with Lob: ${c.lobSent} cards` : `Test run: ${c.lobSent} cards`}</span>}
      </div>
    );
  }
  const st = c.lobStatus;
  const amount = c.lobAmount ?? lobAmount(total + 1); // +1 = the agent's own copy
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const run = async (k: string, f: () => Promise<unknown>, ok?: string) => {
    setBusy(k);
    try { await f(); if (ok) toast.success(ok); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };
  const overCap = info.mode === "live" && info.monthCards + total > info.freeMonthly;
  const done = (c.lobSent ?? 0) + (c.lobFailed ?? 0);
  const spin = (k: string, icon: ReactNode) => (busy === k ? <Loader2 className="size-4 animate-spin" /> : icon);
  const confirmBtns = info.canConfirm && (st === "proof" || st === "requested") && (
    <div className="flex flex-wrap gap-2">
      {st === "requested" && <button type="button" disabled={!!busy} onClick={() => { if (confirm(`Mail ${total} cards with Lob now? This can't be undone.`)) run("ok", () => approve({ campaignId: c._id, payment: "paid" }), "Mailing started"); }} className={btnDark} data-testid="lob-approve">{spin("ok", <CheckCircle2 className="size-4" />)} Payment received, mail it</button>}
      <button type="button" disabled={!!busy} onClick={() => { if (confirm(`Mail ${total} cards with Lob now, without charging the agent? This can't be undone.`)) run("waive", () => approve({ campaignId: c._id, payment: "waived" }), "Mailing started"); }} className={st === "requested" ? btnLight : btnDark} data-testid="lob-waive">{spin("waive", <Send className="size-4" />)} Mail without charge</button>
    </div>
  );
  return (
    <div className="rounded-xl bg-[#FBFAF7] ring-1 ring-[#ebe5da]" data-testid="lob-panel">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-3 text-left">
        <Send className="size-5 text-[#9C7434]" />
        <div className="flex-1">
          <div className="font-semibold">Mail it with Lob <span className="ml-1 rounded-full bg-[#0A0A0A] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#D9BC8C]">One click</span></div>
          <div className="text-xs text-stone-500">Lob prints these exact cards and mails them for you. {money(info.price)} a card, print and postage included.</div>
        </div>
        <ChevronDown className={`size-5 text-stone-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-[#f0ebe2] p-3 text-sm">
          {info.mode === "test" && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">Test mode: Lob renders the cards but prints and mails nothing.</div>}
          <div className="grid gap-2 sm:grid-cols-3">
            {[["Cards", `${total} + 1 copy for you`], ["Price per card", money(info.price)], ["Total", money(amount)]].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-white p-2.5 ring-1 ring-[#ebe5da]"><div className="font-['Playfair_Display'] text-xl">{v}</div><div className="text-[11px] text-stone-500">{l}</div></div>
            ))}
          </div>
          <p className="text-xs text-stone-600">6×11 jumbo postcards with each home's own QR code, {LOB_MAIL_LABEL}. Lob prints the address and postage on the back of each card. Nothing is mailed until Michael confirms.</p>
          {c.lobError && st !== "sending" && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 ring-1 ring-red-200" data-testid="lob-error">{c.lobError}</div>}

          {!st && (
            <button type="button" disabled={!!busy} onClick={() => run("proof", () => proof({ campaignId: c._id }))} className={btnDark} data-testid="lob-proof">{spin("proof", <Eye className="size-4" />)} Step 1: See Lob's proof (free)</button>
          )}
          {st === "proofing" && <div className="flex items-center gap-2 text-stone-600" data-testid="lob-proofing"><Loader2 className="size-4 animate-spin" /> Lob is rendering a proof card…</div>}
          {(st === "proof" || st === "requested") && c.lobProofUrl && (
            <div className="space-y-2" data-testid="lob-proof-ready">
              {(c.lobProofThumbs?.length ?? 0) > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {c.lobProofThumbs!.slice(0, 2).map((t, n) => <img key={t} src={t} alt={n ? "Back proof" : "Front proof"} className="w-full rounded-lg ring-1 ring-[#ebe5da]" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />)}
                </div>
              )}
              <a href={c.lobProofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#9C7434]"><Download className="size-4" /> Open Lob's proof (PDF)</a>
              <span className="ml-2 text-xs text-stone-500">The white box on the back is where Lob prints the address and postage.</span>
            </div>
          )}
          {(st === "proof" || !st) && <AgentCopyAddress agentEmail={c.agentEmail} cardPrice={info.price} />}
          {st === "sent" && (c.copyLobId || c.copyError) && <p className="text-xs text-stone-600" data-testid="lob-copy">{c.copyLobId ? `Your copy: mailed to ${c.copyTo}.` : `Your copy wasn't mailed: ${c.copyError}`}</p>}
          {st === "proof" && (
            <div className="flex flex-wrap gap-2">
              {!info.canConfirm && <button type="button" disabled={!!busy || !copyAddr.address} onClick={() => run("req", () => request({ campaignId: c._id }), "Request sent to Michael")} className={btnDark} data-testid="lob-request">{spin("req", <Send className="size-4" />)} Step 2: Request mailing ({money(amount)})</button>}
              <button type="button" disabled={!!busy} onClick={() => run("proof", () => proof({ campaignId: c._id }))} className={btnLight}>{spin("proof", <RotateCw className="size-4" />)} New proof</button>
            </div>
          )}
          {st === "requested" && (
            <div className="space-y-2 rounded-lg bg-white p-3 ring-1 ring-[#ebe5da]" data-testid="lob-requested">
              <p className="font-semibold">Waiting for payment</p>
              <p className="text-stone-600">Send <b>{money(amount)}</b> by Zelle to <b>{info.zelleTo}</b> with memo <b className="font-mono">{c.lobMemo}</b>. Michael mails the cards as soon as it arrives.</p>
              {!info.canConfirm && <PayByCard kind="lob" id={c._id} amount={amount} after="Lob starts mailing as soon as the card goes through." />}
              {!info.canConfirm && <button type="button" disabled={!!busy} onClick={() => run("cancel", () => cancel({ campaignId: c._id }), "Request cancelled")} className="text-xs font-semibold text-red-700">Cancel request</button>}
            </div>
          )}
          {overCap && (st === "proof" || st === "requested") && info.canConfirm && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">Lob's free plan mails up to {info.freeMonthly} cards a month and {info.monthCards} went out this month. This one needs Lob's Startup plan ($260/mo, cards drop to about $0.72) or wait until next month.</p>
          )}
          {confirmBtns}
          {st === "sending" && (
            <div data-testid="lob-sending">
              <div className="mb-1 flex justify-between text-xs text-stone-600"><span className="flex items-center gap-1"><Loader2 className="size-3.5 animate-spin" /> Sending cards to Lob…</span><span>{done} of {total}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-[#efe9df]"><div className="h-full bg-[#9C7434] transition-all" style={{ width: `${Math.round((done / Math.max(1, total)) * 100)}%` }} /></div>
            </div>
          )}
          {st === "sent" && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900 ring-1 ring-emerald-200" data-testid="lob-sent">
              <b>{c.lobMode === "live" ? `Mailed with Lob: ${c.lobSent} cards` : `Test run done: Lob rendered ${c.lobSent} cards (nothing printed)`}</b>
              {c.lobMode === "live" && c.lobExpected && <> · expected in mailboxes by {new Date(`${c.lobExpected}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>}
              {(c.lobFailed ?? 0) > 0 && <div className="text-xs text-red-800">{c.lobFailed === 1 ? "1 address was" : `${c.lobFailed} addresses were`} refused by Lob (not mailed, not charged). They're marked in the list below.</div>}
            </div>
          )}
          {st === "failed" && info.canConfirm && (
            <button type="button" disabled={!!busy} onClick={() => run("retry", () => approve({ campaignId: c._id, payment: c.lobPayment ?? "paid" }), "Retrying")} className={btnDark} data-testid="lob-retry">{spin("retry", <RotateCw className="size-4" />)} Retry the cards that didn't go</button>
          )}
        </div>
      )}
    </div>
  );
}

function CampaignDetail({ id }: { id: Id<"mailCampaigns"> }) {
  const d = useQuery(api.mailers.detail, { campaignId: id });
  const requestPrint = useMutation(api.mailers.requestPrint);
  const setStatus = useMutation(api.mailers.setStatus);
  const remove = useMutation(api.mailers.remove);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "scanned" | "replied" | "warm">("all");
  const [note, setNote] = useState("");
  const [cost, setCost] = useState("");
  const [progress, setProgress] = useState("");
  useEffect(() => { if (d?.campaign.cost !== undefined) setCost(String(d.campaign.cost)); }, [d?.campaign.cost]);
  if (!d) return <div className="mt-4 text-sm text-stone-500">Loading…</div>;
  const c = d.campaign;
  const agent = AGENTS.find(a => a.email.toLowerCase() === c.agentEmail) ?? AGENTS.find(a => a.name === c.agentName);
  const hs = d.households;
  const shown = hs.filter(h => filter === "all" || (filter === "scanned" && h.scans > 0) || (filter === "replied" && h.leadAt) || (filter === "warm" && h.scans > 0 && !h.leadAt));

  async function pdf() {
    if (!agent) return toast.error("This agent isn't on the team list anymore");
    setBusy("pdf");
    try {
      const out = await buildMailers({ design: c.design as DesignId, agent, households: hs, baseUrl: d!.baseUrl, onProgress: (x, t) => setProgress(`Building ${x} of ${t}…`) });
      download(out, `Mailer_${fileSafe(c.name)}_${fileSafe(c.agentName)}_${hs.length}_homes.pdf`, "application/pdf");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); setProgress(""); }
  }
  const run = async (k: string, f: () => Promise<unknown>, ok: string) => {
    setBusy(k);
    try { await f(); toast.success(ok); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };

  return (
    <div className="mt-4 space-y-4 border-t border-[#f0ebe2] pt-4">
      <div className="flex flex-wrap gap-2">
        {hs.length > 0 && <button type="button" disabled={!!busy} onClick={pdf} className={btnDark} data-testid="mailer-pdf">{busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Print PDF</button>}
        {hs.length > 0 && <button type="button" onClick={() => download(mailingListCsv(hs, d.baseUrl), `Mailing_list_${fileSafe(c.name)}.csv`, "text/csv")} className={btnLight}><FileSpreadsheet className="size-4" /> Mailing list (CSV)</button>}
        {c.status === "draft" && hs.length > 0 && (
          <button type="button" disabled={!!busy} onClick={() => run("print", () => requestPrint({ campaignId: id, note: note || undefined }), "Sent to the office for printing")} className={btnLight} data-testid="mailer-send-print"><Printer className="size-4" /> Send to print</button>
        )}
        {c.status !== "mailed" && (
          <button type="button" disabled={!!busy} onClick={() => run("mailed", () => setStatus({ campaignId: id, status: "mailed" }), "Marked as mailed")} className={btnLight}><Mail className="size-4" /> Mark mailed today</button>
        )}
        {progress && <span className="self-center text-sm text-stone-500">{progress}</span>}
      </div>
      {hs.length > 0 && <LobPanel c={c} total={hs.length} />}
      <WisePelicanPanel households={hs} agent={agent} defaultOpen={hs.length === 0} campaign={{ id, name: c.name, design: c.design as DesignId, wpCode: c.wpCode, wpScans: c.wpScans }} />
      {c.status === "draft" && (
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note for the office (optional): drop date, budget, printer…" className={inputCls} />
      )}
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="w-40"><span className="mb-1 block text-xs font-semibold text-stone-600">Total cost ($)</span>
          <input inputMode="decimal" value={cost} onChange={e => setCost(e.target.value)} className={`${inputCls} py-1.5`} placeholder="e.g. 640" /></label>
        <button type="button" onClick={() => run("cost", () => setStatus({ campaignId: id, status: c.status, cost: Number(cost) || 0 }), "Cost saved")} className={btnLight}>Save cost</button>
        <span className="text-xs text-stone-500">Adds cost per reply to the summary.</span>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {([["all", `All ${hs.length}`], ["scanned", `Scanned ${hs.filter(h => h.scans > 0).length}`], ["warm", `Scanned, no reply ${hs.filter(h => h.scans > 0 && !h.leadAt).length}`], ["replied", `Replied ${hs.filter(h => h.leadAt).length}`]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full px-3 py-1.5 ${filter === k ? "bg-[#0A0A0A] text-white" : "bg-[#F7F5F1] ring-1 ring-[#ebe5da]"}`}>{l}</button>
        ))}
      </div>
      {filter === "warm" && <p className="text-xs text-stone-600">These owners looked but didn't ask. Knock, drop a handwritten note or send the next card first.</p>}
      <div className="max-h-[420px] overflow-auto rounded-xl ring-1 ring-[#ebe5da]">
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 bg-[#F7F5F1] text-stone-500"><tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Property</th><th className="px-3 py-2">Scans</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody>
            {shown.slice(0, 500).map(h => (
              <tr key={h._id} className="border-t border-[#f0ebe2]">
                <td className="px-3 py-1.5 font-mono">{h.code}</td>
                <td className="px-3 py-1.5">{h.nameLine}</td>
                <td className="px-3 py-1.5">{h.propAddr}</td>
                <td className="px-3 py-1.5">{h.scans || ""}</td>
                <td className="px-3 py-1.5">{h.leadAt ? <a href={`/inbox?open=${h.submissionId}`} className="font-semibold text-[#9C7434]">Replied ✓</a> : h.scans ? `Scanned ${new Date(h.lastScanAt ?? 0).toLocaleDateString()}` : h.lobError ? <span className="text-red-700" title={h.lobError}>Lob refused: {h.lobError.slice(0, 60)}</span> : h.lobId && c.lobMode === "live" ? "Mailed (Lob)" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length > 500 && <div className="p-2 text-center text-xs text-stone-500">Showing 500 of {shown.length}. Download the CSV for all.</div>}
      </div>
      {(c.status === "draft" || d.isAdmin) && (
        <button type="button" onClick={() => { if (confirm(`Delete “${c.name}” and its ${hs.length} codes? Printed QR codes from it will stop working.`)) run("rm", () => remove({ campaignId: id }), "Deleted"); }} className="inline-flex items-center gap-1 text-xs font-semibold text-red-700"><Trash2 className="size-3.5" /> Delete mailing</button>
      )}
    </div>
  );
}

export function MailersPage() {
  const me = useQuery(api.hubMe.me);
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<"new" | "mine" | "all">(params.get("open") ? "mine" : "new");
  const [agentName, setAgentName] = useState("");
  const [open, setOpen] = useState<string | null>(params.get("open"));
  const [tut, setTut] = useState(() => typeof localStorage !== "undefined" && localStorage.getItem(TUTORIAL_KEY) !== "1");
  const list = useQuery(api.mailers.list, me ? { scope: tab === "all" ? "all" : "mine" } : "skip");
  const canPick = !!me && (me.isStaff || !me.agentName);
  const listParam = params.get("list");
  const groupParam = params.get("group") ?? undefined;
  const preload = useMemo(() => (listParam ? { listId: listParam, group: groupParam } : undefined), [listParam, groupParam]);
  const [path, setPath] = useState<Path | null>(() => (params.get("list") ? "own" : (params.get("path") as Path | null)));
  useEffect(() => { if (!agentName && me) setAgentName(me.agentName ?? "Michael Kang"); }, [me, agentName]);
  useEffect(() => { if (params.get("open")) { setOpen(params.get("open")); setTab(t => (t === "new" ? "mine" : t)); } }, [params]);

  if (me === undefined) return <div className="p-6 text-sm text-stone-500">Loading…</div>;
  const campaigns = list?.campaigns ?? [];
  const totals = campaigns.reduce((a, c) => ({ homes: a.homes + c.households, scanned: a.scanned + c.scannedHouseholds, leads: a.leads + c.leads }), { homes: 0, scanned: 0, leads: 0 });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-['Playfair_Display'] text-3xl">Seller mailers</h1>
          <p className="text-sm text-stone-500">Jumbo postcards branded for you, with a tracked QR code on every card. Replies land in your inbox and Lofty.</p>
        </div>
        {!tut && <button type="button" onClick={() => setTut(true)} className={btnLight}><GraduationCap className="size-4" /> How it works</button>}
      </div>
      {tut && <Tutorial onClose={() => { localStorage.setItem(TUTORIAL_KEY, "1"); setTut(false); }} />}

      <div className="flex flex-wrap gap-2">
        {([["new", "New mailing"], ["mine", `My mailings${tab !== "all" && list ? ` (${campaigns.length})` : ""}`], ...(me.isStaff ? [["all", "All agents"]] : [])] as [typeof tab, string][]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => { setTab(k); if (params.get("open")) setParams({}); }} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? "bg-[#0A0A0A] text-white" : "bg-white ring-1 ring-[#ebe5da]"}`} data-testid={`tab-${k}`}>{l}</button>
        ))}
      </div>

      {tab === "new" ? (
        <div className="space-y-5">
          <Choices path={path} setPath={setPath} />
          {path && <NewMailing key={path} path={path} agentName={agentName} setAgentName={setAgentName} canPick={canPick} onCreated={id => { setTab("mine"); setOpen(id); }} preload={preload} />}
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {[["Homes mailed", totals.homes], ["Homes that scanned", totals.scanned], ["Replies", totals.leads]].map(([l, n]) => (
                <div key={String(l)} className="rounded-xl bg-[#0A0A0A] p-3 text-white"><div className="font-['Playfair_Display'] text-2xl">{String(n)}</div><div className="text-xs text-[#D9BC8C]">{String(l)}</div></div>
              ))}
            </div>
          )}
          {list === undefined ? <div className="text-sm text-stone-500">Loading…</div> : campaigns.length === 0 ? (
            <div className={`${card} text-center`}>
              <QrCode className="mx-auto size-8 text-[#9C7434]" />
              <p className="mt-2 font-semibold">No mailings yet</p>
              <p className="text-sm text-stone-500">Start with “New mailing”. “Mail it for me” does everything for you.</p>
            </div>
          ) : campaigns.map(c => (
            <CampaignRow key={c._id} c={c} open={open === c._id} onToggle={() => setOpen(open === c._id ? null : c._id)} showAgent={tab === "all" || me.isStaff} />
          ))}
          {campaigns.some(c => c.leads > 0) && <p className="flex items-center gap-1 text-xs text-stone-500"><CheckCircle2 className="size-3.5" /> Replies are also in your Hub inbox and in Lofty with the tag “Mailer”.</p>}
        </div>
      )}
    </div>
  );
}
