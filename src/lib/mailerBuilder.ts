// Agent-branded seller mailers (6x11 jumbo postcards, 0.125in bleed), built in the browser.
// Base PDFs + zones come from skills/seller_mailers/scripts/build_hub_mailers.py (public/mailers/).
// Each household = 2 pages (front, back): base page embedded once, then agent + household
// text, a vector QR code (→ /v/:code) and the agent's photo are stamped on top.
// qrcode's pure core (no fs/canvas renderers): the same file works in Vite and in Convex's Node bundle (Lob sender).
import { OFFICE_ADDRESS } from "../../convex/officeDefs";
// @ts-expect-error no types for the internal path; API = qrcode's create()
import * as QRCore from "qrcode/lib/core/qrcode.js";
type QrCreate = (text: string, opts: { errorCorrectionLevel: string }) => { modules: { size: number; data: Uint8Array } };
const QRCode = { create: ((QRCore as { create?: QrCreate }).create ?? (QRCore as { default: { create: QrCreate } }).default.create) as QrCreate };
import { AGENTS, agentSlug } from "../../convex/agentsData"; // relative: Convex (Lob sender) imports this file too

// Office on mailers: Evanston (convex/officeDefs.ts) since 2026-11-12; phone (773) 985-7153 [Michael, 2026-10-26].
export const MAIL_OFFICE = OFFICE_ADDRESS;
export const MAIL_PHONE = "(773) 985-7153";
/** No Real Broker wording before Nov 10, 2026 (Chicago date of the build); Real Broker line from then on. */
export function mailBrokerage() {
  const chicago = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  return chicago >= "2026-11-09" ? "SpaceMatch Inc. is a team of Real Broker, LLC" : "SpaceMatch Inc.";
}

export type DesignId = "staging" | "value" | "launch" | "team" | "buyers" | "netsheet" | "market" | "spring"
  | "fixorsell" | "movetiming" | "rightsize" | "landlord" | "inherited"
  | "soldashland" | "soldoverlook";

/** `offer` = call-to-action cards (2026-10-31): one concrete free offer with a big gold CTA; the /v/:code page uses the same ask. */
export const DESIGNS: { id: DesignId; title: string; problem: string; best: string; offer?: string }[] = [
  {
    id: "staging",
    title: "Same home. Sells like a different one.",
    problem: "Sellers dread the prep: repainting, decluttering, renting furniture.",
    best: "Older or vacant homes, owners who've been there 7+ years. Strong first card.",
  },
  {
    id: "value",
    title: "Your home has a number. Do you know it?",
    problem: "Owners don't know what their home is worth, and don't trust website estimates.",
    best: "Any farm. Best response driver: a private value range + net sheet.",
  },
  {
    id: "launch",
    title: "Most homes get listed. Ours get launched.",
    problem: "Sellers fear an agent who lists and disappears.",
    best: "Move-up and higher-price areas where sellers are interviewing agents.",
  },
  {
    id: "team",
    title: "Your agent, backed by a whole team.",
    problem: "Choosing who to trust. Leads with 115 five-star reviews.",
    best: "Newer farms where people don't know you yet. Great 3rd or 4th touch.",
  },
  {
    id: "buyers",
    title: "Is there already a buyer for your home?",
    problem: "Owners who'd sell for the right buyer, but don't want to prep and list to find out.",
    best: "Tight-inventory farms and long-time owners. Follow up every reply with your best buyer matches.",
    offer: "Private buyer match",
  },
  {
    id: "netsheet",
    title: "Before you sell, know what you'll walk away with.",
    problem: "Not knowing the bottom line after the mortgage, taxes and costs.",
    best: "Move-down and empty-nester farms, high-equity owners planning their next home.",
    offer: "Free net sheet",
  },
  {
    id: "market",
    title: "What did the homes near you sell for?",
    problem: "Curiosity about the neighbors' sales. The easiest yes in real estate mail.",
    best: "Any farm, any month, especially right after a nearby sale. Great repeat card.",
    offer: "Free neighborhood sales report",
  },
  {
    id: "spring",
    title: "Selling in spring? Winter is when it's won.",
    problem: "Sellers who wait until spring to start and list late, tired and unprepared.",
    best: "Mail December to February. Owners planning a spring move.",
    offer: "Free spring game plan",
  },
  {
    id: "fixorsell",
    title: "Fix it up. Or sell it as it is?",
    problem: "Spending on improvements without knowing whether the work makes sense before a sale.",
    best: "Homes needing updates. Compare condition, prep options and estimated net before spending.",
    offer: "Fix-or-sell plan",
  },
  {
    id: "movetiming",
    title: "Sell first? Buy first? Let's map it.",
    problem: "Needing the next home without a clear plan for selling this one.",
    best: "Owners planning a linked sale and purchase. Timing and financing options, not financing promises.",
    offer: "Move-timing plan",
  },
  {
    id: "rightsize",
    title: "Less house. More room for what's next.",
    problem: "The home no longer fits, but the cost and effort of moving feel unclear.",
    best: "Owners considering a smaller or lower-upkeep home. No assumptions about age or family.",
    offer: "Next-chapter plan",
  },
  {
    id: "landlord",
    title: "Still want to be the landlord?",
    problem: "Rental owners weighing another renewal or repair against selling.",
    best: "Verified rental-owner lists, using the owner's mailing address. Discuss lease and tax questions with advisers.",
    offer: "Rental-exit review",
  },
  {
    id: "inherited",
    title: "Inherited a home? Start with one clear plan.",
    problem: "Not knowing where to start with the property side of an inherited home.",
    best: "Use thoughtfully with appropriate owner outreach. The question never claims the recipient inherited a home.",
    offer: "Property next-steps checklist",
  },
  {
    id: "soldashland",
    title: "Team sale: 2743 N Ashland Avenue · $1,015,000",
    problem: "Generic claims do not show homeowners an actual seller-side team result.",
    best: "Lincoln Park and nearby condo owners. Verified July 21, 2026 closing; Michael Kang listed the property at a prior brokerage. Past results are not a price forecast.",
    offer: "Selling plan · verified team sale",
  },
  {
    id: "soldoverlook",
    title: "Team sale: 15840 Overlook Lane · $453,000",
    problem: "Homeowners want evidence of real representation, not sample sales or invented outcomes.",
    best: "Huntley-area farming. Verified July 20, 2026 closing; Michael Kang and Sabina Hodzic listed at a prior brokerage. Historical result, not a current listing.",
    offer: "Selling plan · verified team sale",
  },
];

// Suggested order for a farm: one card about every 3 weeks, mixing story cards with offer (CTA) cards.
// "spring" is seasonal: swap it in December to February.
export const SEQUENCE: DesignId[] = ["value", "staging", "market", "launch", "netsheet", "team", "buyers", "spring"];

export type Household = {
  code: string;
  nameLine: string; // "Jordan & Taylor Sample" or "Current Homeowner"
  who: string; // "Jordan & Taylor" or "the homeowner"
  mailAddr: string;
  mailCity: string;
  mailState: string;
  mailZip: string;
  propAddr: string;
  propShort: string;
};

export type MailerAgent = { name: string; email: string; phone: string };

type TextZone = {
  type: "text"; tpl: string; align: "left" | "right"; x: number; y: number; size: number; maxw: number;
  font: "pf" | "pf-i" | "m300" | "m400" | "m500" | "m600"; color: [number, number, number]; spacing: number; upper: boolean;
};
type QrZone = { type: "qr"; x: number; y: number; w: number; h: number };
type PhotoZone = { type: "photo"; x: number; y: number; w: number; h: number };
type Zone = TextZone | QrZone | PhotoZone;

const TEAM_LIC = "475.163662";

export const SAMPLE_HOUSEHOLD: Household = {
  code: "SAMPLE", nameLine: "Jordan & Taylor Sample", who: "Jordan & Taylor", mailAddr: "1234 W Sample St",
  mailCity: "Chicago", mailState: "IL", mailZip: "60614", propAddr: "1234 W Sample St, Chicago, IL 60614", propShort: "1234 W Sample St",
};

/** Loads a file under public/ ("/mailers/value.pdf"). Browser: same-origin fetch. Convex: absolute Hub URL. */
export type AssetLoader = (path: string) => Promise<Uint8Array>;
const fetchLoader: AssetLoader = async url => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Couldn't load ${url} (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
};

type Meta = { zones: Record<DesignId, Zone[][]>; agents: Record<string, { name: string; lic: string }> };
let metaCache: Promise<Meta> | null = null;
function meta(load: AssetLoader) {
  const json = async (p: string) => JSON.parse(new TextDecoder().decode(await load(p)));
  metaCache ??= Promise.all([json("/mailers/zones.json"), json("/mailers/agents.json")]).then(([zones, agents]) => ({ zones, agents }));
  metaCache.catch(() => { metaCache = null; });
  return metaCache;
}

// Lob prints the recipient address block itself (white box, 4 x 2.375 in, bottom right of the back),
// so Lob cards skip the Hub's own address lines.
const ADDRESS_TPLS = new Set(["{nameLine}", "{addr1}", "{addr2}"]);

export function licLine(name: string, lic: string) {
  if (!lic) return `${name}, broker · Team leader Michael Kang, Illinois licensed broker #${TEAM_LIC}.`;
  if (lic.startsWith(TEAM_LIC)) return name === "Michael Kang"
    ? `Michael Kang, Illinois licensed broker #${TEAM_LIC}, team leader.`
    : `${name}, broker · Team leader Michael Kang, Illinois licensed broker #${TEAM_LIC}.`;
  return `${name}, Illinois licensed broker #${lic}. Team leader Michael Kang, #${TEAM_LIC}.`;
}

// QR modules → one SVG path (horizontal runs), drawn as vector so it prints sharp at any size.
function qrPath(url: string): { d: string; n: number } {
  const q = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = q.modules.size;
  const data = q.modules.data;
  let d = "";
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (data[y * n + x]) {
        const start = x;
        while (x < n && data[y * n + x]) x++;
        d += `M${start} ${y}h${x - start}v1h${start - x}z`;
      } else x++;
    }
  }
  return { d, n };
}

export type BuildInput = {
  design: DesignId;
  agent: MailerAgent;
  households: Household[];
  baseUrl: string; // e.g. https://hub.spacematchinc.com/v/
  qrQuery?: string; // sample proofs only: "?d=netsheet&a=slug" so /v/SAMPLE shows that design's ask
  onProgress?: (done: number, total: number) => void;
  load?: AssetLoader; // default: same-origin fetch (browser)
  sides?: (0 | 1)[]; // default both (front, back); Lob needs one PDF per side
  lob?: boolean; // Lob print: leave the address lines off (Lob prints its own address block)
  libs?: { pdfLib: typeof import("pdf-lib"); fontkit: unknown };
};

export async function buildMailers(i: BuildInput): Promise<Uint8Array> {
  // Browser: lazy-load pdf-lib. Convex (Lob sender) passes them in: its Node bundle can't resolve these dynamic imports.
  const lib = i.libs?.pdfLib ?? (await import("pdf-lib"));
  const { PDFDocument, rgb, pushGraphicsState, popGraphicsState, setCharacterSpacing } = lib;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fontkit = (i.libs?.fontkit ?? (await import("@pdf-lib/fontkit")).default) as any;
  const load = i.load ?? fetchLoader;
  const sides = i.sides ?? [0, 1];
  const { zones, agents } = await meta(load);
  const slug = agentSlug(i.agent.name);
  // Agents added on the Team roster screen: license # and uploaded square JPG headshot (absolute URL).
  const live = AGENTS.find(a => agentSlug(a.name) === slug);
  const info = agents[slug] ?? (live?.added ? { name: live.name, lic: live.lic ?? "" } : undefined);
  const photoPath = live?.photo ?? (agents[slug] ? `/mailers/agents/${slug}.jpg` : null);
  const [base, photo, ...fontBytes] = await Promise.all([
    load(`/mailers/${i.design}.pdf`),
    photoPath ? load(photoPath).catch(() => null) : Promise.resolve(null), // opaque JPG: no soft mask in print PDFs
    ...["Playfair-400", "Playfair-400i", "Mada-300", "Mada-400", "Mada-500", "Mada-600"].map(f => load(`/mailers/fonts/${f}.ttf`)),
  ]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const keys = ["pf", "pf-i", "m300", "m400", "m500", "m600"] as const;
  const fonts = Object.fromEntries(await Promise.all(keys.map(async (k, n) => [k, await doc.embedFont(fontBytes[n], { subset: true })] as const)));
  const pages = await doc.embedPdf(base, [0, 1]);
  const img = photo ? await doc.embedJpg(photo) : null;
  const W = pages[0].width, H = pages[0].height;

  const first = i.agent.name.split(" ")[0];
  const agentVals: Record<string, string> = {
    name: i.agent.name, first, phone: i.agent.phone, email: i.agent.email,
    licLine: licLine(i.agent.name, info?.lic ?? ""),
    brokerLine: `${mailBrokerage()} · ${MAIL_OFFICE} · Office ${MAIL_PHONE} · spacematchinc.com`,
  };
  const fill = (tpl: string, h: Household) => {
    const vals: Record<string, string> = {
      ...agentVals, who: h.who, prop: h.propShort, code: h.code, nameLine: h.nameLine,
      addr1: h.mailAddr, addr2: `${h.mailCity} ${h.mailState} ${h.mailZip}`.replace(/\s+/g, " ").trim(),
    };
    return tpl.replace(/\{(\w+)\}/g, (_, k) => vals[k] ?? "");
  };

  const total = i.households.length;
  for (let n = 0; n < total; n++) {
    const h = i.households[n];
    const url = `${i.baseUrl}${h.code}${i.qrQuery ?? ""}`;
    const qr = qrPath(url);
    for (const side of sides) {
      const p = doc.addPage([W, H]);
      p.drawPage(pages[side], { x: 0, y: 0, width: W, height: H });
      for (const z of zones[i.design][side]) {
        if (i.lob && z.type === "text" && ADDRESS_TPLS.has(z.tpl)) continue;
        if (z.type === "qr") {
          const s = z.w / qr.n;
          p.drawSvgPath(qr.d, { x: z.x, y: z.y + z.h, scale: s, color: rgb(0.04, 0.04, 0.04) });
        } else if (z.type === "photo") {
          if (img) p.drawImage(img, { x: z.x, y: z.y, width: z.w, height: z.h });
        } else {
          let t = fill(z.tpl, h).trim();
          if (!t) continue;
          if (z.upper) t = t.toUpperCase();
          const font = fonts[z.font];
          let size = z.size;
          const width = (s: string, sz: number) => font.widthOfTextAtSize(s, sz) + z.spacing * (sz / z.size) * s.length;
          while (width(t, size) > z.maxw && size > z.size * 0.72) size -= 0.25;
          while (width(t, size) > z.maxw && t.length > 4) t = `${t.slice(0, -2).trimEnd()}…`;
          const x = z.align === "right" ? z.x - width(t, size) : z.x;
          const sp = z.spacing * (size / z.size);
          if (sp) p.pushOperators(pushGraphicsState(), setCharacterSpacing(sp));
          p.drawText(t, { x, y: z.y, size, font, color: rgb(z.color[0], z.color[1], z.color[2]) });
          if (sp) p.pushOperators(setCharacterSpacing(0), popGraphicsState());
        }
      }
    }
    if (i.onProgress && (n % 25 === 0 || n === total - 1)) {
      i.onProgress(n + 1, total);
      await new Promise(r => setTimeout(r, 0)); // keep the page responsive
    }
  }
  doc.setTitle(`SpaceMatch seller mailer — ${i.agent.name}`);
  doc.setAuthor(`${i.agent.name} · SpaceMatch Inc.`);
  doc.setSubject("6x11 jumbo postcard, 0.125in bleed (11.25 x 6.25 in), 2 pages per home: front, back");
  return await doc.save();
}

export function mailingListCsv(households: (Household & { scans?: number; leadAt?: number })[], baseUrl: string) {
  const head = ["code", "name", "mail_address", "mail_city", "mail_state", "mail_zip", "property_address", "qr_url"];
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = households.map(h => [h.code, h.nameLine, h.mailAddr, h.mailCity, h.mailState, h.mailZip, h.propAddr, `${baseUrl}${h.code}`].map(q).join(","));
  return [head.join(","), ...rows].join("\n");
}

// Wise Pelican list upload: one row per mailbox, already cleaned/deduped by the Hub, so the agent
// doesn't pay Wise Pelican's 10¢/address list fee. Columns map 1:1 in their "Map list" step.
export function wisePelicanCsv(households: Household[]) {
  const head = ["Full Name", "Address", "City", "State", "Zip Code", "Property Address"];
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = households.map(h => [h.nameLine, h.mailAddr, h.mailCity, h.mailState, h.mailZip, h.propAddr].map(v => q(v ?? "")).join(","));
  return [head.join(","), ...rows].join("\n");
}

export function download(data: Uint8Array | string, name: string, type: string) {
  const blob = new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export const fileSafe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
