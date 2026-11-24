import { useEffect, useMemo } from "react";
import { ArrowRight, Info, Phone } from "lucide-react";
import { SellerPortalView, type SellerPortalData } from "./SellerPortalPage";

// Public, read-only demo of the seller launch page for spacematchinc.com ("Try the seller dashboard").
// Everything here is made up and built in the browser — no database reads or writes, nothing is emailed.
const DAY = 864e5;
const SITE = "https://spacematchinc.com";
const TEAM_PHONE = "(773) 985-7153";

function isoDay(t: number) {
  return new Date(t).toISOString().slice(0, 10);
}
function monday(t: number) {
  const d = new Date(t);
  const wd = (d.getUTCDay() + 6) % 7;
  return isoDay(t - wd * DAY);
}

export function buildDemoData(now = Date.now()): SellerPortalData {
  const live = now - 12 * DAY; // 12 days on market
  const at = (daysAgo: number, h = 0) => now - daysAgo * DAY - h * 3600e3;
  const stepAgo: Record<string, number | null> = {
    media: 19, comingSoon: 17, reel: 15, copy: 14, landing: 13, mls: 12, broadcast: 12, ads: 11, openHouse: 9, day7: 5, day14: null,
  };
  const w1 = monday(live), w2 = monday(live + 7 * DAY);
  const ev = (id: string, kind: string, title: string, daysAgo: number, extra: Partial<SellerPortalData["events"][number]> = {}) => ({
    _id: id as never, kind, title, body: undefined as string | undefined, interest: undefined as string | undefined,
    priceOpinion: undefined as string | undefined, rating: undefined as string | undefined, when: undefined as string | undefined,
    createdAt: at(daysAgo, 2), ...extra,
  });
  return {
    address: "2150 Ridge Ave, Evanston, IL 60201",
    price: "$1,150,000",
    status: "Active",
    photoUrl: "/media/site/demo-house.jpg",
    liveDate: isoDay(live),
    links: {},
    sellerFirstName: "Sarah",
    agent: { name: "Your SpaceMatch agent", phone: TEAM_PHONE, email: "team@spacematchinc.com" },
    steps: Object.entries(stepAgo).map(([key, d]) => ({ key, done: d !== null, doneAt: d !== null ? at(d) : undefined, note: undefined })),
    metrics: [
      { weekOf: w1, zillowViews: 1284, zillowSaves: 41, mlsSaved: 9, mlsMaybe: 6, mlsNotInterested: 3, adViews: undefined, adClicks: undefined, reelViews: 6420, tiktokViews: 2310, fbViews: 1870, youtubeViews: 940, auto: ["reel", "youtube"], updatedAt: at(5) },
      { weekOf: w2, zillowViews: 862, zillowSaves: 27, mlsSaved: 12, mlsMaybe: 7, mlsNotInterested: 4, adViews: undefined, adClicks: undefined, reelViews: 9810, tiktokViews: 3480, fbViews: 2650, youtubeViews: 1520, auto: ["reel", "youtube"], updatedAt: at(0, 3) },
    ],
    counts: { showings: 14, feedback: 4, openHouse: 23 },
    events: [
      ev("e1", "offer", "Offer received", 0, { body: "Your agent will call you today to walk through terms.", when: "Today" }),
      ev("e2", "feedback", "Feedback", 1, { body: "Loved the kitchen and the yard. Buyers are comparing it with one other home near the lake.", interest: "Very interested", priceOpinion: "About right", rating: "5" }),
      ev("e3", "showing", "Showing confirmed", 1, { when: "Sat 11:00 AM" }),
      ev("e4", "feedback", "Feedback", 3, { body: "Beautiful light. Second floor bathroom feels dated for the price.", interest: "Somewhat interested", priceOpinion: "A little high", rating: "4" }),
      ev("e5", "update", "Open house: 23 groups signed in", 9, { body: "Two families asked for a second showing." }),
      ev("e6", "feedback", "Feedback", 6, { body: "Great block, steps from the lake. Buyers needed a bigger garage.", interest: "Not for them", priceOpinion: "About right", rating: "4" }),
      ev("e7", "feedback", "Feedback", 8, { body: "Clients loved the layout and want to come back with parents.", interest: "Very interested", priceOpinion: "About right", rating: "5" }),
      ev("e8", "update", "Live on MLS and Zillow", 12, { body: "Syndicated to Zillow, Realtor.com, Redfin and 100+ sites." }),
    ],
    ads: [
      { channel: "meta", status: "running", startDate: isoDay(at(11)), endDate: isoDay(at(-10)), reach: 18640, clicks: 742, leads: 17, auto: true, source: "meta", updatedAt: at(0, 2), note: "Targeting move-up buyers in Evanston and the North Shore." },
      { channel: "google", status: "running", startDate: isoDay(at(11)), endDate: isoDay(at(-10)), reach: 9420, clicks: 388, leads: 6, auto: true, source: "google_ads", updatedAt: at(0, 2) },
      { channel: "website", status: "running", reach: 1130, views: 1650, leads: 9, auto: true, source: "ga", updatedAt: at(0, 1) },
    ],
    social: { reelCheckedAt: at(0, 2), youtubeCheckedAt: at(0, 4) },
    suggestions: [
      { _id: "s1" as never, title: "Refresh the photo order", why: "2,146 Zillow views but most showings come from the yard photo.", action: "Lead with the yard and kitchen photos on Zillow and MLS.", approvedAt: undefined },
      { _id: "s2" as never, title: "Second open house this Sunday", why: "23 groups at the first one and two asked to come back.", action: "Host Sunday 12–2 with a broker preview the Thursday before.", approvedAt: undefined },
      { _id: "s3" as never, title: "Quote the bathroom update", why: "2 showing agents mentioned the upstairs bathroom.", action: "Get a contractor quote to share with buyers as a credit option.", approvedAt: undefined },
    ],
    zillowTotals: { views: 2146, saves: 68 },
    updatedAt: now - 4 * 60e3,
  } as SellerPortalData;
}

export function DemoSellerPage() {
  const data = useMemo(() => buildDemoData(), []);
  useEffect(() => {
    document.title = "Seller dashboard demo · SpaceMatch";
    const m = document.createElement("meta");
    m.name = "robots"; m.content = "noindex";
    document.head.appendChild(m);
    return () => { m.remove(); };
  }, []);
  const top = (
    <section className="flex gap-3 rounded-2xl bg-[#FBF3E4] p-4 text-[15px] ring-1 ring-[#E8D3A8]" data-testid="demo-banner">
      <Info className="mt-0.5 size-5 shrink-0 text-[#9C7434]" aria-hidden />
      <p><b>This is a demo.</b> The listing and every number on this page are made up. When you list with SpaceMatch, your own private page updates on its own from Zillow, ShowingTime, Instagram, YouTube and your ads, and you get a summary email every Monday.</p>
    </section>
  );
  const bottom = (
    <section className="rounded-2xl bg-[#0A0A0A] p-6 text-white" data-testid="demo-cta">
      <p className="text-[11px] uppercase tracking-[0.25em] text-[#D9BC8C]">Want this for your home?</p>
      <h2 className="mt-1 font-display text-2xl leading-snug">Get your home value and your launch plan</h2>
      <p className="mt-2 text-[15px] text-white/70">A SpaceMatch agent prepares a branded market analysis, usually the same day, and walks you through the launch timeline above.</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <a href={`${SITE}/home-valuation`} className="flex items-center justify-center gap-2 rounded-xl bg-[#9C7434] py-3 font-semibold active:scale-[0.99]">Get my home value <ArrowRight className="size-4" /></a>
        <a href="tel:7739857153" className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 font-semibold active:scale-[0.99]"><Phone className="size-4 text-[#D9BC8C]" /> Call or text {TEAM_PHONE}</a>
      </div>
      <a href={`${SITE}/your-listing-live`} className="mt-4 block text-center text-sm text-white/60 underline">Back to spacematchinc.com</a>
    </section>
  );
  return <SellerPortalView data={data} token="demo" demo top={top} bottom={bottom} />;
}
