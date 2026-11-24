// Agent-branded client guides (Buyer + Seller), built in the browser like the listing decks.
// Base PDFs: public/guides/{cb,real}/{buyer,seller}.pdf (US Letter, 612x792 pt). Page 1 = cover,
// page 2 = "Your agent" placeholder, last page = back cover. Agent pages: public/guides/agents/<slug>.pdf.
// Rebuild with skills/spacematch_listing_presentation/scripts/build_hub_guides.py — stamp zones below must match it.
import { agentSlug } from "@/lib/agents";
import { hasAgentPage, type Edition } from "@/lib/deckBuilder";
import { OFFICE_ADDRESS } from "../../convex/officeDefs";

export type GuideKind = "buyer" | "seller";

export const GUIDES: { kind: GuideKind; title: string; pages: number; when: string; note: string }[] = [
  { kind: "buyer", title: "Home Buyer's Guide", pages: 17, when: "Send after the first call or bring to the buyer consultation", note: "Buyer agreement, pre-approval, loan options, real costs, offers, attorney review, closing and a wants-vs-needs worksheet." },
  { kind: "seller", title: "Home Seller's Guide", pages: 17, when: "Send with the pre-listing package or leave behind", note: "Pricing, prep checklist, the SpaceMatch Listing Standard, 11-step launch, Seller Portal, offers, costs and disclosures." },
];

export type GuideInput = { kind: GuideKind; edition: Edition; agent: { name: string; email: string; phone: string }; client?: string };

export function guideFileName(i: GuideInput) {
  const t = i.kind === "buyer" ? "BuyerGuide" : "SellerGuide";
  const who = (i.client || i.agent.name).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `SpaceMatch_${t}_${who}.pdf`;
}

type Loader = (url: string) => Promise<Uint8Array>;
const fetchBytes: Loader = async url => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Couldn't load ${url} (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
};

const W = 612;
const X = 48; // 64px margin

export async function buildGuide(i: GuideInput, load: Loader = fetchBytes): Promise<Uint8Array> {
  const { PDFDocument, rgb, pushGraphicsState, popGraphicsState, setCharacterSpacing } = await import("pdf-lib");
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const slug = agentSlug(i.agent.name);
  const [base, f300, f400, f500, agentPdf] = await Promise.all([
    load(`/guides/${i.edition}/${i.kind}.pdf`),
    load("/decks/fonts/Mada-300.ttf"),
    load("/decks/fonts/Mada-400.ttf"),
    load("/decks/fonts/Mada-500.ttf"),
    hasAgentPage(i.agent.name) ? load(`/guides/agents/${slug}.pdf`) : Promise.resolve(null),
  ]);
  const doc = await PDFDocument.load(base);
  doc.registerFontkit(fontkit);
  const light = await doc.embedFont(f300, { subset: true });
  const reg = await doc.embedFont(f400, { subset: true });
  const med = await doc.embedFont(f500, { subset: true });
  const white = rgb(1, 1, 1);
  const ink = rgb(0.04, 0.04, 0.04);
  const gold = rgb(0.612, 0.455, 0.204);
  const sand = rgb(0.851, 0.737, 0.549);
  type Font = typeof reg;
  type P = ReturnType<typeof doc.getPage>;
  const width = (s: string, size: number, font: Font, sp = 0) => font.widthOfTextAtSize(s, size) + sp * s.length;
  const text = (p: P, s: string, x: number, y: number, size: number, o: { font?: Font; color?: ReturnType<typeof rgb>; opacity?: number; spacing?: number } = {}) => {
    if (!s) return;
    if (o.spacing) p.pushOperators(pushGraphicsState(), setCharacterSpacing(o.spacing));
    p.drawText(s, { x, y, size, font: o.font ?? reg, color: o.color ?? white, opacity: o.opacity ?? 1 });
    if (o.spacing) p.pushOperators(setCharacterSpacing(0), popGraphicsState());
  };
  // shrink a line until it fits the text column
  const fit = (s: string, size: number, font: Font, max: number, sp = 0) => {
    let z = size;
    while (z > 6 && width(s, z, font, sp * (z / size)) > max) z -= 0.25;
    return z;
  };
  const colW = W - 2 * X;
  const client = i.client?.trim() ?? "";

  // 1 · Cover — "Prepared for" + agent line in the black band
  const cover = doc.getPage(0);
  text(cover, "PREPARED FOR", X, 104, 8, { color: sand, spacing: 2.2, font: med });
  if (client) {
    const z = fit(client, 20, light, colW);
    text(cover, client, X, 80, z, { font: light });
  } else {
    cover.drawLine({ start: { x: X, y: 80 }, end: { x: X + 260, y: 80 }, thickness: 0.75, color: white, opacity: 0.5 });
  }
  const agentLine = `${i.agent.name}  ·  ${i.agent.phone}  ·  ${i.agent.email}`;
  text(cover, "YOUR AGENT", X, 54, 7.5, { color: sand, spacing: 2, font: med });
  const xa = X + width("YOUR AGENT", 7.5, med, 2) + 12;
  text(cover, agentLine, xa, 54, fit(agentLine, 10, reg, W - X - xa), { opacity: 0.85 });

  // 2 · "Your agent" page
  if (agentPdf) {
    const src = await PDFDocument.load(agentPdf);
    const [pg] = await doc.copyPages(src, [0]);
    doc.removePage(1);
    doc.insertPage(1, pg);
  } else {
    const p = doc.getPage(1);
    text(p, "YOUR AGENT", X, 725, 8, { color: gold, spacing: 2.4, font: med });
    p.drawLine({ start: { x: X, y: 716 }, end: { x: X + 30, y: 716 }, thickness: 1.5, color: gold });
    text(p, i.agent.name, X, 650, fit(i.agent.name, 34, light, colW), { color: ink, font: light });
    text(p, "BROKER  ·  SPACEMATCH INC.", X, 624, 8.5, { color: gold, spacing: 1.8, font: med });
    const rows: [string, string][] = [["Call or text", i.agent.phone], ["Email", i.agent.email], ["Office", OFFICE_ADDRESS]];
    rows.forEach(([k, v], n) => {
      const y = 570 - n * 52;
      p.drawLine({ start: { x: X, y: y + 22 }, end: { x: W - X, y: y + 22 }, thickness: 0.5, color: ink, opacity: 0.15 });
      text(p, k, X, y + 6, 8.5, { color: ink, opacity: 0.55 });
      text(p, v, X, y - 12, 14, { color: ink });
    });
  }

  // Last page — back cover contact block (below the CTA)
  const last = doc.getPage(doc.getPageCount() - 1);
  text(last, i.agent.name, X, 350, fit(i.agent.name, 26, light, colW), { font: light });
  text(last, i.agent.phone, X, 318, 15, { opacity: 0.9 });
  text(last, i.agent.email, X, 297, fit(i.agent.email, 15, reg, colW), { opacity: 0.9 });

  const title = GUIDES.find(g => g.kind === i.kind)!.title;
  doc.setTitle(`${title} — ${i.agent.name}, SpaceMatch Inc.`);
  doc.setAuthor(`${i.agent.name} · SpaceMatch Inc.`);
  return await doc.save();
}
