// Reel Studio (Michael 2026-10-28): agents order an edited Reel from their own clips + team B-roll.
// Prices are fixed here (Michael: $12 Quick / $25 Signature / $4 extra revision). Paid by Zelle
// up front; Michael confirms the money arrived, then Viktor edits. Shared by the UI and Convex.


export type ReelTier = {
  key: "quick" | "signature";
  name: string;
  price: number;
  maxSeconds: number;
  maxClips: number;
  revisions: number;
  broll: boolean;
  blurb: string;
  includes: string[];
};

export const REEL_TIERS: ReelTier[] = [
  {
    key: "quick",
    name: "Quick Reel",
    price: 12,
    maxSeconds: 30,
    maxClips: 3,
    revisions: 1,
    broll: false,
    blurb: "One talking clip (or up to 3 short ones), trimmed tight, up to 30 seconds.",
    includes: ["Up to 3 clips, up to 30 sec", "Cut out ums and pauses", "Captions you can edit", "Your end card", "1 revision"],
  },
  {
    key: "signature",
    name: "Signature Reel",
    price: 25,
    maxSeconds: 60,
    maxClips: 10,
    revisions: 2,
    broll: true,
    blurb: "Up to 10 clips stitched into one story (drive in, the property, sit-down), with your supporting footage, up to 60 seconds.",
    includes: ["Up to 10 clips combined, up to 60 sec", "Choose supporting clips and title graphics", "Captions you can edit", "2 revisions"],
  },
];
export const CAPTION_SPOTS: Opt[] = [
  // Michael 11-08: "there should be some on top and the middle". Never over the face itself.
  { key: "high", label: "Top", hint: "Above your head. Good for tours, titles and walk-and-talks." },
  { key: "mid", label: "Middle", hint: "Center, just under your chin. Big bold words, the most-watched spot." },
  { key: "low", label: "Bottom", hint: "Lower third. Calm and classic." },
];
export const EXTRA_REVISION_PRICE = 4;
// Free Reels per agent (either package), no Zelle; they go straight to the queue.
// Michael 2026-10-28: first Reel free → 2026-11-08: "allow 5 free reels for my agents". 0 turns it off.
export const FREE_REELS = 5;
export const tierOf = (k: string) => REEL_TIERS.find(t => t.key === k) ?? REEL_TIERS[0];

type Opt = { key: string; label: string; hint?: string };

export const PURPOSES: Opt[] = [
  { key: "meet", label: "Meet me" },
  { key: "just_listed", label: "Just listed" },
  { key: "just_sold", label: "Just sold" },
  { key: "open_house", label: "Open house" },
  { key: "tour", label: "Property tour" },
  { key: "market", label: "Market update" },
  { key: "tip", label: "Buyer or seller tip" },
  { key: "story", label: "Client story" },
  { key: "area", label: "Neighborhood" },
  { key: "business", label: "Business for sale" },
  { key: "day", label: "Day in my life" },
  { key: "other", label: "Something else" },
];

// What each clip is, so Viktor can put the pieces in the right order.
export const CLIP_ROLES: Opt[] = [
  { key: "talk", label: "Me talking to camera" },
  { key: "car", label: "Driving / on the way" },
  { key: "arrive", label: "Arriving / outside" },
  { key: "walk", label: "Walkthrough" },
  { key: "broll", label: "Shots of the place (no talking)" },
  { key: "client", label: "Client or guest" },
  { key: "other", label: "Other" },
];

/** Caption + motion look. Previews are drawn in the browser from these fields (no video files).
 *  All SpaceMatch originals: named and designed in-house, not copied from other teams. */
export type ReelStyle = {
  key: string;
  label: string;
  hint: string;
  for: string[]; // purpose keys it suits best ("all" = any)
  font: "sans" | "serif" | "condensed" | "rounded" | "mono" | "script";
  weight: number;
  upper: boolean;
  caption: "pop" | "line" | "box" | "underline" | "outline" | "typewriter" | "stack" | "karaoke";
  position: "lower" | "middle" | "upper";
  motion: "calm" | "punchy" | "glide" | "snap";
};

export const STYLES: ReelStyle[] = [
  // Michael 11-08: "always check for creativity, update to the most trending styles". Viktor applies this week's
  // best-performing format for the Reel type (reelTrends table, refreshed weekly by the worker).
  { key: "trending", label: "Social edit", hint: "A short hook, quick cuts and prominent captions", for: ["all"], font: "sans", weight: 900, upper: false, caption: "karaoke", position: "middle", motion: "punchy" },
  { key: "clean", label: "Clean", hint: "Simple cuts, white captions, gentle zooms", for: ["all"], font: "sans", weight: 700, upper: false, caption: "line", position: "lower", motion: "calm" },
  { key: "gold_pop", label: "Gold Pop", hint: "Big word-by-word captions, key words in your accent color", for: ["all"], font: "sans", weight: 900, upper: true, caption: "pop", position: "middle", motion: "punchy" },
  { key: "gold_coast", label: "Gold Coast", hint: "Serif titles, slow glides, thin gold rules", for: ["just_listed", "tour", "open_house"], font: "serif", weight: 600, upper: false, caption: "underline", position: "lower", motion: "glide" },
  { key: "penthouse", label: "Penthouse", hint: "Luxury: wide letter spacing, slow fades, black bars", for: ["just_listed", "tour", "just_sold"], font: "serif", weight: 500, upper: true, caption: "line", position: "lower", motion: "glide" },
  { key: "lakefront", label: "Lakefront", hint: "Airy and light, soft captions, calm pace", for: ["tour", "area", "day"], font: "rounded", weight: 600, upper: false, caption: "line", position: "lower", motion: "calm" },
  { key: "headline", label: "Headline", hint: "Newsroom look: bold boxed captions, ticker-style title", for: ["market", "tip"], font: "condensed", weight: 800, upper: true, caption: "box", position: "upper", motion: "snap" },
  { key: "whiteboard", label: "Whiteboard", hint: "Teacher mode: numbered points pop up as you speak", for: ["tip", "market"], font: "rounded", weight: 800, upper: false, caption: "stack", position: "lower", motion: "snap" },
  { key: "bold_block", label: "Bold Block", hint: "Chunky boxed words, fast punch-ins", for: ["tip", "meet", "day"], font: "sans", weight: 900, upper: true, caption: "box", position: "middle", motion: "punchy" },
  { key: "sold_stamp", label: "Sold Stamp", hint: "Celebration: stamp-in title, confetti hit, quick cuts", for: ["just_sold"], font: "condensed", weight: 900, upper: true, caption: "pop", position: "upper", motion: "punchy" },
  { key: "open_door", label: "Open Door", hint: "Date and time card up top, warm welcome feel", for: ["open_house"], font: "sans", weight: 800, upper: false, caption: "box", position: "upper", motion: "glide" },
  { key: "blueprint", label: "Blueprint", hint: "Thin lines and labels, room names call-outs", for: ["tour", "just_listed"], font: "mono", weight: 600, upper: true, caption: "underline", position: "upper", motion: "calm" },
  { key: "storyteller", label: "Storyteller", hint: "Cinematic letterbox, simple lower captions", for: ["story", "meet", "business"], font: "serif", weight: 600, upper: false, caption: "line", position: "lower", motion: "glide" },
  { key: "street_level", label: "Street Level", hint: "City energy: map pins, block names, quick cuts", for: ["area", "day"], font: "condensed", weight: 800, upper: true, caption: "outline", position: "upper", motion: "snap" },
  { key: "karaoke", label: "Karaoke", hint: "Each word lights up in your accent as you say it", for: ["all"], font: "sans", weight: 800, upper: false, caption: "karaoke", position: "middle", motion: "punchy" },
  { key: "typewriter", label: "Typewriter", hint: "Words type on screen, calm and personal", for: ["meet", "story", "tip"], font: "mono", weight: 600, upper: false, caption: "typewriter", position: "lower", motion: "calm" },
  { key: "outline", label: "Outline", hint: "Hollow outlined captions with a solid key word", for: ["meet", "day", "area"], font: "condensed", weight: 900, upper: true, caption: "outline", position: "middle", motion: "punchy" },
  { key: "signature_script", label: "Signature", hint: "Handwritten-style accent words over clean captions", for: ["meet", "story", "just_sold"], font: "script", weight: 600, upper: false, caption: "line", position: "lower", motion: "glide" },
  { key: "boardroom", label: "Boardroom", hint: "Business tone: numbers on cards, sharp cuts", for: ["business", "market"], font: "sans", weight: 700, upper: false, caption: "box", position: "lower", motion: "snap" },
  { key: "minimal", label: "Minimal", hint: "Small captions, lots of space, no effects", for: ["all"], font: "sans", weight: 500, upper: false, caption: "line", position: "lower", motion: "calm" },
  { key: "neon_night", label: "Night Out", hint: "Glowing accent words, darker grade, upbeat", for: ["area", "day", "meet"], font: "rounded", weight: 900, upper: true, caption: "pop", position: "middle", motion: "punchy" },
  { key: "magazine", label: "Magazine", hint: "Cover-style title, serif + sans mix", for: ["just_listed", "meet", "tour"], font: "serif", weight: 700, upper: true, caption: "stack", position: "upper", motion: "glide" },
  { key: "countdown", label: "Countdown", hint: "Big numbers for lists: 3 things, 5 mistakes", for: ["tip", "market"], font: "condensed", weight: 900, upper: true, caption: "stack", position: "middle", motion: "snap" },
  { key: "split_screen", label: "Split Screen", hint: "You on top, the property below", for: ["tour", "just_listed", "market"], font: "sans", weight: 800, upper: false, caption: "box", position: "middle", motion: "snap" },
  { key: "warm_film", label: "Warm Film", hint: "Soft film grade, warm tones, relaxed", for: ["story", "day", "area"], font: "serif", weight: 500, upper: false, caption: "line", position: "lower", motion: "calm" },
];
export const styleOf = (k: string) => STYLES.find(s => s.key === k) ?? STYLES[0];

export type Palette = { key: string; label: string; bg: string; accent: string; text: string };
const pal = (key: string, label: string, bg: string, accent: string, text = "#FFFFFF"): Palette => ({ key, label, bg, accent, text });
export const PALETTES: Palette[] = [
  pal("black_gold", "SpaceMatch black & gold", "#0A0A0A", "#C9A15A"),
  pal("cream_gold", "Cream & gold", "#F7F5F1", "#9C7434", "#0A0A0A"),
  pal("white_black", "White & black", "#FFFFFF", "#0A0A0A", "#0A0A0A"),
  pal("black_white", "Black & white", "#0A0A0A", "#FFFFFF"),
  pal("navy_gold", "Navy & gold", "#14213D", "#D9BC8C"),
  pal("navy_sky", "Navy & sky", "#0B2545", "#8DB3E2"),
  pal("royal_white", "Royal blue", "#1D3FBF", "#FFFFFF"),
  pal("teal_coral", "Teal & coral", "#0F4C5C", "#FF7F66"),
  pal("emerald_cream", "Emerald & cream", "#0B4F3C", "#F2E8CF"),
  pal("forest_sage", "Forest & sage", "#1F3A2E", "#A3B899"),
  pal("olive_sand", "Olive & sand", "#4A4A2E", "#E3D3A8"),
  pal("burgundy_blush", "Burgundy & blush", "#5C1A2B", "#F2C6C2"),
  pal("wine_gold", "Wine & gold", "#4B0F24", "#D4AF37"),
  pal("red_white", "Red & white", "#C1121F", "#FFFFFF"),
  pal("coral_cream", "Coral & cream", "#E9645A", "#FFF4E6"),
  pal("blush_charcoal", "Blush & charcoal", "#F6D6D3", "#333333", "#1A1A1A"),
  pal("lilac_plum", "Lilac & plum", "#D9CFF0", "#4B2C6B", "#1A1A1A"),
  pal("purple_gold", "Purple & gold", "#3C1E6E", "#F2C14E"),
  pal("orange_navy", "Orange & navy", "#F28C28", "#14213D", "#14213D"),
  pal("sunshine_black", "Sunshine & black", "#FFD23F", "#0A0A0A", "#0A0A0A"),
  pal("mint_charcoal", "Mint & charcoal", "#CFEFE2", "#2B2B2B", "#1A1A1A"),
  pal("slate_copper", "Slate & copper", "#2F3E46", "#C8794A"),
  pal("charcoal_lime", "Charcoal & lime", "#222222", "#B5E655"),
  pal("taupe_white", "Taupe & white", "#8B7D6B", "#FFFFFF"),
  pal("stone_black", "Stone & black", "#D6D2C4", "#0A0A0A", "#0A0A0A"),
  pal("custom", "My own brand colors", "#0A0A0A", "#9C7434"),
];

export const PACES: Opt[] = [
  { key: "calm", label: "Calm" },
  { key: "normal", label: "Normal" },
  { key: "fast", label: "Fast" },
];

/** Two takes per mood (Michael 11-08: "no samples or variations"). Files: public/reel-music/<mood>_<take>.mp3
 *  (30 s loops, -16 LUFS); the worker uses the same take from /work/data/reel_studio/music/lib/. */
export const MUSIC_TAKES: Record<string, { a: string; b: string }> = {
  upbeat: { a: "Acoustic pop with claps", b: "Modern synth pop" },
  chill: { a: "Electric piano groove", b: "Laid-back guitar" },
  luxury: { a: "Deep house lounge", b: "Elegant piano" },
  cinematic: { a: "Big orchestral build", b: "Emotional piano & strings" },
  hiphop: { a: "Smooth keys beat", b: "Guitar & scratches" },
  lofi: { a: "Jazzy keys & vinyl", b: "Lazy swing beat" },
  acoustic: { a: "Fingerpicked guitar", b: "Ukulele & claps" },
  piano: { a: "Gentle solo piano", b: "Piano & soft pads" },
  jazz: { a: "Smooth sax lounge", b: "Upbeat swing" },
  electronic: { a: "Future bass energy", b: "Melodic house" },
  inspiring: { a: "Uplifting modern beat", b: "Ukulele & whistles" },
  latin: { a: "Latin guitar groove", b: "Salsa brass" },
};
export const musicUrl = (mood: string, take: "a" | "b" = "a") => `/reel-music/${mood}_${take}.mp3`;

export const MUSIC: Opt[] = [
  { key: "upbeat", label: "Upbeat pop" },
  { key: "chill", label: "Chill" },
  { key: "luxury", label: "Luxury / elegant" },
  { key: "cinematic", label: "Cinematic" },
  { key: "hiphop", label: "Hip-hop beat" },
  { key: "lofi", label: "Lo-fi" },
  { key: "acoustic", label: "Acoustic" },
  { key: "piano", label: "Soft piano" },
  { key: "jazz", label: "Jazz" },
  { key: "electronic", label: "Electronic" },
  { key: "inspiring", label: "Inspiring / corporate" },
  { key: "latin", label: "Latin" },
  { key: "none_trending", label: "Trending sound (I add it in the app)" },
  { key: "none", label: "No music" },
];

export const CTAS: (Opt & { for: string[] })[] = [
  { key: "call", label: "Call or text me", for: ["all"] },
  { key: "dm", label: "DM me", for: ["all"] },
  { key: "bio", label: "Link in bio", for: ["all"] },
  { key: "worth", label: "What's my home worth?", for: ["market", "just_sold", "area", "tip", "meet"] },
  { key: "showing", label: "Book a private showing", for: ["just_listed", "tour", "open_house"] },
  { key: "openhouse", label: "Come to the open house", for: ["open_house", "just_listed"] },
  { key: "comment", label: "Comment \"INFO\" for details", for: ["just_listed", "tour", "tip", "business"] },
  { key: "report", label: "Get my free market report", for: ["market", "area"] },
  { key: "search", label: "Get homes like this first", for: ["just_listed", "just_sold", "tour", "area"] },
  { key: "sell", label: "Thinking of selling? Let's talk", for: ["just_sold", "market", "story"] },
  { key: "buy", label: "Ready to buy? Let's talk", for: ["tip", "area", "day"] },
  { key: "business", label: "Selling a business? Confidential call", for: ["business"] },
  { key: "join", label: "Join our team", for: ["day", "meet"] },
  { key: "site", label: "spacematchinc.com", for: ["all"] },
  { key: "custom", label: "Write my own", for: ["all"] },
  { key: "none", label: "No call to action", for: ["all"] },
];
export const ctasFor = (purpose: string) => CTAS.filter(c => c.for.includes("all") || c.for.includes(purpose));

export type ReelFormat = { key: string; label: string; size: string; w: number; h: number; group: "vertical" | "feed" | "wide" };
export const FORMATS: ReelFormat[] = [
  { key: "instagram", label: "Instagram Reel", size: "1080×1920", w: 1080, h: 1920, group: "vertical" },
  { key: "tiktok", label: "TikTok", size: "1080×1920", w: 1080, h: 1920, group: "vertical" },
  { key: "shorts", label: "YouTube Shorts", size: "1080×1920", w: 1080, h: 1920, group: "vertical" },
  { key: "fb_reel", label: "Facebook Reel", size: "1080×1920", w: 1080, h: 1920, group: "vertical" },
  { key: "fb_feed", label: "Facebook / Instagram feed", size: "1080×1350", w: 1080, h: 1350, group: "feed" },
  { key: "youtube", label: "YouTube (wide)", size: "1920×1080", w: 1920, h: 1080, group: "wide" },
];
export const formatOf = (k: string) => FORMATS.find(f => f.key === k);

export const LENGTHS = [15, 30, 60];

export const BROLL_PICKS: Opt[] = [
  { key: "auto", label: "Let the editor pick + make what's needed" },
  { key: "custom", label: "Custom graphics for this video" },
  { key: "seller", label: "Seller clips" },
  { key: "buyer", label: "Buyer clips" },
  { key: "team", label: "Team & proof" },
  { key: "stickers", label: "Title cards" },
  { key: "none", label: "No B-roll" },
];

export type ReelOptions = {
  purpose: string;
  title?: string; // hook / headline the agent wants
  address?: string;
  style: string;
  palette: string;
  customBg?: string;
  customAccent?: string;
  logo: boolean;
  headshot: boolean;
  nameBar: boolean;
  endCard: boolean;
  lengthSec: number;
  pace: string;
  music: string;
  musicTake?: "a" | "b";
  /** music = none_trending: the trending song the agent will add in the app ("Title — Artist"). */
  trendSound?: string;
  captions: boolean;
  /** Where captions sit. Never over a face (Michael 11-08). high = top of the frame, mid = center just under the chin, low = lower third. Defaults to the style's own spot. */
  captionSpot?: "low" | "mid" | "high";
  cta: string;
  ctaText?: string;
  broll: string[];
  formats: string[];
  sample?: ReelSample; // "Copy a sample video" (Michael 2026-10-28)
  autoOrder?: boolean; // "Figure it out for me": the editor works out what each clip is and the order (Michael 2026-10-29)
};

/** A video the agent wants copied in style (not content). Link or uploaded file. */
export type ReelSample = { link?: string; storageId?: string; fileName?: string; size?: number; match: string[] };
export const SAMPLE_MATCH: Opt[] = [
  { key: "edit", label: "Cuts & pace" },
  { key: "captions", label: "Caption & text look" },
  { key: "story", label: "Story order" },
  { key: "effects", label: "Transitions & effects" },
  { key: "music", label: "Music feel" },
  { key: "colors", label: "Colors" },
];
export const SAMPLE_MAX_MB = 300;

export const DEFAULT_OPTIONS: ReelOptions = {
  purpose: "meet",
  style: "trending",
  palette: "black_gold",
  logo: true,
  headshot: true,
  nameBar: true,
  endCard: true,
  lengthSec: 30,
  pace: "normal",
  music: "upbeat",
  captions: true,
  captionSpot: "mid",
  cta: "call",
  broll: ["auto"],
  formats: ["instagram", "tiktok", "shorts", "fb_reel"],
};

const label = (list: Opt[], k?: string) => list.find(o => o.key === k)?.label ?? k ?? "";

/** End-card brokerage line: Real Broker from Nov 9, 2026 (Michael moved to Real that evening). */
export const brokerageLine = (at = Date.now()) =>
  at >= Date.UTC(2026, 10, 9, 6) ? "SpaceMatch Inc. · a team of Real Broker, LLC" : "SpaceMatch Inc.";

/** Human-readable summary rows (emails, admin view, worker brief). */
export function optionRows(o: ReelOptions): [string, string][] {
  const p = PALETTES.find(x => x.key === o.palette);
  return [
    ["Type", label(PURPOSES, o.purpose)],
    ["Headline", o.title ?? ""],
    ["Address", o.address ?? ""],
    ["Style", styleOf(o.style).label],
    ["Colors", o.palette === "custom" ? `Custom ${o.customBg ?? ""} / ${o.customAccent ?? ""}` : p?.label ?? o.palette],
    ["Branding", [o.logo && "SpaceMatch logo", o.headshot && "headshot", o.nameBar && "name bar", o.endCard && "end card"].filter(Boolean).join(", ") || "None"],
    ["Length", `Up to ${o.lengthSec} sec`],
    ["Pace", label(PACES, o.pace)],
    ["Music", o.music === "none_trending" ? `Trending sound added by the agent in the app${o.trendSound ? `: ${o.trendSound}` : ""}` : MUSIC_TAKES[o.music] ? `${label(MUSIC, o.music)} · version ${(o.musicTake ?? "a").toUpperCase()} (${MUSIC_TAKES[o.music][o.musicTake ?? "a"]})` : label(MUSIC, o.music)],
    ["Captions", o.captions === false ? "Off" : `On · ${o.captionSpot === "high" ? "top" : o.captionSpot === "mid" ? "middle" : "bottom"}`],
    ["Call to action", o.cta === "custom" ? `“${o.ctaText ?? ""}”` : label(CTAS, o.cta)],
    ["B-roll", o.broll.map(b => label(BROLL_PICKS, b)).join(", ")],
    ["Formats", o.formats.map(f => formatOf(f)?.label ?? f).join(", ")],
    ["Clip order", o.autoOrder ? "Figure it out for me (Viktor picks what each clip is and the best order)" : ""],
    ["Copy sample", o.sample ? `${o.sample.link ?? o.sample.fileName ?? "Uploaded video"} · match ${o.sample.match.map(m => label(SAMPLE_MATCH, m)).join(", ")}` : ""],
  ];
}

/** Editing steps the worker reports (reel_queue.py stage <id> <key>), shown as a live tracker. */
export const REEL_STAGES: Opt[] = [
  { key: "clips", label: "Getting your clips" },
  { key: "watch", label: "Watching and transcribing" },
  { key: "cut", label: "Cutting the story together" },
  { key: "style", label: "Adding captions, music and branding" },
  { key: "export", label: "Exporting every format" },
  { key: "check", label: "Final check" },
];

/** The /hub/reel-queue cron: every 15 min, 12:00–03:59 UTC (7am–10:45pm Chicago). Next check time. */
export function nextQueueCheck(now = Date.now()) {
  const d = new Date(now);
  const h = d.getUTCHours();
  if (h >= 4 && h < 12) return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0);
  const q = 15 * 60_000;
  return Math.floor(now / q) * q + q;
}

export const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Waiting for your Zelle",
  payment_sent: "Checking your payment",
  queued: "Paid · in line for editing",
  editing: "Editing now",
  needs_info: "Question for you",
  delivered: "Ready",
  revision_payment: "Waiting for revision payment",
  done: "Done",
  cancelled: "Cancelled",
};

export const ACTIVE_STATUSES = ["queued", "editing"];

/** The caption spot a style uses unless the agent changes it. */
export const spotOf = (st: ReelStyle): "low" | "mid" | "high" => (st.position === "upper" ? "high" : st.position === "middle" ? "mid" : "low");
