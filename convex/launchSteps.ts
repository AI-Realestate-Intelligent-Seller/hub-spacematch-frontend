// Seller Launch Portal: the launch system from the SpaceMatch listing presentation.
// Shared by the backend (default steps) and the frontend (labels, seller copy).
export type LaunchStepDef = { key: string; label: string; seller: string };

export const LAUNCH_STEPS: LaunchStepDef[] = [
  { key: "media", label: "Media day", seller: "Professional photos, video and 3D tour captured." },
  { key: "comingSoon", label: "Coming Soon", seller: "Teaser goes out to our buyer database and partner agents." },
  { key: "reel", label: "Instagram Reel", seller: "Property Reel published on @spacematchchicago." },
  { key: "copy", label: "Listing copy", seller: "Description and feature highlights written and approved." },
  { key: "landing", label: "Property website", seller: "Your home's own landing page goes live." },
  { key: "mls", label: "Live on MLS", seller: "Listed on MLS and syndicated to Zillow, Realtor.com, Redfin and more." },
  { key: "broadcast", label: "Broker broadcast", seller: "Announced to top-producing agents across Chicagoland." },
  { key: "ads", label: "Ads live", seller: "Targeted Instagram, Facebook and Google ads running." },
  { key: "openHouse", label: "Open house", seller: "First public open house held." },
  { key: "day7", label: "Day-7 report", seller: "First full week of results reviewed with you." },
  { key: "day14", label: "Day-14 checkpoint", seller: "Strategy check against the competition and buyer feedback." },
];

export const stepDef = (key: string) => LAUNCH_STEPS.find(s => s.key === key);

export const LISTING_STATUSES = ["Preparing", "Coming soon", "Active", "Under contract", "Closed", "Withdrawn"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

// Normalised street key ("1234 n main st unit 2" → "1234 n main") for matching
// ShowingTime emails and open-house sign-ins to a listing.
export function addressKey(s: string | undefined | null): string {
  const t = (s ?? "")
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\b(north)\b/g, "n")
    .replace(/\b(south)\b/g, "s")
    .replace(/\b(east)\b/g, "e")
    .replace(/\b(west)\b/g, "w")
    .replace(/\s+/g, " ")
    .trim();
  const m = t.match(/^(\d+[a-z]?)\s+(?:([nsew])\s+)?([a-z0-9']+)/);
  if (!m) return t.slice(0, 24);
  return [m[1], m[2], m[3]].filter(Boolean).join(" ");
}

// Monday (UTC date string) of the week containing t.
export function weekOf(t: number): string {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
