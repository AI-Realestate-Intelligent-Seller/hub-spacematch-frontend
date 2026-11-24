// Market myself (Michael 2026-11-22): client-side content + rules. No AI, no credits.
// Touch plan, monthly post ideas, market-update script and the vCard for the business card.

export const chicagoToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const addDays = (ymd: string, d: number) => {
  const t = new Date(`${ymd}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};
const diffDays = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 864e5);
export const prettyDate = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
export const money = (n?: number | null) => (n == null ? "–" : `$${Math.round(n).toLocaleString("en-US")}`);

// ───────── Past-client touch plan ─────────
export type ClientLite = { name: string; closedOn: string; side: string; address?: string; done: string[] };
export type Touch = { key: string; due: string; title: string; text: string; to?: string; toLabel?: string };

function thanksgiving(y: number) {
  const d = new Date(Date.UTC(y, 10, 1));
  const first = (4 - d.getUTCDay() + 7) % 7; // Thursday
  return `${y}-11-${String(1 + first + 21).padStart(2, "0")}`;
}

export function touchesFor(c: ClientLite, agentFirst: string, today = chicagoToday()): Touch[] {
  const first = c.name.split(/\s+/)[0];
  const y = Number(today.slice(0, 4));
  const place = c.address ? ` at ${c.address}` : "";
  const out: Touch[] = [];
  out.push({
    key: "review",
    due: addDays(c.closedOn, 7),
    title: "Ask for a Google review",
    text: `Hi ${first}, it was a pleasure working with you. If you have a minute, a Google review would mean a lot to me. – ${agentFirst}`,
    to: `/reviews?client=${encodeURIComponent(c.name)}`,
    toLabel: "Send review link",
  });
  for (const yy of [y - 1, y, y + 1]) {
    const md = c.closedOn.slice(5);
    const due = `${yy}-${md}`;
    const years = yy - Number(c.closedOn.slice(0, 4));
    if (years < 1) continue;
    if (c.side === "buyer")
      out.push({ key: `anniv-${yy}`, due, title: `${years}-year home anniversary`, text: `Happy ${years}-year home anniversary, ${first}! Hope you're loving the place${place}. If you ever want to know what it's worth today, I'm happy to run the numbers. – ${agentFirst}`, to: "/new", toLabel: "Price their home" });
    else if (c.side === "seller")
      out.push({ key: `anniv-${yy}`, due, title: `${years} year${years > 1 ? "s" : ""} since the sale`, text: `Hi ${first}, it's been ${years} year${years > 1 ? "s" : ""} since we sold${place}. Hope the new place is treating you well! If friends or family ever need help, I'm here. – ${agentFirst}` });
    else if (c.side === "renter")
      out.push({ key: `renew-${yy}`, due: addDays(due, -60), title: "Lease is up in about 2 months", text: `Hi ${first}, your lease is coming up in about two months. Staying, moving, or thinking about buying? Happy to help either way. – ${agentFirst}` });
    else
      out.push({ key: `anniv-${yy}`, due, title: "Yearly rent check-in", text: `Hi ${first}, it's been a year on the rental${place}. Want me to check what it could rent for today? – ${agentFirst}`, to: "/lease", toLabel: "Lease CMA" });
  }
  for (const yy of [y - 1, y, y + 1]) {
    out.push({ key: `thanks-${yy}`, due: addDays(thanksgiving(yy), -3), title: "Thanksgiving note", text: `Happy Thanksgiving, ${first}! Grateful for clients like you. – ${agentFirst}` });
    out.push({ key: `newyear-${yy}`, due: `${yy}-01-02`, title: "New Year note", text: `Happy New Year, ${first}! Wishing you a great ${yy}. If anything real estate comes up this year, I'm one text away. – ${agentFirst}` });
    for (const [q, md] of [["q1", "03-15"], ["q2", "06-15"], ["q3", "09-15"], ["q4", "12-10"]] as const)
      out.push({ key: `${q}-${yy}`, due: `${yy}-${md}`, title: "Quarterly market update", text: `Hi ${first}, quick check-in. Want this quarter's market numbers for your area, or what your home would sell for today? Happy to send either. – ${agentFirst}`, to: "/market-update", toLabel: "Market update kit" });
  }
  return out
    .filter(t => t.due > c.closedOn && !c.done.includes(t.key))
    .filter(t => diffDays(t.due, today) <= 30 && diffDays(today, t.due) <= 21)
    .sort((a, b) => a.due.localeCompare(b.due));
}

// ───────── Monthly post ideas ─────────
const SEASONAL: [string, string, string][] = [
  ["New year, new numbers", "Film yourself outside a home in your area: what last year did and what you expect this year.", "What happened in {area} real estate last year, and what I'm watching this year. Questions? Ask me below. {first}, SpaceMatch"],
  ["Tax-season tip", "Show a folder of closing papers. 30 seconds on what homeowners can keep for taxes (tell them to ask their CPA).", "Bought or sold a home last year? Keep your closing statement handy at tax time. Ask your CPA what applies to you. {first}, SpaceMatch"],
  ["Spring prep checklist", "Walk a home and point at 3 things to fix before listing: paint, light, curb.", "Thinking of selling this spring in {area}? Start with these 3 things. Want the full checklist? DM me. {first}, SpaceMatch"],
  ["Open house season", "Film the setup of an open house: signs, lights, sign-in QR.", "Spring open houses are back in {area}. Here's how we set one up. Want to see a home this weekend? Message me. {first}, SpaceMatch"],
  ["Curb appeal in 1 weekend", "Before/after of a front entry: planters, house numbers, door.", "Small weekend projects that help a home sell faster in {area}. Which one would you try? {first}, SpaceMatch"],
  ["Summer moves and schools", "At a local park or school: why summer is the busiest moving season.", "Moving before school starts? In {area} the summer market moves fast. Here's how to plan it. {first}, SpaceMatch"],
  ["Mid-year market check", "Half-year numbers on screen, you explaining one surprise.", "Halfway through the year in {area}: here's what changed. Want your home's number? I'll run it free. {first}, SpaceMatch"],
  ["Best summer spot", "Your favorite patio, beach or street festival in the area.", "My favorite summer spot in {area}. Where's yours? {first}, SpaceMatch"],
  ["Fall listing window", "Explain why September and October still work for sellers.", "Fall is a great time to sell in {area}: less competition, serious buyers. Thinking about it? Let's talk. {first}, SpaceMatch"],
  ["Cozy home staging", "Stage one room for fall in 60 seconds: throw, lamp, candle.", "Three small fall staging tricks buyers notice. Selling soon? I can help. {first}, SpaceMatch"],
  ["Thankful for clients", "Short thank-you to past clients with a photo of a recent closing.", "Grateful for every family I helped this year in {area}. Thank you. {first}, SpaceMatch"],
  ["Year in review", "Your year in 5 clips: listings, closings, team moments.", "My year in {area} real estate. Thank you for trusting me. Here's to next year. {first}, SpaceMatch"],
];
const STORIES: [string, string, string][] = [
  ["Client story", "Tell one real deal in 30 seconds: the problem, what you did, the result (ask the client first).", "How we got this {area} family moved in [X] days. Every deal has a story. {first}, SpaceMatch"],
  ["Myth vs fact", "Hold up a sign with a common myth, flip to the fact.", "Myth: you need 20% down to buy in {area}. Fact: many buyers put down much less. Ask me how. {first}, SpaceMatch"],
  ["Day in the life", "Morning to evening in 6 clips: showings, calls, a closing.", "A day in the life of a {area} agent. What should I show next? {first}, SpaceMatch"],
  ["Buyer tip", "One mistake buyers make, in 20 seconds.", "Buying in {area}? Don't skip this step. Questions? DM me. {first}, SpaceMatch"],
];

export type PostIdea = { kind: string; title: string; shots: string; caption: string; to?: string; toLabel?: string };
export function postIdeas(month: number, firstName: string, area: string): PostIdea[] {
  const fill = (s: string) => s.replaceAll("{area}", area).replaceAll("{first}", firstName);
  const [sTitle, sShots, sCap] = SEASONAL[month % 12];
  const [tTitle, tShots, tCap] = STORIES[month % STORIES.length];
  return [
    { kind: "Market update", title: `${area} this month`, shots: "Stand outside a home or a street sign in your area. Say 3 numbers: median price, homes sold, days on market.", caption: fill(`{area} market update: [median price], [homes sold] sold, [days] days on market. Want your home's value? Message me. {first}, SpaceMatch`), to: "/market-update", toLabel: "Get my numbers" },
    { kind: "Seasonal", title: sTitle, shots: sShots, caption: fill(sCap) },
    { kind: "Neighborhood spot", title: `A favorite spot in ${area}`, shots: "Coffee shop, restaurant or park. 3 clips: outside, inside, you saying why you love it.", caption: fill(`One of my favorite spots in {area}. If you're thinking of moving here, this is the kind of place you get. {first}, SpaceMatch`) },
    { kind: "Story or tip", title: tTitle, shots: tShots, caption: fill(tCap), to: "/reels", toLabel: "Turn it into a Reel" },
  ];
}

// ───────── Market update script ─────────
export type Stats = { median?: number | null; sales?: number | null; domMedian?: number | null; active?: number | null; yoyPct?: number | null; soldToList?: number | null; monthsSupply?: number | null };
export const monthName = (ym: string) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export function updateKit(area: string, month: string, s: Stats, firstName: string, source: "mred" | "agent") {
  const m = monthName(month);
  const yoy = s.yoyPct != null ? ` That's ${s.yoyPct >= 0 ? "up" : "down"} ${Math.abs(s.yoyPct)}% from a year ago.` : "";
  const supply = s.monthsSupply != null ? ` We have about ${s.monthsSupply} months of supply, ${s.monthsSupply < 4 ? "which still favors sellers" : "which gives buyers more room"}.` : "";
  const src = source === "mred" ? `Source: MRED, ${m}. Detached + attached homes.` : `Numbers entered by ${firstName} from connectMLS, ${m}.`;
  const script = `Here's what happened in ${area} real estate in ${m}. The median sold price was ${money(s.median)}.${yoy} ${s.sales ?? "–"} homes sold, and the typical home went under contract in ${s.domMedian ?? "–"} days. Right now there are ${s.active ?? "–"} homes for sale.${supply} Want to know what yours would sell for? Send me a message. I'm ${firstName} with SpaceMatch.`;
  const caption = `${area} market update, ${m}\n• Median sold price: ${money(s.median)}${s.yoyPct != null ? ` (${s.yoyPct >= 0 ? "+" : ""}${s.yoyPct}% vs last year)` : ""}\n• Homes sold: ${s.sales ?? "–"}\n• Days on market: ${s.domMedian ?? "–"}\n• For sale now: ${s.active ?? "–"}\nWant your home's number? DM me.\n${src}`;
  const text = `Hi! Quick ${area} update for ${m}: median sold price ${money(s.median)}, ${s.sales ?? "–"} homes sold, ${s.domMedian ?? "–"} days on market. Curious what your home would sell for? – ${firstName}`;
  return { script, caption, text, src };
}

// ───────── Business card vCard ─────────
export function vcard(p: { name: string; phone?: string; email?: string; title?: string; url: string }) {
  const [first, ...rest] = p.name.split(" ");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${rest.join(" ")};${first};;;`,
    `FN:${p.name}`,
    "ORG:SpaceMatch Inc. · a team of Real Broker\\, LLC",
    p.title ? `TITLE:${p.title}` : "",
    p.phone ? `TEL;TYPE=CELL:${p.phone}` : "",
    "TEL;TYPE=WORK:(773) 985-7153",
    p.email ? `EMAIL:${p.email}` : "",
    "ADR;TYPE=WORK:;;2822 Central St.;Evanston;IL;60201;USA",
    `URL:${p.url}`,
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

export const smsLink = (body: string, phone = "") => `sms:${phone.replace(/[^\d+]/g, "")}${/iPhone|iPad|Mac/.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(body)}`;
export const mailLink = (subject: string, body: string, to = "") => `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
