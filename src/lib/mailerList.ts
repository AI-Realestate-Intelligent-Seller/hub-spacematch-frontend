// ATN Title farm list (CSV or Excel) → clean mailing rows.
// Auto-detects columns (owner names, mailing + property address), cleans owner names
// ("SMITH, JOHN A & MARY B" → "John & Mary Smith"), sends corporate owners to
// "Current Homeowner" (or skips them), and keeps one card per mailbox.
import type { Household } from "./mailerBuilder";

export type Field =
  | "ownerFull" | "owner2Full" | "first1" | "last1" | "first2" | "last2"
  | "mailAddr" | "mailCity" | "mailState" | "mailZip" | "mailCsz"
  | "propAddr" | "propCity" | "propState" | "propZip" | "ownerOcc";

export const FIELD_LABELS: Record<Field, string> = {
  ownerFull: "Owner name (full)", owner2Full: "Second owner (full)",
  first1: "Owner first name", last1: "Owner last name", first2: "Owner 2 first name", last2: "Owner 2 last name",
  mailAddr: "Mailing street", mailCity: "Mailing city", mailState: "Mailing state", mailZip: "Mailing ZIP", mailCsz: "Mailing city/state/ZIP (one column)",
  propAddr: "Property street", propCity: "Property city", propState: "Property state", propZip: "Property ZIP",
  ownerOcc: "Owner-occupied flag",
};

// Header synonyms, checked in order (normalized: lowercase, letters+digits only).
const SYN: Record<Field, string[]> = {
  first1: ["owner1first", "ownerfirstname", "owner1firstname", "firstname", "first", "ownerfirst", "owner1fname"],
  last1: ["owner1last", "ownerlastname", "owner1lastname", "lastname", "last", "ownerlast", "owner1lname"],
  first2: ["owner2first", "owner2firstname", "coownerfirstname", "secondownerfirstname"],
  last2: ["owner2last", "owner2lastname", "coownerlastname", "secondownerlastname"],
  ownerFull: ["ownername", "owner1name", "owner1fullname", "ownerfullname", "owner", "owners", "primaryowner", "owner1", "taxpayername", "taxpayer", "name", "fullname", "ownernames"],
  owner2Full: ["owner2name", "owner2fullname", "owner2", "secondowner", "coowner", "coownername"],
  mailAddr: ["mailaddress", "mailingaddress", "mailstreet", "mailingstreet", "mailaddr", "mailingaddress1", "mailaddress1", "ownermailingaddress", "owneraddress", "taxbilladdress", "mailingstreetaddress"],
  mailCity: ["mailcity", "mailingcity", "ownercity", "taxbillcity"],
  mailState: ["mailstate", "mailingstate", "ownerstate", "mailst", "taxbillstate"],
  mailZip: ["mailzip", "mailingzip", "mailzipcode", "mailingzipcode", "ownerzip", "mailzip5", "taxbillzip"],
  mailCsz: ["mailcitystatezip", "mailingcitystatezip", "mailcsz", "ownercitystatezip"],
  propAddr: ["siteaddress", "propertyaddress", "situsaddress", "propaddress", "siteaddr", "propertystreet", "sitestreet", "address", "streetaddress", "situsstreet", "propertyaddress1"],
  propCity: ["sitecity", "propertycity", "situscity", "propcity", "city"],
  propState: ["sitestate", "propertystate", "situsstate", "propstate", "state"],
  propZip: ["sitezip", "propertyzip", "situszip", "propzip", "zip", "zipcode", "sitezipcode", "propertyzipcode"],
  ownerOcc: ["owneroccupied", "owneroccupiedflag", "owneroccupancy", "ownerocc", "occupancy", "homesteadexemption", "homestead"],
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

export function detectColumns(headers: string[]): Partial<Record<Field, string>> {
  const out: Partial<Record<Field, string>> = {};
  const used = new Set<string>();
  const byNorm = new Map(headers.map(h => [norm(h), h]));
  for (const f of Object.keys(SYN) as Field[]) {
    for (const s of SYN[f]) {
      const h = byNorm.get(s);
      if (h && !used.has(h)) { out[f] = h; used.add(h); break; }
    }
  }
  // Loose second pass: "Mailing Address Line 1", "Site Address Full", etc.
  const loose: [Field, RegExp][] = [
    ["mailAddr", /^mail.*(addr|street)/], ["mailCity", /^mail.*city/], ["mailState", /^mail.*st(ate)?$/], ["mailZip", /^mail.*zip/],
    ["propAddr", /^(site|situs|prop).*(addr|street)/], ["propCity", /^(site|situs|prop).*city/], ["propZip", /^(site|situs|prop).*zip/],
    ["ownerFull", /^owner.*name/],
  ];
  for (const [f, re] of loose) {
    if (out[f]) continue;
    const h = headers.find(x => re.test(norm(x)) && !used.has(x));
    if (h) { out[f] = h; used.add(h); }
  }
  return out;
}

export async function readSheet(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "", raw: false, blankrows: false });
  // Header row = first row with 3+ non-empty cells.
  const hi = grid.findIndex(r => r.filter(c => String(c).trim()).length >= 3);
  if (hi < 0) throw new Error("Couldn't find a header row in that file");
  const headers = grid[hi].map((h, n) => String(h).trim() || `Column ${n + 1}`);
  const rows = grid.slice(hi + 1)
    .filter(r => r.some(c => String(c).trim()))
    .map(r => Object.fromEntries(headers.map((h, n) => [h, String(r[n] ?? "").trim()])));
  return { headers, rows };
}

const ENTITY = /\b(LLC|L\.?L\.?C|INC|CORP|CORPORATION|COMPANY|CO|LTD|LP|LLP|BANK|NATIONAL|ASSOCIATION|ASSN|ASSOC|HOLDINGS|PROPERTIES|INVESTMENTS?|PARTNERS(HIP)?|GROUP|MANAGEMENT|MGMT|REALTY|CHURCH|CITY OF|VILLAGE OF|COUNTY|STATE OF|HUD|SECRETARY|FANNIE|FREDDIE|FEDERAL|MORTGAGE|CONDOMINIUM|CONDO|HOA|ASSOCIATES|DEVELOPMENT|ENTERPRISES?|VENTURES?|CAPITAL|FUND|SERIES)\b/i;
const TRUST = /\b(TRUST|TRUSTEE|TRUSTEES|TR|TRS|TRST|REVOCABLE|LIVING|ESTATE OF|ESTATE|DECLARATION|DECL|LAND TRUST|TRUST NO|TRUST #|UTD|U\/T\/A|DTD)\b/i;
const SUFFIX = /\b(JR|SR|II|III|IV|MD|DDS|ESQ)\b\.?/gi;

export const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s\-'’])([a-z])/g, (_, a, b) => a + b.toUpperCase())
    .replace(/\bMc([a-z])/g, (_, c) => `Mc${c.toUpperCase()}`)
    .replace(/\b(Ii|Iii|Iv)\b/g, m => m.toUpperCase());

type Person = { first: string; last: string };

// One owner string → people. "SMITH, JOHN A & MARY B" | "JOHN A SMITH & MARY B SMITH" | "SMITH JOHN A"
function parseOwner(raw: string, lastFirst: boolean): Person[] {
  const s = raw.replace(SUFFIX, "").replace(/\s+/g, " ").trim();
  if (!s) return [];
  if (s.includes(",")) {
    const [last, rest] = s.split(",", 2).map(x => x.trim());
    return rest.split(/\s*(?:&|\band\b|\/)\s*/i).filter(Boolean).map(p => {
      const parts = p.split(" ");
      // "JOHN A" (same last) or "MARY JONES" (own last name, 2+ words with no initial)
      return { first: parts[0], last: parts.length >= 2 && parts[parts.length - 1].length > 1 && p !== rest.split(/&/)[0].trim() ? parts[parts.length - 1] : last };
    });
  }
  const chunks = s.split(/\s*(?:&|\band\b|\/)\s*/i).filter(Boolean);
  const out: Person[] = [];
  let sharedLast = "";
  for (const c of chunks) {
    const w = c.split(" ").filter(x => x.length > 0);
    if (w.length === 1) { out.push({ first: w[0], last: sharedLast }); continue; }
    if (lastFirst) {
      if (out.length === 0) { sharedLast = w[0]; out.push({ first: w[1], last: w[0] }); }
      else out.push({ first: w[0], last: w.length >= 3 && w[w.length - 1].length > 1 ? w[w.length - 1] : sharedLast });
    } else {
      const last = w[w.length - 1].length > 1 ? w[w.length - 1] : w[w.length - 2];
      sharedLast ||= last;
      out.push({ first: w[0], last });
    }
  }
  return out.map(p => ({ first: p.first, last: p.last || sharedLast }));
}

function names(people: Person[]): { nameLine: string; who: string } | null {
  const ps = people.filter(p => p.first && p.first.length > 1).slice(0, 2).map(p => ({ first: titleCase(p.first), last: titleCase(p.last) }));
  if (!ps.length) return null;
  if (ps.length === 1) return { nameLine: `${ps[0].first} ${ps[0].last}`.trim(), who: ps[0].first };
  const [a, b] = ps;
  if (a.first === b.first) return { nameLine: `${a.first} ${a.last}`.trim(), who: a.first };
  return {
    nameLine: a.last === b.last || !b.last ? `${a.first} & ${b.first} ${a.last}`.trim() : `${a.first} ${a.last} & ${b.first} ${b.last}`,
    who: `${a.first} & ${b.first}`,
  };
}

export type CleanOptions = {
  map: Partial<Record<Field, string>>;
  lastFirst: boolean; // "SMITH JOHN" style names (title/tax data); ignored when names have commas or split columns
  skipCorporate: boolean;
  skipTrusts?: boolean; // default true: trusts/estates are dropped (Michael 2026-10-31); false → mailed as "Current Homeowner"
  ownerOccOnly: boolean;
  exclude?: Set<string>; // normalized property streets to skip (active Hub listings)
};

export type CleanResult = {
  households: Omit<Household, "code">[];
  stats: { rows: number; kept: number; corporate: number; trusts: number; duplicates: number; noAddress: number; absenteeSkipped: number; excluded: number };
};

export const streetKey = (s: string) =>
  s.toUpperCase().replace(/[.,#]/g, " ").replace(/\b(UNIT|APT|STE|SUITE)\b/g, " ").replace(/\b(STREET)\b/g, "ST").replace(/\b(AVENUE)\b/g, "AVE")
    .replace(/\b(ROAD)\b/g, "RD").replace(/\b(DRIVE)\b/g, "DR").replace(/\b(COURT)\b/g, "CT").replace(/\b(PLACE)\b/g, "PL")
    .replace(/\b(NORTH)\b/g, "N").replace(/\b(SOUTH)\b/g, "S").replace(/\b(EAST)\b/g, "E").replace(/\b(WEST)\b/g, "W")
    .replace(/\s+/g, " ").trim();

const addrCase = (s: string) => titleCase(s).replace(/\b(N|S|E|W|Ne|Nw|Se|Sw)\b/g, m => m.toUpperCase()).replace(/\b(Il|In|Wi)\b$/g, m => m.toUpperCase());

function splitCsz(csz: string) {
  const m = csz.trim().match(/^(.*?)[,\s]+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  return m ? { city: m[1].trim(), state: m[2].toUpperCase(), zip: m[3] } : { city: csz.trim(), state: "", zip: "" };
}

export function cleanRows(rows: Record<string, string>[], o: CleanOptions): CleanResult {
  const g = (r: Record<string, string>, f: Field) => (o.map[f] ? (r[o.map[f]!] ?? "").trim() : "");
  const stats = { rows: rows.length, kept: 0, corporate: 0, trusts: 0, duplicates: 0, noAddress: 0, absenteeSkipped: 0, excluded: 0 };
  const seen = new Set<string>();
  const out: CleanResult["households"] = [];
  for (const r of rows) {
    let propStreet = g(r, "propAddr");
    let mailStreet = g(r, "mailAddr") || propStreet;
    let mailCity = g(r, "mailCity"), mailState = g(r, "mailState"), mailZip = g(r, "mailZip");
    if (!mailCity && g(r, "mailCsz")) ({ city: mailCity, state: mailState, zip: mailZip } = splitCsz(g(r, "mailCsz")));
    if (!g(r, "mailAddr")) { mailCity ||= g(r, "propCity"); mailState ||= g(r, "propState"); mailZip ||= g(r, "propZip"); }
    mailState ||= "IL";
    if (!mailStreet || !mailCity || !mailZip) { stats.noAddress++; continue; }
    propStreet ||= mailStreet;
    if (o.exclude?.has(streetKey(propStreet))) { stats.excluded++; continue; }
    const occ = g(r, "ownerOcc").toUpperCase();
    const absentee = occ ? !/^(Y|YES|TRUE|1|O|OWNER|OWNER OCCUPIED|H|HOMESTEAD)/.test(occ) : streetKey(mailStreet) !== streetKey(propStreet);
    if (o.ownerOccOnly && absentee) { stats.absenteeSkipped++; continue; }
    const key = `${streetKey(mailStreet)}|${mailZip.slice(0, 5)}`;
    if (seen.has(key)) { stats.duplicates++; continue; }

    // Names
    const rawOwners = [g(r, "ownerFull"), g(r, "owner2Full")].filter(Boolean).join(" & ");
    const rawAll = rawOwners || [g(r, "first1"), g(r, "last1"), g(r, "first2"), g(r, "last2")].join(" ");
    let nm: { nameLine: string; who: string } | null = null;
    const isTrust = TRUST.test(rawAll);
    const isCorp = !isTrust && ENTITY.test(rawAll);
    if (isCorp) {
      stats.corporate++;
      if (o.skipCorporate) continue;
    } else if (isTrust) {
      stats.trusts++;
      if (o.skipTrusts !== false) continue;
    } else if (g(r, "first1") || g(r, "last1")) {
      nm = names([{ first: g(r, "first1"), last: g(r, "last1") }, { first: g(r, "first2"), last: g(r, "last2") || g(r, "last1") }]);
    } else if (rawOwners) {
      nm = names([...parseOwner(g(r, "ownerFull"), o.lastFirst), ...parseOwner(g(r, "owner2Full"), o.lastFirst)]);
    }
    seen.add(key);
    const propCity = g(r, "propCity") || (streetKey(mailStreet) === streetKey(propStreet) ? mailCity : "");
    const propShort = addrCase(propStreet);
    out.push({
      nameLine: nm?.nameLine ?? "Current Homeowner",
      who: nm?.who ?? "the homeowner",
      mailAddr: addrCase(mailStreet),
      mailCity: titleCase(mailCity),
      mailState: mailState.toUpperCase().slice(0, 2),
      mailZip,
      propAddr: [propShort, titleCase(propCity), `${(g(r, "propState") || mailState).toUpperCase().slice(0, 2)} ${g(r, "propZip") || (propCity ? "" : mailZip)}`.trim()].filter(Boolean).join(", "),
      propShort,
    });
  }
  stats.kept = out.length;
  return { households: out, stats };
}

// Title/tax lists usually print "SMITH JOHN A". Guess from the first 50 names: if the first
// word is often shared by the second owner's last word (or names have commas) → last-first.
export function guessLastFirst(rows: Record<string, string>[], col?: string): boolean {
  if (!col) return true;
  const sample = rows.slice(0, 80).map(r => (r[col] ?? "").trim()).filter(Boolean);
  if (!sample.length) return true;
  const commas = sample.filter(s => s.includes(",")).length;
  if (commas > sample.length / 3) return true;
  const COMMON_FIRST = /^(JAMES|JOHN|ROBERT|MICHAEL|WILLIAM|DAVID|RICHARD|JOSEPH|THOMAS|CHARLES|MARY|PATRICIA|JENNIFER|LINDA|ELIZABETH|BARBARA|SUSAN|JESSICA|SARAH|KAREN|DANIEL|MARK|PAUL|STEVEN|KEVIN|BRIAN|NANCY|LISA|MARGARET|ANNA|MARIA|JOSE|JUAN|CARLOS|LUIS|ANTHONY|CHRISTOPHER|MATTHEW|ANDREW|JOSHUA|KIM|LEE|CHRISTINE|LAURA|AMY|ANGELA|HELEN|DONNA|CAROL|RUTH|SANDRA|SHARON|PETER|GEORGE|EDWARD|RONALD|TIMOTHY|JASON|JEFFREY|RYAN|GARY|ERIC|STEPHEN|FRANK|SCOTT|GREGORY|RAYMOND|ALEXANDER|PATRICK|JACK|DENNIS|JERRY|TYLER|AARON|ADAM|HENRY|NATHAN|DOUGLAS|ZACHARY|KYLE|WALTER|ETHAN|JEREMY|HAROLD|KEITH|CHRISTIAN|ROGER|NOAH|GERALD|CARL|TERRY|SEAN|AUSTIN|ARTHUR|LAWRENCE|JESSE|DYLAN|BRYAN|JOE|JORDAN|BILLY|BRUCE|ALBERT|WILLIE|GABRIEL|LOGAN|ALAN|JUAN|WAYNE|ROY|RALPH|RANDY|EUGENE|VINCENT|RUSSELL|ELIJAH|LOUIS|BOBBY|PHILIP|JOHNNY|EMILY|MICHELLE|DOROTHY|MELISSA|DEBORAH|STEPHANIE|REBECCA|KATHLEEN|SHIRLEY|AMANDA|CYNTHIA|NICOLE|KATHERINE|EMMA|JULIE|JOYCE|VIRGINIA|VICTORIA|KELLY|LAUREN|CHRISTINA|JOAN|EVELYN|JUDITH|OLIVIA|MEGAN|CHERYL|MARTHA|ANDREA|FRANCES|HANNAH|JACQUELINE|ANN|GLORIA|JEAN|KATHRYN|ALICE|TERESA|SARA|JANICE|DORIS|MADISON|JULIA|GRACE|JUDY|ABIGAIL|MARIE|DENISE|BEVERLY|AMBER|THERESA|MARILYN|DANIELLE|DIANA|BRITTANY|NATALIE|SOPHIA|ROSE|ISABELLA|ALEXIS|KAYLA|CHARLOTTE)$/;
  let firstIsFirst = 0, lastIsFirst = 0;
  for (const s of sample) {
    const w = s.split(/\s*&\s*/)[0].split(/\s+/);
    if (COMMON_FIRST.test(w[0] ?? "")) firstIsFirst++;
    if (COMMON_FIRST.test(w[1] ?? "")) lastIsFirst++;
  }
  return lastIsFirst >= firstIsFirst;
}
