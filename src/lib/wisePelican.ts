// Wise Pelican 6x9 assets, branded per agent in the browser (Michael, #mailers 2026-10-26).
// Wise Pelican prints 6x9 cards with a 0.25in white border: the front upload is 8.5 x 5.5 in
// (PNG 2550 x 1650 at 300 dpi); our optional back panel (4 x 5 in) goes left of their address block.
// Base JPGs + zones come from skills/seller_mailers/scripts/build_wp_fronts.py (public/mailers/wp/).
// One QR per mailing → /v/<wpCode>; the landing page asks for the property address.
import QRCode from "qrcode";
import { AGENTS, agentSlug } from "@/lib/agents";
import { MAIL_OFFICE, MAIL_PHONE, type DesignId, type MailerAgent, licLine, mailBrokerage } from "@/lib/mailerBuilder";

export type WpKind = DesignId | "back";

type TextZone = {
  type: "text"; tpl: string; align: "left" | "right"; maxw: number; x: number; base: number; size: number;
  family: "pf" | "mada"; weight: number; italic: boolean; color: string; spacing: number; upper: boolean;
};
type QrZone = { type: "qr"; x: number; y: number; w: number; h: number };
type PhotoZone = { type: "photo"; x: number; y: number; w: number; h: number };
type Page = { w: number; h: number; zones: (TextZone | QrZone | PhotoZone)[] };

let zonesCache: Promise<Record<WpKind, Page>> | null = null;
let agentsCache: Promise<Record<string, { name: string; lic: string }>> | null = null;
let fontsReady: Promise<void> | null = null;

const FONTS: [string, string, string, string][] = [
  ["WpPF", "Playfair-400", "400", "normal"], ["WpPF", "Playfair-400i", "400", "italic"],
  ["WpMada", "Mada-300", "300", "normal"], ["WpMada", "Mada-400", "400", "normal"],
  ["WpMada", "Mada-500", "500", "normal"], ["WpMada", "Mada-600", "600", "normal"],
];

function loadFonts() {
  fontsReady ??= Promise.all(FONTS.map(async ([fam, file, weight, style]) => {
    const f = new FontFace(fam, `url(/mailers/fonts/${file}.ttf)`, { weight, style });
    await f.load();
    document.fonts.add(f);
  })).then(() => undefined);
  return fontsReady;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  if (/^https?:/.test(url)) img.crossOrigin = "anonymous"; // uploaded headshots (Convex storage) on the canvas
  img.src = url;
  await img.decode();
  return img;
}

/** Inserts a pHYs chunk (300 dpi) after IHDR so Wise Pelican's editor sizes the PNG at 8.5 x 5.5 in. */
async function withDpi(blob: Blob, dpi = 300): Promise<Blob> {
  const src = new Uint8Array(await blob.arrayBuffer());
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
  let c = 0xffffffff;
  for (let i = 4; i < 17; i++) {
    c ^= chunk[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  dv.setUint32(17, (c ^ 0xffffffff) >>> 0);
  const at = 8 + 25; // signature + IHDR (4 len + 4 type + 13 data + 4 crc)
  const out = new Uint8Array(src.length + 21);
  out.set(src.subarray(0, at)); out.set(chunk, at); out.set(src.subarray(at), at + 21);
  return new Blob([out], { type: "image/png" });
}

export type WpInput = { kind: WpKind; agent: MailerAgent; code: string; baseUrl: string };

/** Agent-branded Wise Pelican PNG: 2550x1650 front (8.5x5.5 in) or 1200x1500 back panel (4x5 in). */
export async function buildWisePelicanPng(i: WpInput): Promise<Blob> {
  zonesCache ??= fetch("/mailers/wp/zones.json").then(r => r.json());
  agentsCache ??= fetch("/mailers/agents.json").then(r => r.json());
  const slug = agentSlug(i.agent.name);
  const [zones, agents, base] = await Promise.all([zonesCache, agentsCache, loadImage(`/mailers/wp/${i.kind}.jpg`), loadFonts()]);
  const pg = zones[i.kind];
  // Agents added on the Team roster screen: license # + uploaded headshot.
  const live = AGENTS.find(a => agentSlug(a.name) === slug);
  const info = agents[slug] ?? (live?.added ? { name: live.name, lic: live.lic ?? "" } : undefined);
  const photoUrl = live?.photo ?? (agents[slug] ? `/mailers/agents/${slug}.png` : null);
  const photo = photoUrl && pg.zones.some(z => z.type === "photo") ? await loadImage(photoUrl).catch(() => null) : null;

  const canvas = document.createElement("canvas");
  canvas.width = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const S = canvas.width / pg.w;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw images");
  ctx.drawImage(base, 0, 0);

  const url = `${i.baseUrl}${i.code}`;
  const vals: Record<string, string> = {
    name: i.agent.name, phone: i.agent.phone, email: i.agent.email, code: i.code,
    url: url.replace(/^https?:\/\//, ""),
    licLine: licLine(i.agent.name, info?.lic ?? ""),
    brokerName: mailBrokerage(), office: MAIL_OFFICE, officePhone: MAIL_PHONE,
  };

  for (const z of pg.zones) {
    if (z.type === "qr") {
      const q = QRCode.create(url, { errorCorrectionLevel: "M" });
      const n = q.modules.size;
      const x0 = z.x * S, y0 = z.y * S, m = (z.w * S) / n;
      ctx.fillStyle = "#0A0A0A";
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (!q.modules.data[y * n + x]) continue;
          const l = Math.round(x0 + x * m), t = Math.round(y0 + y * m);
          ctx.fillRect(l, t, Math.round(x0 + (x + 1) * m) - l, Math.round(y0 + (y + 1) * m) - t);
        }
      }
    } else if (z.type === "photo") {
      if (photo) ctx.drawImage(photo, z.x * S, z.y * S, z.w * S, z.h * S);
    } else {
      let t = z.tpl.replace(/\{(\w+)\}/g, (_: string, k: string) => vals[k] ?? "").trim();
      if (!t) continue;
      if (z.upper) t = t.toUpperCase();
      const fam = z.family === "pf" ? "WpPF" : "WpMada";
      let size = z.size;
      const setFont = (sz: number) => { ctx.font = `${z.italic ? "italic " : ""}${z.weight} ${sz * S}px ${fam}`; };
      const sp = (sz: number) => z.spacing * (sz / z.size) * S;
      const width = (s: string, sz: number) => { setFont(sz); return ctx.measureText(s).width + sp(sz) * s.length; };
      const max = z.maxw * S;
      while (width(t, size) > max && size > z.size * 0.72) size -= 0.25;
      while (width(t, size) > max && t.length > 4) t = `${t.slice(0, -2).trimEnd()}…`;
      setFont(size);
      ctx.fillStyle = z.color;
      ctx.textBaseline = "alphabetic";
      const space = sp(size);
      let x = z.align === "right" ? z.x * S - width(t, size) : z.x * S; // CSS letter-spacing also trails the last glyph
      setFont(size);
      const y = z.base * S;
      if (!space) ctx.fillText(t, x, y);
      else for (const ch of t) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + space; }
    }
  }
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Couldn't create the image");
  return withDpi(blob);
}
