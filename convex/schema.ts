import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const upgradeValidator = v.object({
  item: v.string(),
  year: v.optional(v.string()),
  notes: v.optional(v.string()),
});

export const attachmentValidator = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  size: v.number(),
  contentType: v.optional(v.string()),
});

// Commercial building facts (all optional; the OM / rent roll fill the gaps).
export const commercialValidator = v.object({
  buildingSf: v.optional(v.string()),
  landSf: v.optional(v.string()),
  units: v.optional(v.string()),
  unitMix: v.optional(v.string()),
  stories: v.optional(v.string()),
  zoning: v.optional(v.string()),
  parking: v.optional(v.string()),
  pins: v.optional(v.string()),
  occupancy: v.optional(v.string()),
  saleType: v.optional(v.string()),
  grossIncome: v.optional(v.string()),
  operatingExpenses: v.optional(v.string()),
  noi: v.optional(v.string()),
  propertyTaxes: v.optional(v.string()),
  expenseStructure: v.optional(v.string()),
  tenants: v.optional(v.string()),
  capex: v.optional(v.string()),
  dataSources: v.optional(v.string()),
});

// One entry per agent edit after submission (the worker reads the ones newer
// than completedAt to know what to rebuild).
export const revisionValidator = v.object({
  at: v.number(),
  byEmail: v.string(),
  type: v.union(v.literal("details"), v.literal("list_price")),
  changed: v.array(v.string()),
  // Before → after per edited field (JSON, truncated) so the worker can say
  // exactly what changed.
  diff: v.optional(
    v.array(v.object({ field: v.string(), from: v.string(), to: v.string() })),
  ),
  listPrice: v.optional(v.number()),
  note: v.optional(v.string()),
});

export const STATUS_VALUES = [
  "submitted",
  "building",
  "needs_info",
  "approval",
  "ready",
  "revision",
  "failed",
] as const;
export const statusValidator = v.union(
  v.literal("submitted"),
  v.literal("building"),
  v.literal("needs_info"),
  v.literal("approval"),
  v.literal("ready"),
  v.literal("revision"),
  v.literal("failed"),
);

// Lease (rental) CMA facts: flat string map so the form can grow without
// schema churn. Multi-selects are stored comma-joined.
export const leaseValidator = v.record(v.string(), v.string());

export const requestFields = {
  // "sale" (default, missing on older rows) or "lease" = rental analysis.
  reportType: v.optional(v.union(v.literal("sale"), v.literal("lease"))),
  lease: v.optional(leaseValidator),
  // Investor / 2–4 unit add-on on a residential sale CMA (Michael 2026-11-02):
  // goal, outputs, units, u1Beds/u1Baths/u1Rent/u1Status/u1LeaseEnd…,
  // rehabScope, rehabBudget, finishLevel, rehabNotes, hud. Flat string map.
  investor: v.optional(v.record(v.string(), v.string())),
  kind: v.optional(v.union(v.literal("residential"), v.literal("commercial"))),
  commercial: v.optional(commercialValidator),
  attachments: v.optional(v.array(attachmentValidator)),
  agentName: v.string(),
  agentEmail: v.string(),
  agentPhone: v.optional(v.string()),
  clientName: v.string(),
  clientEmail: v.optional(v.string()),
  clientPhone: v.optional(v.string()),
  street: v.string(),
  unit: v.optional(v.string()),
  city: v.string(),
  state: v.string(),
  zip: v.string(),
  propertyType: v.string(),
  beds: v.optional(v.string()),
  bathsFull: v.optional(v.string()),
  bathsHalf: v.optional(v.string()),
  sqft: v.optional(v.string()),
  yearBuilt: v.optional(v.string()),
  basement: v.optional(v.string()),
  garage: v.optional(v.string()),
  hoaDues: v.optional(v.string()),
  condition: v.string(),
  upgrades: v.array(upgradeValidator),
  otherUpgrades: v.optional(v.string()),
  knownIssues: v.optional(v.string()),
  sellerPriceExpectation: v.optional(v.string()),
  timeline: v.optional(v.string()),
  purpose: v.string(),
  neededBy: v.optional(v.string()),
  branding: v.string(),
  // "Include assigned schools" | "Leave schools out" (residential only;
  // missing on rows filed before 2026-10-27 = include).
  schools: v.optional(v.string()),
  compNotes: v.optional(v.string()),
  notes: v.optional(v.string()),
};

const schema = defineSchema({
  ...authTables,
  cmaRequests: defineTable({
    ...requestFields,
    userId: v.id("users"),
    submittedByEmail: v.optional(v.string()),
    status: statusValidator,
    statusNote: v.optional(v.string()),
    valueLow: v.optional(v.number()),
    valueHigh: v.optional(v.number()),
    listPrice: v.optional(v.number()),
    // Viktor's own recommendation, kept when the agent sets their own price.
    recommendedListPrice: v.optional(v.number()),
    agentListPrice: v.optional(v.number()),
    agentListPriceNote: v.optional(v.string()),
    // Set when the agent edits while a build is running; the worker's "ready"
    // then turns into "revision" so the edit gets built too.
    revisionPending: v.optional(v.boolean()),
    revisions: v.optional(v.array(revisionValidator)),
    pdfStorageId: v.optional(v.id("_storage")),
    workbookStorageId: v.optional(v.id("_storage")),
    pickedUpAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // ── Agent Hub ──
  // Client / team form answers. agentEmail = who it routes to ("" = team).
  formSubmissions: defineTable({
    formId: v.string(),
    formTitle: v.string(),
    group: v.string(),
    audience: v.string(),
    agentEmail: v.string(),
    agentName: v.string(),
    contactName: v.string(),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    propertyAddress: v.optional(v.string()),
    answers: v.record(v.string(), v.string()),
    status: v.union(v.literal("new"), v.literal("contacted"), v.literal("done")),
    isLead: v.boolean(),
    escalatedAt: v.optional(v.number()),
    handledByEmail: v.optional(v.string()),
    handledAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    loftyLeadId: v.optional(v.string()),
    loftyError: v.optional(v.string()),
    // Website uploads (pricing-review): files in Convex storage, shown in the Inbox.
    attachments: v.optional(v.array(attachmentValidator)),
  })
    .index("by_agent", ["agentEmail"])
    .index("by_status", ["status"]),

  // Resources / vendor directory. Agents add their own; Michael curates.
  vendors: defineTable({
    name: v.string(),
    company: v.optional(v.string()),
    category: v.string(),
    subcategory: v.optional(v.string()),
    description: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    address: v.optional(v.string()),
    areas: v.optional(v.string()),
    languages: v.optional(v.string()),
    perk: v.optional(v.string()),
    preferred: v.boolean(),
    hidden: v.boolean(),
    private: v.boolean(),
    // Public "Trusted Local Pros" page on spacematchinc.com. Undefined = shown (unless private/hidden); admins can switch off.
    onWebsite: v.optional(v.boolean()),
    addedByEmail: v.string(),
    addedByName: v.string(),
    source: v.optional(v.string()),
  }).index("by_category", ["category"]),

  // Thumbs-up / note per agent per vendor.
  vendorReviews: defineTable({
    vendorId: v.id("vendors"),
    userEmail: v.string(),
    userName: v.string(),
    rating: v.number(),
    note: v.optional(v.string()),
  }).index("by_vendor", ["vendorId"]),

  // 100% commission rentals (Michael 2026-11-10): Chicago rental buildings that pay the tenant's agent
  // a full month's rent or more. Agents add; staff (admins + ops) stamp Verified with how they confirmed it.
  commissionBuildings: defineTable({
    name: v.string(),
    address: v.string(),
    addressKey: v.string(),
    neighborhood: v.optional(v.string()),
    manager: v.optional(v.string()),
    // Percent of ONE month's rent paid to the tenant's agent (100 = a full month).
    commissionPct: v.number(),
    // Which list: "pays" (100% or more; rows without a status) or "no_pay" (Michael 11-10: "a spot about
    // buildings that dont pay"), with why: no broker commission, under a full month, or didn't pay on a deal.
    status: v.optional(v.union(v.literal("pays"), v.literal("no_pay"))),
    noPayReason: v.optional(v.union(v.literal("none"), v.literal("under"), v.literal("unpaid"))),
    bonus: v.optional(v.string()),
    keyRule: v.optional(v.string()),
    terms: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    brokerUrl: v.optional(v.string()),
    website: v.optional(v.string()),
    sourceNote: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    offerEnds: v.optional(v.string()),
    verified: v.boolean(),
    verifiedAt: v.optional(v.number()),
    verifiedByName: v.optional(v.string()),
    verifiedByEmail: v.optional(v.string()),
    verifiedHow: v.optional(v.string()),
    flagNote: v.optional(v.string()),
    flaggedByName: v.optional(v.string()),
    flaggedAt: v.optional(v.number()),
    hidden: v.boolean(),
    addedByEmail: v.string(),
    addedByName: v.string(),
    createdAt: v.number(),
  }).index("by_key", ["addressKey"]),

  // Team announcements board (leaders/ops post; everyone reads; push to subscribed phones).
  announcements: defineTable({
    title: v.optional(v.string()),
    body: v.string(),
    link: v.optional(v.string()),
    pinned: v.boolean(),
    authorEmail: v.string(),
    authorName: v.string(),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  pushSubs: defineTable({
    userEmail: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    createdAt: v.number(),
  }).index("by_endpoint", ["endpoint"]),


  // Seller Launch Portal: one row per listing; sellers open /s/:token (no login).
  listings: defineTable({
    address: v.string(),
    addressKey: v.string(),
    mlsNumber: v.optional(v.string()),
    price: v.optional(v.string()),
    status: v.string(),
    photoUrl: v.optional(v.string()),
    agentEmail: v.string(),
    agentName: v.string(),
    sellerName: v.string(),
    sellerEmail: v.optional(v.string()),
    sellerPhone: v.optional(v.string()),
    token: v.string(),
    steps: v.array(v.object({ key: v.string(), done: v.boolean(), doneAt: v.optional(v.number()), note: v.optional(v.string()) })),
    links: v.optional(v.object({
      zillow: v.optional(v.string()),
      website: v.optional(v.string()),
      reel: v.optional(v.string()),
      tour: v.optional(v.string()),
      youtube: v.optional(v.string()),
      tiktok: v.optional(v.string()),
      facebook: v.optional(v.string()),
    })),
    liveDate: v.optional(v.string()), // YYYY-MM-DD, for days on market
    // Instagram Reel matched automatically (by Reel link or street in the caption).
    // Latest totals read off the listing's public Zillow page (twice a week).
    zillowPage: v.optional(v.object({ url: v.string(), views: v.number(), saves: v.number(), checkedAt: v.number(), price: v.optional(v.number()), homeStatus: v.optional(v.string()) })),
    // Seller's Lofty contact, found or created when the listing is saved (lofty.syncListingSeller).
    loftyLeadId: v.optional(v.string()),
    loftyError: v.optional(v.string()),
    loftyAt: v.optional(v.number()),
    reelAuto: v.optional(v.object({ mediaId: v.string(), permalink: v.string(), views: v.number(), matchedBy: v.string(), checkedAt: v.number() })),
    // YouTube Short matched automatically (by links.youtube id or street in the title).
    ytAuto: v.optional(v.object({ videoId: v.string(), url: v.string(), title: v.string(), views: v.number(), matchedBy: v.string(), checkedAt: v.number() })),
    weeklyEmail: v.boolean(),
    sellerLastSeenAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_agent", ["agentEmail"])
    .index("by_mls", ["mlsNumber"])
    .index("by_addressKey", ["addressKey"]),

  // Weekly numbers the agent enters (Zillow + MLS have no feed).
  listingMetrics: defineTable({
    listingId: v.id("listings"),
    weekOf: v.string(),
    zillowViews: v.optional(v.number()),
    zillowSaves: v.optional(v.number()),
    mlsSaved: v.optional(v.number()),
    mlsMaybe: v.optional(v.number()),
    mlsNotInterested: v.optional(v.number()),
    adViews: v.optional(v.number()),
    adClicks: v.optional(v.number()),
    reelViews: v.optional(v.number()),
    // Lifetime views of the listing Reel on other channels (TikTok/Facebook typed; YouTube auto or typed).
    tiktokViews: v.optional(v.number()),
    fbViews: v.optional(v.number()),
    youtubeViews: v.optional(v.number()),
    auto: v.optional(v.array(v.string())), // fields filled by code: "zillow" | "reel"
    zillowDays: v.optional(v.number()), // days of Zillow reports summed into this week
    enteredByEmail: v.string(), // "auto" when only code has written the row
    updatedAt: v.number(),
  }).index("by_listing_week", ["listingId", "weekOf"]),

  // Ad campaigns per listing (one row per channel). meta/google/lofty are typed in
  // by the agent until Meta/Google Ads are connected; website = Google Analytics.
  listingAds: defineTable({
    listingId: v.id("listings"),
    channel: v.string(), // meta | google | lofty | website
    status: v.string(), // not_started | scheduled | running | paused | ended
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    reach: v.optional(v.number()), // people reached / impressions / website visitors
    views: v.optional(v.number()), // website page views
    clicks: v.optional(v.number()),
    leads: v.optional(v.number()),
    spend: v.optional(v.number()), // agent-only, never sent to sellers
    budget: v.optional(v.number()), // agent-only
    campaignRef: v.optional(v.string()),
    adLink: v.optional(v.string()),
    note: v.optional(v.string()),
    pages: v.optional(v.string()), // website: JSON [{host,path,views}]
    campaigns: v.optional(v.string()), // meta/google auto: JSON [{id,name,status}] matched campaigns
    source: v.string(), // manual | ga | meta | google_ads
    error: v.optional(v.string()),
    requestedAt: v.optional(v.number()),
    updatedByEmail: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_listing", ["listingId", "channel"]),

  // "What we'd do next": rule-based suggestions (no AI). Agent reviews drafts,
  // publishes; seller sees published ones and can approve the plan.
  listingSuggestions: defineTable({
    listingId: v.id("listings"),
    ruleKey: v.string(), // rule id, or "custom"
    title: v.string(),
    why: v.string(),
    action: v.string(),
    status: v.string(), // draft | published | dismissed
    approvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_listing", ["listingId", "createdAt"]),

  // Activity feed: showings, feedback (agent approves first), offers, updates.
  listingEvents: defineTable({
    listingId: v.id("listings"),
    kind: v.string(), // showing | cancelled | feedback | offer | update | price
    status: v.string(), // pending | published | hidden
    title: v.string(),
    body: v.optional(v.string()),
    interest: v.optional(v.string()),
    priceOpinion: v.optional(v.string()),
    rating: v.optional(v.string()),
    when: v.optional(v.string()),
    agentOnly: v.optional(v.string()), // e.g. buyer's agent, never sent to sellers
    source: v.string(), // agent | showingtime
    externalId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_listing", ["listingId", "createdAt"])
    .index("by_external", ["externalId"])
    .index("by_status", ["status"]),

  // One row per address per day from Zillow "Daily Listing Report" emails
  // (team@ + michael@). Kept even with no matching listing yet; rolled up into
  // listingMetrics weekly sums when a listing with the same addressKey exists.
  zillowReports: defineTable({
    addressKey: v.string(),
    address: v.string(),
    day: v.string(), // YYYY-MM-DD the numbers are for
    views: v.number(),
    saves: v.number(),
    externalId: v.string(), // gmail:<mailbox>:<id>
    createdAt: v.number(),
  })
    .index("by_address_day", ["addressKey", "day"])
    .index("by_external", ["externalId"]),

  // Running totals from the public Zillow page; weekly numbers = difference.
  zillowSnapshots: defineTable({
    listingId: v.id("listings"),
    at: v.number(),
    views: v.number(),
    saves: v.number(),
  }).index("by_listing", ["listingId", "at"]),

  // ShowingTime emails that matched no listing (shown to admins to fix).
  showingInbox: defineTable({
    externalId: v.string(),
    subject: v.string(),
    address: v.string(),
    mls: v.optional(v.string()),
    parsed: v.string(), // JSON of ParsedShowing
    createdAt: v.number(),
  }).index("by_external", ["externalId"]),

  // Lofty "Today" snapshot per agent (refreshed by cron + on demand). Lists are JSON.
  loftyToday: defineTable({
    agentEmail: v.string(),
    agentName: v.string(),
    loftyUserId: v.optional(v.number()),
    updatedAt: v.number(),
    refreshing: v.optional(v.boolean()),
    requestedAt: v.optional(v.number()),
    data: v.optional(v.string()), // JSON TodayData
    error: v.optional(v.string()),
  }).index("by_email", ["agentEmail"]),

  // 90-day Growth Playbook checklist progress (one row per user).
  growthProgress: defineTable({
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
    level: v.optional(v.number()),
    done: v.array(v.string()),
    startedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Growth Score (2026-11-02): agent-entered profiles + auto-checked presence + score.
  growthPresence: defineTable({
    email: v.string(),
    name: v.string(),
    niche: v.optional(v.string()),
    instagram: v.optional(v.string()),
    youtube: v.optional(v.string()),
    links: v.optional(v.record(v.string(), v.string())),
    zillowReviews: v.optional(v.number()),
    zillowVerified: v.optional(v.boolean()),
    gbpLocation: v.optional(v.string()), // "locations/123"
    gbpTitle: v.optional(v.string()),
    gbpReviewUri: v.optional(v.string()),
    gbpClickedAt: v.optional(v.number()),
    signals: v.optional(v.string()), // JSON Signals
    score: v.optional(v.string()), // JSON Score
    total: v.optional(v.number()),
    history: v.optional(v.array(v.object({ month: v.string(), total: v.number() }))),
    checkedAt: v.optional(v.number()),
    checking: v.optional(v.boolean()),
    requestedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),
  // Team-level Growth Score state (key "gbp": visible Business Profiles + pending invites).
  growthTeamState: defineTable({ key: v.string(), data: v.string(), updatedAt: v.number() }).index("by_key", ["key"]),

  // "Request help" asks to the support team (logged, emailed to the person).
  helpRequests: defineTable({
    fromUserId: v.id("users"),
    fromEmail: v.string(),
    fromName: v.string(),
    toName: v.string(),
    toEmail: v.string(),
    topic: v.string(),
    details: v.string(),
    urgency: v.string(), // "now" | "today" | "week"
    status: v.string(), // "new" | "in_progress" | "waiting" | "done" (legacy "open" = new)
    reply: v.optional(v.string()),
    statusAt: v.optional(v.number()),
    statusBy: v.optional(v.string()),
    reassignedBy: v.optional(v.string()),
    createdAt: v.number(),
    doneAt: v.optional(v.number()),
    doneBy: v.optional(v.string()),
  })
    .index("by_from", ["fromUserId"])
    .index("by_to", ["toEmail"]),

  // Agent suggestions for the Hub (fixes / add-ons). Viktor reviews weekly; Michael approves.
  feedback: defineTable({
    fromUserId: v.id("users"),
    fromEmail: v.string(),
    fromName: v.string(),
    kind: v.string(), // "fix" | "improve" | "addon"
    area: v.string(),
    title: v.string(),
    details: v.string(),
    blocking: v.optional(v.boolean()),
    shotId: v.optional(v.id("_storage")),
    voters: v.array(v.id("users")),
    category: v.string(), // key of FEEDBACK_CATEGORIES (auto on submit, Viktor refines)
    categorySource: v.string(), // "auto" | "viktor" | "admin"
    status: v.string(), // see FEEDBACK_STATUS
    priority: v.optional(v.string()), // "high" | "medium" | "low"
    estimate: v.optional(v.string()), // e.g. "~3K credits"
    viktorNote: v.optional(v.string()),
    mergedInto: v.optional(v.id("feedback")),
    reviewedAt: v.optional(v.number()),
    decisionNote: v.optional(v.string()),
    decidedBy: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    shippedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_from", ["fromUserId"]),

  // Ad Kit orders: an agent orders a listing ad package, admins approve, ledger tracks payment.
  adOrders: defineTable({
    listingId: v.id("listings"),
    address: v.string(),
    agentEmail: v.string(),
    agentName: v.string(),
    tier: v.string(), // essential | signature | luxury
    openHouse: v.boolean(),
    payment: v.string(), // ahead | closing
    spend: v.number(),
    fee: v.number(), // SpaceMatch automation fee (incl. open-house fee)
    surcharge: v.number(), // pay-at-closing surcharge
    total: v.number(),
    status: v.string(), // requested | approved | live | done | declined | cancelled
    paymentStatus: v.string(), // unpaid | paid | deducted | rolled
    paymentNote: v.optional(v.string()),
    authorizedAt: v.number(),
    orderedByEmail: v.string(),
    note: v.optional(v.string()), // agent note
    adminNote: v.optional(v.string()),
    decidedByEmail: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    liveAt: v.optional(v.number()),
    settledAt: v.optional(v.number()),
    kit: v.optional(v.string()), // JSON AdKit
    metaCampaignId: v.optional(v.string()),
    draftError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_listing", ["listingId"])
    .index("by_agent", ["agentEmail"])
    .index("by_status", ["status"]),

  // Reel Studio (Michael 2026-10-28): paid agent Reel orders. Zelle up front → Michael confirms → Viktor edits.
  // Seller lists (Michael 2026-10-31): agent orders owner lists for ≤3 ZIPs; Viktor's cron pulls Realist.
  // Price = 2× the run's credits (first list free), billed after delivery by Zelle (convex/sellerLists.ts).
  sellerListOrders: defineTable({
    agentEmail: v.string(),
    agentName: v.string(),
    orderedByEmail: v.string(),
    code: v.string(), // SL-#### (also the Zelle memo)
    zips: v.array(v.string()),
    // Building order (Michael 2026-11-10: "market the whole building"): the worker pulls these buildings' ZIPs and keeps
    // only the owners at these street addresses. zips = the buildings' distinct ZIPs. Omitted = a ZIP order.
    buildings: v.optional(v.array(v.object({ address: v.string(), zip: v.string() }))),
    filters: v.object({ years: v.number(), types: v.string(), top: v.number(), skipTrusts: v.boolean() }),
    status: v.string(), // queued | pulling | delivered | needs_info | failed | cancelled
    statusNote: v.optional(v.string()),
    question: v.optional(v.string()),
    answer: v.optional(v.string()),
    free: v.boolean(),
    homes: v.optional(v.number()),
    summary: v.optional(v.any()), // seller_list_order.py summary.json (per-ZIP counts, suggested designs)
    files: v.array(v.object({ kind: v.string(), name: v.string(), storageId: v.id("_storage"), size: v.number() })),
    viktorNote: v.optional(v.string()),
    costRuns: v.array(v.object({ credits: v.number(), at: v.number(), note: v.optional(v.string()), threadId: v.optional(v.string()) })),
    costCredits: v.number(),
    costFinal: v.optional(v.boolean()),
    price: v.optional(v.number()),
    payment: v.optional(
      v.object({
        code: v.string(),
        amount: v.number(),
        status: v.string(), // awaiting | sent | confirmed | waived
        createdAt: v.number(),
        sentAt: v.optional(v.number()),
        confirmedAt: v.optional(v.number()),
        confirmedBy: v.optional(v.string()),
        note: v.optional(v.string()),
        method: v.optional(v.string()), // "card" when paid through Stripe (convex/cardPay.ts)
      }),
    ),
    // "Mail it for me" (Michael 2026-11-02, done-for-you): list → cards built per suggested design → Lob proofs
    // → ONE Zelle (list + cards × LOB_CARD_PRICE) → Michael confirms → Lob mails. Series = next card every 4 weeks.
    mail: v.optional(v.object({
      mode: v.union(v.literal("once"), v.literal("series")),
      stopped: v.optional(v.boolean()),
      drops: v.array(v.object({
        n: v.number(),
        status: v.string(), // scheduled | building | proofing | ready | mailing | mailed | failed | stopped
        code: v.string(), // Zelle memo (SL-1002, SL-1002-2 …)
        campaignIds: v.array(v.id("mailCampaigns")),
        cards: v.number(),
        listAmount: v.number(),
        cardAmount: v.number(),
        copies: v.optional(v.number()), // agent's own copies inside `cards` (1 per design, Michael 2026-11-12)
        amount: v.number(),
        scheduledFor: v.optional(v.number()),
        readyAt: v.optional(v.number()),
        approvedAt: v.optional(v.number()),
        payment: v.optional(v.string()), // paid | waived (Michael's own / no charge)
        mailedAt: v.optional(v.number()),
        sent: v.optional(v.number()),
        refused: v.optional(v.number()),
        expected: v.optional(v.string()),
        error: v.optional(v.string()),
      })),
    })),
    queuedAt: v.optional(v.number()),
    pickedUpAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentEmail", "createdAt"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  reelOrders: defineTable({
    agentEmail: v.string(),
    agentName: v.string(),
    orderedByEmail: v.string(),
    tier: v.string(), // quick | signature
    price: v.number(), // frozen at order time (0 when free)
    free: v.optional(v.boolean()), // one of the agent's free Reels (FREE_REELS, Michael 2026-11-08: 5)
    revisionsIncluded: v.number(),
    options: v.any(), // ReelOptions (convex/reelDefs.ts)
    clips: v.array(v.object({ id: v.string(), name: v.string(), link: v.string(), size: v.number(), role: v.optional(v.string()) })),
    notes: v.optional(v.string()),
    status: v.string(), // awaiting_payment | payment_sent | queued | editing | needs_info | delivered | revision_payment | done | cancelled
    statusNote: v.optional(v.string()),
    payments: v.array(
      v.object({
        kind: v.string(), // order | revision
        amount: v.number(),
        code: v.string(),
        status: v.string(), // awaiting | sent | confirmed | rejected
        createdAt: v.number(),
        sentAt: v.optional(v.number()),
        confirmedAt: v.optional(v.number()),
        confirmedBy: v.optional(v.string()),
        note: v.optional(v.string()),
        method: v.optional(v.string()), // "card" when paid through Stripe
      }),
    ),
    // kind "captions" = agent edited caption text (free, doesn't use a revision).
    revisions: v.array(
      v.object({
        n: v.number(),
        note: v.string(),
        at: v.number(),
        paid: v.boolean(),
        kind: v.optional(v.string()),
        edits: v.optional(v.array(v.object({ i: v.number(), text: v.string() }))),
      }),
    ),
    // Caption lines of the latest version (worker sets them), so agents can fix wording.
    captionLines: v.optional(v.array(v.object({ i: v.number(), start: v.number(), end: v.number(), text: v.string() }))),
    question: v.optional(v.string()),
    answer: v.optional(v.string()),
    version: v.number(),
    outputs: v.array(
      v.object({ version: v.number(), format: v.string(), storageId: v.id("_storage"), size: v.number(), seconds: v.optional(v.number()) }),
    ),
    viktorNote: v.optional(v.string()),
    costRuns: v.array(v.object({ credits: v.number(), at: v.number(), note: v.optional(v.string()), threadId: v.optional(v.string()) })),
    costCredits: v.number(),
    queuedAt: v.optional(v.number()),
    pickedUpAt: v.optional(v.number()),
    // Live progress while editing (Michael 2026-10-29): stage key from REEL_STAGES + when it started.
    stage: v.optional(v.string()),
    stageAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentEmail", "createdAt"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  // Reel Studio direct phone uploads (Michael 2026-11-08 "uploading is really confusing"): the browser
  // uploads a clip in 16 MB parts (each its own storage file, so no 2-minute upload timeout) and the
  // worker joins the parts, copies the clip into the agent's Drive folder, then deletes the parts.
  // Reel Studio trend check (Michael 11-08): the worker refreshes weekly; one row, newest wins.
  reelTrends: defineTable({
    checkedAt: v.number(),
    picks: v.array(v.object({ purpose: v.string(), name: v.string(), how: v.string() })),
    signals: v.array(v.string()),
    // Trending songs agents add in the app (can't be baked into the file).
    sounds: v.optional(v.array(v.object({ title: v.string(), artist: v.string(), use: v.string(), reels: v.optional(v.string()), preview: v.optional(v.string()), link: v.optional(v.string()) }))),
  }).index("by_checked", ["checkedAt"]),

  reelUploads: defineTable({
    agentEmail: v.string(),
    uploadedBy: v.string(),
    name: v.string(),
    size: v.number(),
    mimeType: v.string(),
    parts: v.array(v.id("_storage")),
    driveFileId: v.optional(v.string()),
    driveLink: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_agent", ["agentEmail", "createdAt"]),

  // B-Roll Library (2026-10-24): video files for /broll; clip metadata lives in src/lib/broll.ts.
  brollClips: defineTable({
    cid: v.string(),
    storageId: v.id("_storage"),
    size: v.number(),
    updatedAt: v.number(),
  }).index("by_cid", ["cid"]),

  // "Why SpaceMatch" personal pitch links agents text/email to prospects during a call.
  // One row per link sent; the public page pings opens/sections/actions so the agent sees it live.
  whyLinks: defineTable({
    token: v.string(),
    agentSlug: v.string(),
    agentEmail: v.string(),
    createdByEmail: v.string(),
    prospectName: v.string(),
    path: v.string(), // sell | buy | both
    channel: v.string(), // text | email | copy | qr | present
    createdAt: v.number(),
    opens: v.number(),
    firstOpenedAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
    section: v.optional(v.string()),
    sections: v.array(v.string()),
    actions: v.array(v.string()),
    chosenPath: v.optional(v.string()),
    requestedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_agent", ["agentEmail", "createdAt"]),

  // Seller mailers (convex/mailers.ts): one campaign = one design mailed to one list.
  mailCampaigns: defineTable({
    name: v.string(),
    design: v.string(),
    agentEmail: v.string(),
    agentName: v.string(),
    createdByEmail: v.string(),
    households: v.number(),
    status: v.union(v.literal("draft"), v.literal("print_requested"), v.literal("mailed")),
    printRequestedAt: v.optional(v.number()),
    mailedOn: v.optional(v.string()),
    cost: v.optional(v.number()),
    note: v.optional(v.string()),
    scans: v.number(),
    scannedHouseholds: v.number(),
    leads: v.number(),
    createdAt: v.number(),
    // Wise Pelican 6x9 route: one QR per mailing (→ /v/<wpCode>), scans counted here.
    wpCode: v.optional(v.string()),
    wpScans: v.optional(v.number()),
    // Lob print + mail (Michael 2026-11-01): test proof → agent requests → Zelle → Michael approves → batches.
    lobStatus: v.optional(v.union(
      v.literal("proofing"), v.literal("proof"), v.literal("requested"), v.literal("sending"), v.literal("sent"), v.literal("failed"),
    )),
    lobProofUrl: v.optional(v.string()),
    lobProofThumbs: v.optional(v.array(v.string())),
    lobProofAt: v.optional(v.number()),
    lobRequestedAt: v.optional(v.number()),
    lobRequestedBy: v.optional(v.string()),
    lobAmount: v.optional(v.number()),
    lobMemo: v.optional(v.string()),
    lobPayment: v.optional(v.union(v.literal("paid"), v.literal("waived"))),
    lobApprovedAt: v.optional(v.number()),
    lobApprovedBy: v.optional(v.string()),
    lobMode: v.optional(v.union(v.literal("live"), v.literal("test"))),
    lobRun: v.optional(v.number()),
    lobSent: v.optional(v.number()),
    lobFailed: v.optional(v.number()),
    lobDoneAt: v.optional(v.number()),
    lobExpected: v.optional(v.string()),
    lobError: v.optional(v.string()),
    // Built by "Mail it for me" (sellerListOrders.mail): which order and drop this mailing belongs to.
    orderId: v.optional(v.id("sellerListOrders")),
    drop: v.optional(v.number()),
    // Agent's own copy (Michael 2026-11-12): one extra card to agentMailAddresses, billed like any other card.
    copyLobId: v.optional(v.string()),
    copyTo: v.optional(v.string()),
    copyError: v.optional(v.string()),
  })
    .index("by_agent", ["agentEmail", "createdAt"])
    .index("by_wpCode", ["wpCode"])
    .index("by_order", ["orderId"]),
  // Where each agent's own copy of their Lob mailings goes (convex/agentCopy.ts). Required before mailing.
  agentMailAddresses: defineTable({
    email: v.string(),
    name: v.string(),
    line1: v.string(),
    line2: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    zip: v.string(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_email", ["email"]),
  mailHouseholds: defineTable({
    campaignId: v.id("mailCampaigns"),
    code: v.string(),
    nameLine: v.string(),
    who: v.string(),
    mailAddr: v.string(),
    mailCity: v.string(),
    mailState: v.string(),
    mailZip: v.string(),
    propAddr: v.string(),
    propShort: v.string(),
    scans: v.number(),
    firstScanAt: v.optional(v.number()),
    lastScanAt: v.optional(v.number()),
    leadAt: v.optional(v.number()),
    submissionId: v.optional(v.id("formSubmissions")),
    lobId: v.optional(v.string()), // psc_… once Lob accepted the card
    lobError: v.optional(v.string()),
  })
    .index("by_code", ["code"])
    .index("by_campaign", ["campaignId"]),

  // Agent Videos (Michael 2026-10-26): cached Drive file list per agent upload folder + notes for the editor.
  agentVideoFiles: defineTable({
    agentEmail: v.string(),
    files: v.array(v.object({ id: v.string(), name: v.string(), size: v.number(), mimeType: v.string(), createdTime: v.string(), link: v.string() })),
    checkedAt: v.number(),
    error: v.optional(v.string()),
  }).index("by_agent", ["agentEmail"]),
  agentVideoBriefs: defineTable({
    agentEmail: v.string(),
    agentName: v.string(),
    kind: v.string(),
    title: v.string(),
    address: v.optional(v.string()),
    useFor: v.array(v.string()),
    notes: v.optional(v.string()),
    files: v.array(v.string()),
    status: v.union(v.literal("new"), v.literal("editing"), v.literal("posted")),
    postedUrl: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    sheetRange: v.optional(v.string()),
    sheetError: v.optional(v.string()),
  })
    .index("by_agent", ["agentEmail", "createdAt"])
    .index("by_created", ["createdAt"]),

  // Over-cap CMA approvals and other admin settings.
  // Adoption scoreboard: one row per person × Chicago day × Hub area (page pings, no AI).
  hubActivity: defineTable({
    email: v.string(),
    day: v.string(), // YYYY-MM-DD, America/Chicago
    area: v.string(),
    count: v.number(),
    firstAt: v.number(),
    lastAt: v.number(),
  })
    .index("by_email_day_area", ["email", "day", "area"])
    .index("by_day", ["day"]),

  // Lead Desk (Michael 2026-10-27): ops vet any lead, book an agent, agent accepts + logs outcome.
  deskLeads: defineTable({
    stage: v.string(), // deskDefs DESK_STAGES
    source: v.string(),
    sourceRef: v.optional(v.string()), // e.g. gmail:<id> for auto-intake dedupe
    mergedRefs: v.optional(v.array(v.string())), // later intake emails merged into this lead
    rawText: v.optional(v.string()),
    leadType: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    language: v.optional(v.string()),
    details: v.record(v.string(), v.string()),
    rating: v.optional(v.string()),
    notes: v.optional(v.string()),
    agentEmail: v.optional(v.string()),
    agentName: v.optional(v.string()),
    apptStart: v.optional(v.number()),
    apptMinutes: v.optional(v.number()),
    apptKind: v.optional(v.string()),
    apptLocation: v.optional(v.string()),
    textClient: v.optional(v.boolean()),
    token: v.optional(v.string()), // agent one-tap link /a/:token
    calendarEventId: v.optional(v.string()),
    calendarLink: v.optional(v.string()),
    calendarError: v.optional(v.string()),
    bookedByEmail: v.optional(v.string()),
    bookedByName: v.optional(v.string()),
    bookedAt: v.optional(v.number()),
    bookSeq: v.optional(v.number()), // bumps on every (re)booking so stale scheduled jobs skip
    respondedAt: v.optional(v.number()),
    declineReason: v.optional(v.string()),
    escalatedAt: v.optional(v.number()),
    outcome: v.optional(v.string()),
    outcomeNote: v.optional(v.string()),
    outcomeAt: v.optional(v.number()),
    outcomeAskedAt: v.optional(v.number()),
    closeReason: v.optional(v.string()),
    loftyLeadId: v.optional(v.string()),
    loftyError: v.optional(v.string()),
    texts: v.optional(v.record(v.string(), v.number())), // confirm / r24 / r2 → sent at
    textError: v.optional(v.string()),
    history: v.array(v.object({ at: v.number(), by: v.string(), text: v.string() })),
    createdAt: v.number(),
    createdBy: v.string(),
  })
    .index("by_stage", ["stage", "createdAt"])
    .index("by_agent", ["agentEmail", "apptStart"])
    .index("by_token", ["token"])
    .index("by_sourceRef", ["sourceRef"])
    .index("by_created", ["createdAt"]),

  // Per-agent booking profile for the Lead Desk (hours, languages, areas).
  deskAgents: defineTable({
    email: v.string(),
    hours: v.optional(v.record(v.string(), v.union(v.array(v.number()), v.null()))),
    languages: v.array(v.string()),
    areas: v.string(),
    specialties: v.array(v.string()),
    active: v.boolean(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_email", ["email"]),

  // Rate limit for anonymous website upload URLs (pricing-review). Rows older than a day are pruned.
  publicUploadTickets: defineTable({ at: v.number() }).index("by_at", ["at"]),

  // Agent-written email templates (Michael 2026-10-31). Personal by default; "Suggest for team"
  // → admins/ops approve → status "team" shows in everyone's library.
  emailTemplates: defineTable({
    ownerUserId: v.id("users"),
    ownerEmail: v.string(),
    ownerName: v.string(),
    title: v.string(),
    segment: v.string(), // a SEGMENTS id or "other"
    subject: v.string(),
    body: v.string(),
    status: v.string(), // mine | suggested | team | declined
    reviewNote: v.optional(v.string()),
    reviewedBy: v.optional(v.string()),
    basedOn: v.optional(v.string()), // library email id it started from
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerUserId", "updatedAt"])
    .index("by_status", ["status", "updatedAt"]),

  // Agent's own Follow Up Boss account (Angel's idea, Michael approved 2026-11-02).
  // Hub leads routed to the agent are copied into their FUB; Lofty stays the team CRM.
  // apiKey never leaves the server (fub.mine returns only the last 4 chars).
  fubConnections: defineTable({
    userId: v.id("users"),
    email: v.string(),
    apiKey: v.string(),
    enabled: v.boolean(),
    accountLabel: v.optional(v.string()),
    connectedAt: v.number(),
    pushedCount: v.optional(v.number()),
    lastPushAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    lastErrorAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_email", ["email"]),

  // Neighborhood & marketing plan per listing (Michael 2026-11-08 #team-app-design).
  // Built by listingPlans.build: free public data (Census geocoder + ACS via Census
  // Reporter, Chicago community areas, CPS boundaries) + web_search + one AI write-up.
  listingPlans: defineTable({
    listingId: v.id("listings"),
    status: v.union(v.literal("queued"), v.literal("building"), v.literal("ready"), v.literal("error")),
    step: v.optional(v.string()),
    neighborhood: v.optional(v.string()),
    notes: v.optional(v.string()),
    requestedByEmail: v.string(),
    facts: v.optional(v.any()),
    plan: v.optional(v.any()),
    error: v.optional(v.string()),
    builds: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_listing", ["listingId"]),


  // New Leads tracker (Michael 2026-11-08): one row per new Lofty lead (last ~2 weeks),
  // synced every 5 min from Lofty leads + the team comms feed. hub_* comms = sent from the Hub.
  trackedLeads: defineTable({
    loftyLeadId: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    source: v.string(),
    kind: v.string(), // leadTrackDefs Kind
    leadTypes: v.array(v.number()),
    stage: v.string(),
    agentName: v.optional(v.string()),
    street: v.optional(v.string()),
    tags: v.array(v.string()),
    cannotText: v.boolean(),
    createdAt: v.number(),
    comms: v.array(v.object({ at: v.number(), kind: v.string(), status: v.optional(v.string()), text: v.optional(v.string()), by: v.optional(v.string()) })),
    textCount: v.number(), // Lofty text events seen (refetch contents when it changes)
    handled: v.optional(v.string()), // done | not_lead
    handledBy: v.optional(v.string()),
    history: v.array(v.object({ at: v.number(), by: v.string(), text: v.string() })),
    alertedReplyAt: v.optional(v.number()),
    // Auto CMA when they ask "what's it worth / more info" (2026-11-09).
    cmaRequestId: v.optional(v.id("cmaRequests")),
    cmaAuto: v.optional(v.string()), // why no CMA was started: no_address | daily_cap
    updatedAt: v.number(),
  })
    .index("by_lofty", ["loftyLeadId"])
    .index("by_cma", ["cmaRequestId"])
    .index("by_created", ["createdAt"]),

  hubSettings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  // Pay by card (Michael 2026-11-10: "add the stripe option"). One row: Michael pastes his Stripe key in
  // Settings; it never leaves the server (cardPay.info returns only the last 4 characters).
  stripeConfig: defineTable({
    apiKey: v.string(),
    mode: v.string(), // live | test (test keys never show Pay by card to agents on prod)
    feeMode: v.string(), // agent = 3% card fee added to the agent's total | absorb = SpaceMatch pays Stripe's fee
    savedBy: v.string(),
    savedAt: v.number(),
  }),
  // One row per Stripe Checkout Session. Paid = Stripe said so when the Hub asked (never the browser).
  cardPayments: defineTable({
    kind: v.string(), // list | lob | reel | ad
    refId: v.string(), // the order's _id
    code: v.string(), // the order's payment code (SL-1005, MAIL-XXXXX, RS-1004, AD-XXXXX)
    label: v.string(),
    amount: v.number(), // what the order costs (same as the Zelle amount)
    fee: v.number(), // card fee added on top (0 when SpaceMatch absorbs it)
    total: v.number(), // charged to the card
    userId: v.id("users"),
    agentEmail: v.string(),
    agentName: v.string(),
    backPath: v.string(),
    sessionId: v.string(),
    url: v.string(),
    mode: v.string(),
    status: v.string(), // open | paid | expired | problem
    note: v.optional(v.string()),
    checks: v.number(),
    createdAt: v.number(),
    expiresAt: v.number(),
    paidAt: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_ref", ["kind", "refId"])
    .index("by_created", ["createdAt"]),
  // Team roster screen (/team, Michael 2026-11-16): agents added, edited or removed in the Hub.
  // Merged over SEED_AGENTS in agentsData.ts (applyRoster).
  rosterAgents: defineTable({
    email: v.string(), // lowercase
    name: v.string(),
    phone: v.string(),
    title: v.optional(v.string()),
    lic: v.optional(v.string()),
    bio: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
    photoUrl: v.optional(v.string()),
    folderId: v.optional(v.string()),
    folderError: v.optional(v.string()),
    status: v.string(), // active | removed
    addedBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    removedAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  // ── Market myself, per agent (Michael 2026-11-22 "All of it", DM 1795360151.449479) ──
  // Agent marketing settings: own Google review link (blank = team Google page) + market areas (keys in marketDefs).
  agentMarketing: defineTable({
    email: v.string(), // lowercase
    reviewUrl: v.optional(v.string()),
    areas: v.optional(v.array(v.string())),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),
  // Review requests: client opens /r/:token. Every client sees the Google button (no review gating).
  reviewRequests: defineTable({
    token: v.string(),
    agentEmail: v.string(),
    agentName: v.string(),
    clientName: v.string(),
    channel: v.string(), // text | email | copy
    target: v.string(), // agent | team (which Google page the button opens)
    createdAt: v.number(),
    opens: v.number(),
    firstOpenedAt: v.optional(v.number()),
    clickedAt: v.optional(v.number()),
    note: v.optional(v.string()), // optional private note from the client
    noteAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_agent", ["agentEmail", "createdAt"]),
  // Past clients for the touch plan (each agent sees only their own).
  pastClients: defineTable({
    agentEmail: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    closedOn: v.string(), // YYYY-MM-DD
    side: v.string(), // seller | buyer | renter | landlord
    done: v.array(v.string()), // touch keys done, e.g. "anniv-2027", "thanks-2026"
    createdAt: v.number(),
  }).index("by_agent", ["agentEmail"]),
  // Open house calendar: a slot on a team listing; anyone can host an open slot.
  openHouses: defineTable({
    listingId: v.optional(v.id("listings")),
    address: v.string(),
    date: v.string(), // YYYY-MM-DD (Chicago)
    start: v.string(), // HH:MM
    end: v.string(),
    listingAgent: v.string(),
    hostEmail: v.optional(v.string()),
    hostName: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdByEmail: v.string(),
    createdAt: v.number(),
  }).index("by_date", ["date"]),
  // Monthly MRED area stats (pushed by the monthly script; agents may type numbers when a pull is missing).
  marketStats: defineTable({
    area: v.string(), // marketDefs key
    month: v.string(), // YYYY-MM
    sales: v.optional(v.number()),
    median: v.optional(v.number()),
    yoyPct: v.optional(v.number()),
    domMedian: v.optional(v.number()),
    soldToList: v.optional(v.number()),
    active: v.optional(v.number()),
    monthsSupply: v.optional(v.number()),
    source: v.string(), // mred | agent
    enteredBy: v.optional(v.string()),
    pulledAt: v.number(),
  }).index("by_area_month", ["area", "month"]),
});

export default schema;
