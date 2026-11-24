// Growth Score (Michael 2026-11-02 "b is what I want built"): checks each agent's real online
// presence against the playbook's SPACE formula and scorecard (section 08). 100 points:
// S 15 · P 20 · A 20 · C 25 · E 20. Followers are deliberately NOT scored (playbook 08).
// Pure code shared by the backend (scoring) and the page (labels, fixes). No AI.

export const GBP_MANAGER_EMAIL = "team@spacematchinc.com";

// Profiles an agent should have live (playbook: 8 at Levels 1–2, 11 at Level 3).
export type ProfileKey =
  | "google"
  | "zillow"
  | "realtor"
  | "homes"
  | "brokerage"
  | "team"
  | "instagram"
  | "youtube"
  | "facebook"
  | "linkedin"
  | "tiktok";

export const PROFILES: {
  key: ProfileKey;
  label: string;
  domain: RegExp;
  hint: string;
}[] = [
  {
    key: "google",
    label: "Google Business Profile",
    domain: /(google\.[a-z.]+|goo\.gl|g\.page|maps\.app\.goo\.gl)/i,
    hint: "Connected via the Google reviews button",
  },
  {
    key: "zillow",
    label: "Zillow agent profile",
    domain: /zillow\.com/i,
    hint: "https://www.zillow.com/profile/…",
  },
  {
    key: "realtor",
    label: "Realtor.com profile",
    domain: /realtor\.com/i,
    hint: "https://www.realtor.com/realestateagents/…",
  },
  {
    key: "homes",
    label: "Homes.com profile",
    domain: /homes\.com/i,
    hint: "https://www.homes.com/real-estate-agents/…",
  },
  {
    key: "brokerage",
    label: "Brokerage profile (Real)",
    domain:
      /(onereal\.com|therealbrokerage\.com|real\.com|joinreal\.com|cbrealty\.com|coldwellbanker)/i,
    hint: "Your Real Broker agent page",
  },
  {
    key: "team",
    label: "SpaceMatch team page",
    domain: /spacematchinc\.com/i,
    hint: "https://spacematchinc.com/…",
  },
  {
    key: "instagram",
    label: "Instagram",
    domain: /instagram\.com/i,
    hint: "Your handle, e.g. @yourname",
  },
  {
    key: "youtube",
    label: "YouTube",
    domain: /(youtube\.com|youtu\.be)/i,
    hint: "Your channel handle, e.g. @yourname",
  },
  {
    key: "facebook",
    label: "Facebook business page",
    domain: /(facebook\.com|fb\.com)/i,
    hint: "https://facebook.com/…",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    domain: /linkedin\.com/i,
    hint: "https://linkedin.com/in/…",
  },
  {
    key: "tiktok",
    label: "TikTok",
    domain: /tiktok\.com/i,
    hint: "https://tiktok.com/@…",
  },
];

// Playbook scorecard targets by level (section 08).
export const TARGETS: Record<
  number,
  { posts: number; videos: number; reviews: number; profiles: number }
> = {
  1: { posts: 5, videos: 3, reviews: 2, profiles: 8 },
  2: { posts: 5, videos: 4, reviews: 3, profiles: 8 },
  3: { posts: 6, videos: 5, reviews: 4, profiles: 11 },
};

// What the checks found. null = not measured (team connection missing / source down).
export type Signals = {
  checkedAt: number;
  instagram:
    | null
    | {
        ok: true;
        username: string;
        postsCount: number | null;
        posts28: number;
        videos28: number;
        lastPostAt: number | null;
      }
    | { ok: false; reason: "no_handle" | "private" | "not_found" };
  youtube:
    | null
    | {
        ok: true;
        channelId: string;
        uploads28: number;
        lastUploadAt: number | null;
      }
    | { ok: false; reason: "no_handle" | "not_found" };
  google:
    | null
    | {
        ok: true;
        title: string;
        rating: number;
        total: number;
        new30: number;
        reviewUri?: string;
      }
    | { ok: false; reason: "not_connected" };
  lofty: null | {
    leads30: number;
    touched30: number;
    overdue: number;
    quiet: number;
  };
  links: Partial<Record<ProfileKey, "live" | "entered" | "broken">>;
  notes: string[]; // team-level gaps, e.g. "Instagram check not connected yet"
};

export type Profile = {
  niche?: string;
  instagram?: string;
  youtube?: string;
  links?: Partial<Record<ProfileKey, string>>;
  zillowReviews?: number;
  zillowVerified?: boolean;
};

export type Part = {
  key: "S" | "P" | "A" | "C" | "E";
  label: string;
  max: number;
  got: number | null;
  detail: string[];
};
export type FixId =
  | "niche"
  | "ig_handle"
  | "ig_business"
  | "gbp_connect"
  | "gbp_reviews"
  | "zillow_reviews"
  | "profiles"
  | "posts"
  | "videos"
  | "youtube"
  | "lead_touch"
  | "follow_ups"
  | "quiet";
export type Fix = {
  id: FixId;
  lost: number;
  title: string;
  why: string;
  steps: string[];
  playbookItem?: string;
  hubLink?: { to: string; label: string };
};
export type Score = {
  total: number;
  measured: number;
  parts: Part[];
  fixes: Fix[];
  level: number;
  color: "red" | "yellow" | "green";
};

const NICHE_RE = /\bI help\b.+\bin\b.+/i;
export const nicheOk = (s?: string) =>
  !!s && NICHE_RE.test(s) && s.trim().split(/\s+/).length <= 25;

const clamp = (x: number, max: number) => Math.max(0, Math.min(max, x));
const r1 = (x: number) => Math.round(x * 10) / 10;

export function score(profile: Profile, s: Signals, level = 1): Score {
  const T = TARGETS[level] ?? TARGETS[1];
  const fixes: Fix[] = [];
  const add = (f: Omit<Fix, "lost"> & { lost: number }) =>
    f.lost > 0.4 && fixes.push(f);

  // ---- S · Stake a claim (15) -------------------------------------------------
  const ig = s.instagram;
  const sDetail: string[] = [];
  let S = 0;
  const hasNiche = nicheOk(profile.niche);
  S += hasNiche ? 9 : 0;
  sDetail.push(
    hasNiche
      ? "Niche sentence written"
      : "No “I help ___ in ___ do ___” sentence yet",
  );
  if (!hasNiche)
    add({
      id: "niche",
      lost: 9,
      title: "Write your one-sentence niche",
      why: "A stranger has to be able to repeat what you do. Generalists get skipped.",
      steps: [
        "Pick one neighborhood (walkable) and one buyer or asset type.",
        "Write: “I help ___ in ___ do ___.” Nine words or fewer is ideal.",
        "Paste it under My profiles here, then into your Instagram bio and all your profiles word for word.",
      ],
      playbookItem: "l1-5",
    });
  let sIg: number | null = null;
  if (ig === null) sIg = null;
  else if (ig.ok) {
    sIg = 6;
    sDetail.push(`Instagram @${ig.username} is public and findable`);
  } else {
    sIg = 0;
    if (ig.reason === "no_handle") {
      sDetail.push("No Instagram handle entered");
      add({
        id: "ig_handle",
        lost: 6,
        title: "Add your Instagram handle",
        why: "We can't check your posting without it.",
        steps: [
          "Open My profiles below.",
          "Type your handle (e.g. @yourname) and save.",
        ],
      });
    } else {
      sDetail.push(
        ig.reason === "private"
          ? "Instagram account is private"
          : "Instagram handle not found",
      );
      add({
        id: "ig_business",
        lost: 6,
        title:
          ig.reason === "private"
            ? "Make your Instagram public and a Business account"
            : "Fix your Instagram handle",
        why: "Clients and the algorithm can't find a private or wrong account.",
        steps:
          ig.reason === "private"
            ? [
                "Instagram → Settings → Account privacy → turn Private off.",
                "Settings → Account type and tools → Switch to professional account → Business, category Real Estate Agent.",
              ]
            : [
                "Check the spelling under My profiles. Just the handle, e.g. @yourname.",
              ],
        playbookItem: "l1-6",
      });
    }
  }
  const sMax = 9 + (sIg === null ? 0 : 6);
  S += sIg ?? 0;

  // ---- P · Prove it publicly (20) -------------------------------------------
  const g = s.google;
  const pDetail: string[] = [];
  let P = 0;
  let pMax = 5;
  if (g !== null) {
    pMax += 15;
    if (g.ok) {
      const base =
        g.total >= 20
          ? 8
          : g.total >= 10
            ? 6
            : g.total >= 5
              ? 4
              : g.total >= 1
                ? 2
                : 0;
      const fresh = clamp((g.new30 / T.reviews) * 7, 7);
      P += base + fresh;
      pDetail.push(
        `Google: ${g.total} reviews${g.total ? ` at ${g.rating.toFixed(1)}★` : ""}, ${g.new30} new in 30 days (goal ${T.reviews})`,
      );
      if (8 - base + 7 - fresh > 2)
        add({
          id: "gbp_reviews",
          lost: r1(8 - base + 7 - fresh),
          title: `Get ${Math.max(1, T.reviews - g.new30)} new Google review${T.reviews - g.new30 === 1 ? "" : "s"} this month`,
          why: "8 in 10 sellers call only one agent. Reviews make you that one call.",
          steps: [
            "Text 5 past clients the review script tonight, link already open.",
            "Ask at the closing table, phone in hand, not by email later.",
            g.reviewUri
              ? `Your review link: ${g.reviewUri}`
              : "Your review link is on your Google Business Profile → Ask for reviews.",
          ],
          playbookItem: "l1-7",
          hubLink: { to: "/emails", label: "Review request templates" },
        });
    } else {
      pDetail.push("Google Business Profile not connected yet");
      add({
        id: "gbp_connect",
        lost: 15,
        title: "Connect your Google reviews",
        why: "Google is where sellers check you first. Takes 2 minutes.",
        steps: [
          "Tap “Connect my Google reviews” on your score card.",
          `Add ${GBP_MANAGER_EMAIL} as a Manager on your Business Profile.`,
          "No profile yet? The same button walks you through creating one.",
        ],
        playbookItem: "l1-2",
      });
    }
  }
  const z = profile.zillowReviews ?? 0;
  const zPts = z >= 10 ? 5 : z >= 5 ? 3 : z >= 1 ? 1 : 0;
  P += zPts;
  pDetail.push(
    profile.zillowReviews == null
      ? "Zillow reviews not entered"
      : `Zillow: ${z} reviews${profile.zillowVerified ? " (verified)" : " (self-reported)"}`,
  );
  if (zPts < 5)
    add({
      id: "zillow_reviews",
      lost: 5 - zPts,
      title: z
        ? "Grow your Zillow reviews to 10"
        : "Get your first Zillow reviews",
      why: "Zillow is the second place buyers and sellers check.",
      steps: [
        "Ask every past client for a Zillow review too, right after Google.",
        "Update your count under My profiles. Cris spot-checks it.",
      ],
      playbookItem: "l1-8",
    });

  // ---- A · Appear everywhere (20) -------------------------------------------
  const live = PROFILES.filter(
    p => s.links[p.key] === "live" || s.links[p.key] === "entered",
  ).length;
  const broken = PROFILES.filter(p => s.links[p.key] === "broken").map(
    p => p.label,
  );
  const A = clamp((live / T.profiles) * 20, 20);
  const aDetail = [
    `${live} of ${T.profiles} profiles live`,
    ...(broken.length ? [`Broken link: ${broken.join(", ")}`] : []),
  ];
  if (A < 20) {
    const missing = PROFILES.filter(
      p => !s.links[p.key] || s.links[p.key] === "broken",
    )
      .slice(0, 4)
      .map(p => p.label);
    add({
      id: "profiles",
      lost: r1(20 - A),
      title: `Get ${T.profiles - live > 0 ? T.profiles - live : broken.length} more profile${T.profiles - live === 1 ? "" : "s"} live`,
      why: "Clients check you in 3+ places before they call. Same photo, same sentence everywhere.",
      steps: [
        `Missing or broken: ${missing.join(", ")}.`,
        "Claim each one, fill every optional field, use the identical headshot.",
        "Paste each link under My profiles so it counts.",
      ],
      playbookItem: "l1-3",
    });
  }

  // ---- C · Cadence beats quality (25) ----------------------------------------
  const cDetail: string[] = [];
  let C = 0;
  let cMax = 0;
  const yt = s.youtube;
  const ytVideos = yt && yt.ok ? yt.uploads28 : 0;
  if (ig !== null) {
    cMax += 15;
    const posts = ig.ok ? ig.posts28 : 0;
    const videos = (ig.ok ? ig.videos28 : 0) + ytVideos;
    const pPts = clamp((posts / (T.posts * 4)) * 10, 10);
    const vPts = clamp((videos / (T.videos * 4)) * 5, 5);
    C += pPts + vPts;
    cDetail.push(
      `Instagram: ${posts} posts in 28 days (goal ${T.posts * 4}), ${ig.ok ? ig.videos28 : 0} Reels`,
    );
    if (10 - pPts > 1)
      add({
        id: "posts",
        lost: r1(10 - pPts),
        title: `Post ${T.posts}× a week`,
        why: "Cadence beats quality. Five posts a week, forever.",
        steps: [
          "Block 90 minutes on Sunday and batch the week.",
          "Use the six pillars: at most 2 of 5 posts are listings.",
          "An explicit ask on at least half of what you post.",
        ],
        playbookItem: "l2-2",
        hubLink: { to: "/broll", label: "B-roll library" },
      });
    if (5 - vPts > 1)
      add({
        id: "videos",
        lost: r1(5 - vPts),
        title: `Make ${T.videos} of those videos`,
        why: "Short vertical video is what gets shown to strangers.",
        steps: [
          "Vertical, captions burned in, under 45 seconds.",
          "One on-camera market update per week: one number, what it means.",
        ],
        playbookItem: "l2-9",
        hubLink: { to: "/reels", label: "Reel Studio" },
      });
  }
  if (yt !== null) {
    cMax += 10;
    const yPts = yt.ok ? clamp((yt.uploads28 / (T.videos * 4)) * 10, 10) : 0;
    C += yPts;
    cDetail.push(
      yt.ok
        ? `YouTube: ${yt.uploads28} uploads in 28 days`
        : yt.reason === "no_handle"
          ? "No YouTube channel entered"
          : "YouTube channel not found",
    );
    if (10 - yPts > 1)
      add({
        id: "youtube",
        lost: r1(10 - yPts),
        title: yt.ok
          ? "Post your Reels to YouTube Shorts too"
          : "Start a YouTube channel",
        why: "Real estate is heavily searched on YouTube and almost no local agent shows up.",
        steps: [
          "Create the channel with the same name, photo and sentence.",
          "Upload the same vertical videos as Shorts. Zero extra filming.",
          "Add the handle under My profiles.",
        ],
        playbookItem: "l2-12",
      });
  }

  // ---- E · Every lead in 5 min (20) -------------------------------------------
  const L = s.lofty;
  const eDetail: string[] = [];
  let E = 0;
  let eMax = 0;
  if (L !== null) {
    eMax = 20;
    const rate = L.leads30 ? L.touched30 / L.leads30 : 1;
    const tPts = 10 * rate;
    const fPts =
      L.overdue === 0 ? 5 : L.overdue <= 3 ? 3 : L.overdue <= 10 ? 1 : 0;
    const qPts = L.quiet === 0 ? 5 : L.quiet <= 3 ? 3 : 0;
    E = tPts + fPts + qPts;
    eDetail.push(
      L.leads30
        ? `${L.touched30} of ${L.leads30} new Lofty leads (30 days) contacted`
        : "No new Lofty leads in 30 days",
      `${L.overdue} overdue follow-ups · ${L.quiet} active clients quiet 14+ days`,
    );
    if (10 - tPts > 1)
      add({
        id: "lead_touch",
        lost: r1(10 - tPts),
        title: `Contact ${L.leads30 - L.touched30} untouched lead${L.leads30 - L.touched30 === 1 ? "" : "s"}`,
        why: "Every hour you wait, the lead is talking to someone else.",
        steps: [
          "Notifications on for Lofty. Five-minute rule, no exceptions.",
          "Call first, then text if no answer.",
          "Open Today on the Hub home for the list.",
        ],
        playbookItem: "l2-7",
        hubLink: { to: "/", label: "Today list" },
      });
    if (5 - fPts > 1)
      add({
        id: "follow_ups",
        lost: 5 - fPts,
        title: `Clear ${L.overdue} overdue follow-ups`,
        why: "Overdue tasks are leads someone else is calling.",
        steps: [
          "Do them or reschedule them honestly in Lofty today.",
          "The Hub home's Today list shows them in order.",
        ],
        hubLink: { to: "/", label: "Today list" },
      });
    if (5 - qPts > 1)
      add({
        id: "quiet",
        lost: 5 - qPts,
        title: `Check in with ${L.quiet} quiet client${L.quiet === 1 ? "" : "s"}`,
        why: "Active clients with no contact in 14 days go cold.",
        steps: [
          "Send a one-line personal text to each today.",
          "Log it in Lofty so it counts.",
        ],
        hubLink: { to: "/", label: "Today list" },
      });
  }

  const parts: Part[] = [
    { key: "S", label: "Stake a claim", max: sMax, got: S, detail: sDetail },
    {
      key: "P",
      label: "Prove it publicly",
      max: pMax,
      got: P,
      detail: pDetail,
    },
    { key: "A", label: "Appear everywhere", max: 20, got: A, detail: aDetail },
    {
      key: "C",
      label: "Cadence",
      max: cMax,
      got: cMax ? C : null,
      detail: cMax ? cDetail : ["Not checked yet"],
    },
    {
      key: "E",
      label: "Every lead in 5 min",
      max: eMax,
      got: eMax ? E : null,
      detail: eMax ? eDetail : ["Lofty not reachable, not scored this time"],
    },
  ];
  const measured = parts.reduce((a, p) => a + (p.got === null ? 0 : p.max), 0);
  const got = parts.reduce((a, p) => a + (p.got ?? 0), 0);
  const total = measured ? Math.round((got / measured) * 100) : 0;
  fixes.sort((a, b) => b.lost - a.lost);
  return {
    total,
    measured,
    parts: parts.map(p => ({ ...p, got: p.got === null ? null : r1(p.got) })),
    fixes: fixes.slice(0, 6).map(f => ({ ...f, lost: r1(f.lost) })),
    level,
    color: total >= 75 ? "green" : total >= 50 ? "yellow" : "red",
  };
}

// Instagram handle / YouTube handle normalisers.
export const igHandle = (x?: string) =>
  x
    ?.trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase() || "";
export const ytHandle = (x?: string) => {
  const t = x?.trim() ?? "";
  if (!t) return "";
  const m = t.match(/youtube\.com\/(@[\w.-]+|channel\/UC[\w-]{22})/i);
  if (m) return m[1];
  return t.startsWith("@") || t.startsWith("UC") ? t : `@${t}`;
};
