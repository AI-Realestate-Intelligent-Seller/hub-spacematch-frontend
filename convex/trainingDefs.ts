// SpaceMatch Academy (2026-10-19): 7 tracks. Each track = modules + a role-play drill + a 5-question certification check.
// Certified = all modules done + check passed (4/5) + a staff sign-off. Stored per user in hubSettings `training:<userId>`.
// Module ids are stored in progress; don't rename ids once agents have progress (track ids are display-only except quiz/certs).
export type TrainingModule = {
  id: string;
  title: string;
  minutes: number;
  playbook?: string;
  to?: string;
  href?: string;
  /** Private PDF in Convex storage (convex/trainingFiles.ts), opened only by signed-in agents/staff. */
  file?: string;
  note?: string;
};
export type QuizQ = {
  q: string;
  options: string[];
  answer: number;
  why: string;
};
export type Drill = { scenario: string; partner: string; good: string[] };
export type TrainingTrack = {
  id: string;
  n: number;
  title: string;
  blurb: string;
  icon: string;
  outcome: string;
  modules: TrainingModule[];
  drill: Drill;
  quiz: QuizQ[];
};

export const PASS_MARK = 4;

const pb = (id: string, title: string, minutes: number): TrainingModule => ({
  id: `pb:${id}`,
  playbook: id,
  title,
  minutes,
});

export const TRAINING_TRACKS: TrainingTrack[] = [
  {
    id: "start",
    n: 1,
    title: "SpaceMatch OS",
    icon: "Rocket",
    blurb:
      "How our machine works, the rules, and your tools. Finish in week one.",
    outcome:
      "You know where every lead, form and question goes, and your tools are set up.",
    modules: [
      pb("spacematch-os", "SpaceMatch OS: how our machine works", 5),
      pb("team-agreement", "Team Agreement cheat sheet", 5),
      pb("lead-routing", "Lead routing & pond rules", 4),
      pb("brand-compliance", "Brand & compliance guide", 4),
      pb("fair-housing", "Fair housing, advertising & wire fraud", 5),
      {
        id: "x:lofty-setup",
        href: "https://docs.google.com/document/d/1HIwVTqCbC91l-Ow_6PQOprzpTunCbxqGksApeBZjV5M",
        title: "Set up Lofty (onboarding guide)",
        minutes: 20,
      },
      {
        id: "x:tools",
        to: "/home",
        title: "Set up your tools (Home → Set up your tools)",
        minutes: 15,
      },
      {
        id: "x:muse",
        to: "/muse",
        title: "Set up your SpaceMatch Coach in Muse (AI playbook helper)",
        minutes: 2,
      },
      {
        id: "x:culture",
        href: "https://docs.google.com/document/d/1ZLZF8M3ZxofhT2lr4TfpqGUSqZ9yG8Ia2I8ck3uK2b4",
        title: "Mission, vision, values & culture",
        minutes: 5,
      },
    ],
    drill: {
      scenario:
        'A new agent asks you: "A seller just called the office line about selling their condo and their dry cleaner. What do I do?" Walk them through it, start to finish.',
      partner:
        "Play the new agent. Ask: Whose lead is it? What's the split? Who handles the business part? Where does the paperwork go?",
      good: [
        "Office-line call = team-generated lead, 50/50",
        "Call within 1 hour, log it in Lofty",
        "Business part → Michael via Business Seller form / Lead hand-off",
        "Uses forms (not DMs) for Cris and Atom",
      ],
    },
    quiz: [
      {
        q: "A new company lead is assigned to you at 2:10 pm. By when must you call?",
        options: [
          "By end of day",
          "By 3:10 pm",
          "Within 24 hours",
          "After Anna has texted twice",
        ],
        answer: 1,
        why: "Call within 1 hour; personal contact within 24 hours.",
      },
      {
        q: "A lead calls the office line about one of the team's listings. What split applies if it closes?",
        options: [
          "Your tier split",
          "50/50 team-generated",
          "100% to you after the Real cap",
          "Whatever Michael decides later",
        ],
        answer: 1,
        why: "Office line, team@ inquiries, team ads/portals and sign calls on team listings are team-generated: 50/50.",
      },
      {
        q: "A Korean-speaking lead comes in. Who gets it?",
        options: [
          "Whoever is next in rotation",
          "Matthew",
          "Sein Shin",
          "The pond",
        ],
        answer: 2,
        why: "Korean-speaking leads go to Sein Shin; Spanish-speaking leads go to Matthew.",
      },
      {
        q: "You need flyers and a Reel for a new listing. Best way to ask?",
        options: [
          "Text Cris",
          "Marketing request form",
          "Email Michael",
          "Post in a group chat",
        ],
        answer: 1,
        why: "Forms create a record and notify the right person; Cris handles marketing requests.",
      },
      {
        q: "Which line must appear in every ad and post?",
        options: [
          "Your license number only",
          "SpaceMatch Inc. · a team of Real Broker, LLC",
          "Your previous brokerage's name",
          "Nothing if it's your personal account",
        ],
        answer: 1,
        why: "Illinois advertising rules: the sponsoring brokerage is always shown.",
      },
    ],
  },
  {
    id: "leads",
    n: 2,
    title: "Lead Engine",
    icon: "PhoneCall",
    blurb:
      "Speed, a daily routine, a sphere that refers you, and reviews that sell you.",
    outcome:
      "You run a daily lead routine and a database that sends you business every year.",
    modules: [
      pb("speed-to-lead", "Speed-to-lead", 4),
      pb("lofty-daily", "Your daily Lofty routine", 4),
      pb("sphere-system", "The sphere system", 5),
      pb("seller-prospecting", "Expireds, FSBOs & quiet leads", 5),
      pb("objections", "Handling common objections", 5),
      pb("reviews-referrals", "Reviews: the engine behind every search", 3),
      {
        id: "x:scripts",
        to: "/templates?tab=scripts",
        title: "Read the scripts & emails library",
        minutes: 10,
      },
    ],
    drill: {
      scenario:
        "Call a 'quiet' home-value lead who filled out a form 3 weeks ago and never answered Anna.",
      partner:
        'Play the homeowner: busy, a little suspicious, "just curious what it\'s worth." Push back once: "I\'m not selling anytime soon."',
      good: [
        "Opens with a reason to talk (a real number range or a nearby sale)",
        "Asks why/when/where-next without pushing",
        "Offers the CMA walk-through with two time options",
        "Logs the call and sets the next task in Lofty",
      ],
    },
    quiz: [
      {
        q: "You can't reach a new lead. What's the Day 1 routine?",
        options: [
          "One email",
          "Call + voicemail + text",
          "Wait for Anna",
          "Text only",
        ],
        answer: 1,
        why: "Day 1, Day 3 and Day 7: call + voicemail + text (email on Day 7).",
      },
      {
        q: "How often must an active lead have something logged to stay yours?",
        options: [
          "Every 3 days",
          "Every 14 days",
          "Every 30 days",
          "Only when they reply",
        ],
        answer: 1,
        why: "Log something at least every 14 days and keep the stage current.",
      },
      {
        q: "Your sphere contacts in Lofty should be…",
        options: [
          "Added to Anna's drip",
          "Tagged A/B/C with a touch rhythm, and kept out of company drips",
          "Left untagged",
          "Handed to the pond",
        ],
        answer: 1,
        why: "Sphere leads are yours; A/B/C sets the rhythm.",
      },
      {
        q: "Best moment to ask for a review?",
        options: [
          "A month after closing",
          "At keys / when the seller gets the wire",
          "During attorney review",
          "Only if they offer",
        ],
        answer: 1,
        why: "Ask at the emotional peak, with the link, while you're together.",
      },
      {
        q: 'Seller says "Your fee is too high." The best first move:',
        options: [
          "Offer a discount",
          "Acknowledge, ask what's behind it, then talk net with numbers",
          "Say it's non-negotiable",
          "Change the subject",
        ],
        answer: 1,
        why: "Acknowledge → ask → answer with numbers → confirm. Only Michael changes fees.",
      },
    ],
  },
  {
    id: "listings",
    n: 3,
    title: "Listing System",
    icon: "Home",
    blurb:
      "Win with the CMA-first appointment, price it right, launch it like an event.",
    outcome:
      "You can take a seller lead to a signed, launched, well-reported listing.",
    modules: [
      pb("cma-first", "The CMA-first seller appointment", 4),
      pb("cma-how-to", "CMA how-to", 4),
      pb("listing-presentation", "Listing presentation guide", 5),
      {
        id: "x:presentations",
        to: "/presentations",
        title: "Download your branded listing deck & seller guide",
        minutes: 10,
      },
      pb("pricing", "Pricing & price-adjustment conversations", 4),
      pb("before-market", "Before-market launch", 4),
      pb("listing-launch", "Listing launch (the 10 steps)", 5),
      pb("open-house", "Open house", 4),
    ],
    drill: {
      scenario:
        "Listing appointment, minute 40. You've shown the comps and recommended $499,000. The seller says another agent told them $540,000.",
      partner:
        'Play the seller: proud of the kitchen, needs to move by June, likes the other agent. Ask "Why should I list lower with you?"',
      good: [
        "Lets the seller pick the closest comp",
        "Explains search bands ($499K vs $540K)",
        "Shows the Day-14 checkpoint plan",
        "Asks for the listing with the agreement ready",
      ],
    },
    quiz: [
      {
        q: "How many CMAs can each agent request per month before approval is needed?",
        options: ["1", "2", "5", "Unlimited"],
        answer: 1,
        why: "2 per agent per month; more goes to Michael for a one-tap approval.",
      },
      {
        q: "You put up a Coming Soon sign and post on Instagram. When must it be on MLS?",
        options: [
          "Within 1 business day",
          "Within 7 days",
          "Whenever photos are ready",
          "Never if it's Coming Soon",
        ],
        answer: 0,
        why: "Clear Cooperation: public marketing → MLS within 1 business day.",
      },
      {
        q: "What's the listing admin fee, and who can waive it?",
        options: [
          "$395, the agent",
          "$595, only Michael",
          "$495, Cris",
          "$195, nobody",
        ],
        answer: 1,
        why: "Listing $595 (or $495 with a co-op broker). Only Michael can waive a fee.",
      },
      {
        q: "Day 14 with fewer than ~8 showings. What now?",
        options: [
          "Wait for spring",
          "Talk price or presentation with the seller",
          "Drop the price without asking",
          "Pull the listing",
        ],
        answer: 1,
        why: "Day 14 is the price and strategy checkpoint; changes need the seller's written OK.",
      },
      {
        q: "Why price at $499,000 instead of $505,000?",
        options: [
          "Lower commission",
          "Search bands: $505K misses buyers searching up to $500K",
          "MLS rules",
          "Appraisers require it",
        ],
        answer: 1,
        why: "Think in $25K/$50K search bands.",
      },
    ],
  },
  {
    id: "buyers",
    n: 4,
    title: "Buyer System",
    icon: "FileSignature",
    blurb:
      "Agreement first, value clear, offers that win, closings that stay on time.",
    outcome:
      "You can sign a buyer, write a winning Illinois offer and close on schedule.",
    modules: [
      pb("buyer-consultation", "Buyer consultation + buyer rep agreement", 5),
      pb(
        "commission-talk",
        "Explaining your value after the NAR settlement",
        4,
      ),
      {
        id: "x:buyer-guide",
        to: "/presentations?guide=buyer",
        title: "Download your branded buyer guide",
        minutes: 3,
      },
      pb("offers-illinois", "Writing & negotiating offers in Illinois", 6),
      pb("contract-to-close", "Contract to close", 5),
    ],
    drill: {
      scenario:
        'First call with a buyer from Zillow who wants to see a condo tomorrow and asks, "Why do I have to sign something just to look?"',
      partner:
        "Play the buyer: first-time, not pre-approved, worried about fees. Ask who pays you.",
      good: [
        "Explains the written agreement before touring (required since 2024)",
        "Explains compensation clearly, offers the Showing Agreement for one tour",
        "Sends the Buyer Intake form + lender options",
        "Books a consult, not just a showing",
      ],
    },
    quiz: [
      {
        q: "When must a buyer sign a written agreement?",
        options: [
          "At offer",
          "Before the first tour",
          "At closing",
          "Only for new construction",
        ],
        answer: 1,
        why: "Required before touring since the 2024 NAR settlement.",
      },
      {
        q: "Attorney review in Illinois usually lasts…",
        options: ["24 hours", "5 business days", "30 days", "Until closing"],
        answer: 1,
        why: "Usually 5 business days after acceptance.",
      },
      {
        q: "A client gets an email with new wiring instructions. They should…",
        options: [
          "Wire right away",
          "Call the title company at a number they look up themselves",
          "Reply to the email",
          "Ask you to forward it",
        ],
        answer: 1,
        why: "We never send wiring instructions; confirm by phone only.",
      },
      {
        q: "Under contract. Who opens the file and tracks deadlines?",
        options: [
          "Atom, via a TC request",
          "The lender",
          "Michael",
          "Nobody until closing",
        ],
        answer: 0,
        why: "Submit a TC request; Atom opens the file. Upload to ReZEN and dotloop.",
      },
      {
        q: "Can buyer-agent compensation be advertised on MLS?",
        options: [
          "Yes, in remarks",
          "No, it's negotiated in the deal",
          "Only for listings over $1M",
          "Only on Coming Soon",
        ],
        answer: 1,
        why: "Post-settlement, offers of compensation are off MLS and negotiated.",
      },
    ],
  },
  {
    id: "edge",
    n: 5,
    title: "Our Edge: Business, Commercial & Leasing",
    icon: "Store",
    blurb:
      "What most residential teams can't do. Spot it, route it, earn from it.",
    outcome:
      "You spot business, commercial and rental opportunities and route them correctly.",
    modules: [
      pb("biz-radar", "Business & commercial radar", 4),
      pb(
        "business-valuation",
        "Business valuation basics: SDE, add-backs & SBA",
        6,
      ),
      pb("commercial-business", "Commercial / business-sale playbook", 6),
      {
        id: "f:biz-building-cheat-sheet",
        file: "biz-building-cheat-sheet",
        title:
          "Cheat sheet: selling a business with its building (Galena case study)",
        minutes: 15,
        note: "Team only",
      },
      {
        id: "f:advanced-business-underwriting",
        file: "advanced-business-underwriting",
        title: "Advanced business sales: financials & bank underwriting",
        minutes: 60,
        note: "Team only · Advanced case study",
      },
      {
        id: "x:commercial-howtos",
        href: "https://drive.google.com/drive/folders/1MhN15IMVI_lPdAO3Y7hvD69BqEeq4ugw",
        title: "Commercial how-tos (Crexi, Buildout)",
        minutes: 15,
      },
      pb("leasing", "Leasing: landlords & tenants", 6),
      {
        id: "x:lease-cma",
        to: "/lease",
        title: "Request your first lease CMA",
        minutes: 5,
      },
    ],
    drill: {
      scenario:
        "At a listing appointment the seller mentions they own two laundromats and want to retire in a year.",
      partner:
        "Play the seller: asks what the laundromats are worth and whether you can list them on Zillow.",
      good: [
        "Doesn't give a value on the spot",
        "Explains confidentiality (blind teaser, NDA before financials)",
        "Asks for 3 years of tax returns, lease and equipment list",
        "Routes to Michael via Business Seller form / Lead hand-off",
      ],
    },
    quiz: [
      {
        q: "What can a business-sale teaser show?",
        options: [
          "Name and address",
          "City and state only",
          "Full financials",
          "Owner's phone",
        ],
        answer: 1,
        why: "Blind teaser only; financials after a signed NDA.",
      },
      {
        q: "What do buyers' lenders underwrite a business sale on?",
        options: [
          "The seller's P&L",
          "Filed tax returns",
          "The asking price",
          "Verbal cash figures",
        ],
        answer: 1,
        why: "Tax returns, not P&Ls; unreported cash doesn't count.",
      },
      {
        q: "SDE is…",
        options: [
          "Gross sales",
          "Net profit + owner's salary + perks + interest + depreciation + true one-time expenses",
          "Rent × 12",
          "Price ÷ 3",
        ],
        answer: 1,
        why: "Seller's discretionary earnings, every add-back proven.",
      },
      {
        q: "A Chicago landlord's apartment. Which lease?",
        options: [
          "Cook County lease",
          "Chicago Residential Lease (RLTO)",
          "Evanston Model Lease",
          "Any lease",
        ],
        answer: 1,
        why: "City of Chicago → RLTO lease plus its required disclosures.",
      },
      {
        q: "Can a Chicago landlord reject an applicant for paying with a housing voucher?",
        options: [
          "Yes",
          "No, source of income is protected",
          "Only in winter",
          "If the rent is high",
        ],
        answer: 1,
        why: "Chicago and Cook County protect source of income.",
      },
    ],
  },
  {
    id: "marketing",
    n: 6,
    title: "Content, Ads & AI",
    icon: "Megaphone",
    blurb:
      "Video that builds trust, ads you can read, AI that saves hours, safely.",
    outcome:
      "You publish weekly, read ad results and use AI without compliance risk.",
    modules: [
      pb("social-video", "Instagram & video for agents", 4),
      pb(
        "video-leadgen",
        "Video-first lead gen: Reels, YouTube & AI avatars",
        5,
      ),
      pb("ai-toolkit", "AI toolkit for agents", 6),
      pb("ads-analytics", "Ads & analytics", 5),
    ],
    drill: {
      scenario:
        "Use the AI prompts to draft an MLS description and a 30-second Reel script for a real listing (or the sample in Templates). Read both out loud to a teammate.",
      partner:
        "Play compliance: spot any fair-housing language, invented facts, or a missing brokerage line.",
      good: [
        "Describes the home, not the buyer",
        "Every fact checked against MLS",
        "Hook in 3 seconds, one call to action",
        "Brokerage line included",
      ],
    },
    quiz: [
      {
        q: "Which listing phrase is a fair-housing red flag?",
        options: [
          "Fenced yard",
          "Perfect for young families",
          "Updated 2022 kitchen",
          "Two blocks to the train",
        ],
        answer: 1,
        why: "Describe the home, never the ideal buyer.",
      },
      {
        q: "What should never be pasted into a public AI tool?",
        options: [
          "Bedroom count",
          "A client's bank statement or SSN",
          "A neighborhood name",
          "Public MLS stats",
        ],
        answer: 1,
        why: "No client financials, IDs or contracts in public AI tools.",
      },
      {
        q: "Your ad has a low click rate (under ~1%). First fix?",
        options: [
          "Double the budget",
          "Change the first photo or headline",
          "Stop all ads",
          "Target the whole state",
        ],
        answer: 1,
        why: "Low clicks = the creative isn't stopping people.",
      },
      {
        q: "What do sellers see about their ads?",
        options: [
          "Budget and spend",
          "Results: reach, clicks, views",
          "Nothing",
          "Your ad account login",
        ],
        answer: 1,
        why: "Sellers see results, never spend.",
      },
      {
        q: "Best hook placement in a Reel?",
        options: [
          "The last 3 seconds",
          "The first 3 seconds",
          "In the caption only",
          "Doesn't matter",
        ],
        answer: 1,
        why: "Hook in the first 3 seconds; captions on.",
      },
    ],
  },
  {
    id: "numbers",
    n: 7,
    title: "Run It Like a Business",
    icon: "BarChart3",
    blurb:
      "Your plan in numbers, a weekly scorecard, and the 90-day growth plan.",
    outcome:
      "You know your numbers and track the inputs that produce closings.",
    modules: [
      pb("gci-plan", "Your business plan in numbers", 5),
      pb("weekly-scorecard", "The weekly scorecard", 5),
      {
        id: "x:growth",
        to: "/growth",
        title: "Start the 90-day Growth Playbook",
        minutes: 5,
        note: "Tracked item by item",
      },
    ],
    drill: {
      scenario:
        "Sit with Brandon or Michael and present your plan: income goal → GCI → closings → appointments → weekly conversations.",
      partner:
        "Play the coach: ask where the appointments will come from, and what you'll do the week numbers drop.",
      good: [
        "Uses their real split and fees",
        "Has a weekly conversation target",
        "Names lead sources (team leads + sphere + own marketing)",
        "Commits to a 9–11 lead block",
      ],
    },
    quiz: [
      {
        q: "Which is a lead measure you control this week?",
        options: [
          "Closings",
          "Conversations",
          "Market prices",
          "Interest rates",
        ],
        answer: 1,
        why: "Track inputs (conversations, appointments); closings follow.",
      },
      {
        q: "Tier 2 split before the Real cap on self-generated deals?",
        options: ["70%", "75%", "85%", "50%"],
        answer: 1,
        why: "Tier 2 Producer ($50K–$125K GCI): 75 / 85.",
      },
      {
        q: "What's the Real Broker annual cap?",
        options: ["$4,000", "$12,000", "$16,000", "No cap"],
        answer: 0,
        why: "$4,000 per cap year.",
      },
      {
        q: "Lots of conversations, few appointments. Fix…",
        options: [
          "Your listing presentation",
          "The ask (objection drills)",
          "Your closing process",
          "Nothing",
        ],
        answer: 1,
        why: "Fix the weakest funnel stage first.",
      },
      {
        q: "How much of each check should you set aside for taxes?",
        options: ["0%", "About 25–30%", "50%", "Only at year end"],
        answer: 1,
        why: "You're a 1099 contractor; reserve 25–30%.",
      },
    ],
  },
];

export const TRAINING_MODULE_IDS: string[] = TRAINING_TRACKS.flatMap(t =>
  t.modules.map(m => m.id),
);
export const TRACK_IDS: string[] = TRAINING_TRACKS.map(t => t.id);
