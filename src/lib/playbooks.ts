// Team playbooks (static). Written 2026-10-17 from the team agreement, Lofty rules, listing deck, CMA and brand guides.
// Edit here, redeploy. Links: `to` = in-app path, `href` = external.
import { ACADEMY_PLAYBOOKS } from "./academyPlaybooks";
import type { Playbook } from "./playbookTypes";

export type { Playbook, PlaybookLink, PlaybookSection } from "./playbookTypes";

const CORE_PLAYBOOKS: Playbook[] = [
  {
    id: "speed-to-lead",
    n: 1,
    title: "Speed-to-Lead",
    who: "Every agent, every new lead",
    minutes: 4,
    summary:
      "Call within 1 hour, real contact within 24 hours, log everything. The lead that hears from us first usually picks us.",
    tags: "lead new lead call text follow up voicemail sla response time",
    sections: [
      {
        h: "The rule (team agreement §7.1)",
        items: [
          "Call every assigned lead within 1 hour of getting it.",
          "Make personal contact (a real call or text, not an automated drip) within 24 hours.",
          "Log every call, text and note in Lofty. If it isn't in Lofty, it didn't happen.",
          "Leads that aren't worked get reassigned. Team clients and data stay with the team.",
        ],
      },
      {
        h: "First hour",
        items: [
          'Call first. No answer → text right away: "Hi {first name}, it\'s {you} with SpaceMatch. I just got your request about {property/area}. Is now a good time for a quick call?"',
          "Texts get far more replies than emails on our team. Email is a backup, not the first touch.",
          "Open the lead in the Hub Inbox and tap Contacted. Leads still marked New after 1 hour alert Michael and Cris.",
        ],
        links: [{ label: "My inbox", to: "/inbox" }],
      },
      {
        h: "Can't reach them",
        items: [
          "Call between 8am and 9pm their time, never outside that window.",
          "Day 1: call + voicemail + text. Day 3: call + voicemail + text. Day 7: call + voicemail + short email.",
          "Vary the time of day (morning, lunch, after 5pm).",
          "After Day 7, set the Lofty stage to Nurture with a reason. Don't delete leads.",
        ],
      },
      {
        h: "When they reply",
        items: [
          "A reply always gets a personal text or call back the same business day, even if Anna (our Lofty AI) already answered.",
          "Move the stage as it changes: Attempting Contact → Connected Qualifying → Appointment Set → Active Client.",
          "Book the next step (consult, CMA, showing) before you hang up.",
        ],
      },
    ],
  },
  {
    id: "open-house",
    n: 2,
    title: "Open House",
    who: "Hosting agent",
    minutes: 5,
    summary:
      "Promote the week before, capture every visitor with the QR sign-in (it goes straight to Lofty under your name), follow up the same day.",
    tags: "open house sign in qr signs flyer visitors follow up lofty",
    sections: [
      {
        h: "7 days before",
        items: [
          "Confirm the date and time with the seller and listing agent (if it isn't your listing).",
          "Send a Marketing request for directional signs, riders and flyers. Cris handles it.",
          "Ask Cris for an Instagram story/post. Add the open house to MLS and Lofty.",
        ],
        links: [
          { label: "Marketing request", to: "/forms?open=marketing-request" },
          {
            label: "Open house flyer + sign-in sheet",
            to: "/templates?sec=marketing",
          },
        ],
      },
      {
        h: "Day of",
        items: [
          "Print the Open House Sign-In QR code (Forms → Open house sign-in → QR), or show it on a tablet at the door.",
          "Every visitor signs in. Sign-ins create a Lofty lead tagged Open House + the address, assigned to you, with their answers as a note.",
          "Open house leads are NOT in Anna's or the company drips. Following up is 100% on you.",
          'Ask two questions: "Are you working with an agent?" and "Do you have a home to sell first?"',
        ],
        links: [
          {
            label: "Open house sign-in (QR)",
            to: "/forms?open=open-house-signin",
          },
        ],
      },
      {
        h: "After",
        items: [
          "Same evening: text every visitor a thank-you plus one useful thing (disclosures, comps, other homes).",
          "Unrepresented buyers → buyer consultation. Visitors with a home to sell → offer a CMA.",
          "Send the seller a short recap: number of groups, feedback themes, any interest.",
        ],
        links: [
          {
            label: "Buyer consultation playbook",
            to: "/playbooks/buyer-consultation",
          },
        ],
      },
    ],
  },
  {
    id: "listing-launch",
    n: 3,
    title: "Listing Launch",
    who: "Listing agent + Cris/Atom",
    minutes: 6,
    summary:
      "The 14-day launch we promise in the listing presentation, in order, with who does what.",
    tags: "listing launch media photos coming soon mls marketing reel day 7 day 14",
    sections: [
      {
        h: "Before media day",
        items: [
          "Signed listing agreement + disclosures in dotloop. The listing admin fee ($595) is disclosed in writing.",
          "Send the seller the Listing Launch Checklist form (media dates, access, showing windows, approvals).",
          "Prep list to the seller: declutter, lights on, blinds open, cars out of the driveway.",
        ],
        links: [
          {
            label: "Listing Launch Checklist form",
            to: "/forms?open=listing-launch",
          },
          {
            label: "Seller property details form",
            to: "/forms?open=seller-property-details",
          },
        ],
      },
      {
        h: "Launch sequence",
        items: [
          "1. Media day: photos, video, 3D tour and floor plan (Giraffe360 or our photographer). Virtual staging by Stagifi if needed.",
          "2. Coming Soon (if the seller agreed). Public marketing means it must hit MLS within 1 business day (Clear Cooperation).",
          "3. Reel + listing copy: Cris drafts, you and the seller approve.",
          "4. Property landing page on the website.",
          "5. MLS live: check every field, photos in order, showing instructions in ShowingTime.",
          "6. Broker broadcast + CRM email to matching buyers.",
          "7. Ads live (social/Google, if in the plan).",
          "8. First-weekend open house.",
          "9. Day 7: seller report (views, saves, showings, feedback).",
          "10. Day 14: price and strategy checkpoint against the competition.",
        ],
        links: [
          {
            label: "Listing prep & media vendors",
            to: "/resources?cat=Listing%20prep%20%26%20media",
          },
          { label: "Marketing request", to: "/forms?open=marketing-request" },
        ],
      },
      {
        h: "Every week after",
        items: [
          "Monday: send the seller the numbers and the feedback, good and bad.",
          "Forward ShowingTime feedback to the seller within 24 hours.",
          "Any price or marketing change gets the seller's written OK first.",
        ],
      },
    ],
  },
  {
    id: "listing-presentation",
    n: 4,
    title: "Listing Presentation Guide",
    who: "Agents going on listing appointments",
    minutes: 6,
    summary:
      "Pre-listing package before, appointment deck during, leave-behind after. Win on the plan, not the price.",
    tags: "listing appointment presentation deck seller pitch cma net sheet objections",
    sections: [
      {
        h: "24–48 hours before",
        items: [
          "Request a CMA in the Hub (address + what you know). It comes back as a branded PDF and workbook.",
          "Email the Pre-Listing Package (who we are, our launch system, reviews). No pricing in it.",
          "Send the seller the Seller Intake form so you walk in knowing their timeline, reason and price expectation.",
        ],
        links: [
          { label: "Request a CMA", to: "/new" },
          { label: "Seller intake form", to: "/forms?open=seller-intake" },
        ],
      },
      {
        h: "At the appointment (about 60 minutes)",
        items: [
          "Start with them: ask why they're moving, their timing, and what worries them about selling. Listen more than you talk.",
          "Walk the home and take notes on upgrades and condition. These change the CMA.",
          "Show the launch system (media day → Coming Soon → MLS → ads → open house → Day-7 report → Day-14 checkpoint).",
          "Pricing: show the comps and the value range, then recommend a list price. Show three net-sheet scenarios.",
          "Fees: walk through the commission and the $595 listing admin fee openly. Only Michael can waive a fee.",
          "Ask for the listing. Have the listing agreement ready in dotloop.",
        ],
      },
      {
        h: "Common objections",
        items: [
          '"Another agent said a higher price." → Show the comps. Overpricing costs time, and every week on market costs leverage.',
          '"Can you cut your commission?" → Explain what the fee pays for (media, staging, ads, reports). Escalate to Michael. Never promise a cut yourself.',
          '"We\'ll wait until spring." → Show current competition and offer Coming Soon prep now.',
        ],
      },
      {
        h: "After",
        items: [
          "Leave the one-page leave-behind. Same-day thank-you text.",
          "Follow up on Day 1, Day 3 and Day 7, and log it all in Lofty.",
          "Signed? Start the Listing Launch playbook.",
        ],
        links: [
          { label: "Listing Launch playbook", to: "/playbooks/listing-launch" },
        ],
      },
    ],
  },
  {
    id: "buyer-consultation",
    n: 5,
    title: "Buyer Consultation + Buyer Rep Agreement",
    who: "Agents working with buyers",
    minutes: 5,
    summary:
      "Meet, qualify, sign the buyer agreement before the first tour, then search, tour, offer and close.",
    tags: "buyer consultation buyer rep agreement representation showing pre approval lender offer",
    sections: [
      {
        h: "Before the consult",
        items: [
          "Send the Buyer Intake form (budget, areas, must-haves, timeline, financing).",
          "Not pre-approved? Connect them with a lender from Vendors → Lenders, by loan type.",
        ],
        links: [
          { label: "Buyer intake form", to: "/forms?open=buyer-intake" },
          { label: "Lenders", to: "/resources?cat=Lenders" },
        ],
      },
      {
        h: "The consult (30–45 minutes)",
        items: [
          "Explain the process: pre-approval → search → tours → offer → attorney review → inspection → appraisal → closing.",
          "Explain how you're paid, and that the seller may or may not offer compensation.",
          "Sign a written buyer agreement before the first tour. It's required since the 2024 NAR settlement. Use the Exclusive Buyer Rep Agreement (Spanish version available). Use the Showing Agreement for a one-off tour.",
          "Disclose the $395 buyer-rep admin fee in writing.",
          "Set them up on Zenlist and in Lofty with their saved search.",
        ],
        links: [{ label: "Buyer templates", to: "/templates?sec=buyer" }],
      },
      {
        h: "Touring and offers",
        items: [
          "After each tour, send the Tour Feedback form. Their answers sharpen the search.",
          "Ready to write: send the Buyer Offer form to collect price, terms, lender and attorney.",
          "Under contract: submit a TC request so Atom opens the file and tracks deadlines.",
        ],
        links: [
          {
            label: "Tour feedback form",
            to: "/forms?open=buyer-tour-feedback",
          },
          { label: "Buyer offer form", to: "/forms?open=buyer-offer" },
          { label: "TC request", to: "/forms?open=tc-request" },
          { label: "Attorneys", to: "/resources?cat=Attorneys" },
          { label: "Inspectors", to: "/resources?cat=Inspectors" },
        ],
      },
    ],
  },
  {
    id: "cma-how-to",
    n: 6,
    title: "CMA How-To",
    who: "Every agent",
    minutes: 3,
    summary:
      "Request a branded CMA from the Hub. It comes back as a PDF and workbook with a value range and suggested list price.",
    tags: "cma comps value pricing lease rent commercial request report",
    sections: [
      {
        h: "Request it",
        items: [
          "Tap CMA → fill in the address, client, property facts, upgrades (what + year), condition and the seller's expectation. The more you fill in, the better the price.",
          "Commercial or business property: switch to Commercial and attach the OM, rent roll, T-12, and any CoStar exports.",
          "Rental pricing: use New lease CMA.",
          "Limit: 2 CMAs per agent per month. More than that goes to Michael for a one-tap approval.",
        ],
        links: [
          { label: "Request a CMA", to: "/new" },
          { label: "Lease CMA", to: "/lease" },
        ],
      },
      {
        h: "Track it",
        items: [
          "My requests shows the status: Queued → Building → Ready (or Needs info, with a note on what's missing).",
          "Ready: download the PDF and the workbook. Read the notes for what to confirm with the seller.",
        ],
        links: [{ label: "My requests", to: "/requests" }],
      },
      {
        h: "Change it",
        items: [
          "Edit details (new upgrade, corrected square footage) → the report updates.",
          "Set list price → the PDF is rebuilt at your price. The app warns you if it's outside the value range.",
          "Always review the CMA yourself before sending it to a client.",
        ],
      },
    ],
  },
  {
    id: "team-agreement",
    n: 7,
    title: "Team Agreement Cheat Sheet",
    who: "Every agent",
    minutes: 3,
    summary:
      "Splits, fees, cap and lead rules on one page. Your signed agreement and Exhibit A always win.",
    tags: "split commission tier cap fees team agreement real broker admin fee",
    sections: [
      {
        h: "Your split (self-generated leads, before / after Real cap)",
        items: [
          "Tier 1 Associate (under $50K GCI, trailing 12 months): 70 / 75",
          "Tier 2 Producer ($50K–$125K): 75 / 85",
          "Tier 3 Senior ($125K–$250K): 80 / 90",
          "Tier 4 Partner ($250K+ or invite): 85 / 90",
          "Team-generated leads are always 50/50 (office line, team@ inquiries, team ads and portals, sign/open-house calls on team listings, routed business/commercial inquiries).",
          "Tiers are reviewed every Jan 1. You can move up mid-year (from your next deal), but only move down at the annual review.",
        ],
      },
      {
        h: "Real Broker",
        items: [
          "Real cap: $4,000 per cap year (your Real anniversary). After you cap, your self-generated split moves to the after-cap column.",
          "Paid by the agent to Real: $249 sign-up, $900 a year, $50 per transaction (CBR), plus post-cap transaction fees.",
          "Your Real stock and revenue share are yours.",
        ],
      },
      {
        h: "SpaceMatch admin fees (disclosed in writing)",
        items: [
          "Listing $595 · Listing with a co-op broker $495 · Buyer rep $395 · Rental $195.",
          "Only Michael can waive a fee. An unapproved waiver comes out of your share.",
        ],
      },
      {
        h: "Leads and leaving",
        items: [
          "Call within 1 hour, personal contact within 24 hours, and log everything in Lofty.",
          "30 days' notice to leave. Pending deals are paid at your current split. Team-generated listings stay with the team.",
          "Questions about your split: ask Michael.",
        ],
        links: [
          { label: "Deal / commission sheet", to: "/forms?open=deal-sheet" },
          { label: "Speed-to-Lead playbook", to: "/playbooks/speed-to-lead" },
        ],
      },
    ],
  },
  {
    id: "lead-routing",
    n: 8,
    title: "Lead Routing & Pond Rules",
    who: "Every agent",
    minutes: 3,
    summary:
      "Where leads come from, who gets them, and when they go back to the pond.",
    tags: "lead routing pond round robin assignment north shore korean spanish anna reassign",
    sections: [
      {
        h: "How leads are assigned",
        items: [
          "Company leads (website, Zillow, Realtor.com, paid ads, YouTube) come in through Lofty and are assigned to an agent. Anna (our Lofty AI) texts them automatically, but you still follow up personally.",
          "North Shore leads rotate Brendan → Susan → Matthew. Spanish-speaking leads go to Matthew.",
          "Korean-speaking leads go to Sein Shin.",
          "Your own open-house sign-ins, referrals and sphere are yours, and stay out of Anna and the company drips.",
        ],
      },
      {
        h: "Keeping a lead",
        items: [
          "Meet speed-to-lead: call within 1 hour, personal contact within 24 hours.",
          "Answer every reply with a personal text or call.",
          "Keep active leads current. Log something at least every 14 days and keep the stage up to date.",
        ],
        links: [
          { label: "Speed-to-Lead playbook", to: "/playbooks/speed-to-lead" },
        ],
      },
      {
        h: "The pond",
        items: [
          "Leads that aren't worked are moved to the team pond and reassigned. Michael reviews the pond and assigns good leads to agents who are following up.",
          "Want more leads? The fastest way is a strong response record in Lofty.",
          "Handing a lead to a teammate? Use the Lead hand-off form so it's tracked.",
        ],
        links: [
          { label: "Lead hand-off form", to: "/forms?open=lead-handoff" },
        ],
      },
    ],
  },
  {
    id: "brand-compliance",
    n: 9,
    title: "Brand & Compliance Guide",
    who: "Anyone making marketing",
    minutes: 3,
    summary: "How SpaceMatch looks and sounds, and what every ad must include.",
    tags: "brand logo colors fonts compliance advertising real broker fair housing marketing",
    sections: [
      {
        h: "Every ad and post",
        items: [
          'Show "SpaceMatch Inc. · a team of Real Broker, LLC" on everything. No Coldwell Banker marks anywhere.',
          "Office: 2822 Central St., Evanston, IL 60201 · Team line (773) 985-7153 · spacematchinc.com.",
          'Fair housing: describe the property, not the people. No "perfect for families", "walking distance to church" or similar.',
          "Only use stats and claims Michael has approved. If you're not sure, ask before you post.",
        ],
      },
      {
        h: "Look",
        items: [
          "Colors: black #0A0A0A, white, paper #F7F5F1. Accents: bronze #9C7434 and gold #D9BC8C, never for large blocks of text.",
          "Fonts: Playfair Display for headlines, Mada for everything else.",
          "Use the SpaceMatch-only logo (without the old Coldwell Banker lockup). Cris has the files and Canva templates.",
        ],
        links: [
          {
            label: "Marketing request (Cris)",
            to: "/forms?open=marketing-request",
          },
        ],
      },
      {
        h: "Voice",
        items: [
          'Confident, calm, plain-spoken. We\'re "a marketing company designed to sell real estate."',
          'Skip clichés: dream home, cozy, won\'t last long, "hope you are doing well". Skip exclamation-mark hype.',
          "Be specific: real numbers, real dates, real features.",
        ],
      },
    ],
  },
  {
    id: "commercial-business",
    n: 10,
    title: "Commercial / Business-Sale Playbook",
    who: "Agents on commercial, multi-unit or business deals",
    minutes: 6,
    summary:
      "Confidential marketing, NDA before financials, tax returns as the truth, and Michael in the loop early.",
    tags: "commercial business sale laundromat nda teaser loi sba crexi costar multi unit investor",
    sections: [
      {
        h: "Taking the listing",
        items: [
          "Tell Michael early. Business and commercial deals are routed by the team and priced with him.",
          "Send the Business Seller form, and use the Business Sale Listing Agreement from Templates.",
          "Collect 3 years of filed tax returns, YTD P&L, the lease, and the equipment list. Buyers' lenders underwrite the tax returns, not the seller's P&L.",
          "Request a commercial CMA and attach the documents (OM, rent roll, T-12, CoStar exports).",
        ],
        links: [
          { label: "Business seller form", to: "/forms?open=business-seller" },
          { label: "Commercial CMA", to: "/new" },
          { label: "Business-sale templates", to: "/templates?sec=business" },
        ],
      },
      {
        h: "Marketing it confidentially",
        items: [
          "Blind teaser only: no business name, no street address. Show the city and state only.",
          "Financials only after a signed NDA. Log every NDA and buyer in the deal folder.",
          "Commercial and 5+ unit buildings: Viktor pulls MRED and Crexi comps automatically on every request. CoStar data comes from exports only.",
          "The team emails the right buyer list: business buyers, investors, or buyers matched by area.",
        ],
      },
      {
        h: "Buyers and financing",
        items: [
          "Qualify buyers with the Business Buyer form (cash available, experience, financing).",
          "SBA buyers: connect them with an SBA lender from Vendors → Lenders.",
          "Use the LOI template, then the Asset Purchase Agreement drafted by an attorney. Laundromats: use the Laundromat Due Diligence Checklist.",
          "Check the lease early: assignment consent, term long enough for a 10-year loan, and the options.",
        ],
        links: [
          { label: "Business buyer form", to: "/forms?open=business-buyer" },
          { label: "Lenders", to: "/resources?cat=Lenders" },
          { label: "Attorneys", to: "/resources?cat=Attorneys" },
        ],
      },
    ],
  },
  {
    id: "lofty-daily",
    n: 11,
    title: "Your Daily Lofty Routine (30 minutes)",
    who: "Every agent, every working day",
    minutes: 4,
    summary:
      "Same 30 minutes every morning: new leads, tasks due, hot leads, then one batch of follow-ups. Consistency beats bursts.",
    tags: "lofty crm daily routine tasks smart plan pond follow up morning",
    sections: [
      {
        h: "Every morning, in this order",
        items: [
          "New leads first (5 min): anyone assigned overnight gets a call now, text if no answer. Mark Contacted in the Hub Inbox.",
          "Tasks due today (10 min): clear every Lofty task. Can't do it today? Reschedule with a reason; never let tasks pile up overdue.",
          "Hot leads (5 min): check 'Recently active' / high-score leads who viewed homes or opened emails. A lead viewing listings at 11pm is telling you something. Text them.",
          "One follow-up batch (10 min): pick one group (e.g. buyers in Nurture, past clients this month) and send personal texts using the Scripts & emails tab.",
        ],
        links: [
          { label: "Scripts & emails", to: "/templates?tab=scripts" },
          { label: "My inbox", to: "/inbox" },
        ],
      },
      {
        h: "Keep Lofty clean",
        items: [
          "Every lead has a stage, a next task, and a note from your last real conversation.",
          "Use Smart Plans for drips, but never as the only touch. A reply always gets a human answer the same day.",
          "Tag the source and timeframe (0–3, 3–6, 6–12 months). Michael's scorecards read these tags.",
          "Don't delete leads. Move dead ones to Nurture or Archive with a reason.",
        ],
      },
      {
        h: "Weekly (Friday, 15 min)",
        items: [
          "Review your pipeline: who could sign or write an offer in the next 30 days?",
          "Ask 2 past clients or friends for an intro (script: Past client check-in).",
          "Update the Hub listing page for each active listing so sellers see fresh numbers.",
        ],
      },
    ],
  },
  {
    id: "seller-prospecting",
    n: 12,
    title: "Seller Prospecting: Expireds, FSBOs & Quiet Leads",
    who: "Agents building a listing pipeline",
    minutes: 5,
    summary:
      "Listings come from follow-up. Call expireds the day they expire, help FSBOs before you pitch, and wake up quiet home-value leads with real numbers.",
    tags: "expired fsbo prospecting seller leads home value unresponsive cold call listing appointment",
    sections: [
      {
        h: "Expired listings",
        items: [
          "Pull expireds from connectMLS every morning. Call the same day; most sellers relist within weeks.",
          "Check the Do Not Call list before cold calling, and respect 'don't call me' right away.",
          "Lead with a diagnosis, not a pitch: price vs. sold comps, photos, days on market, showing access.",
          "Goal of the call: a 15-minute walk-through, not a signed listing.",
        ],
        links: [
          { label: "connectMLS", href: "https://connectmls.mredllc.com" },
          { label: "Expired script", to: "/templates?tab=scripts" },
        ],
      },
      {
        h: "FSBOs",
        items: [
          "Be useful first: offer a free CMA, a disclosure packet checklist, or to bring a buyer.",
          "Ask if they offer buyer-agent compensation. If yes, you may have a buyer; if no, you have a reason to follow up.",
          "Follow up every 7 days for 6 weeks. Most FSBOs list with an agent within 2 months.",
        ],
      },
      {
        h: "Quiet home-value leads",
        items: [
          "These people asked what their home is worth. Answer with a real number range and 3 sold comps.",
          "Use the Hub CMA request for a branded report, and send it with a short personal note.",
          "Re-engage every 30–45 days with something new: a nearby sale, rate change, or seasonal timing.",
        ],
        links: [{ label: "Request a CMA", to: "/new" }],
      },
    ],
  },
  {
    id: "objections",
    n: 13,
    title: "Handling Common Objections",
    who: "Every agent, listing and buyer appointments",
    minutes: 5,
    summary:
      "Acknowledge, ask a question, answer with facts. Never argue; get to the real concern.",
    tags: "objection commission fee price wait interview other agents discount negotiate script",
    sections: [
      {
        h: "The method",
        items: [
          'Acknowledge: "That makes sense." Ask: "Can I ask what\'s behind that?" Answer with numbers. Confirm: "Does that help?"',
          "Role-play these with Brandon before your first appointments.",
        ],
        links: [{ label: "Request coaching", to: "/help" }],
      },
      {
        h: "Sellers",
        items: [
          '"Your fee is too high." → "What matters most is what you net. Here\'s our marketing plan and our list-to-sale numbers. If a lower fee nets you less, it isn\'t cheaper." Show the Seller Guide.',
          '"Another agent said a higher price." → "I\'d love to be wrong. Here are the 3 closest sales. Buyers and appraisers will use these too. Let\'s price to get showings in the first 2 weeks."',
          '"We\'ll wait until spring." → "Fewer homes compete in winter, and serious buyers are still out. Let\'s prepare now so you can launch the moment you\'re ready."',
          '"We\'re interviewing other agents." → "Great, you should. Here\'s what to ask every agent: marketing plan, days on market, and who actually answers the phone."',
        ],
      },
      {
        h: "Buyers",
        items: [
          '"Why sign a buyer agreement?" → Illinois requires a written agreement before we work together. It spells out what I do and how I\'m paid, and you can see exactly what you agree to.',
          "\"We'll wait for rates to drop.\" → Compare today's payment vs. a lower rate with higher prices and more competition; refinancing later is an option, buying back time isn't.",
          '"We want to see more homes first." → Agree, then tighten criteria with the Buyer Consultation Questionnaire so every showing counts.',
        ],
        links: [
          {
            label: "Buyer Consultation Questionnaire",
            to: "/templates?q=Buyer%20Consultation",
          },
        ],
      },
    ],
  },
  {
    id: "pricing",
    n: 14,
    title: "Pricing & Price-Adjustment Conversations",
    who: "Listing agents",
    minutes: 4,
    summary:
      "Price from closed sales, launch in the right search band, and review at day 14, 21 and 30 with data, not opinions.",
    tags: "price pricing reduction adjustment cma comps search band days on market overpriced",
    sections: [
      {
        h: "Setting the price",
        items: [
          "Use closed sales from the last 3–6 months, closest first; actives are competition, not value.",
          "Think in search bands ($25K / $50K steps). $505K misses everyone searching up to $500K.",
          "Write down the reason for the price and the plan if showings are low. Share it with the seller up front.",
        ],
        links: [{ label: "CMA how-to", to: "/playbooks/cma-how-to" }],
      },
      {
        h: "When to review",
        items: [
          "Day 14: fewer than ~8 showings or no second showings → talk about price or presentation.",
          "Day 21–30: showings but no offers → the market is telling us the price; recommend an adjustment.",
          "Use the weekly seller update so the conversation is never a surprise.",
        ],
        links: [
          { label: "Price adjustment email", to: "/templates?tab=scripts" },
        ],
      },
      {
        h: "In the conversation",
        items: [
          "Lead with buyer feedback and new sales, then the recommendation and the date.",
          "One meaningful adjustment beats three small ones.",
          "Get the change signed (Listing Agreement Modification Form) and update MLS, Lofty and the Hub the same day.",
        ],
      },
    ],
  },
  {
    id: "offers-illinois",
    n: 15,
    title: "Writing & Negotiating Offers in Illinois",
    who: "Buyer's agents (and listing agents reviewing offers)",
    minutes: 6,
    summary:
      "Know the contract form, collect everything first with the Offer Prep Worksheet, and present offers the seller can say yes to.",
    tags: "offer contract multi-board car purchase contract attorney review inspection earnest money appraisal negotiate counter",
    sections: [
      {
        h: "Before you write",
        items: [
          "Fill out the Offer Prep Worksheet with the buyer and confirm every term.",
          "Call the listing agent: how many offers, deadline, what matters to the seller (price, date, possession, certainty).",
          "Pick the right form: Chicago REALTORS residential, condo or multi-unit contract, or Multi-Board 8.0 where it's used.",
          "Attach the pre-approval (matching this price) and proof of funds.",
        ],
        links: [
          { label: "Offer Prep Worksheet", to: "/templates?q=Offer%20Prep" },
          { label: "Purchase contracts", to: "/templates?sec=offers" },
        ],
      },
      {
        h: "Key terms in Illinois",
        items: [
          "Attorney review: usually 5 business days after acceptance. Either side's attorney can propose changes.",
          "Inspection: usually 5 business days. Requests go through the attorneys.",
          "Mortgage contingency and appraisal: write real dates the lender can meet.",
          "Earnest money: amount, holder and due dates exactly as written. Wire instructions are confirmed by phone only.",
        ],
      },
      {
        h: "Multiple offers (listing side)",
        items: [
          "Compare offers on the Multiple Offer Comparison sheet: net to seller, financing strength, contingencies, timing.",
          "Treat every buyer's agent the same; give the same information to all.",
          "Ask for highest and best with one clear deadline.",
        ],
        links: [
          {
            label: "Multiple Offer Comparison",
            to: "/templates?q=Multiple%20Offer",
          },
        ],
      },
    ],
  },
  {
    id: "contract-to-close",
    n: 16,
    title: "Contract to Close",
    who: "Every agent with a deal under contract",
    minutes: 5,
    summary:
      "Put every deadline on your calendar the day the contract is accepted, update the client weekly, and get every document into ReZEN.",
    tags: "under contract closing timeline rezen compliance attorney review inspection appraisal mortgage commitment walk-through",
    sections: [
      {
        h: "Day of acceptance",
        items: [
          "Send the fully signed contract to both attorneys, the lender and the title company.",
          "Open the Contract-to-Close Checklist and write every contract date on it and your calendar.",
          "Upload the contract to ReZEN (Real's transaction system) and the dotloop loop.",
          "Send the client the Under Contract next-steps message.",
        ],
        links: [
          {
            label: "Contract-to-Close Checklist",
            to: "/templates?q=Contract-to-Close",
          },
          { label: "Under contract script", to: "/templates?tab=scripts" },
        ],
      },
      {
        h: "Every week until closing",
        items: [
          "Confirm status with the lender and the attorney; never let a deadline pass without written extension.",
          'Update your client even when nothing changed: "No news is on track."',
          "Schedule the final walk-through 24–48 hours before closing.",
        ],
      },
      {
        h: "Closing & after",
        items: [
          "All signed documents are in ReZEN before closing so commission can be released.",
          "Send the thank-you + review request, and set a 90-day past-client task in Lofty.",
          "Listing side: update MLS to Closed, take down the sign and lockbox, update the Hub listing.",
        ],
      },
    ],
  },
  {
    id: "leasing",
    n: 17,
    title: "Leasing: Landlords & Tenants",
    who: "Agents doing rentals",
    minutes: 6,
    summary:
      "Written screening criteria, the right lease for the location, and every required disclosure. Rentals are fast; mistakes are expensive.",
    tags: "lease rental landlord tenant application screening rlto security deposit chicago cook county evanston",
    sections: [
      {
        h: "Landlord listing",
        items: [
          "Complete the Rental Listing Intake, including written screening criteria the landlord will apply to every applicant.",
          "Sign the exclusive right to lease agreement (Real Broker form in dotloop) before marketing.",
          "Price from leased comps in the last 6 months; request a Lease CMA in the Hub.",
        ],
        links: [
          { label: "Lease CMA", to: "/lease" },
          {
            label: "Rental Listing Intake",
            to: "/templates?q=Rental%20Listing%20Intake",
          },
        ],
      },
      {
        h: "Right lease, right disclosures",
        items: [
          "City of Chicago → Chicago Residential Lease (RLTO). Suburban Cook County → Cook County lease (RTLO). Evanston → Evanston Model Lease. Elsewhere → Residential Lease.",
          "Pre-1978 buildings: lead-based paint disclosure + EPA pamphlet. Also radon and flood disclosures.",
          "Chicago: RLTO summary, heating cost disclosure and bed bug brochure with the lease.",
          "Security deposits follow strict rules (receipt, interest, return deadlines). Landlords should follow their attorney's guidance.",
        ],
        links: [{ label: "Leasing templates", to: "/templates?sec=leasing" }],
      },
      {
        h: "Fair, consistent screening",
        items: [
          "Chicago and Cook County protect source of income, including housing vouchers. Count all lawful income.",
          "Cook County: criminal history is reviewed only after the applicant passes the other criteria, with an individualized assessment.",
          "Same criteria, same order, every applicant. Keep notes on why each application was approved or declined.",
          "Do a Move-In Condition Checklist with photos on day one.",
        ],
        links: [
          { label: "Move-In / Move-Out Checklist", to: "/templates?q=Move-In" },
        ],
      },
    ],
  },
  {
    id: "business-valuation",
    n: 18,
    title: "Business Valuation Basics: SDE, Add-Backs & SBA",
    who: "Agents working business sales (laundromats, cafés, service businesses)",
    minutes: 6,
    summary:
      "Small businesses sell on Seller's Discretionary Earnings proven by tax returns, and most buyers need an SBA loan, so the deal must pass a lender's math.",
    tags: "sde add backs valuation multiple sba 7a dscr laundromat business sale tax returns lender",
    sections: [
      {
        h: "SDE in plain English",
        items: [
          "SDE = net profit on the tax return + owner's salary + owner perks + interest + depreciation/amortization + true one-time expenses.",
          "Every add-back needs proof (tax return line, statement or receipt). Cash income that isn't reported doesn't count.",
          "Price = SDE × a multiple. Main-street businesses often trade around 2–3× SDE; laundromats are also judged on equipment age, lease and utility history.",
        ],
        links: [
          {
            label: "Business Seller Document Request List",
            to: "/templates?q=Document%20Request",
          },
        ],
      },
      {
        h: "Will a lender finance it?",
        items: [
          "Most buyers use SBA 7(a): typically ~10% down, 10-year term for business assets.",
          "Lenders want debt service coverage around 1.25× or better after a fair salary for the new owner.",
          "The lease must run long enough for the loan (with options) and allow assignment.",
          "Ask Michael to run the add-back and loan-capacity check before you set the asking price.",
        ],
        links: [{ label: "Ask Michael", to: "/help" }],
      },
      {
        h: "Deal flow",
        items: [
          "NDA → Buyer Profile & Proof of Funds → teaser and financials → tour → LOI → due diligence → Asset Purchase Agreement (attorney drafted) → closing.",
          "Never share the business name or financials before a signed NDA.",
        ],
        links: [{ label: "Business templates", to: "/templates?sec=business" }],
      },
    ],
  },
  {
    id: "social-video",
    n: 19,
    title: "Instagram & Video for Agents",
    who: "Every agent",
    minutes: 4,
    summary:
      "Post listings and local knowledge consistently, follow the brand, and turn every comment and DM into a Lofty lead.",
    tags: "instagram reels video social media marketing content heygen youtube brand post",
    sections: [
      {
        h: "What to post (3× a week)",
        items: [
          "Listings: Coming Soon, Just Listed, Open House, Just Sold (flyers in Templates, Reels from Giraffe360 video).",
          "Local knowledge: one block, one restaurant, one market stat. Specific beats generic.",
          'You: a 30-second Reel on a question clients actually ask ("How much do I need to buy a condo in Logan Square?").',
        ],
        links: [
          { label: "Marketing templates", to: "/templates?sec=marketing" },
        ],
      },
      {
        h: "Rules",
        items: [
          "Every ad and post includes the brokerage name: SpaceMatch Inc. · a team of Real Broker, LLC.",
          "Get the seller's OK before posting their home; never show people or personal items without consent.",
          'No fair-housing red flags: describe the home, not who should live there (no "perfect for families", "ideal for young professionals").',
          "Tag @spacematchchicago so the team account can reshare.",
        ],
        links: [
          { label: "Brand & compliance", to: "/playbooks/brand-compliance" },
        ],
      },
      {
        h: "Turn attention into leads",
        items: [
          "Reply to every comment and DM within a few hours; move real conversations to text.",
          "Add anyone who asks about buying or selling to Lofty with source = Instagram.",
        ],
      },
    ],
  },
  {
    id: "fair-housing",
    n: 20,
    title: "Fair Housing, Advertising & Wire Fraud",
    who: "Every agent (required reading)",
    minutes: 5,
    summary:
      "Treat everyone the same, advertise the property not the people, include the brokerage name, and never let a client wire money on an emailed instruction.",
    tags: "fair housing compliance advertising license law wire fraud protected class steering discrimination",
    sections: [
      {
        h: "Fair housing",
        items: [
          "Federal law protects race, color, religion, national origin, sex, disability and familial status. Illinois, Chicago and Cook County add more, including source of income, age, marital status, sexual orientation, gender identity, military status and others.",
          'Don\'t steer: never answer "Is this a good neighborhood?" or "Who lives here?" with your opinion about people or schools. Share public data sources instead.',
          "Same service, same information, same criteria for every client and applicant.",
        ],
        links: [
          {
            label: "IL Fair Housing brochure",
            to: "/templates?q=Fair%20Housing",
          },
        ],
      },
      {
        h: "Advertising (Illinois license law)",
        items: [
          "Every ad shows the sponsoring brokerage: Real Broker, LLC (with SpaceMatch Inc.).",
          "Don't advertise another agent's listing without permission, and keep MLS data accurate.",
          'Describe features ("3 bedrooms, fenced yard"), never the ideal buyer.',
        ],
      },
      {
        h: "Wire fraud",
        items: [
          "Give every buyer and seller the Wire Fraud Warning at contract.",
          "We never send wiring instructions. Clients confirm by calling the title company at a number they look up themselves.",
          "If a client thinks they wired to the wrong place: call their bank immediately for a recall, then call Michael.",
        ],
        links: [
          { label: "Wire Fraud Warning", to: "/templates?q=Wire%20Fraud" },
        ],
      },
    ],
  },
];

export const PLAYBOOKS: Playbook[] = [...CORE_PLAYBOOKS, ...ACADEMY_PLAYBOOKS];
