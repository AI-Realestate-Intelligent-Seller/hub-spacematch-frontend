// SpaceMatch Academy playbooks (2026-10-19). Systems-first modules that sit alongside playbooks 1–20.
// Built from SpaceMatch's own tools (Hub, Lofty + Anna, CMA engine, Giraffe360/Stagifi, HeyGen/YouTube, business brokerage).
import type { Playbook } from "./playbookTypes";

export const ACADEMY_PLAYBOOKS: Playbook[] = [
  {
    id: "spacematch-os",
    n: 21,
    title: "SpaceMatch OS: How Our Machine Works",
    who: "Every agent, day one",
    minutes: 5,
    summary:
      "One map of how a lead becomes a closing here: Lofty + Anna catch it, the Hub runs it, the support team carries the paperwork. Know it and you'll never wonder where something goes.",
    tags: "system hub lofty anna support cris atom cma inbox forms how it works overview",
    sections: [
      {
        h: "The flow",
        items: [
          "Capture: website, portals, ads, YouTube, open-house QR and referrals all land in Lofty. Anna (our Lofty AI) texts company leads within minutes.",
          "Convert: you call within 1 hour, set the appointment, and book the next step before you hang up.",
          "Prove value: request a CMA in the Hub. It comes back as a branded report you can send the same day.",
          "Win: branded listing deck or buyer guide from Decks & guides, already in your name. No editing.",
          "Execute: Listing launch form → media day → Coming Soon → MLS → ads → reports. Buyers: intake → tours → offer form → TC request.",
          "Keep: closing → review request → past-client plan in Lofty. Past clients and their referrals are the cheapest leads you'll ever get.",
        ],
      },
      {
        h: "Who does what",
        items: [
          "You: conversations, appointments, negotiation, client experience. That's where your hours go.",
          "Cris: marketing (flyers, signs, Reels, listing copy). Ask with the Marketing request form.",
          "Atom: transactions (file opening, deadlines, compliance). Ask with a TC request.",
          "Michael: pricing calls, fee waivers, business and commercial deals, anything unusual.",
          "Every person in Your support team (on Home) has a Request help button. Use it instead of a text, so the ask is logged and nothing gets lost.",
        ],
        links: [
          { label: "Your support team", to: "/home#team" },
          { label: "All forms", to: "/forms" },
        ],
      },
      {
        h: "Three habits that make the system work",
        items: [
          "If it isn't in Lofty, it didn't happen. Log every call, text and note.",
          "Use the form, not a DM. Forms create a record, notify the right person and feed your Today screen.",
          "Open the Hub every morning. Today shows your leads, tasks and CMAs in one place.",
        ],
        links: [{ label: "Open Today", to: "/home" }],
      },
    ],
  },
  {
    id: "weekly-scorecard",
    n: 22,
    title: "The Weekly Scorecard: Lead Measures Beat Wishes",
    who: "Every agent, every Friday",
    minutes: 5,
    summary:
      "Closings are a result you can't control week to week. Conversations and appointments are inputs you can. Track the inputs, and the closings take care of themselves.",
    tags: "kpi scorecard conversations appointments metrics accountability weekly review time block power hour",
    sections: [
      {
        h: "Track these 5 numbers every week",
        items: [
          "Conversations: real two-way talks about real estate (calls, texts back and forth, in person). Target: 25 a week (5 a day).",
          "Appointments set: listing consults, buyer consults, CMA walk-throughs.",
          "Appointments held: set vs. held shows how well you confirm.",
          "Agreements signed: listing agreements + buyer rep agreements.",
          "Under contract / closed: the lagging result.",
        ],
      },
      {
        h: "Protect the hours that produce them",
        items: [
          "Block 9:00–11:00 every weekday for lead work only: new leads, follow-ups, prospecting. Phone on Do Not Disturb for everything else.",
          "Start with the hardest call. The rest of the block gets easier.",
          "Admin, paperwork and marketing go after lunch, or to Cris and Atom through the forms.",
        ],
      },
      {
        h: "Read your funnel",
        items: [
          "Lots of conversations, few appointments → work on the ask. Practice the objection drills.",
          "Appointments set but not held → confirm the day before and send something useful (the guide, the CMA).",
          "Appointments held, few agreements → sharpen the listing or buyer presentation.",
          "Fix one stage at a time. Review your numbers with Brandon or Michael monthly.",
        ],
        links: [
          { label: "Objection scripts", to: "/playbooks/objections" },
          { label: "Plan your year", to: "/playbooks/gci-plan" },
        ],
      },
    ],
  },
  {
    id: "gci-plan",
    n: 23,
    title: "Your Business Plan in Numbers",
    who: "Every agent, at onboarding and every January",
    minutes: 5,
    summary:
      "Work backward from the income you want to the conversations you need this week. Ten minutes of math replaces a year of guessing.",
    tags: "business plan goal gci income math reverse engineer split cap budget",
    sections: [
      {
        h: "Work backward (example)",
        items: [
          "Goal: $100,000 take-home from real estate this year.",
          "Your split: a Tier 2 agent keeps 75% before the Real cap (see the Team Agreement cheat sheet). So you need about $133,000 in GCI, plus your fees.",
          "Average commission: if your average deal pays $10,000 GCI, you need about 14 closings.",
          "Ratios (typical starting point, then use your own): 1 in 3 appointments signs, 1 in 4 signed clients closes in the year → about 168 appointments, or 3–4 a week.",
          "Appointments come from conversations. At 1 appointment per 7 conversations you need about 25 conversations a week. That's your daily 5.",
        ],
      },
      {
        h: "Know your costs",
        items: [
          "SpaceMatch admin fees per deal: listing $595, listing with a co-op broker $495, buyer rep $395, rental $195.",
          "Real Broker: $4,000 cap per cap year, $249 sign-up, $900 a year, $50 per transaction, plus post-cap transaction fees.",
          "Your own costs: MLS and association dues, license renewal, E&O, your phone, your car, marketing you pay for yourself.",
          "Set aside 25–30% of every check for taxes. You're paid as a 1099 contractor.",
        ],
      },
      {
        h: "Make it real",
        items: [
          "Write your numbers in the Growth Playbook and share them with Brandon or Michael.",
          "Team leads (50/50) close faster but pay less. Your sphere and your own marketing grow your split. Build both.",
          "Hitting a higher tier counts from your next deal. Tiers are reviewed every January 1.",
        ],
        links: [
          { label: "90-day Growth Playbook", to: "/growth" },
          {
            label: "Team Agreement cheat sheet",
            to: "/playbooks/team-agreement",
          },
        ],
      },
    ],
  },
  {
    id: "sphere-system",
    n: 24,
    title: "The Sphere System: A Database That Pays You Every Year",
    who: "Every agent",
    minutes: 5,
    summary:
      "Your best leads are people who already know you. Sort them, give each group a rhythm, and lead with something useful every time, never a 'just checking in'.",
    tags: "sphere database past clients referrals soi nurture value home value report touch plan",
    sections: [
      {
        h: "Build it this week",
        items: [
          "Load everyone you know into Lofty (phone contacts, social, past clients) with source = Sphere. These leads are yours and stay out of Anna and the company drips.",
          "Tag each person A, B or C. A = would refer you today. B = likes you, not top of mind. C = knows your name.",
          "Goal: 150+ real people in your first 90 days.",
        ],
      },
      {
        h: "The rhythm",
        items: [
          "A: a personal call or coffee every month, and a handwritten note on their home anniversary.",
          "B: a personal text every quarter with something specific (a nearby sale, a contractor rec, an event).",
          "C: a monthly market email or video from Lofty, plus your social posts.",
          "Everyone, every year: their home's value. Send a CMA or the home value report (teamspacematch.com/home-value-report) on their purchase anniversary.",
        ],
        links: [{ label: "Request a CMA", to: "/new" }],
      },
      {
        h: "Ask for referrals the right way",
        items: [
          'Ask specifically: "Who do you know who\'s talked about moving in the next year?" beats "Keep me in mind."',
          "Ask at the high points: offer accepted, closing day, the first review.",
          "Thank every referral within 24 hours, whether it closes or not. Log it with the Referral form.",
        ],
        links: [
          { label: "Referral form", to: "/forms?open=referral" },
          { label: "Script library", to: "/templates?tab=scripts" },
        ],
      },
    ],
  },
  {
    id: "reviews-referrals",
    n: 25,
    title: "Reviews: The Engine Behind Every Search",
    who: "Every agent, every closing",
    minutes: 3,
    summary:
      "Clients check reviews before they call anyone. Every closing gets a review request, and every review is reused everywhere.",
    tags: "reviews google zillow testimonial referral closing gift reputation local seo",
    sections: [
      {
        h: "Ask every time",
        items: [
          "Ask at the emotional peak: the day you hand over keys or the seller gets the wire. Text the Google review link while you're still together.",
          'Make it easy: "Would you mind sharing two sentences about what it was like working with me? Here\'s the link."',
          "Follow up once after 3 days. Never offer anything in exchange for a review.",
        ],
      },
      {
        h: "Where reviews go",
        items: [
          "Google (SpaceMatch Inc. business profile) first. It powers local search and Maps.",
          "Then Zillow and your Real Broker profile if the client is willing.",
          "Send Cris the best quote for a graphic and the listing deck's reviews page.",
        ],
        links: [
          { label: "Marketing request", to: "/forms?open=marketing-request" },
        ],
      },
      {
        h: "After the review",
        items: [
          "Set a 90-day past-client task in Lofty, then move them into your A list.",
          "Reply to every public review within a day, with a thank-you and no private details.",
        ],
      },
    ],
  },
  {
    id: "cma-first",
    n: 26,
    title: "The CMA-First Seller Appointment",
    who: "Every agent working seller leads",
    minutes: 4,
    summary:
      "Sellers decide who's serious by who shows up prepared. Our CMA engine lets you walk in with a branded report on their home before the first meeting.",
    tags: "seller lead appointment cma value home value pre-listing conversion",
    sections: [
      {
        h: "From lead to appointment",
        items: [
          'The hook: "I\'ll put together a full value report on your home. It takes about 20 minutes to walk you through. Does Tuesday or Wednesday work better?"',
          "Ask the 4 questions before you hang up: why move, by when, where to next, and what they think it's worth.",
          "Send the Seller Intake form so their upgrades and condition are in the CMA.",
        ],
        links: [
          { label: "Seller intake form", to: "/forms?open=seller-intake" },
        ],
      },
      {
        h: "Build the report",
        items: [
          "Request the CMA in the Hub with every upgrade (what + year) and the condition. Better inputs, better price.",
          "Read the notes on what to confirm, and set the list price you'd defend. The PDF rebuilds at your price.",
          "Send the Pre-Listing Package the day before. No pricing in it; the price is for the meeting.",
        ],
        links: [
          { label: "Request a CMA", to: "/new" },
          { label: "Listing deck", to: "/presentations" },
        ],
      },
      {
        h: "In the meeting",
        items: [
          "Walk the comps together. Let them pick the most similar sale; people trust a number they helped find.",
          "Show three net-sheet scenarios, then recommend one price and explain the search band.",
          "Ask for the listing with the agreement ready in dotloop. Not today? Book the next date before you leave.",
        ],
      },
    ],
  },
  {
    id: "before-market",
    n: 27,
    title: "Before-Market Launch: Make Every Listing an Event",
    who: "Listing agents",
    minutes: 4,
    summary:
      "The first 10 days on market decide the price. We build demand before day one with professional media, Coming Soon done legally, and a buyer list ready to go.",
    tags: "coming soon pre market giraffe360 stagifi virtual staging media clear cooperation launch",
    sections: [
      {
        h: "Two weeks out",
        items: [
          "Signed listing agreement and disclosures in dotloop. Send the Listing launch form.",
          "Book media day: Giraffe360 photos, 3D tour and floor plan. Empty or dated rooms → virtual staging by Stagifi.",
          "Prep visit with the seller: declutter, repairs worth doing, lights and blinds.",
        ],
        links: [
          { label: "Listing launch form", to: "/forms?open=listing-launch" },
        ],
      },
      {
        h: "Coming Soon, the legal way",
        items: [
          "Clear Cooperation: once you market it publicly (sign, social, email blast), it must be on MLS within 1 business day.",
          "Use MLS Coming Soon status if the seller agrees, and get their OK in writing.",
          "Tease it to your buyer list and the team first, so day one opens with showings booked.",
        ],
      },
      {
        h: "Day one and after",
        items: [
          "Reel and listing copy from Cris, the property page on the website, broker broadcast, and ads if they're in the plan.",
          "First-weekend open house. Every visitor signs in with the QR form.",
          "The seller sees views, saves, showings and ad results on their Hub listing page. Report on Day 7 and review strategy on Day 14.",
        ],
        links: [
          { label: "My listings", to: "/listings" },
          { label: "Listing Launch playbook", to: "/playbooks/listing-launch" },
        ],
      },
    ],
  },
  {
    id: "commission-talk",
    n: 28,
    title: "Explaining Your Value After the NAR Settlement",
    who: "Every agent, buyer and seller side",
    minutes: 4,
    summary:
      "Compensation is negotiable and has to be in writing before you tour. Agents who explain their value clearly win; agents who get awkward about it lose.",
    tags: "commission compensation buyer agreement nar settlement value proposition fee negotiation",
    sections: [
      {
        h: "What changed (Aug 2024)",
        items: [
          "Buyers sign a written agreement before the first tour, with your compensation spelled out.",
          "Offers of buyer-agent compensation can't be posted on MLS. They're negotiated in the deal.",
          "Commissions were always negotiable. Now every client knows it, so say it first.",
        ],
      },
      {
        h: "Buyer side",
        items: [
          "\"My fee is in this agreement. Many sellers still contribute to it, and I'll ask for that in every offer. If a seller doesn't, here's how we handle it.\"",
          "Walk through what you do: search, access, pricing advice, negotiation, attorney and inspection coordination, deadlines through closing.",
          "Use the Showing Agreement for a one-off tour, and the Exclusive Buyer Rep Agreement for real clients.",
        ],
        links: [
          {
            label: "Buyer guide (your branding)",
            to: "/presentations?guide=buyer",
          },
        ],
      },
      {
        h: "Seller side",
        items: [
          "Talk net, not percentage: what they walk away with after price, fees and time on market.",
          "Show the launch system and the reports they'll get. That's what the fee pays for.",
          "Discuss whether to offer buyer-agent compensation as a strategy (more buyers can afford to use an agent), never a requirement.",
          "Never promise a reduced fee. Only Michael can change fees or waive the admin fee.",
        ],
        links: [
          {
            label: "Seller guide (your branding)",
            to: "/presentations?guide=seller",
          },
        ],
      },
    ],
  },
  {
    id: "biz-radar",
    n: 29,
    title: "Business & Commercial Radar: Our Edge",
    who: "Every agent",
    minutes: 4,
    summary:
      "Michael has sold over 100 businesses. Every homeowner you meet might own a business, a building or a lease that's ending. Spot it, hand it off, and keep a role in the deal.",
    tags: "business sale commercial referral owner laundromat building lease investor edge opportunity",
    sections: [
      {
        h: "Listen for these",
        items: [
          '"I own a laundromat / restaurant / shop." Owners thinking about retiring or moving are business-sale leads.',
          '"We own the building our business is in" or a 2–6 unit they\'ve held for years: commercial or investment sale.',
          '"Our lease is up next year": leasing or a purchase of their own space.',
          "Buyers asking about investment properties or buying a business with an SBA loan.",
        ],
      },
      {
        h: "What to do",
        items: [
          "Don't value it yourself, and don't share anything about the business publicly. Business sales are confidential from the first conversation.",
          "Send the Business Seller or Business Buyer form, or a Lead hand-off to Michael with what you heard.",
          "Michael prices it with you and runs the add-back and loan-capacity check. Your role and split are confirmed in writing before marketing starts.",
        ],
        links: [
          { label: "Business seller form", to: "/forms?open=business-seller" },
          { label: "Business buyer form", to: "/forms?open=business-buyer" },
          { label: "Lead hand-off", to: "/forms?open=lead-handoff" },
        ],
      },
      {
        h: "Learn the basics",
        items: [
          "Know what SDE means and why lenders underwrite tax returns, not P&Ls.",
          "Know that NDA comes before any financials, and that the teaser never names the business.",
        ],
        links: [
          {
            label: "Business valuation basics",
            to: "/playbooks/business-valuation",
          },
          {
            label: "Commercial playbook",
            to: "/playbooks/commercial-business",
          },
        ],
      },
    ],
  },
  {
    id: "ai-toolkit",
    n: 30,
    title: "AI Toolkit for Agents: Faster, Not Sloppier",
    who: "Every agent",
    minutes: 6,
    summary:
      "AI writes the first draft in seconds. You check the facts, fair housing and tone. Here are the prompts that save us hours, and the lines you never cross.",
    tags: "ai chatgpt prompts listing description follow up text video script automation viktor",
    sections: [
      {
        h: "What we already automate for you",
        items: [
          "Anna answers new company leads in minutes, any hour. You take over the real conversation.",
          "The CMA engine pulls comps and builds a branded report and workbook from your request.",
          "Decks and client guides arrive already in your name and photo.",
          "Ask for anything else you do over and over (a report, a checklist, a mailing) with Request help on Michael's card. If it's repeatable, we'll automate it.",
        ],
      },
      {
        h: "Prompts that work (copy, then fill the brackets)",
        items: [
          'Listing copy: "Write a 150-word MLS description for [beds/baths/sqft, key upgrades with years, location features]. Describe the home, not the buyer. No superlatives I can\'t prove."',
          'Follow-up text: "Write a 2-sentence text to [name], a [buyer/seller] who [last thing they said]. Friendly, no pressure, end with one easy question."',
          "Video script: \"Write a 30-second Reel script answering '[real client question]' for [neighborhood]. Hook in the first 3 seconds, one stat, one call to action.\"",
          'Objection prep: "Act as a seller who thinks my fee is too high. Push back 3 times. Then tell me what I did well and what to fix."',
          'Market update: "Turn these numbers [paste MLS stats] into a 5-line email a homeowner would actually read."',
        ],
      },
      {
        h: "Lines you never cross",
        items: [
          "Never paste client SSNs, bank statements, contracts or financials into a public AI tool.",
          "Check every fact against MLS and public records. AI invents square footage, schools and taxes with confidence.",
          "Run listing copy through the fair-housing check: features only, no 'perfect for families' or similar.",
          "Every published piece shows the brokerage: SpaceMatch Inc. · a team of Real Broker, LLC.",
        ],
        links: [
          {
            label: "Fair housing & advertising",
            to: "/playbooks/fair-housing",
          },
          { label: "Your support team", to: "/home#team" },
        ],
      },
    ],
  },
  {
    id: "video-leadgen",
    n: 31,
    title: "Video-First Lead Gen: Reels, YouTube & AI Avatars",
    who: "Every agent",
    minutes: 5,
    summary:
      "Video builds trust before the first call. Short Reels for reach, YouTube for search, and AI avatar video so you can be consistent without filming every day.",
    tags: "video youtube reels heygen avatar content lead generation search seo instagram",
    sections: [
      {
        h: "The 3-part content system",
        items: [
          "Reach: 2–3 Reels a week on Instagram. Listings, neighborhoods, and real client questions answered in 30 seconds.",
          'Search: YouTube videos people find for years: "Moving to Evanston", "Cost of selling in Chicago", "Condo vs. townhouse in Lakeview".',
          "Consistency: AI avatar video (HeyGen) turns a script into a video in your likeness. The team already runs this for our YouTube channel.",
        ],
      },
      {
        h: "Make each video count",
        items: [
          "Hook in the first 3 seconds with the question or the number.",
          "One idea per video. Captions on (most people watch muted).",
          "End with one call to action: \"Text me 'VALUE' for a free home value report\" or the team line.",
          "Brokerage name on screen or in the caption. Seller's OK before you show their home.",
        ],
      },
      {
        h: "Turn views into leads",
        items: [
          "Reply to comments and DMs within a few hours, then move to text.",
          "Add every real inquiry to Lofty with source = Instagram or YouTube.",
          "Want your own avatar or a video series? Send a Marketing request; Cris and Michael will set it up.",
        ],
        links: [
          { label: "Marketing request", to: "/forms?open=marketing-request" },
          { label: "Instagram & video basics", to: "/playbooks/social-video" },
        ],
      },
    ],
  },
  {
    id: "ads-analytics",
    n: 32,
    title: "Ads & Analytics: Read the Numbers Sellers Care About",
    who: "Listing agents and anyone running ads",
    minutes: 5,
    summary:
      "Instagram, Google and Lofty ads only matter if you can read them. Know the 4 numbers, report them to sellers weekly, and fix the weakest one.",
    tags: "ads instagram meta google lofty analytics reach clicks cost per lead conversion report",
    sections: [
      {
        h: "The 4 numbers",
        items: [
          "Reach: how many people saw it. Tells you if the audience is big enough.",
          "Clicks and click rate: did the photo and headline make people stop? Under about 1% → change the first photo or the headline.",
          "Leads and cost per lead: what each inquiry cost. Compare it across Instagram, Google and Lofty, not against a guess.",
          "Contact rate: how many of those leads you actually reached. Ads are wasted without speed-to-lead.",
        ],
      },
      {
        h: "Listing ads",
        items: [
          "Every active listing has an Ad campaigns card on its Hub listing page: Instagram, Google, Lofty and the website, with status and results.",
          "Update it when a campaign starts or ends. Sellers see it on their listing page, so it is part of your weekly report.",
          "Sellers see results, not budgets. Talk about reach, clicks and showings.",
        ],
        links: [{ label: "My listings", to: "/listings" }],
      },
      {
        h: "Lead-gen ads",
        items: [
          "Company ads feed Lofty as team leads (50/50). They're paid for, so they get your fastest response.",
          "Running your own ads? Use your own landing page or Lofty lead form, tag the source, and show the brokerage name in every ad.",
          "Judge an ad after it has had a fair test (a week or about 1,000 people reached), not after one day.",
        ],
        links: [{ label: "Speed-to-Lead", to: "/playbooks/speed-to-lead" }],
      },
    ],
  },
];
