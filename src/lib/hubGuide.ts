// Hub Guide content: what every tool does + "when do I use what" situations.
// Used by the public landing page (FEATURE_GROUPS) and /guide (TOOLS_GUIDE + SITUATIONS).
// Static copy only, no AI. Edit here, redeploy.

export type GuideTool = {
  id: string;
  name: string;
  to: string; // in-app route
  what: string; // one line: what it does
  when: string; // one line: when to reach for it
  where: string; // how to find it in the app
};

export const TOOLS_GUIDE: GuideTool[] = [
  // Win the client
  { id: "why", name: "Why SpaceMatch link", to: "/why", what: "A personal pitch page with your photo, our 14-day launch plan, calculators and reviews. You see when the prospect opens it and what they read.", when: "Right after a first call with a seller or buyer who is still deciding.", where: "Home › big Why SpaceMatch tile" },
  { id: "cma", name: "CMA request", to: "/new", what: "Fill in the address and upgrades. You get a branded Cloud CMA PDF and a comps workbook. Works for sale, buyer-offer, lease and commercial.", when: "Before every listing appointment, pricing talk or offer. Order it 1–2 days ahead.", where: "Home › Get a CMA (gold tile) · avatar menu › My CMA requests" },
  { id: "decks", name: "Decks & guides", to: "/presentations", what: "Pre-listing package, appointment deck, full listing deck, plus Buyer and Seller guides. Each one already carries your name, photo and contact info.", when: "Send the pre-listing package before the appointment and present the deck at it. Send the Buyer guide after a buyer consult.", where: "Home › Decks & guides" },
  { id: "sellerlists", name: "Seller lists", to: "/seller-lists", what: "Pick up to 3 ZIP codes, or type one or more building addresses, and get the owner-occupied homes most likely to sell (no LLCs or trusts, not listed), each with a suggested postcard. You don't need a listing. First list free, then $5 per ZIP by Zelle.", when: "Before a mailing, when you start farming a new area or a condo building, or when you need more seller conversations.", where: "Home › Mail a neighborhood or a building · Marketing › Seller lists" },
  { id: "mailers", name: "Seller mailers", to: "/mailers", what: "4 jumbo postcard designs with your face and a QR code. Every scan becomes a lead in your Inbox and in Lofty.", when: "Farming a neighborhood, after a Just Listed or Just Sold, or circling a new listing.", where: "Marketing › Postcards" },
  // Leads & clients
  { id: "today", name: "Today", to: "/home", what: "Your new Lofty leads, showings, follow-ups due and hot leads gone quiet, all in one list. Refreshes 3 times a day.", when: "First thing every morning, and again after lunch.", where: "Home › Today" },
  { id: "forms", name: "Client forms", to: "/forms", what: "25 forms for sellers, buyers, renters, landlords, business sales, open houses and referrals. Send them as a link, text, email or QR code.", when: "Any time you'd otherwise type questions into a text: intake, property details, offer info, tour check-ins.", where: "Bottom tab › Forms" },
  { id: "inbox", name: "Inbox", to: "/inbox", what: "Every form reply and mailer or Why-link lead comes here, tagged with your name. Mark it contacted or done.", when: "When you get the 'new form reply' email, or as part of your daily routine.", where: "Bottom tab › Inbox (red badge = new)" },
  // Listings
  { id: "portal", name: "Seller portal", to: "/listings", what: "A private live page for each seller: launch timeline, Zillow views and saves, showing feedback (you approve it first), ad results and a weekly email.", when: "The day the listing agreement is signed. Your seller gets the link by text and email.", where: "Bottom tab › Listings › New listing" },
  { id: "adkit", name: "Ad Kit", to: "/ad-orders", what: "Order a Meta, Google and YouTube ad package for a listing. Choose pay now or pay at closing. The campaign copy comes ready-made.", when: "Coming Soon or launch week, or when showings slow down.", where: "Listings › your listing › Ads & web tab › Order ads" },
  { id: "broll", name: "B-Roll Library", to: "/broll", what: "Branded SpaceMatch clips with your name bar and end card for your own Reels.", when: "Posting on Instagram or TikTok without a fresh shoot.", where: "Home › Docs & training › B-Roll Library" },
  { id: "reels", name: "Reel Studio", to: "/reels", what: "Order a finished Reel from your own clips: pick a style, your colors, music and call to action. Quick Reel $12, Signature $25, paid by Zelle. Download a file for Instagram, TikTok, YouTube and Facebook.", when: "You filmed something and want it posted this week without editing it yourself.", where: "Home › Reel Studio" },
  { id: "videos", name: "My videos", to: "/my-videos", what: "Upload raw phone clips to your Drive folder. Our editor turns them into finished Reels.", when: "After a walkthrough, market update or client story you filmed on your phone.", where: "Home › My videos" },
  // Run your business
  { id: "signature", name: "Email signature", to: "/signature", what: "Builds your own email signature with the SpaceMatch and Real logos, your photo, cell, the office address and your own Instagram, Facebook, LinkedIn, TikTok, YouTube and Zillow links. Copy it and paste it into Gmail, Outlook or your phone.", when: "Your first week, and any time your phone, title or social links change.", where: "Home › Make your email signature · Marketing › Email signature · avatar menu › My email signature" },
  { id: "templates", name: "Templates & scripts", to: "/templates", what: "Blank Real Broker and IL forms, SpaceMatch documents, call scripts and email templates.", when: "Before you write something from scratch: listing agreement, buyer rep, net sheet or follow-up email.", where: "Home › Docs & training › Templates library" },
  { id: "rentals100", name: "100% commission rentals", to: "/commission-rentals", what: "Chicago rental buildings that pay the tenant's agent a full month's rent or more, with the rule you must follow and how to get paid. A gold Verified stamp means the office confirmed it with the building. You can add buildings you know. A second list, Doesn't pay, shows buildings that pay no broker commission, pay under a full month, or didn't pay an agent on a deal.", when: "A renter client wants an apartment, a building tells you it pays 100% or more, or you want to know before a tour whether a building pays.", where: "Home › 100% commission rentals · Clients › 100% rentals" },
  { id: "vendors", name: "Vendors", to: "/resources", what: "Trusted lenders, attorneys, inspectors, contractors, stagers and movers that Michael has used. Call, text or send the client a contact card.", when: "A client asks 'who do you recommend?'", where: "Bottom tab › Vendors" },
  { id: "playbooks", name: "Playbooks", to: "/playbooks", what: "Step-by-step how-tos: speed-to-lead, open house, listing launch, offers in Illinois, contract to close and more.", when: "Your first time doing something, or when you want our exact process.", where: "Avatar menu › Playbooks · Home › Academy" },
  { id: "academy", name: "SpaceMatch Academy", to: "/training", what: "7 training tracks with short quizzes and a sign-off from a team lead.", when: "Your first 30 days, then one track a month.", where: "Home › Docs & training › SpaceMatch Academy" },
  { id: "muse", name: "Muse coach", to: "/muse", what: "Puts our playbooks, scripts and the 90-day plan inside Meta's free Muse AI on your phone, so you can ask \"what do I say?\" by voice or text, or practice objections.", when: "Set it up in week one. Use it in the car before appointments, after showings, and for role-play practice.", where: "Avatar menu › Muse coach · Ask Muse button on every playbook" },
  { id: "growth", name: "Growth Playbook", to: "/growth", what: "A 90-day plan, 45 minutes a day, with progress tracking.", when: "New to the team, or when your pipeline is thin.", where: "Home › Docs & training › Growth Playbook" },
  // Team
  { id: "help", name: "Get help", to: "/help", what: "Ask Cris, Atom, Brandon, Sergio or Michael. Pick how urgent it is and track the reply.", when: "Signs, MLS input, dotloop, Lofty access, pricing questions or deal strategy.", where: "Home › Get help" },
  { id: "announcements", name: "Announcements", to: "/announcements", what: "Team news with phone notifications.", when: "Check whenever you get a Hub notification.", where: "Home › Announcements · avatar menu" },
  { id: "feedback", name: "Suggest a fix", to: "/feedback", what: "Report something broken or ask for a new feature. Michael reviews every week.", when: "Anything in the Hub is confusing, slow or missing.", where: "Home › bottom · avatar menu" },
];

export type Step = { text: string; to?: string; label?: string };
export type Situation = {
  id: string;
  stage: "seller" | "buyer" | "listing" | "lease" | "closing" | "everyday";
  title: string; // "I just…" moment
  goal: string;
  steps: Step[];
  playbook?: string; // /playbooks/:id
};

export const STAGES: { id: Situation["stage"]; label: string }[] = [
  { id: "everyday", label: "Every day" },
  { id: "seller", label: "Sellers" },
  { id: "listing", label: "Active listing" },
  { id: "buyer", label: "Buyers" },
  { id: "lease", label: "Rentals" },
  { id: "closing", label: "Contract & closing" },
];

export const SITUATIONS: Situation[] = [
  {
    id: "morning", stage: "everyday", title: "Starting my day",
    goal: "See who needs you before you open anything else.",
    steps: [
      { text: "Open Home and work the Today list from the top: new leads first, then showings and follow-ups.", to: "/home", label: "Home" },
      { text: "Clear new replies in your Inbox.", to: "/inbox", label: "Inbox" },
      { text: "Spend 30 minutes in Lofty using the daily routine.", to: "/playbooks/lofty-daily", label: "Lofty routine" },
    ],
    playbook: "lofty-daily",
  },
  {
    id: "new-lead", stage: "everyday", title: "A new lead just came in",
    goal: "Reach them within 5 minutes and look like a real team.",
    steps: [
      { text: "Call, then text if they don't pick up. Use the speed-to-lead scripts.", to: "/playbooks/speed-to-lead", label: "Speed-to-Lead" },
      { text: "Send a Why SpaceMatch link so they see who you are before the second call.", to: "/why", label: "Why link" },
      { text: "Send the matching intake form (Seller or Buyer Intake) to collect details.", to: "/forms", label: "Forms" },
    ],
    playbook: "speed-to-lead",
  },
  {
    id: "stuck", stage: "everyday", title: "I can't find something / I'm stuck",
    goal: "Get an answer without hunting.",
    steps: [
      { text: "Type it in the search box on Home: 'lender', 'open house', 'deck', 'buyer rep', 'transfer tax'.", to: "/home", label: "Search" },
      { text: "Still stuck? Send a help request to the right person.", to: "/help", label: "Get help" },
    ],
  },
  {
    id: "seller-maybe", stage: "seller", title: "A homeowner says 'maybe next year'",
    goal: "Stay top of mind without chasing.",
    steps: [
      { text: "Send a Why SpaceMatch link (Sell path). You'll get a notification when they open it.", to: "/why", label: "Why link" },
      { text: "Offer a free CMA so they know their number today.", to: "/new", label: "Get a CMA" },
      { text: "Tag them in Lofty and add their block to your next seller mailer.", to: "/mailers", label: "Mailers" },
    ],
    playbook: "seller-prospecting",
  },
  {
    id: "appointment", stage: "seller", title: "I booked a listing appointment",
    goal: "Walk in with the price, the plan and proof.",
    steps: [
      { text: "Order the CMA 1–2 days ahead. Add every upgrade the seller mentioned.", to: "/new", label: "Get a CMA" },
      { text: "Send the Seller Intake form so you have their details and timeline.", to: "/forms?open=seller-intake", label: "Seller Intake" },
      { text: "Email the pre-listing package and Seller guide the day before.", to: "/presentations", label: "Decks & guides" },
      { text: "At the table, present the appointment deck and show the Seller portal demo: 'this is the page you'll get.'", to: "/demo/seller", label: "Portal demo" },
    ],
    playbook: "listing-presentation",
  },
  {
    id: "farm", stage: "seller", title: "I want more listings in one area",
    goal: "Be the name people in the neighborhood recognize.",
    steps: [
      { text: "Send a seller mailer to the area. Every QR scan becomes a lead.", to: "/mailers", label: "Seller mailers" },
      { text: "Post Reels using B-roll with your name bar.", to: "/broll", label: "B-Roll" },
      { text: "Film a quick market update and upload it for editing.", to: "/my-videos", label: "My videos" },
    ],
  },
  {
    id: "signed", stage: "listing", title: "I just signed a listing",
    goal: "Launch in 14 days, with the seller watching it happen.",
    steps: [
      { text: "Create the listing. The seller portal is built and the seller gets their private link.", to: "/listings", label: "New listing" },
      { text: "Send the Property Details and Listing Launch Checklist forms.", to: "/forms?open=listing-launch", label: "Launch checklist" },
      { text: "Book media day in Giraffe360 and ask Cris for signs (Marketing Request).", to: "/forms?open=marketing-request", label: "Marketing Request" },
      { text: "Order an Ad Kit from the listing's Ads & web tab.", to: "/listings", label: "Listings" },
    ],
    playbook: "listing-launch",
  },
  {
    id: "live", stage: "listing", title: "My listing is live",
    goal: "Keep the seller informed without 20 texts a week.",
    steps: [
      { text: "Tick off launch steps as they happen. The seller sees them right away.", to: "/listings", label: "Listings" },
      { text: "Showing feedback lands on the listing's Activity tab. Approve it before the seller sees it.", to: "/listings", label: "Listings" },
      { text: "Open house: show the Open House Sign-in QR at the door. Visitors go straight into Lofty.", to: "/forms?open=open-house-signin", label: "Open house sign-in" },
      { text: "Mondays: fill in the 30-second numbers form (Zillow and MLS counts).", to: "/listings", label: "Listings" },
    ],
    playbook: "open-house",
  },
  {
    id: "no-offers", stage: "listing", title: "Day 14 and no offers",
    goal: "Have the price conversation with data, not feelings.",
    steps: [
      { text: "Open the listing's Next steps tab. It suggests moves based on views, saves and feedback.", to: "/listings", label: "Next steps" },
      { text: "Ask for an updated CMA with the newest competition.", to: "/requests", label: "My CMAs" },
      { text: "Publish the plan. The seller taps Approve in their portal.", to: "/playbooks/pricing", label: "Pricing talk" },
    ],
    playbook: "pricing",
  },
  {
    id: "buyer-new", stage: "buyer", title: "I have a new buyer",
    goal: "Get them pre-approved and signed before you tour.",
    steps: [
      { text: "Send Buyer Intake to get their areas, budget and timeline.", to: "/forms?open=buyer-intake", label: "Buyer Intake" },
      { text: "Send the Buyer guide and introduce a lender from Vendors.", to: "/resources?cat=Lenders", label: "Lenders" },
      { text: "Run the buyer consult and sign the buyer rep agreement (Templates).", to: "/playbooks/buyer-consultation", label: "Buyer consult" },
      { text: "After tours, send the Tour Check-in form.", to: "/forms?open=buyer-tour-feedback", label: "Tour Check-in" },
    ],
    playbook: "buyer-consultation",
  },
  {
    id: "buyer-offer", stage: "buyer", title: "My buyer wants to make an offer",
    goal: "Know the walk-away number before you write it.",
    steps: [
      { text: "Order a CMA with purpose 'Buyer offer support'. You get an open, suggested and walk-away price.", to: "/new", label: "Get a CMA" },
      { text: "Collect offer details with the Offer & Under Contract (Buyer) form.", to: "/forms?open=buyer-offer", label: "Offer form" },
      { text: "Use the Illinois offer playbook and the Real Broker forms in Templates.", to: "/playbooks/offers-illinois", label: "Offers in IL" },
    ],
    playbook: "offers-illinois",
  },
  {
    id: "landlord", stage: "lease", title: "A landlord wants to rent out a unit",
    goal: "Price the rent right and fill it fast.",
    steps: [
      { text: "Order a lease CMA (rent range and suggested asking rent).", to: "/lease", label: "Lease CMA" },
      { text: "Send Landlord Intake, then Rental Listing Details.", to: "/forms?open=landlord-intake", label: "Landlord forms" },
      { text: "Follow the leasing playbook for screening and lease signing.", to: "/playbooks/leasing", label: "Leasing" },
    ],
    playbook: "leasing",
  },
  {
    id: "renter", stage: "lease", title: "A renter is looking",
    goal: "Get them application-ready before they fall for a place.",
    steps: [
      { text: "Send Renter Intake, then Rental Application Prep.", to: "/forms?open=renter-intake", label: "Renter forms" },
      { text: "Send Lease & Move-in once they're approved.", to: "/forms?open=renter-move-in", label: "Move-in" },
    ],
    playbook: "leasing",
  },
  {
    id: "contract", stage: "closing", title: "We're under contract",
    goal: "Hand off the paperwork and hit every deadline.",
    steps: [
      { text: "Submit a TC / Contract-to-Close Request so Atom opens the file.", to: "/forms?open=tc-request", label: "TC request" },
      { text: "Fill in the Deal / Commission Sheet.", to: "/forms?open=deal-sheet", label: "Deal sheet" },
      { text: "Line up an attorney and inspector from Vendors.", to: "/resources?cat=Attorneys", label: "Attorneys" },
      { text: "Follow Contract to Close for the IL attorney review and inspection timeline.", to: "/playbooks/contract-to-close", label: "Contract to Close" },
    ],
    playbook: "contract-to-close",
  },
  {
    id: "closed", stage: "closing", title: "We just closed",
    goal: "Turn one client into reviews and referrals.",
    steps: [
      { text: "Ask for a Google review the same week. Use the reviews playbook.", to: "/playbooks/reviews-referrals", label: "Reviews" },
      { text: "Send the referral form link so they can pass you names.", to: "/forms?open=referral", label: "Referral form" },
      { text: "Mark the listing Closed in Listings so the seller portal shows it.", to: "/listings", label: "Listings" },
    ],
    playbook: "reviews-referrals",
  },
  {
    id: "business", stage: "closing", title: "It's a business or commercial deal",
    goal: "Use our business-sale edge.",
    steps: [
      { text: "Send Business Owner / Seller or Business Buyer / Investor.", to: "/forms?open=business-seller", label: "Business forms" },
      { text: "Order a commercial CMA or BOV (pick Commercial on the CMA form).", to: "/new", label: "Commercial CMA" },
      { text: "Read the commercial playbook and ask Michael about pricing.", to: "/playbooks/commercial-business", label: "Commercial playbook" },
    ],
    playbook: "commercial-business",
  },
];

// First-week checklist shown at the top of /guide.
export const FIRST_WEEK: Step[] = [
  { text: "Add the Hub to your phone's home screen (Home › Install card).", to: "/home", label: "Install" },
  { text: "Tick off 'Set up your tools' on Home: Lofty, connectMLS, dotloop and the rest.", to: "/home", label: "Set up tools" },
  { text: "Do the Why SpaceMatch tutorial and send your first link.", to: "/why", label: "Why link" },
  { text: "Start the first Academy track, SpaceMatch OS.", to: "/training", label: "Academy" },
  { text: "Set up your SpaceMatch Coach in Muse (2 minutes): our playbooks in your pocket.", to: "/muse", label: "Muse coach" },
  { text: "Look through Vendors so you know who to recommend for lenders, attorneys and inspectors.", to: "/resources", label: "Vendors" },
];

// Landing page groups (ids from TOOLS_GUIDE).
export const FEATURE_GROUPS: { title: string; blurb: string; ids: string[] }[] = [
  { title: "Win the client", blurb: "Show up prepared and look like the best team in the room.", ids: ["why", "cma", "decks", "sellerlists", "mailers"] },
  { title: "Work your leads", blurb: "Every lead, form reply and follow-up in one list.", ids: ["today", "forms", "inbox"] },
  { title: "Launch & market listings", blurb: "A 14-day launch your seller can watch live.", ids: ["portal", "adkit", "broll", "videos"] },
  { title: "Run your business", blurb: "Forms, vendors, playbooks and training in one place.", ids: ["templates", "signature", "vendors", "playbooks", "academy", "muse"] },
  { title: "Team support", blurb: "Help is one tap away.", ids: ["help", "announcements", "feedback"] },
];

export const toolById = (id: string) => TOOLS_GUIDE.find(t => t.id === id)!;
