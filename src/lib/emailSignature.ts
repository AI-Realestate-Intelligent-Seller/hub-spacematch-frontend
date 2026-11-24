// Email signature builder (Michael 2026-11-12: "agents can create their own in our app").
// Same design as his own michael@ / team@ Gmail signatures: table layout with inline styles only,
// because Gmail strips <style> blocks. Images live in public/media/sig and are referenced by their
// full hub.spacematchinc.com address so they load inside an email.
// Python twin (used for Michael's and the team mailbox): /work/data/email_signature/v2/build.py.
import { OFFICE_ADDRESS } from "../../convex/officeDefs";
import { AGENT_PROFILES } from "./agentProfiles";
import { profileFor, rosterPhoto } from "./rosterProfiles";

export const SIG_HOST = "https://hub.spacematchinc.com";
const BRONZE = "#9C7434", GOLD = "#D9BC8C", INK = "#3A3833", BLACK = "#0A0A0A", MUTE = "#6B665D";
const SERIF = "Georgia,'Times New Roman',serif", SANS = "Arial,Helvetica,sans-serif";
const SITE = "https://spacematchinc.com";
const OFFICE_PHONE = "(773) 985-7153";
export const SIG_LEGAL = "SpaceMatch Inc. · a team of Real Broker, LLC";

// Team numbers, the same five Michael approved for his own signature (spacematchinc.com "by the Numbers").
export const SIG_STATS: [string, string, string][] = [
  ["#19", "Chicago team", "RealTrends 2024"],
  ["115", "Five-star", "reviews"],
  ["$297M+", "Sold since", "2021"],
  ["500+", "Homes", "sold"],
  ["100+", "Businesses", "sold"],
];

// Agents with a square signature photo in public/media/sig (made by agent_headshots.py).
const SIG_PHOTOS = new Set([
  "angel-zhang", "brandon-banks", "brendan-murphy", "cynthia-beltran", "eduardo-rodriguez", "emilie-rose-danno",
  "jennifer-guevara", "matthew-davila", "michael-kang", "newell-broadway", "rob-robinson", "sabina-hodzic", "sein-shin",
  "sergio-monjane", "shagha-mughtadai", "shan-keter-white-henderson", "susan-strange", "tarik-hage", "thalia-mena",
]);

export const SOCIALS = [
  { key: "instagram", label: "Instagram", hint: "@yourhandle", base: "https://www.instagram.com/", tail: "/" },
  { key: "facebook", label: "Facebook", hint: "facebook.com/yourpage", base: "https://www.facebook.com/", tail: "" },
  { key: "linkedin", label: "LinkedIn", hint: "linkedin.com/in/you", base: "https://www.linkedin.com/in/", tail: "/" },
  { key: "tiktok", label: "TikTok", hint: "@yourhandle", base: "https://www.tiktok.com/@", tail: "" },
  { key: "youtube", label: "YouTube", hint: "@yourchannel", base: "https://www.youtube.com/@", tail: "" },
  { key: "zillow", label: "Zillow", hint: "zillow.com/profile/you", base: "https://www.zillow.com/profile/", tail: "/" },
] as const;
export type SocialKey = (typeof SOCIALS)[number]["key"];
export const NO_LINKS: Record<SocialKey, string> = { instagram: "", facebook: "", linkedin: "", tiktok: "", youtube: "", zillow: "" };

export type SigInput = {
  name: string;
  title: string;
  cell: string;
  email: string;
  photo: string; // path like /media/sig/slug.jpg, a full https link (Team roster upload), or "" for no photo
  showOffice: boolean;
  showStats: boolean;
  showCta: boolean;
  extra: string; // designations line, e.g. "CLHMS · ABR"
  links: Record<SocialKey, string>; // the agent's own profiles: a handle or a pasted link
  booking?: string; // Calendly or other booking page (Cris 11-23 for Rada), shown as "Book a consultation"
};

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** What we already know about the signed-in agent: title and signature photo. */
export function sigDefaults(name: string): { title: string; photo: string } {
  const p0 = AGENT_PROFILES.find(a => a.name === name) ?? AGENT_PROFILES.find(a => a.slug === slugOf(name));
  const slug = p0?.slug ?? slugOf(name);
  const p = profileFor(slug) ?? p0; // includes agents added on the Team roster screen
  const uploaded = rosterPhoto(name); // headshot from the Team roster screen wins
  return {
    title: (p?.title ?? "Real Estate Broker").replace(/\s*·\s*SpaceMatch Inc\.?$/i, ""),
    photo: uploaded ?? (SIG_PHOTOS.has(slug) ? `/media/sig/${slug}.jpg` : ""),
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tel = (s: string) => { const d = s.replace(/\D/g, ""); return d.length === 10 ? `+1${d}` : d.length === 11 ? `+${d}` : d; };
/** Turn "@handle", "handle" or a pasted link into a full https link for that site. */
export function linkFor(key: SocialKey, raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(v)) return `https://${v}`;
  const site = SOCIALS.find(x => x.key === key);
  const h = v.replace(/^@/, "").replace(/\s+/g, "");
  return site && h ? `${site.base}${encodeURIComponent(h)}${site.tail}` : "";
}

const a = (href: string, text: string, color = INK, bold = false) =>
  `<a href="${esc(href)}" style="color:${color};text-decoration:none;${bold ? "font-weight:bold;" : ""}" target="_blank">${text}</a>`;
const row = (label: string, html: string) =>
  `<tr><td style="font-family:${SANS};font-size:11px;font-weight:bold;color:${BRONZE};padding:0 8px 0 0;line-height:19px;vertical-align:top;">${label}</td>` +
  `<td style="font-family:${SANS};font-size:13px;color:${INK};line-height:19px;">${html}</td></tr>`;

function stats() {
  const tds = SIG_STATS.map(([num, l1, l2], i) =>
    `<td style="${i ? `border-left:1px solid ${GOLD};padding:0 10px;` : "padding:0 10px 0 0;"}vertical-align:top;">` +
    `<div style="font-family:${SERIF};font-size:19px;line-height:22px;font-weight:bold;color:${BLACK};white-space:nowrap;">${num}</div>` +
    `<div style="font-family:${SANS};font-size:9px;line-height:12px;letter-spacing:.5px;color:${MUTE};text-transform:uppercase;">${l1}<br>${l2}</div></td>`);
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>${tds.join("")}</tr></table>`;
}

/** The signature as email-safe HTML. `host` is swapped for the page's own origin in the on-screen preview. */
export function buildSignature(s: SigInput, host = SIG_HOST): string {
  const name = esc(s.name.trim() || "Your Name");
  const title = esc(s.title.trim() || "Real Estate Broker").toUpperCase();
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(OFFICE_ADDRESS)}`;
  const sep = ` &nbsp;<span style="color:${GOLD};">|</span>&nbsp; `;
  const cell = s.cell.trim();
  const phones = [
    cell ? a(`tel:${tel(cell)}`, esc(cell)) : "",
    s.showOffice || !cell ? `${cell ? `<span style="font-size:11px;font-weight:bold;color:${BRONZE};">O</span>&nbsp; ` : ""}${a(`tel:${tel(OFFICE_PHONE)}`, OFFICE_PHONE)}` : "",
  ].filter(Boolean).join(sep);
  const email = s.email.trim();
  const rows = [
    row(cell ? "M" : "O", phones),
    email ? row("E", a(`mailto:${email}`, esc(email))) : "",
    row("W", a(SITE, "spacematchinc.com")),
    row("A", a(mapUrl, esc(OFFICE_ADDRESS))),
  ].join("");
  const info =
    `<div style="font-family:${SERIF};font-size:23px;line-height:27px;font-weight:bold;color:${BLACK};">${name}</div>` +
    `<div style="font-family:${SANS};font-size:10px;line-height:16px;letter-spacing:2px;font-weight:bold;color:${BRONZE};padding:2px 0 7px 0;">${title} &nbsp;|&nbsp; SPACEMATCH INC.</div>` +
    `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`;
  const head = s.photo
    ? `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>` +
      `<td style="padding:0 16px 0 0;vertical-align:middle;"><img src="${/^https?:\/\//i.test(s.photo) ? s.photo : host + s.photo}" width="92" height="92" alt="${name}" style="display:block;width:92px;min-width:92px;max-width:none;height:92px;border-radius:50%;border:2px solid ${GOLD};"></td>` +
      `<td style="border-left:2px solid ${GOLD};padding:0 0 0 16px;vertical-align:middle;">${info}</td></tr></table>`
    : info;
  const links = SOCIALS.map(x => { const href = linkFor(x.key, s.links[x.key] ?? ""); return href ? a(href, x.label, BRONZE) : ""; })
    .filter(Boolean).join(" &nbsp;&middot;&nbsp; ");
  const booking = bookingLink(s.booking ?? "");
  const first = esc(s.name.trim().split(/\s+/)[0] || "");
  const bookLine = booking
    ? a(booking, `Book a consultation${first && first !== "Your" ? ` with ${first}` : ""} &rarr;`, BRONZE, true) +
      `&nbsp; ${a(booking, esc(booking.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")), MUTE)}`
    : "";
  const line = (html: string, css: string) => `<tr><td style="font-family:${SANS};${css}">${html}</td></tr>`;
  return [
    `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${SANS};color:${INK};">`,
    `<tr><td style="padding:0 0 14px 0;">${head}</td></tr>`,
    `<tr><td style="padding:0 0 12px 0;"><a href="${SITE}" target="_blank" style="text-decoration:none;"><img src="${host}/media/sig/lockup-band.png" width="420" height="60" alt="SpaceMatch Inc. | Real" style="display:block;width:420px;max-width:100%;height:auto;border:0;"></a></td></tr>`,
    s.showStats ? `<tr><td style="padding:0 0 10px 0;">${stats()}</td></tr>` : "",
    s.extra.trim() ? line(`<span style="color:${BRONZE};">&#9733;</span> ${esc(s.extra.trim())}`, `font-size:11px;line-height:17px;color:${MUTE};padding:0 0 6px 0;`) : "",
    links ? line(links, "font-size:11px;line-height:17px;padding:0 0 8px 0;") : "",
    bookLine ? line(bookLine, "font-size:12px;line-height:17px;padding:0 0 8px 0;") : "",
    s.showCta ? line(a(`${SITE}/home-valuation`, "What&rsquo;s your home worth? &rarr;", BRONZE, true), "font-size:12px;line-height:17px;padding:0 0 8px 0;") : "",
    line(esc(SIG_LEGAL).replace("·", "&middot;"), `font-size:10px;line-height:15px;color:${MUTE};border-top:1px solid ${GOLD};padding:7px 0 0 0;`),
    "</table>",
  ].join("");
}

/** A booking page as a full https link ("calendly.com/you" or a pasted link); "" when empty. */
export function bookingLink(raw: string): string {
  const v = raw.trim().replace(/\s+/g, "");
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
}

/** Plain-text version for mail apps that refuse formatted signatures. */
export function plainSignature(s: SigInput): string {
  return [
    s.name.trim(),
    `${s.title.trim() || "Real Estate Broker"} | SpaceMatch Inc.`,
    [s.cell.trim() && `M ${s.cell.trim()}`, (s.showOffice || !s.cell.trim()) && `O ${OFFICE_PHONE}`].filter(Boolean).join(" | "),
    s.email.trim(),
    "spacematchinc.com",
    OFFICE_ADDRESS,
    bookingLink(s.booking ?? "") && `Book a consultation: ${bookingLink(s.booking ?? "")}`,
    SIG_LEGAL,
  ].filter(Boolean).join("\n");
}
