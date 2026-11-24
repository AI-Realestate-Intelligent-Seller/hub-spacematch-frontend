// Copy for the Agent Videos page (Michael 2026-10-26). Facts only: no follower counts or results promised.
export type Phone = "iphone" | "android";

export const WHY = [
  {
    t: "You film, we edit",
    d: "Your raw clips go to our professional editor (Vidchops). They add captions, B-roll, music and SpaceMatch branding. You never open an editing app.",
  },
  {
    t: "Sellers hire who they've already met",
    d: "Video lets a homeowner see and hear you before they ever call. Posting regularly keeps you top of mind with your farm and your sphere.",
  },
  {
    t: "Free reach on the team page",
    d: "Finished Reels post on the SpaceMatch Instagram (@spacematchchicago). Ask us to add you as a collaborator so the Reel shows on your profile too.",
  },
  {
    t: "One shoot, many uses",
    d: "The same clips can go into listing Reels, your agent page on spacematchinc.com, your Why SpaceMatch link and our YouTube channel.",
  },
  {
    t: "10 minutes, several posts",
    d: "One short filming session can be cut into several Reels when the editor mixes your clips with our team B-roll.",
  },
];

export const STEPS: { t: string; d: string; iphone?: string; android?: string; tip?: string }[] = [
  {
    t: "Set your camera to 4K (one time)",
    d: "Higher resolution gives the editor room to crop and zoom without blur.",
    iphone: "Settings → Camera → Record Video → 4K at 30 fps.",
    android: "Samsung: Camera → ⚙ Settings → Rear video size → UHD 4K (30 fps). Pixel: Camera → Video → ⚙ → Resolution 4K, 30 fps.",
    tip: "Low on storage? 1080p at 30 fps is fine. Never below 1080p.",
  },
  {
    t: "Set up the shot",
    d: "Hold the phone vertical, at eye level, about 3–4 feet away. A tripod or a stack of books beats holding it. Face a window so the light is in front of you, never behind you. Turn off the TV, fans and AC, then wipe the lens.",
    tip: "The back camera is the sharpest. Use the front camera only when you need to see yourself.",
  },
  {
    t: "Record",
    d: "Wait 2 seconds before you start talking and 2 seconds after you finish. If you stumble, pause and start the sentence again. The editor cuts the mistakes. 20 seconds to 3 minutes per clip is ideal.",
    tip: "Leave it raw: no filters, beauty mode, music, text or trimming.",
  },
  {
    t: "Upload the original file",
    d: "Tap \"Upload to my folder\". Google Drive opens your own folder. Tap + → Upload → pick your videos. Use Wi-Fi and keep Drive open until the upload finishes.",
    iphone: "First time: install Google Drive from the App Store and sign in with your @spacematchinc.com email.",
    android: "First time: open Google Drive, tap your photo (top right) and switch to your @spacematchinc.com account.",
    tip: "Never send clips by text, WhatsApp, email or Instagram DM. They shrink the video and the editor can't use it.",
  },
  {
    t: "Tell the editor what it is",
    d: "Tap \"Tell the editor\", pick the clips you just uploaded and add a line or two: what it is, the listing address or area, and where you'd like it used. Your note goes straight onto the editor's video log.",
  },
];

export const CHECK_DO = [
  "4K (or 1080p) at 30 fps, vertical",
  "Light in front of you, quiet room",
  "Phone steady at eye level",
  "2-second pause at start and end",
  "Upload the original from your phone",
];
export const CHECK_DONT = [
  "Filters, beauty mode, music or text",
  "Window or bright light behind you",
  "Texting, WhatsApp or emailing the clip",
  "Screen recordings or downloads from Instagram",
  "Other company names (say \"SpaceMatch\")",
];

export const IDEAS: { t: string; len: string; say: string }[] = [
  { t: "Intro / about me", len: "30–60 s", say: "\"Hi, I'm ___ with SpaceMatch. I help people buy and sell in ___. What I love about this job is ___.\"" },
  { t: "Why I joined SpaceMatch", len: "30–60 s", say: "\"I joined SpaceMatch because ___. For my clients that means ___.\"" },
  { t: "Listing walkthrough", len: "1–3 min", say: "Walk slowly room by room with the phone steady. Point out the 3 best features in your own words." },
  { t: "Neighborhood spot", len: "20–40 s", say: "Stand outside a favorite café, park or shop: \"If you live in ___, you have to try ___. Here's why.\"" },
  { t: "Seller tip", len: "30–60 s", say: "\"Thinking about selling? Do these 3 things before you list: ___, ___, ___.\"" },
  { t: "Buyer tip", len: "30–60 s", say: "\"Buying your first home? Here's what nobody tells you about ___.\"" },
  { t: "Just listed / just sold", len: "20–40 s", say: "In front of the home: \"We just ___ this home in ___. Here's what made it work.\" Get your client's OK before you show or name them." },
  { t: "B-roll of you (no talking)", len: "5–10 s each", say: "Walking up to a house, unlocking a door, on a call, reviewing a contract, handing over keys. The editor uses these between your talking clips." },
];

export const FAIR_HOUSING =
  "Fair housing: talk about the home, the location and amenities, never about who the area is \"good for\" (no \"great for families\", \"safe neighborhood\" or similar). Market numbers come from the MLS or your CMA, never a guess.";

export const fmtSize = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(0.1, n / 1e6).toFixed(n > 1e7 ? 0 : 1)} MB`);

// Upload quality flags (we only see name, type and size from Drive).
export function qualityFlag(f: { name: string; size: number; mimeType: string }): string | null {
  if (!f.mimeType.startsWith("video/")) return "Not a video";
  if (/-WA\d+|WhatsApp/i.test(f.name)) return "WhatsApp copy, low quality. Upload the original from your phone.";
  if (f.size < 15e6) return "Small file. It may be compressed. Upload the original if you have it.";
  return null;
}

// Android: open the Drive app straight to the folder; iPhone: the https link opens the Drive app.
export function driveHref(url: string): string {
  if (typeof navigator === "undefined" || !/Android/i.test(navigator.userAgent)) return url;
  const u = new URL(url);
  return `intent://${u.host}${u.pathname}#Intent;scheme=https;package=com.google.android.apps.docs;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}
