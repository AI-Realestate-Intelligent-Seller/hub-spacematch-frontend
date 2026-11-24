// Renders the SpaceMatch Coach blocks into a simple, AI-friendly PDF (real text, no images).
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { Block } from "./musePack";

const W = 612, H = 792, M = 54;
const INK = rgb(0.04, 0.04, 0.04), GOLD = rgb(0.61, 0.45, 0.2), MUTED = rgb(0.4, 0.38, 0.35);

// Standard fonts only speak WinAnsi: map the common extras, drop the rest.
const WIN_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const MAP: Record<string, string> = { "→": "->", "←": "<-", "×": "x", "≥": ">=", "≤": "<=", "★": "*", "✓": "v", "›": ">", "≈": "~", "−": "-", "\u00a0": " ", "\u2009": " ", "\u202f": " " };
export function winAnsi(s: string) {
  let out = "";
  for (const ch of s) {
    if (MAP[ch] !== undefined) out += MAP[ch];
    else if ((ch.codePointAt(0) ?? 0) < 256 || WIN_EXTRA.includes(ch)) out += ch;
  }
  return out.replace(/[\u0000-\u0008\u000b-\u001f]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= width) line = test;
      else {
        if (line) lines.push(line);
        // very long tokens (URLs): hard-break
        let w = word;
        while (font.widthOfTextAtSize(w, size) > width) {
          let i = w.length;
          while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
          lines.push(w.slice(0, i));
          w = w.slice(i);
        }
        line = w;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function packToPdf(blocks: Block[], footer: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(winAnsi(blocks.find(b => b.k === "title")?.t ?? "SpaceMatch Coach"));
  doc.setAuthor("SpaceMatch Inc.");
  doc.setSubject("SpaceMatch playbooks, scripts and situations for an AI coach");
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const newPage = () => { page = doc.addPage([W, H]); y = H - M; };
  const ensure = (h: number) => { if (y - h < M + 20) newPage(); };

  const draw = (text: string, o: { font: PDFFont; size: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number; lead?: number; bullet?: string }) => {
    const indent = o.indent ?? 0, lead = o.lead ?? o.size * 1.35;
    const lines = wrap(winAnsi(text), o.font, o.size, W - 2 * M - indent);
    ensure(Math.min(lines.length, 3) * lead + (o.gap ?? 0));
    y -= o.gap ?? 0;
    lines.forEach((ln, i) => {
      ensure(lead);
      y -= lead;
      if (i === 0 && o.bullet) page.drawText(o.bullet, { x: M + indent - 12, y, size: o.size, font: o.bullet === "•" ? reg : bold, color: GOLD });
      page.drawText(ln, { x: M + indent, y, size: o.size, font: o.font, color: o.color ?? INK });
    });
  };

  for (const b of blocks) {
    if (b.k === "title") {
      page.drawRectangle({ x: 0, y: H - 120, width: W, height: 120, color: INK });
      page.drawText(winAnsi(b.t), { x: M, y: H - 78, size: 30, font: bold, color: rgb(1, 1, 1) });
      page.drawRectangle({ x: M, y: H - 92, width: 60, height: 3, color: GOLD });
      y = H - 140;
    } else if (b.k === "h1") {
      if (y < H - 200) newPage();
      draw(b.t, { font: bold, size: 18, gap: 10 });
      page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 1, color: GOLD });
      y -= 10;
    } else if (b.k === "h2") draw(b.t, { font: bold, size: 13.5, gap: 12, color: GOLD });
    else if (b.k === "h3") draw(b.t, { font: bold, size: 11.5, gap: 8 });
    else if (b.k === "p") draw(b.t, { font: reg, size: 10.5, gap: 3, color: b.t.startsWith("Hub:") ? MUTED : INK });
    else if (b.k === "li") draw(b.t, { font: reg, size: 10.5, gap: 2, indent: 14, bullet: "•" });
    else if (b.k === "num") draw(b.t, { font: reg, size: 10.5, gap: 2, indent: 16, bullet: `${b.n}.` });
  }

  const pages = doc.getPages();
  const f = winAnsi(footer);
  pages.forEach((pg, i) => {
    pg.drawText(f, { x: M, y: 28, size: 8, font: reg, color: MUTED });
    const n = `${i + 1} / ${pages.length}`;
    pg.drawText(n, { x: W - M - reg.widthOfTextAtSize(n, 8), y: 28, size: 8, font: reg, color: MUTED });
  });
  return doc.save();
}
