// Agent-branded listing presentations, built in the browser.
// Base PDFs (public/decks/{cb,real}/{pre,appt,full}.pdf) have blank agent slots:
// page 1 = cover, page 2 = "Your agent" placeholder, last page = closing.
// Rebuild them with skills/spacematch_listing_presentation/scripts/build_hub_decks.py.
import { OFFICE_ADDRESS } from "../../convex/officeDefs";
import { agentSlug } from "@/lib/agents";

export type DeckKind = "pre" | "appt" | "full";
export type Edition = "cb" | "real";

export const DECKS: { kind: DeckKind; title: string; pages: number; when: string; note: string }[] = [
  { kind: "pre", title: "Pre-Listing Package", pages: 18, when: "Email 24–48 hours before the appointment", note: "Who we are and how we launch homes. No pricing or fees — those you cover in person." },
  { kind: "appt", title: "Appointment Deck", pages: 36, when: "Present at the listing appointment", note: "Discovery, pricing, launch plan, net sheet and next steps. Skips what the pre-listing package already covered." },
  { kind: "full", title: "Full Master Deck", pages: 45, when: "Everything in one file", note: "All slides, for sellers who didn't get the pre-listing package." },
];

// Agents with a pre-rendered "Your agent" slide (photo + bio). Others get a simple contact slide.
const AGENT_PAGES = new Set([
  "michael-kang", "angel-zhang", "brandon-banks", "brendan-murphy", "cynthia-beltran", "eduardo-rodriguez",
  "emilie-rose-danno", "jennifer-guevara", "matthew-davila", "newell-broadway",
  "rob-robinson", "sabina-hodzic", "sein-shin", "sergio-monjane", "shagha-mughtadai",
  "shan-keter-white-henderson", "susan-strange", "tarik-hage", "thalia-mena", "rada-chapkis",
]);
export const hasAgentPage = (name: string) => AGENT_PAGES.has(agentSlug(name));

// SpaceMatch moves to Real Broker, LLC on Nov 10, 2026 (moved from Oct 29 by Michael, 2026-10-26) — no Coldwell Banker on materials from then on.
export const REAL_START = "2026-11-09"; // flipped early: Michael moved to Real Nov 9 2026 9:10 PM CT
export const chicagoToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
export const realOnly = () => chicagoToday() >= REAL_START;
export const defaultEdition = (): Edition => (realOnly() ? "real" : "cb");

export type DeckInput = {
  kind: DeckKind;
  edition: Edition;
  agent: { name: string; email: string; phone: string };
  seller?: string;
  address?: string;
  date?: string; // YYYY-MM-DD
};

const OFFICE = `spacematchinc.com  ·  ${OFFICE_ADDRESS}`;
const BROKER = { real: "SpaceMatch Inc.  ·  a team of Real Broker, LLC", cb: "SpaceMatch Inc.  ·  Coldwell Banker Realty" };

export function prettyDate(iso?: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function deckFileName(i: DeckInput) {
  const t = DECKS.find(d => d.kind === i.kind)!.title.replace(/[^A-Za-z]+/g, "");
  const who = (i.address || i.seller || i.agent.name).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `SpaceMatch_${t}_${who}.pdf`;
}

async function bytes(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Couldn't load ${url} (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

export async function buildDeck(i: DeckInput): Promise<Uint8Array> {
  const { PDFDocument, rgb, pushGraphicsState, popGraphicsState, setCharacterSpacing } = await import("pdf-lib");
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const slug = agentSlug(i.agent.name);
  const [base, f300, f400, agentPdf] = await Promise.all([
    bytes(`/decks/${i.edition}/${i.kind}.pdf`),
    bytes("/decks/fonts/Mada-300.ttf"),
    bytes("/decks/fonts/Mada-400.ttf"),
    AGENT_PAGES.has(slug) ? bytes(`/decks/agents/${slug}.pdf`) : Promise.resolve(null),
  ]);
  const doc = await PDFDocument.load(base);
  doc.registerFontkit(fontkit);
  const light = await doc.embedFont(f300, { subset: true });
  const reg = await doc.embedFont(f400, { subset: true });
  const white = rgb(1, 1, 1);
  const ink = rgb(0.04, 0.04, 0.04);
  const bronze = rgb(0.612, 0.455, 0.204);

  type P = ReturnType<typeof doc.getPage>;
  const text = (p: P, s: string, x: number, y: number, size: number, o: { font?: typeof reg; color?: ReturnType<typeof rgb>; opacity?: number; spacing?: number } = {}) => {
    if (!s) return;
    if (o.spacing) p.pushOperators(pushGraphicsState(), setCharacterSpacing(o.spacing));
    p.drawText(s, { x, y, size, font: o.font ?? reg, color: o.color ?? white, opacity: o.opacity ?? 1 });
    if (o.spacing) p.pushOperators(setCharacterSpacing(0), popGraphicsState());
  };
  const width = (s: string, size: number, font = reg, spacing = 0) => font.widthOfTextAtSize(s, size) + spacing * s.length;

  // 1 · Cover: "Prepared for" line + agent line
  const cover = doc.getPage(0);
  let x = 97.5;
  const y1 = 105, s1 = 21;
  const fields: [string, number][] = [[i.seller?.trim() || "", 270], [i.address?.trim() || "", 315]];
  if (i.kind !== "pre") fields.push([prettyDate(i.date), 150]);
  text(cover, "Prepared for", x, y1, s1, { opacity: 0.9 });
  x += width("Prepared for", s1) + 10;
  fields.forEach(([v, blankW], k) => {
    if (k > 0) { text(cover, "·", x, y1, s1, { opacity: 0.9 }); x += width("·", s1) + 10; }
    if (v) { text(cover, v, x, y1, s1, { opacity: 0.95 }); x += width(v, s1) + 10; }
    else { cover.drawLine({ start: { x, y: y1 - 3 }, end: { x: x + blankW, y: y1 - 3 }, thickness: 1, color: white, opacity: 0.5 }); x += blankW + 10; }
  });
  const agentLine = `PRESENTED BY ${i.agent.name}  ·  ${i.agent.phone}  ·  ${i.agent.email}`.toUpperCase();
  text(cover, agentLine, 97.5, 52, 15, { opacity: 0.7, spacing: 2.6 });

  // 2 · "Your agent" slide
  if (agentPdf) {
    const src = await PDFDocument.load(agentPdf);
    const [pg] = await doc.copyPages(src, [0]);
    doc.removePage(1);
    doc.insertPage(1, pg);
  } else {
    const p = doc.getPage(1);
    text(p, "YOUR AGENT", 97.5, 690, 18, { color: ink, opacity: 0.72, spacing: 5.8 });
    p.drawLine({ start: { x: 97.5, y: 676 }, end: { x: 156, y: 676 }, thickness: 2.25, color: bronze });
    text(p, i.agent.name.toUpperCase(), 97.5, 560, 60, { font: light, color: ink, spacing: 3 });
    text(p, "BROKER  ·  SPACEMATCH INC.", 97.5, 515, 17, { color: bronze, spacing: 4 });
    text(p, i.agent.phone, 97.5, 420, 30, { font: light, color: ink });
    text(p, i.agent.email, 97.5, 375, 30, { font: light, color: ink });
    text(p, OFFICE, 97.5, 330, 20, { color: ink, opacity: 0.72 });
    text(p, "SPACEMATCHINC.COM", 97.5, 42, 15, { color: ink, opacity: 0.52, spacing: 3.3 });
  }

  // Last page: agent contact
  const last = doc.getPage(doc.getPageCount() - 1);
  if (i.kind === "pre") {
    const s = `${i.agent.name}  ·  ${i.agent.phone}  ·  ${i.agent.email}`;
    text(last, s, 1342.5 - width(s, 17), 118, 17, { color: ink, opacity: 0.8 });
  } else {
    const lines: [string, number, number][] = [
      [i.agent.name, 26, 0.95], [i.agent.phone, 21, 0.9], [i.agent.email, 21, 0.9], [OFFICE, 21, 0.85], [BROKER[i.edition], 21, 0.75],
    ];
    lines.forEach(([s, size, op], k) => text(last, s, 97.5, 272 - k * 44, size, { opacity: op, font: reg }));
  }

  doc.setTitle(`${DECKS.find(d => d.kind === i.kind)!.title} — ${i.agent.name}, SpaceMatch Inc.`);
  doc.setAuthor(`${i.agent.name} · SpaceMatch Inc.`);
  return await doc.save();
}
