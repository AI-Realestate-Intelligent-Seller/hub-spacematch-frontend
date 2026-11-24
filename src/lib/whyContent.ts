import { OFFICE_ADDRESS } from "../../convex/officeDefs";
// Copy for the public "Why SpaceMatch" page (/m/<agent>). Facts come from the approved
// seller deck v6, the Oct-2026 mailer and published reviews. Do not add numbers without a source.
export type WhyPath = "sell" | "buy" | "both";

export const PATH_LABEL: Record<WhyPath, string> = { sell: "Selling", buy: "Buying", both: "Selling & buying" };

export const STATS = [
  { n: "5.0★", l: "Across 115 Google & Zillow reviews" },
  { n: "$116.3M", l: "Closed in 2024 (RealTrends)" },
  { n: "23,000", l: "Buyers in our own CRM" },
  { n: "36,500+", l: "Followers on @spacematchchicago" },
];

export type CompareRow = { k: string; typical: string; sm: string };

export const SELL_ROWS: CompareRow[] = [
  { k: "Pricing", typical: "Priced to win the listing", sm: "Priced on the evidence, with a net sheet before you decide" },
  { k: "Preparation", typical: "Fix it up yourself, or list it as-is", sm: "Stagifi digital staging and decluttering: photos at 2pm, magazine-ready by 7pm" },
  { k: "Media", typical: "Basic photos, posted as-is", sm: "A media day: photography, video, aerial and a listing Reel" },
  { k: "Launch", typical: "Posted on the MLS. Hope buyers find it.", sm: "A 14-day launch: Coming Soon, landing page, broker broadcast, paid ads when included" },
  { k: "Audience", typical: "Rents attention from the portals", sm: "An audience we already own: 23,000 buyers in our CRM and 36,500+ Instagram followers" },
  { k: "Updates", typical: "You call to ask what's happening", sm: "Your own live Seller Portal, plus a summary every Monday" },
  { k: "Who you get", typical: "One agent doing everything alone", sm: "Your agent, backed by a whole team: staging, media, marketing, plus Spanish and Korean speakers" },
];

export const BUY_ROWS: CompareRow[] = [
  { k: "Finding homes", typical: "The same portal alerts everyone gets", sm: "Alerts plus our own Coming Soon listings and agent-network previews, when permitted" },
  { k: "Your pros", typical: "Find a lender, inspector and attorney on your own", sm: "Our vetted Trusted Local Pros: lenders, inspectors, attorneys, contractors" },
  { k: "Offers", typical: "Write it and hope", sm: "Offers built on real comps, by a team that also lists homes and knows what listing agents look for" },
  { k: "Guidance", typical: "Paperwork and surprises", sm: "A clear plan and a buyer guide from first tour to keys" },
  { k: "Support", typical: "One person juggling everything", sm: "Your agent, backed by a 20+ agent team and an operations staff" },
  { k: "Later on", typical: "Done at closing", sm: "When you sell one day, our 14-day launch system is already yours" },
];

export const BOTH_ROWS: CompareRow[] = [
  { k: "Timing", typical: "Two separate plans that don't talk to each other", sm: "One plan and one team for both moves, timed together" },
  { k: "Budget", typical: "Guess what you can afford next", sm: "Your sale's estimated net feeds your next budget. Try the calculator below." },
];

export const LAUNCH = [
  { d: "Day 0", t: "Capture", body: "Media day: photography, video and aerial. Stagifi digital staging the same day." },
  { d: "Day 1", t: "Position", body: "Coming Soon where permitted, the listing Reel, the story and a single-property landing page." },
  { d: "Day 2", t: "Publish", body: "MLS, Zillow, Realtor.com, Redfin and 100+ sites, plus email, all at once." },
  { d: "Day 3", t: "Broadcast", body: "Broker broadcast, our 23,000-buyer database and paid ads when included in the plan." },
  { d: "Weekend", t: "Convert", body: "Open house with lead capture while attention peaks." },
  { d: "Day 7", t: "Analyze", body: "Performance report: views, saves, showings and feedback, live in your Seller Portal." },
  { d: "Day 14", t: "Adjust", body: "We adjust or escalate based on the evidence, not emotion. You approve every material change." },
];

export const BUY_STEPS = [
  { t: "Strategy call", body: "Your must-haves, budget, areas and timing, written into one plan." },
  { t: "Pre-approval", body: "A vetted lender from our Trusted Local Pros, so your offer is taken seriously." },
  { t: "Search", body: "Alerts, plus our team's Coming Soon listings and network previews when permitted." },
  { t: "Tours", body: "We pull comps for every home you love, so you know what it's really worth." },
  { t: "Offer", body: "Price and terms built on the evidence, and on what the listing agent is looking for." },
  { t: "Inspection & attorney", body: "Vetted pros, clear next steps and no surprises." },
  { t: "Keys", body: "Closing coordinated end to end. Then we're here for whatever comes next." },
];

export const BOTH_OPTIONS = [
  { t: "Sell first, then buy", pro: "Cash in hand and a stronger offer", con: "May need a rent-back or short-term housing" },
  { t: "Buy first, then sell", pro: "Move once, on your schedule", con: "Needs financing that covers both homes for a while" },
  { t: "Buy with a sale contingency", pro: "The safest timing", con: "Your offer can be less competitive" },
  { t: "Close both the same day", pro: "One move, no gap", con: "Needs tight coordination, which is what we do" },
];

export const CASES = [
  { img: "/media/why/wolf.jpg", t: "5129 Wolf Rd, Western Springs", s: "$1,500,000 · 2.8-acre site with development upside" },
  { img: "/media/why/trumbull.jpg", t: "7943 S Trumbull, Chicago", s: "40 days unsold before staging → sold above asking in a week" },
  { img: null, t: "4440 W Sunnyside 1N, Chicago", s: "Sold above asking in a week" },
];

export const REVIEWS = [
  { q: "They clearly explained the steps involved in selling our house… We felt completely supported and would recommend them without hesitation.", who: "Hermosa home seller · Zillow, Aug 2026" },
  { q: "Excellent work from Michael and his team. Having such a network of motivated and responsible people is a must in the real estate game. Two closings within the past year and many many more to come!", who: "Alex D." },
  { q: "Michael was an amazing agent to work with. Very knowledgeable of the market and spot on with his pricing. He is personable and accessible at any time. Very detail oriented and very proactive.", who: "Ganseree C." },
  { q: "Michael is one of the most knowledgeable REALTORS in the game! Will recommend it to all my friends and family. Thank you so much to you and your team Michael! Thank you for making our dreams a reality!", who: "Felipe C." },
];

export const STAGING = [
  { before: "/media/why/stagifi-1-before.jpg", after: "/media/why/stagifi-1-after.jpg", label: "Lakefront condo" },
  { before: "/media/why/stagifi-2-before.jpg", after: "/media/why/stagifi-2-after.jpg", label: "City-view living room" },
];

export const OFFICE = OFFICE_ADDRESS;
export const TEAM_LINE = "(773) 985-7153";

/** Brokerage line: Real Broker, LLC from Nov 10 2026 (Chicago date; moved from Oct 29), SpaceMatch Inc. only before. */
export function brokerageLine(now = new Date()) {
  const chicago = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
  return chicago >= "2026-11-09" ? "SpaceMatch Inc. · a team of Real Broker, LLC" : "SpaceMatch Inc.";
}

/** Section ids → names the agent sees in the Hub ("Viewing now · …"). */
export const SECTION_NAMES: Record<string, string> = {
  intro: "Intro",
  path: "What they're planning",
  difference: "The SpaceMatch way",
  staging: "Before & after staging",
  portal: "Seller Portal",
  launch: "14-day launch",
  journey: "Path to keys",
  plan: "Sell & buy timing",
  numbers: "Calculator",
  proof: "Results & reviews",
  agent: "About you",
  next: "Next step",
};
