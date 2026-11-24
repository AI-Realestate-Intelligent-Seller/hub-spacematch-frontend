// Shared money math for the Emails tools (rent vs own, move-up) and the seller net sheet
// (Michael 2026-10-31, #team-app-design 1793460359.025149). Plain code, no AI, no API calls.
// Every default is an editable assumption and the UI shows it next to the numbers.

// ---------- Places ----------
export type County = "cook" | "dupage" | "lake" | "will" | "kane" | "mchenry" | "other";
export type Place = { zip: string; name: string; county: County; chicago: boolean };

// Chicago zips → the neighborhood most people call it. Suburbs we work most.
const CHI: Record<string, string> = {
  "60601": "the Loop / Lakeshore East", "60602": "the Loop", "60603": "the Loop", "60604": "the Loop", "60605": "South Loop",
  "60606": "West Loop / Fulton River", "60607": "West Loop / University Village", "60608": "Pilsen / Bridgeport", "60609": "Back of the Yards",
  "60610": "Old Town / Gold Coast", "60611": "Streeterville", "60612": "Near West Side", "60613": "Lakeview / Wrigleyville",
  "60614": "Lincoln Park", "60615": "Hyde Park / Kenwood", "60616": "South Loop / Chinatown", "60617": "South Chicago / East Side",
  "60618": "Avondale / North Center", "60619": "Chatham", "60620": "Auburn Gresham", "60621": "Englewood", "60622": "Wicker Park / Ukrainian Village",
  "60623": "Little Village", "60624": "Garfield Park", "60625": "Lincoln Square / Albany Park", "60626": "Rogers Park", "60628": "Roseland",
  "60629": "Chicago Lawn", "60630": "Jefferson Park", "60631": "Edison Park", "60632": "Brighton Park", "60633": "Hegewisch",
  "60634": "Portage Park / Dunning", "60636": "West Englewood", "60637": "Woodlawn / Hyde Park", "60638": "Garfield Ridge",
  "60639": "Belmont Cragin", "60640": "Uptown / Andersonville", "60641": "Portage Park / Irving Park", "60642": "Noble Square / Goose Island",
  "60643": "Beverly / Morgan Park", "60644": "Austin", "60645": "West Ridge", "60646": "Edgebrook / Sauganash", "60647": "Logan Square / Bucktown",
  "60649": "South Shore", "60651": "Humboldt Park", "60652": "Ashburn", "60653": "Bronzeville", "60654": "River North", "60655": "Mount Greenwood",
  "60656": "Norwood Park", "60657": "Lakeview", "60659": "West Ridge / North Park", "60660": "Edgewater", "60661": "West Loop",
};
const SUBURBS: Record<string, [string, County]> = {
  "60201": ["Evanston", "cook"], "60202": ["Evanston", "cook"], "60203": ["Evanston", "cook"], "60076": ["Skokie", "cook"], "60077": ["Skokie", "cook"],
  "60091": ["Wilmette", "cook"], "60093": ["Winnetka", "cook"], "60043": ["Kenilworth", "cook"], "60022": ["Glencoe", "cook"], "60025": ["Glenview", "cook"],
  "60026": ["Glenview", "cook"], "60053": ["Morton Grove", "cook"], "60714": ["Niles", "cook"], "60068": ["Park Ridge", "cook"], "60016": ["Des Plaines", "cook"],
  "60018": ["Des Plaines", "cook"], "60056": ["Mount Prospect", "cook"], "60004": ["Arlington Heights", "cook"], "60005": ["Arlington Heights", "cook"],
  "60062": ["Northbrook", "cook"], "60301": ["Oak Park", "cook"], "60302": ["Oak Park", "cook"], "60304": ["Oak Park", "cook"], "60305": ["River Forest", "cook"],
  "60130": ["Forest Park", "cook"], "60402": ["Berwyn", "cook"], "60546": ["Riverside", "cook"], "60525": ["La Grange", "cook"], "60453": ["Oak Lawn", "cook"],
  "60712": ["Lincolnwood", "cook"], "60706": ["Harwood Heights / Norridge", "cook"], "60707": ["Elmwood Park", "cook"], "60803": ["Alsip", "cook"],
  "60035": ["Highland Park", "lake"], "60015": ["Deerfield", "lake"], "60045": ["Lake Forest", "lake"], "60044": ["Lake Bluff", "lake"], "60069": ["Lincolnshire", "lake"],
  "60061": ["Vernon Hills", "lake"], "60048": ["Libertyville", "lake"], "60047": ["Long Grove / Lake Zurich", "lake"], "60089": ["Buffalo Grove", "lake"],
  "60126": ["Elmhurst", "dupage"], "60521": ["Hinsdale", "dupage"], "60540": ["Naperville", "dupage"], "60563": ["Naperville", "dupage"], "60565": ["Naperville", "dupage"],
  "60137": ["Glen Ellyn", "dupage"], "60187": ["Wheaton", "dupage"], "60515": ["Downers Grove", "dupage"], "60516": ["Downers Grove", "dupage"], "60148": ["Lombard", "dupage"],
  "60181": ["Villa Park", "dupage"], "60523": ["Oak Brook", "dupage"], "60559": ["Westmont", "dupage"], "60514": ["Clarendon Hills", "dupage"],
};

export function placeOf(zipRaw: string): Place | null {
  const zip = (zipRaw.match(/\d{5}/) ?? [""])[0];
  if (!zip) return null;
  if (CHI[zip]) return { zip, name: CHI[zip], county: "cook", chicago: true };
  const s = SUBURBS[zip];
  if (s) return { zip, name: s[0], county: s[1], chicago: false };
  const n = Number(zip);
  // Rough fallback: 600xx–604xx/607xx/608xx are mostly Cook-area suburbs.
  if (n >= 60000 && n <= 60999) return { zip, name: `the ${zip} area`, county: "other", chicago: false };
  return { zip, name: `the ${zip} area`, county: "other", chicago: false };
}

// ---------- Transfer tax (per $500, rounded up) ----------
// City of Chicago: $3.75 buyer (city portion) + $1.50 seller (CTA portion) per $500 — chicago.gov 7551.
// State of Illinois: $0.50 per $500, seller. Cook County: $0.25 per $500, seller. Other collar counties $0.25.
const per500 = (price: number, rate: number) => Math.ceil(Math.max(0, price) / 500) * rate;
export const sellerTransferTax = (price: number, p: { county: County; chicago: boolean }) => ({
  state: per500(price, 0.5),
  county: p.county === "other" ? 0 : per500(price, 0.25),
  city: p.chicago ? per500(price, 1.5) : 0,
});
export const buyerCityTransferTax = (price: number, chicago: boolean) => (chicago ? per500(price, 3.75) : 0);

// ---------- Loans ----------
export const monthlyPI = (loan: number, ratePct: number, years = 30) => {
  const r = ratePct / 100 / 12, n = years * 12;
  if (loan <= 0) return 0;
  return r > 0 ? (loan * r) / (1 - (1 + r) ** -n) : loan / n;
};
export const balanceAfter = (loan: number, ratePct: number, months: number, years = 30) => {
  const r = ratePct / 100 / 12, pmt = monthlyPI(loan, ratePct, years);
  if (loan <= 0) return 0;
  if (r === 0) return Math.max(0, loan - pmt * months);
  return Math.max(0, loan * (1 + r) ** months - (pmt * ((1 + r) ** months - 1)) / r);
};

// Title owner's policy (seller pays in IL). Close to the Chicago-area rate cards, ±$300. Confirm with title.
export const ownersPolicy = (price: number) => Math.round(Math.max(1000, 600 + price * 0.0035) / 10) * 10;

// ---------- Seller net sheet ----------
export type NetSheetIn = {
  price: number;
  payoff: number; // all loans + HELOC
  listPct: number; // listing side %
  buyerPct: number; // buyer side % (if seller pays)
  place: { county: County; chicago: boolean };
  annualTax: number; // last full-year tax bill
  closeMonth: number; // 1–12
  priorYearUnpaid: boolean; // Cook 2nd installment of last year not paid yet (bills in arrears)
  attorney: number;
  hoaFees: number; // paid-assessment letter, move-out, etc.
  credits: number; // repairs / concessions / buyer credit
  other: number; // survey, water cert, zoning, etc.
};
export type NetLine = { label: string; amount: number; note?: string };

export function netSheet(i: NetSheetIn) {
  const t = sellerTransferTax(i.price, i.place);
  // Cook County taxes are paid a year behind. At closing the seller credits the buyer this year's
  // taxes through the closing day, usually at 105% of the last full bill.
  const ytd = i.annualTax * 1.05 * (Math.max(1, Math.min(12, i.closeMonth)) - 0.5) / 12;
  const prior = i.priorYearUnpaid ? i.annualTax * 0.5 : 0;
  const lines: NetLine[] = [
    { label: "Commission, listing side", amount: (i.price * i.listPct) / 100, note: `${i.listPct}%` },
    { label: "Commission, buyer side", amount: (i.price * i.buyerPct) / 100, note: `${i.buyerPct}%` },
    { label: "Illinois transfer tax", amount: t.state, note: "$0.50 per $500" },
    ...(t.county ? [{ label: "County transfer tax", amount: t.county, note: "$0.25 per $500" }] : []),
    ...(t.city ? [{ label: "Chicago transfer tax (seller part)", amount: t.city, note: "$1.50 per $500" }] : []),
    { label: "Title insurance (owner's policy)", amount: ownersPolicy(i.price), note: "estimate" },
    { label: "Title and closing fees", amount: 650, note: "estimate" },
    { label: "Attorney", amount: i.attorney },
    { label: "Property tax credit to buyer", amount: Math.round(ytd + prior), note: i.priorYearUnpaid ? "this year + last year's 2nd bill" : "this year to closing, 105%" },
    ...(i.hoaFees ? [{ label: "HOA letters and move-out fees", amount: i.hoaFees }] : []),
    ...(i.credits ? [{ label: "Credits and repairs", amount: i.credits }] : []),
    ...(i.other ? [{ label: "Other (survey, water cert, zoning)", amount: i.other }] : []),
  ];
  const costs = lines.reduce((s, l) => s + l.amount, 0);
  const net = i.price - costs - i.payoff;
  return { lines, costs, net, costPct: i.price ? (costs / i.price) * 100 : 0 };
}

// Short version for projections (rent vs own, move-up): no tax credit, credits or HOA letters.
export const sellingCosts = (price: number, place: { county: County; chicago: boolean }, commissionPct = 6) => {
  const t = sellerTransferTax(price, place);
  return (price * commissionPct) / 100 + t.state + t.county + t.city + ownersPolicy(price) + 650 + 750;
};

// ---------- Owning costs ----------
export type OwnAssume = {
  ratePct: number;
  downPct: number;
  taxPct: number; // property tax, % of price per year
  hoa: number; // monthly
  insurance: number; // monthly
  pmiPct: number; // yearly % of loan while down < 20%
};
export const ownMonthly = (price: number, a: OwnAssume) => {
  const loan = price * (1 - a.downPct / 100);
  const pi = monthlyPI(loan, a.ratePct);
  const tax = (price * a.taxPct) / 100 / 12;
  const pmi = a.downPct < 20 ? (loan * a.pmiPct) / 100 / 12 : 0;
  return { loan, pi, tax, pmi, hoa: a.hoa, insurance: a.insurance, total: pi + tax + pmi + a.hoa + a.insurance };
};
// Highest price whose full monthly cost fits the budget (binary search).
export const priceForMonthly = (budget: number, a: OwnAssume) => {
  let lo = 0, hi = 5_000_000;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (ownMonthly(mid, a).total > budget) hi = mid; else lo = mid;
  }
  return Math.floor(lo / 1000) * 1000;
};

// ---------- Rent vs own ----------
export type RentVsOwnIn = OwnAssume & {
  rent: number;
  extra: number;
  zip: string;
  appreciationPct: number; // home value growth per year
  rentGrowthPct: number; // rent growth per year
  savingsPct: number; // what the renter earns on savings
  commissionPct: number; // when they sell later
};
export type Horizon = {
  years: number;
  value: number;
  balance: number;
  sellCosts: number;
  walkAway: number; // cash at sale after costs and payoff
  cashIn: number; // down + closing
  gain: number; // walkAway − cashIn
  principalPaid: number;
  renterSavings: number; // renter who saved the same cash + monthly difference
  rentPaid: number;
  ownPaid: number;
};

export function rentVsOwn(i: RentVsOwnIn) {
  const place = placeOf(i.zip) ?? { zip: i.zip, name: "your area", county: "cook" as County, chicago: false };
  const budget = i.rent + i.extra;
  const price = priceForMonthly(budget, i);
  const m = ownMonthly(price, i);
  const down = (price * i.downPct) / 100;
  // Buyer closing costs: lender + title + attorney ≈ 2% of price, plus Chicago's buyer transfer tax.
  const closing = Math.round(price * 0.02 + buyerCityTransferTax(price, place.chicago));
  const cashIn = down + closing;
  const horizon = (years: number): Horizon => {
    const months = years * 12;
    const value = price * (1 + i.appreciationPct / 100) ** years;
    const balance = balanceAfter(m.loan, i.ratePct, months);
    const sc = sellingCosts(value, place, i.commissionPct);
    const walkAway = value - sc - balance;
    // Renter: invests the same up-front cash, and each month saves (owning cost − rent) at savingsPct.
    let sav = cashIn, rentPaid = 0, ownPaid = 0;
    const r = i.savingsPct / 100 / 12;
    for (let k = 0; k < months; k++) {
      const y = Math.floor(k / 12);
      const rent = i.rent * (1 + i.rentGrowthPct / 100) ** y;
      const own = m.pi + (m.tax + m.hoa + m.insurance) * 1.03 ** y + (balanceAfter(m.loan, i.ratePct, k) > price * 0.78 ? m.pmi : 0);
      rentPaid += rent; ownPaid += own;
      sav = sav * (1 + r) + (own - rent);
    }
    return { years, value, balance, sellCosts: sc, walkAway, cashIn, gain: walkAway - cashIn, principalPaid: m.loan - balance, renterSavings: sav, rentPaid, ownPaid };
  };
  return { place, budget, price, monthly: m, down, closing, cashIn, five: horizon(5), ten: horizon(10) };
}

// ---------- Move-up (sell, cash out, keep some in the bank) ----------
export type MoveUpIn = {
  value: number;
  payoff: number;
  currentPI: number; // what they pay now, P&I (optional, 0 = unknown)
  place: { county: County; chicago: boolean };
  commissionPct: number;
  nextPrice: number;
  keep: number; // cash they want to keep in the bank
  ratePct: number;
  taxPct: number;
  hoa: number;
  insurance: number;
};
export function moveUp(i: MoveUpIn) {
  const sc = sellingCosts(i.value, i.place, i.commissionPct);
  const walkAway = Math.max(0, i.value - sc - i.payoff);
  const nextClosing = Math.round(i.nextPrice * 0.02 + buyerCityTransferTax(i.nextPrice, i.place.chicago));
  const available = Math.max(0, walkAway - i.keep - nextClosing);
  const down = Math.min(available, i.nextPrice);
  const downPct = i.nextPrice ? (down / i.nextPrice) * 100 : 0;
  const m = ownMonthly(i.nextPrice, { ratePct: i.ratePct, downPct, taxPct: i.taxPct, hoa: i.hoa, insurance: i.insurance, pmiPct: 0.5 });
  const equityNow = i.value - i.payoff;
  return { sellCosts: sc, walkAway, nextClosing, down, downPct, monthly: m, keep: Math.min(i.keep, walkAway), equityNow };
}

// ---------- Formatting ----------
export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const usdK = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000).toLocaleString("en-US")}K`);
export const roundTo = (n: number, step: number) => Math.round(n / step) * step;
export const num = (s: string | number) => (typeof s === "number" ? s : Number(String(s).replace(/[^\d.]/g, "")) || 0);
