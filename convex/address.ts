// One address format everywhere: "851 N Eagle St, Naperville, IL 60563" (Michael 2026-10-18).
// Shared by the frontend (display) and backend (normalize on save). Pure functions only.

const SUFFIX: Record<string, string> = {
  street: "St", st: "St", str: "St",
  avenue: "Ave", ave: "Ave", av: "Ave",
  drive: "Dr", dr: "Dr",
  road: "Rd", rd: "Rd",
  boulevard: "Blvd", blvd: "Blvd",
  lane: "Ln", ln: "Ln",
  court: "Ct", ct: "Ct",
  place: "Pl", pl: "Pl",
  parkway: "Pkwy", pkwy: "Pkwy",
  terrace: "Ter", ter: "Ter",
  circle: "Cir", cir: "Cir",
  highway: "Hwy", hwy: "Hwy",
  trail: "Trl", trl: "Trl",
  square: "Sq", sq: "Sq",
  way: "Way",
};
const DIR: Record<string, string> = {
  north: "N", n: "N", south: "S", s: "S", east: "E", e: "E", west: "W", w: "W",
  northeast: "NE", ne: "NE", northwest: "NW", nw: "NW", southeast: "SE", se: "SE", southwest: "SW", sw: "SW",
};
const UNIT_WORDS = /\s*(?:,\s*)?(?:#|\bunit\b|\bapt\.?\b|\bapartment\b|\bsuite\b|\bste\.?\b)\s*([\w-]+)\s*$/i;

const SMALL = new Set(["of", "and", "the", "at"]);
const cap = (w: string) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w);

/** Title-case a city: "olympia fields" → "Olympia Fields". */
export function formatCity(city: string): string {
  return city
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(w => (/^(mc)(\w)/i.test(w) ? `Mc${cap(w.slice(2))}` : cap(w)))
    .join(" ");
}

function stripTrailingCityStateZip(street: string, city?: string, state?: string, zip?: string): string {
  let s = street.trim().replace(/\s+/g, " ");
  // "..., IL, 60563" / "... IL 60563" / "... 60563"
  if (zip) s = s.replace(new RegExp(`[,\\s]*${zip}(-\\d{4})?\\s*$`), "");
  s = s.replace(/[,\s]+\d{5}(-\d{4})?\s*$/, "");
  const st = (state || "IL").trim();
  s = s.replace(new RegExp(`[,\\s]+(${st}|illinois)\\.?\\s*$`, "i"), "");
  if (city) {
    const c = city.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`[,\\s]+${c}\\s*$`, "i"), "");
  }
  return s.replace(/[,\s]+$/, "");
}

/** "851 N Eagle Street Naperville, IL, 60563" → "851 N Eagle St". Unit split out if embedded. */
export function formatStreet(street: string, opts: { city?: string; state?: string; zip?: string } = {}): { street: string; unit?: string } {
  let s = stripTrailingCityStateZip(street, opts.city, opts.state, opts.zip);
  let unit: string | undefined;
  const m = s.match(UNIT_WORDS);
  if (m && /\d/.test(m[1])) {
    unit = m[1].toUpperCase();
    s = s.slice(0, m.index).trim();
  }
  const words = s.split(" ").filter(Boolean);
  const out = words.map((raw, i) => {
    const w = raw.replace(/[.,]$/, "");
    const lw = w.toLowerCase();
    if (/^\d/.test(w)) return /^\d+(st|nd|rd|th)$/i.test(w) ? w.toLowerCase() : w.toUpperCase(); // 63rd, 12B
    const isLast = i === words.length - 1;
    // Directional right after the house number, or at the very end (e.g. "Main St NW").
    // …but not when it IS the street name ("1611 North Ave").
    const nameIsDir = i === 1 && words.length === 3 && !!SUFFIX[words[2].toLowerCase().replace(/[.,]$/, "")];
    if ((i === 1 || isLast) && DIR[lw] && words.length > 2 && !nameIsDir) return DIR[lw];
    if (i > 1 && !isLast && SMALL.has(lw)) return lw;
    if (isLast && i > 1 && SUFFIX[lw]) return SUFFIX[lw];
    return cap(w);
  });
  return { street: out.join(" "), unit };
}

export type AddressParts = { street: string; unit?: string | null; city?: string | null; state?: string | null; zip?: string | null };

/** "851 N Eagle St #2B, Naperville, IL 60563" */
export function formatAddress(a: AddressParts, opts: { withZip?: boolean } = {}): string {
  const withZip = opts.withZip ?? true;
  const city = a.city ? formatCity(a.city) : "";
  const state = (a.state || "IL").trim().toUpperCase();
  const zip = (a.zip ?? "").trim();
  const { street, unit: embedded } = formatStreet(a.street ?? "", { city: a.city ?? undefined, state, zip });
  const rawUnit = (a.unit ?? "").trim().replace(/^(?:#|unit|apt\.?|suite|ste\.?|can)\s*/i, "");
  const unit = rawUnit || embedded;
  const line1 = `${street}${unit ? ` #${unit.toUpperCase()}` : ""}`;
  const tail = [state, withZip ? zip : ""].filter(Boolean).join(" ");
  return [line1, city, tail].filter(Boolean).join(", ");
}

/** Normalize the street/city fields before saving a request. */
export function normalizeAddressFields<T extends AddressParts>(a: T): T {
  const { street, unit } = formatStreet(a.street ?? "", { city: a.city ?? undefined, state: a.state ?? undefined, zip: a.zip ?? undefined });
  return {
    ...a,
    street,
    unit: (a.unit ?? "").trim() || unit || a.unit,
    city: a.city ? formatCity(a.city) : a.city,
    state: (a.state || "IL").trim().toUpperCase(),
  };
}

/** Free-text address ("950 michigan ave, evanston il 60202") → "950 Michigan Ave, Evanston, IL 60202". */
export function formatFreeAddress(raw: string): string {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return s;
  const zip = s.match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1];
  let rest = zip ? s.replace(/[,\s]*\d{5}(?:-\d{4})?\s*$/, "") : s;
  const st = rest.match(/[,\s]+([A-Za-z]{2})\.?\s*$/);
  const state = st && /^(il|in|wi|mi|ia|mo|fl|ny|ca|tx)$/i.test(st[1]) ? st[1].toUpperCase() : undefined;
  if (state) rest = rest.slice(0, st!.index);
  const parts = rest.split(",").map(p => p.trim()).filter(Boolean);
  const street = parts.shift() ?? "";
  const city = parts.join(" ");
  if (!city && !state && !zip) return formatStreet(street).street + (formatStreet(street).unit ? ` #${formatStreet(street).unit}` : "");
  return formatAddress({ street, city, state: state ?? "IL", zip: zip ?? "" });
}

/** "825000" / "$825k" → "$825,000"; leaves text like "Call for price" alone. */
export function formatPrice(raw?: string | null): string {
  const s = (raw ?? "").trim();
  if (!s) return s;
  const m = s.replace(/[$,\s]/g, "").match(/^(\d+(?:\.\d+)?)([kKmM])?$/);
  if (!m) return s;
  const n = Number(m[1]) * (m[2] ? (m[2].toLowerCase() === "k" ? 1e3 : 1e6) : 1);
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
