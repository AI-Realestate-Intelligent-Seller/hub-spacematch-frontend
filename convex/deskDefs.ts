import { OFFICE_SHORT } from "./officeDefs";
// Lead Desk (Michael 2026-10-27, #lead-gen-sources): ops vet leads from any channel,
// book an agent on Google Calendar, agent accepts, logs the outcome. Shared FE/BE.
export const TZ = "America/Chicago";

export const DESK_SOURCES = [
  "YouTube ads (Peak Presence)",
  "Office call",
  "Website",
  "Zillow",
  "Realtor.com",
  "Referral",
  "Sign call",
  "Open house",
  "Mailer",
  "Social (IG/FB)",
  "Walk-in",
  "Past client",
  "Other",
] as const;

export const LEAD_TYPES = [
  { id: "seller", label: "Seller" },
  { id: "buyer", label: "Buyer" },
  { id: "both", label: "Sell + buy" },
  { id: "renter", label: "Renter" },
  { id: "landlord", label: "Landlord" },
] as const;
export type LeadType = (typeof LEAD_TYPES)[number]["id"];

export type DeskField = {
  id: string;
  label: string;
  kind?: "text" | "select" | "textarea";
  options?: string[];
  placeholder?: string;
  for: LeadType[];
};

const S: LeadType[] = ["seller", "both", "landlord"];
const B: LeadType[] = ["buyer", "both", "renter"];
const ALL: LeadType[] = ["seller", "buyer", "both", "renter", "landlord"];

// Vetting questions. Seller/landlord fields first, then buyer/renter, then shared.
export const DESK_FIELDS: DeskField[] = [
  { id: "address", label: "Property address", placeholder: "123 N Main St #4, Chicago 60614", for: S },
  { id: "propertyType", label: "Property type", kind: "select", options: ["Condo", "Single family", "Townhouse", "2–4 unit", "5+ unit", "Land", "Commercial"], for: ["seller", "both", "landlord", "buyer", "renter"] },
  { id: "bedsBaths", label: "Beds / baths", placeholder: "3 bd / 2 ba", for: ALL },
  { id: "condition", label: "Condition", kind: "select", options: ["Move-in ready", "Needs light updates", "Needs work", "Gut rehab", "Not sure"], for: S },
  { id: "occupancy", label: "Who lives there", kind: "select", options: ["Owner", "Tenant", "Vacant"], for: S },
  { id: "priceInMind", label: "Price in mind", placeholder: "$450k, or 'wants a CMA'", for: S },
  { id: "whySelling", label: "Why selling / renting out", placeholder: "Relocating, upsizing, estate…", for: S },
  { id: "listedNow", label: "Listed with another agent right now?", kind: "select", options: ["No", "Yes (stop, don't solicit)", "Expired / withdrawn"], for: S },
  { id: "areas", label: "Where they're looking", placeholder: "Zip codes, neighborhoods or buildings (e.g. 60614, Lincoln Park, 1 Bennett Park)", for: B },
  { id: "budget", label: "Price range / budget", placeholder: "$400k–$550k or $2,500/mo", for: B },
  { id: "mustHaves", label: "Must-haves", placeholder: "Parking, in-unit laundry, schools…", for: B },
  { id: "financing", label: "Financing", kind: "select", options: ["Pre-approved", "Talking to a lender", "Cash", "Not started", "N/A (renter)"], for: B },
  { id: "lender", label: "Lender (if pre-approved)", for: B },
  { id: "mustSellFirst", label: "Needs to sell first?", kind: "select", options: ["No", "Yes", "Not sure"], for: ["buyer", "both"] },
  { id: "timeline", label: "Timeline", kind: "select", options: ["ASAP (0–30 days)", "1–3 months", "3–6 months", "6+ months", "Just curious"], for: ALL },
  { id: "otherAgent", label: "Working with another agent?", kind: "select", options: ["No", "Yes", "Talked to some"], for: B },
];

export const fieldsFor = (t: string) => DESK_FIELDS.filter(f => f.for.includes(t as LeadType));

export const RATINGS = [
  { id: "hot", label: "Hot", tone: "bg-red-100 text-red-800" },
  { id: "warm", label: "Warm", tone: "bg-amber-100 text-amber-900" },
  { id: "nurture", label: "Nurture", tone: "bg-stone-100 text-stone-700" },
] as const;

export const MEETING_KINDS = [
  { id: "listing", label: "Listing appointment (at the property)", short: "Listing appt", minutes: 60 },
  { id: "phone", label: "Phone call (agent calls the client)", short: "Phone call", minutes: 30 },
  { id: "video", label: "Video call (Google Meet)", short: "Video call", minutes: 30 },
  { id: "office", label: `Office meeting (${OFFICE_SHORT})`, short: "Office meeting", minutes: 60 },
  { id: "showing", label: "Showing / tour", short: "Showing", minutes: 60 },
] as const;
export const kindLabel = (k: string) => MEETING_KINDS.find(m => m.id === k)?.short ?? k;

export const OUTCOMES = [
  { id: "met", label: "Met, following up" },
  { id: "signed", label: "Signed (listing or buyer agreement)" },
  { id: "rescheduled", label: "Rescheduled" },
  { id: "no_show", label: "No-show" },
  { id: "not_fit", label: "Not a fit" },
] as const;
export const outcomeLabel = (o: string) => OUTCOMES.find(x => x.id === o)?.label ?? o;

export const CLOSE_REASONS = ["Couldn't reach (3 tries)", "Not a real lead / spam", "Duplicate", "Outside our area", "Already has an agent", "Just curious, nurture in Lofty"] as const;

export const LANGUAGES = ["English", "Spanish", "Korean", "Polish", "Mandarin", "Cantonese", "Arabic", "Urdu", "Hindi", "Tagalog", "Russian", "Ukrainian", "Persian", "French"] as const;

export const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Hours = Record<string, [number, number] | null>; // minutes after midnight, Chicago
// Until an agent sets their own: Mon–Sat 9am–7pm.
export const DEFAULT_HOURS: Hours = { sun: null, mon: [540, 1140], tue: [540, 1140], wed: [540, 1140], thu: [540, 1140], fri: [540, 1140], sat: [540, 1140] };

export const DESK_STAGES = ["to_vet", "booked", "accepted", "needs_agent", "done", "closed"] as const;
export const STAGE_LABEL: Record<string, string> = {
  to_vet: "To vet",
  booked: "Waiting for agent",
  accepted: "Accepted",
  needs_agent: "Needs a new agent",
  done: "Done",
  closed: "Closed",
};

// ── Chicago time helpers ──────────────────────────────────────────────
export function ctParts(t: number) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short", timeZoneName: "shortOffset" });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  const off = Number((p.timeZoneName ?? "GMT-6").replace("GMT", "") || "0");
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: Number(p.hour), mm: Number(p.minute), wd, off };
}

/** Epoch ms for a Chicago wall-clock time (handles DST by re-checking the offset). */
export function ctToMs(y: number, m: number, d: number, minutes: number): number {
  const guess = Date.UTC(y, m - 1, d, 0, minutes) + 6 * 36e5;
  const off = ctParts(guess).off;
  return Date.UTC(y, m - 1, d, 0, minutes) - off * 36e5;
}

export const fmtWhen = (t: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(t));
export const fmtTime = (t: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(t));
export const fmtDay = (t: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(new Date(t));
export const isoCT = (t: number) => {
  const p = ctParts(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.hh)}:${pad(p.mm)}:00`;
};

export type Busy = { start: number; end: number };

/** Open start times for one agent: inside their hours, not busy, not in the past, 30-min grid. */
export function openSlots(opts: { hours: Hours; busy: Busy[]; from: number; days: number; minutes: number; now: number }): number[] {
  const out: number[] = [];
  const start = ctParts(opts.from);
  for (let i = 0; i < opts.days; i++) {
    const dayMs = ctToMs(start.y, start.m, start.d + i, 12 * 60);
    const p = ctParts(dayMs);
    const h = opts.hours[DAYS[p.wd]];
    if (!h) continue;
    for (let min = h[0]; min + opts.minutes <= h[1]; min += 30) {
      const s = ctToMs(p.y, p.m, p.d, min);
      const e = s + opts.minutes * 60000;
      if (s < opts.now + 30 * 60000) continue; // at least 30 min notice
      if (opts.busy.some(b => b.start < e && b.end > s)) continue;
      out.push(s);
    }
  }
  return out;
}

/** Lead summary lines used in the calendar event, emails and the Lofty note. */
export function detailLines(l: { leadType: string; details: Record<string, string>; language?: string; rating?: string; notes?: string; source: string }): [string, string][] {
  const rows: [string, string][] = [
    ["Type", LEAD_TYPES.find(t => t.id === l.leadType)?.label ?? l.leadType],
    ["Source", l.source],
  ];
  if (l.rating) rows.push(["Rating", RATINGS.find(r => r.id === l.rating)?.label ?? l.rating]);
  if (l.language && l.language !== "English") rows.push(["Language", l.language]);
  for (const f of fieldsFor(l.leadType)) if (l.details[f.id]) rows.push([f.label, l.details[f.id]]);
  if (l.notes) rows.push(["Call notes", l.notes]);
  return rows;
}

/** Pull name / phone / email / address out of a pasted lead email or text. */
export function parseLeadText(raw: string): { name?: string; phone?: string; email?: string; address?: string } {
  const t = raw.replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\r/g, "");
  const grab = (re: RegExp) => t.match(re)?.[1]?.trim();
  const name = grab(/(?:^|\s)(?:Full\s+)?Name:\s*(.+?)(?=\s+(?:E-?mail|Phone|Address|Date|Message)\s*:|\n|$)/i);
  const email = grab(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  const phone = grab(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
  let address = grab(/Address:\s*(.+?)(?=\s+React to this|\s+(?:Phone|E-?mail|Date)\s*:|\n|$)/i);
  if (address) address = address.replace(/,?\s*USA,?$/i, "").replace(/,\s*$/, "");
  return { name, phone, email, address };
}

export const normPhone = (p?: string) => {
  const d = (p ?? "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return "";
};
