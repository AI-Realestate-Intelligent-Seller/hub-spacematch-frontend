// Ad Kit: tiers, prices and the per-listing marketing kit (copy, campaign names,
// tracking links, YouTube script). Plain templates — no AI, no credits.
// Shared by the backend (orders/ledger) and the UI (order dialog, kit view).

export type TierKey = "essential" | "signature" | "luxury";
export type Tier = {
  key: TierKey; name: string; spend: number; fee: number;
  split: { meta: number; google: number; youtube: number }; // ad spend per channel (14 days)
  blurb: string; includes: string[];
};
export type AdPricing = { tiers: Tier[]; openHouse: { spend: number; fee: number }; closingSurcharge: number; days: number };

// Approved by Michael 2026-10-18 (#listing-lead-creating-engine). Admins can edit in the Hub.
export const DEFAULT_PRICING: AdPricing = {
  tiers: [
    {
      key: "essential", name: "Essential", spend: 350, fee: 75, split: { meta: 200, google: 100, youtube: 50 },
      blurb: "Most homes under $750K",
      includes: ["Instagram + Facebook ads, 14 days", "Google search ads", "YouTube listing video ad", "Just Listed + Just Sold ads", "Seller sees results live"],
    },
    {
      key: "signature", name: "Signature", spend: 700, fee: 125, split: { meta: 350, google: 200, youtube: 150 },
      blurb: "$750K–$1.5M, or extra push",
      includes: ["Everything in Essential", "2× reach on Instagram + Facebook", "Retargeting site visitors", "Longer YouTube flight", "Day-7 tune-up"],
    },
    {
      key: "luxury", name: "Luxury", spend: 1200, fee: 200, split: { meta: 500, google: 300, youtube: 400 },
      blurb: "$1.5M+ and signature properties",
      includes: ["Everything in Signature", "Big YouTube push (North Shore + city)", "Luxury audience targeting", "Premium search coverage", "Day-7 + Day-14 tune-ups"],
    },
  ],
  openHouse: { spend: 60, fee: 15 },
  closingSurcharge: 50,
  days: 14,
};

export function priceOf(p: AdPricing, tierKey: string, openHouse: boolean, payment: "ahead" | "closing") {
  const t = p.tiers.find(x => x.key === tierKey);
  if (!t) throw new Error("Pick a package");
  const spend = t.spend + (openHouse ? p.openHouse.spend : 0);
  const fee = t.fee + (openHouse ? p.openHouse.fee : 0);
  const surcharge = payment === "closing" ? p.closingSurcharge : 0;
  return { tier: t, spend, fee, surcharge, total: spend + fee + surcharge };
}

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n + 1).replace(/\s+\S*$/, "").replace(/[,.·\s]+$/, "") + ".");

export const slugOf = (address: string) =>
  address.split(",")[0].toLowerCase().replace(/#/g, "unit-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
export const streetOf = (address: string) => address.split(",")[0].trim();

export type KitInput = { address: string; price?: string; agentName: string; agentPhone?: string; website?: string; tour?: string; reel?: string };
export type AdKit = {
  campaigns: { channel: string; name: string; budget: number; url: string }[];
  meta: { primary: string[]; headlines: string[]; description: string; cta: string };
  google: { headlines: string[]; descriptions: string[]; keywords: string[] };
  youtube: { title: string; script: string };
  instagram: { caption: string };
  justListed: { headline: string; text: string };
  justSold: { headline: string; text: string };
  openHouse?: { headline: string; text: string };
  checklist: string[];
};

const OFFICE = "(773) 985-7153";

export function buildKit(k: KitInput, tier: Tier, withOpenHouse: boolean, ohSpend: number): AdKit {
  const street = streetOf(k.address);
  const town = (k.address.split(",")[1] ?? "Chicago").trim() || "Chicago";
  const slug = slugOf(k.address);
  const base = k.website?.trim() || "https://spacematchinc.com";
  const url = (source: string) => `${base}${base.includes("?") ? "&" : "?"}utm_source=${source}&utm_medium=paid&utm_campaign=${slug}`;
  const price = k.price ? ` · ${k.price}` : "";
  const phone = k.agentPhone || OFFICE;
  const name = (ch: string, phase = "Launch") => `SM | ${street} | ${ch} | ${phase}`;
  const campaigns = [
    { channel: "Instagram + Facebook", name: name("Meta"), budget: tier.split.meta, url: url("meta") },
    { channel: "Google search", name: name("Google"), budget: tier.split.google, url: url("google") },
    { channel: "YouTube", name: name("YouTube"), budget: tier.split.youtube, url: url("youtube") },
  ];
  if (withOpenHouse) campaigns.push({ channel: "Open house (Instagram + Facebook)", name: name("Meta", "Open House"), budget: ohSpend, url: url("meta_oh") });

  return {
    campaigns,
    meta: {
      primary: [
        `Just listed in ${town}: ${street}${price}. Tour it before it's gone — photos, video and details at the link.`,
        `New on the market — ${street}, ${town}${price}. Book a private showing with ${k.agentName}: ${phone}.`,
        `Take a look inside ${street}. Fresh listing from SpaceMatch Inc. Tap to see the full tour.`,
      ],
      headlines: [`${street}${price}`, `Just listed in ${town}`, "Book a private showing"],
      description: "SpaceMatch Inc. · a team of Real Broker, LLC",
      cta: "Learn more",
    },
    google: {
      headlines: [street.slice(0, 30).trim(), `Homes for sale ${town}`.length <= 30 ? `Homes for sale ${town}` : "Homes for Sale Near You", "Just Listed — Tour Today", "Book a Private Showing", "SpaceMatch Inc.", `See Photos & Price`],
      descriptions: [
        clip(`New listing at ${street}, ${town}. See photos and details, then book a showing.`, 90),
        clip(`Call ${phone} or request a showing online. SpaceMatch Inc. · Real Broker, LLC.`, 90),
      ],
      keywords: [`"${street}"`, `"homes for sale ${town.toLowerCase()}"`, `"${town.toLowerCase()} real estate"`, `"condos for sale ${town.toLowerCase()}"`, `"${street.toLowerCase()} for sale"`],
    },
    youtube: {
      title: `${street}, ${town} — Home Tour${price}`,
      script: [
        `[0–3s] Exterior hero shot. On screen: "JUST LISTED · ${street}".`,
        `[3–10s] "Welcome to ${street} in ${town}. Let me show you around." — walk through the front door.`,
        `[10–25s] Kitchen, living room, best feature. One line each, no superlatives about who should live here.`,
        `[25–35s] Bedrooms, bath, outdoor space or view.`,
        `[35–45s] "${k.price ? `Offered at ${k.price}. ` : ""}Book a private showing with ${k.agentName} at ${phone}, or tap the link for the full tour."`,
        `End card: SpaceMatch Inc. · a team of Real Broker, LLC · Equal Housing Opportunity.`,
      ].join("\n"),
    },
    instagram: {
      caption: `JUST LISTED ✨ ${street}, ${town}${price}\n\nSwipe through, then DM us or tap the link in bio for the full tour and a private showing.\n\n${k.agentName} · ${phone}\nSpaceMatch Inc. · a team of Real Broker, LLC\n#justlisted #${town.toLowerCase().replace(/[^a-z]/g, "")}realestate #chicagohomes #spacematch`,
    },
    justListed: { headline: `Just Listed · ${street}`, text: `${street}, ${town}${price} is now on the market. See the photos and book a showing: ${url("just_listed")}` },
    justSold: { headline: `Just Sold · ${street}`, text: `Another one sold by SpaceMatch Inc. Thinking about selling? Get your home's value: https://spacematchinc.com?utm_source=meta&utm_medium=paid&utm_campaign=${slug}-sold` },
    openHouse: withOpenHouse ? { headline: `Open House · ${street}`, text: `Join us this weekend at ${street}, ${town}. Stop by and take a look — no appointment needed.` } : undefined,
    checklist: [
      "Housing ads: Meta campaign must use the HOUSING special ad category (location radius 15 mi+, no age/gender targeting).",
      "Use listing photos/video only — no people in a way that implies who should live there.",
      "Every ad: 'SpaceMatch Inc. · a team of Real Broker, LLC' + Equal Housing Opportunity where space allows.",
      "Keep the campaign name exactly as above so results show up on the seller's page automatically.",
      "Tracking links carry utm_campaign=" + slug + " so website visits count toward this listing.",
    ],
  };
}
