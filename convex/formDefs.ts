// The 25 SpaceMatch forms (replace ~123 scattered Google Forms on team@).
// Pure data: imported by the backend (validation/routing) and the frontend (rendering).

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select"
  | "radio"
  | "checks"
  | "date"
  | "number"
  | "money"
  | "rating"
  | "agent";

export type Field = {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  help?: string;
  placeholder?: string;
  section?: string; // starts a new section heading before this field
  half?: boolean; // half width on desktop
};

export type FormGroup =
  | "Seller"
  | "Buyer"
  | "Renter"
  | "Landlord"
  | "Business"
  | "Leads"
  | "Team";

export type FormDef = {
  id: string;
  group: FormGroup;
  title: string;
  blurb: string; // shown to the agent in the hub
  intro: string; // shown to the client at the top of the form
  audience: "client" | "agent" | "team";
  lead?: boolean; // new-lead form → 1-hour response alert + escalation
  fields: Field[];
};

export const GROUPS: { id: FormGroup; label: string; blurb: string }[] = [
  { id: "Seller", label: "Sellers", blurb: "From first call to after closing" },
  { id: "Buyer", label: "Buyers", blurb: "Search, tours, offer, closing" },
  { id: "Renter", label: "Renters", blurb: "Find, apply, move in" },
  { id: "Landlord", label: "Landlords", blurb: "List, screen, lease" },
  { id: "Business", label: "Business sales", blurb: "Laundromats & businesses" },
  { id: "Leads", label: "Lead capture", blurb: "Open houses, co-op feedback, referrals" },
  { id: "Team", label: "Team (internal)", blurb: "Requests to Michael, Cris & Atom" },
];

const YN = ["Yes", "No"];
const YNU = ["Yes", "No", "Not sure"];
const TIMELINE = ["ASAP", "1–3 months", "3–6 months", "6+ months", "Just exploring"];
const PROPERTY_TYPES = [
  "Single-family",
  "Condo",
  "Townhome",
  "2–4 unit",
  "5+ unit building",
  "Land",
  "Commercial",
];

// Every client form starts with the same contact block; name + (email or phone) required.
const contact = (who = "Your"): Field[] => [
  { id: "fullName", label: `${who} full name`, type: "text", required: true, section: "Contact" },
  { id: "phone", label: "Mobile phone", type: "tel", half: true },
  { id: "email", label: "Email", type: "email", half: true },
  {
    id: "preferredContact",
    label: "Best way to reach you",
    type: "radio",
    options: ["Call", "Text", "Email"],
  },
];

const address = (label = "Property address", required = true): Field => ({
  id: "propertyAddress",
  label,
  type: "text",
  required,
  placeholder: "Street, unit, city, ZIP",
});

const afterClosing = (side: "Seller" | "Buyer"): FormDef => ({
  id: side === "Seller" ? "seller-after-closing" : "buyer-after-closing",
  group: side,
  title: `After Closing — ${side} Review`,
  blurb: "Rating, testimonial OK, referrals. 4–5★ get the Google review link.",
  intro:
    "Congratulations on closing! Two minutes of feedback helps us get better and helps other families find us.",
  audience: "client",
  fields: [
    ...contact(),
    address("Property address", false),
    { id: "rating", label: "How would you rate your experience?", type: "rating", required: true, section: "Your experience" },
    { id: "wentWell", label: "What did we do well?", type: "textarea" },
    { id: "improve", label: "What could we have done better?", type: "textarea" },
    { id: "testimonialOk", label: "May we share your comments as a testimonial?", type: "radio", options: ["Yes, with my first name", "Yes, anonymously", "No"] },
    { id: "referrals", label: "Know anyone buying, selling or renting? (name + phone)", type: "textarea", section: "Referrals" },
    ...(side === "Seller"
      ? [{ id: "forwardingAddress", label: "Forwarding address (for documents)", type: "text" } as Field]
      : [{ id: "homeAnniversary", label: "May we send a home-anniversary note each year?", type: "radio", options: YN } as Field]),
  ],
});

export const FORMS: FormDef[] = [
  // ───────────── SELLER ─────────────
  {
    id: "seller-intake",
    group: "Seller",
    title: "Seller Intake",
    blurb: "First conversation: home, motivation, timeline, price expectation.",
    intro: "Tell us about your home and your plans. Your agent will use this to prepare your pricing and marketing plan.",
    audience: "client",
    lead: true,
    fields: [
      ...contact(),
      { ...address(), section: "The property" },
      { id: "propertyType", label: "Property type", type: "select", options: PROPERTY_TYPES, half: true },
      { id: "occupancy", label: "Currently", type: "select", options: ["Owner-occupied", "Tenant-occupied", "Vacant"], half: true },
      { id: "beds", label: "Bedrooms", type: "number", half: true },
      { id: "baths", label: "Bathrooms", type: "number", half: true },
      { id: "sqft", label: "Approx. square feet", type: "number", half: true },
      { id: "yearBuilt", label: "Year built", type: "number", half: true },
      { id: "reason", label: "Why are you thinking of selling?", type: "textarea", section: "Your plans" },
      { id: "timeline", label: "When would you like to move?", type: "select", options: TIMELINE, required: true, half: true },
      { id: "priceExpectation", label: "What do you think it's worth?", type: "money", half: true },
      { id: "mortgagePayoff", label: "Approx. mortgage payoff (optional)", type: "money", half: true },
      { id: "buyingNext", label: "Buying your next home too?", type: "select", options: ["Yes", "No", "Maybe"], half: true },
      { id: "decisionMakers", label: "Anyone else on title / involved in the decision?", type: "text" },
      { id: "heardFrom", label: "How did you hear about SpaceMatch?", type: "select", options: ["Referral", "Zillow", "Google", "Instagram", "Mailer", "Sign", "Open house", "Other"] },
      { id: "notes", label: "Anything else we should know?", type: "textarea" },
    ],
  },
  {
    id: "seller-property-details",
    group: "Seller",
    title: "Property Details & Disclosures",
    blurb: "Upgrades, system ages, known issues, HOA, inclusions — feeds the CMA + listing.",
    intro: "These details help us price accurately and answer buyer questions before they come up.",
    audience: "client",
    fields: [
      ...contact(),
      { ...address(), section: "Updates" },
      { id: "upgrades", label: "Upgrades in the last 10 years (what + year)", type: "textarea", placeholder: "e.g. Kitchen 2021, roof 2019, windows 2018" },
      { id: "roofAge", label: "Roof age (years)", type: "number", half: true },
      { id: "hvacAge", label: "Furnace / AC age (years)", type: "number", half: true },
      { id: "waterHeaterAge", label: "Water heater age (years)", type: "number", half: true },
      { id: "electricalPanel", label: "Electrical panel (amps)", type: "text", half: true },
      { id: "waterIssues", label: "Any water in the basement / leaks ever?", type: "radio", options: YNU, section: "Condition" },
      { id: "knownIssues", label: "Known defects or repairs needed", type: "textarea" },
      { id: "permits", label: "Any work done without permits?", type: "radio", options: YNU },
      { id: "hoaName", label: "HOA / management company", type: "text", section: "HOA & costs", half: true },
      { id: "hoaDues", label: "HOA dues ($/month)", type: "money", half: true },
      { id: "specialAssessment", label: "Pending special assessment?", type: "radio", options: YNU },
      { id: "taxes", label: "Annual property taxes", type: "money", half: true },
      { id: "utilities", label: "Avg. monthly utilities", type: "money", half: true },
      { id: "parking", label: "Parking (garage / spaces / deeded)", type: "text", section: "Included items" },
      { id: "included", label: "Staying with the home", type: "checks", options: ["Refrigerator", "Range/oven", "Dishwasher", "Microwave", "Washer", "Dryer", "Window treatments", "Light fixtures", "Mounted TVs"] },
      { id: "excluded", label: "Anything you're taking that buyers might expect to stay?", type: "text" },
    ],
  },
  {
    id: "listing-launch",
    group: "Seller",
    title: "Listing Launch Checklist",
    blurb: "Media day, access, staging, showings, open house — starts the 14-day launch.",
    intro: "Let's plan your launch: media day, showings and how you'd like to approve marketing.",
    audience: "client",
    fields: [
      ...contact(),
      { ...address(), section: "Media day" },
      { id: "mediaDates", label: "Best dates for photos / video / 3D tour", type: "text", placeholder: "e.g. Tue 10/21 or Thu 10/23 morning" },
      { id: "access", label: "Access for the photographer", type: "select", options: ["I'll be home", "Lockbox", "Building concierge", "Tenant must be notified"] },
      { id: "staging", label: "Interested in virtual or physical staging?", type: "radio", options: ["Virtual", "Physical", "No thanks", "Not sure"] },
      { id: "highlights", label: "Your favorite features of the home", type: "textarea", section: "Story" },
      { id: "neighborhood", label: "Neighborhood favorites (parks, cafés, schools)", type: "textarea" },
      { id: "comingSoon", label: "OK to market as Coming Soon first?", type: "radio", options: YNU, section: "Showings" },
      { id: "showingWindows", label: "Preferred showing windows", type: "text", placeholder: "e.g. weekdays after 4pm, weekends 10–4" },
      { id: "notice", label: "Notice needed before showings", type: "select", options: ["None", "1 hour", "2 hours", "24 hours"], half: true },
      { id: "pets", label: "Pets in the home?", type: "text", half: true },
      { id: "openHouse", label: "Open house first weekend?", type: "radio", options: YN },
      { id: "yardSign", label: "OK to install a yard sign?", type: "radio", options: ["Yes", "No", "N/A (condo)"] },
      { id: "approvals", label: "How would you like to approve marketing?", type: "radio", options: ["Text", "Email", "Seller portal"] },
    ],
  },
  {
    id: "seller-offer",
    group: "Seller",
    title: "Offer & Contract Info (Seller)",
    blurb: "Attorney, payoff, possession, HOA contact — everything the TC needs.",
    intro: "You're under contract — congratulations! Please share these details so closing goes smoothly.",
    audience: "client",
    fields: [
      ...contact(),
      { ...address(), section: "Closing team" },
      { id: "attorneyName", label: "Your attorney (name + firm)", type: "text" },
      { id: "attorneyContact", label: "Attorney phone / email", type: "text" },
      { id: "lender", label: "Mortgage lender for payoff", type: "text", half: true },
      { id: "loanLast4", label: "Loan # (last 4)", type: "text", half: true },
      { id: "hoaContact", label: "HOA / management contact", type: "text" },
      { id: "closingDate", label: "Preferred closing date", type: "date", section: "Timing", half: true },
      { id: "possession", label: "Possession", type: "select", options: ["At closing", "Post-closing (rent-back)", "Not sure"], half: true },
      { id: "survey", label: "Do you have a survey?", type: "radio", options: YNU },
      { id: "questions", label: "Questions for your agent", type: "textarea" },
    ],
  },
  afterClosing("Seller"),

  // ───────────── BUYER ─────────────
  {
    id: "buyer-intake",
    group: "Buyer",
    title: "Buyer Intake",
    blurb: "Budget, pre-approval, areas, must-haves, timeline.",
    intro: "Tell us what you're looking for and we'll set up your search and tours.",
    audience: "client",
    lead: true,
    fields: [
      ...contact(),
      { id: "areas", label: "Neighborhoods / suburbs", type: "text", required: true, section: "Your search" },
      { id: "priceMin", label: "Price from", type: "money", half: true },
      { id: "priceMax", label: "Price up to", type: "money", half: true },
      { id: "propertyTypes", label: "Property types", type: "checks", options: PROPERTY_TYPES },
      { id: "beds", label: "Min. bedrooms", type: "number", half: true },
      { id: "baths", label: "Min. bathrooms", type: "number", half: true },
      { id: "mustHaves", label: "Must-haves", type: "textarea" },
      { id: "dealBreakers", label: "Deal-breakers", type: "textarea" },
      { id: "preapproved", label: "Pre-approved?", type: "select", options: ["Yes", "In progress", "No — need a lender", "Paying cash"], section: "Financing", half: true },
      { id: "downPayment", label: "Down payment (%)", type: "number", half: true },
      { id: "lender", label: "Lender (if any)", type: "text" },
      { id: "timeline", label: "Move by", type: "select", options: TIMELINE, required: true, half: true },
      { id: "currentHome", label: "Currently", type: "select", options: ["Renting", "Own — need to sell", "Own — keeping it", "Living with family"], half: true },
      { id: "firstTime", label: "First-time buyer?", type: "radio", options: YN },
      { id: "notes", label: "Anything else?", type: "textarea" },
    ],
  },
  {
    id: "buyer-tour-feedback",
    group: "Buyer",
    title: "Tour Check-in",
    blurb: "After a tour day: favorites, ratings, offer interest, next tour.",
    intro: "Quick check-in after your tours — what did you love, and what's next?",
    audience: "client",
    fields: [
      ...contact(),
      { id: "homesSeen", label: "Homes you toured", type: "textarea", section: "Today's tours" },
      { id: "favorite", label: "Your favorite and why", type: "textarea" },
      { id: "rating", label: "How close are we to the right home?", type: "rating" },
      { id: "offer", label: "Ready to write an offer on any?", type: "radio", options: ["Yes", "Maybe", "Not yet"] },
      { id: "changes", label: "Should we change the search? (price, area, features)", type: "textarea" },
      { id: "nextTour", label: "Availability for the next tour", type: "text" },
    ],
  },
  {
    id: "buyer-offer",
    group: "Buyer",
    title: "Offer & Under Contract (Buyer)",
    blurb: "Offer terms, lender, attorney, inspection — then hand to TC.",
    intro: "Let's put your offer together. Your agent will review every term with you before it's sent.",
    audience: "client",
    fields: [
      ...contact(),
      { ...address(), section: "Offer" },
      { id: "offerPrice", label: "Offer price", type: "money", half: true },
      { id: "earnest", label: "Earnest money", type: "money", half: true },
      { id: "financing", label: "Financing", type: "select", options: ["Conventional", "FHA", "VA", "Cash", "Other"], half: true },
      { id: "downPayment", label: "Down payment (%)", type: "number", half: true },
      { id: "closingDate", label: "Target closing date", type: "date", half: true },
      { id: "inspection", label: "Inspection", type: "select", options: ["Yes — full", "Yes — info only", "Waive"], half: true },
      { id: "contingencies", label: "Other contingencies / requests", type: "textarea" },
      { id: "lenderContact", label: "Lender (name, phone, email)", type: "text", section: "Your team" },
      { id: "attorneyContact", label: "Attorney (name, phone, email)", type: "text" },
      { id: "questions", label: "Questions", type: "textarea" },
    ],
  },
  afterClosing("Buyer"),

  // ───────────── RENTER ─────────────
  {
    id: "renter-intake",
    group: "Renter",
    title: "Renter Intake",
    blurb: "Budget, move-in date, beds, pets, must-haves.",
    intro: "Tell us what you need and we'll send matching rentals.",
    audience: "client",
    lead: true,
    fields: [
      ...contact(),
      { id: "areas", label: "Neighborhoods", type: "text", required: true, section: "Your search" },
      { id: "budget", label: "Max rent ($/month)", type: "money", required: true, half: true },
      { id: "moveIn", label: "Move-in date", type: "date", required: true, half: true },
      { id: "beds", label: "Bedrooms", type: "select", options: ["Studio", "1", "2", "3", "4+"], half: true },
      { id: "leaseLength", label: "Lease length", type: "select", options: ["12 months", "6 months", "Month-to-month", "Flexible"], half: true },
      { id: "pets", label: "Pets (type + size)", type: "text", half: true },
      { id: "parking", label: "Parking needed?", type: "select", options: YN, half: true },
      { id: "laundry", label: "Laundry", type: "select", options: ["In-unit required", "In-building OK", "Doesn't matter"] },
      { id: "occupants", label: "Number of occupants", type: "number", section: "Qualifying", half: true },
      { id: "income", label: "Household monthly income", type: "money", half: true },
      { id: "credit", label: "Credit score range", type: "select", options: ["750+", "700–749", "650–699", "600–649", "Below 600", "Not sure"] },
      { id: "mustHaves", label: "Must-haves", type: "textarea" },
    ],
  },
  {
    id: "renter-application-prep",
    group: "Renter",
    title: "Rental Application Prep",
    blurb: "Rental history, employment, documents ready — before applying.",
    intro: "Getting your info ready now means your application can go in the same day you find the place.",
    audience: "client",
    fields: [
      ...contact(),
      { id: "currentAddress", label: "Current address", type: "text", section: "Rental history" },
      { id: "currentRent", label: "Current rent", type: "money", half: true },
      { id: "yearsThere", label: "How long there?", type: "text", half: true },
      { id: "landlord", label: "Current landlord (name + phone)", type: "text" },
      { id: "employer", label: "Employer & position", type: "text", section: "Employment" },
      { id: "income", label: "Monthly income", type: "money", half: true },
      { id: "credit", label: "Credit score range", type: "select", options: ["750+", "700–749", "650–699", "600–649", "Below 600", "Not sure"], half: true },
      { id: "history", label: "Any evictions, bankruptcies or broken leases?", type: "radio", options: ["No", "Yes — I'll explain"] },
      { id: "historyNotes", label: "Explanation (if yes)", type: "textarea" },
      { id: "coApplicants", label: "Co-applicants (names + emails)", type: "textarea" },
      { id: "docs", label: "Documents ready", type: "checks", options: ["Photo ID", "2 recent pay stubs", "Offer letter", "Bank statements", "Pet records"], section: "Documents" },
    ],
  },
  {
    id: "renter-move-in",
    group: "Renter",
    title: "Lease & Move-in",
    blurb: "Lease signed → keys, utilities, insurance, move date.",
    intro: "Almost home! Confirm a few move-in details.",
    audience: "client",
    fields: [
      ...contact(),
      { ...address("Rental address"), section: "Move-in" },
      { id: "leaseStart", label: "Lease start", type: "date", half: true },
      { id: "moveDate", label: "Move date", type: "date", half: true },
      { id: "keys", label: "Key pickup preference", type: "text" },
      { id: "setup", label: "Done so far", type: "checks", options: ["Lease signed", "Deposit / move-in fee paid", "Renter's insurance", "Electric", "Gas", "Internet", "Elevator reserved"] },
      { id: "rating", label: "How was working with us?", type: "rating", section: "Feedback" },
      { id: "comments", label: "Comments / referrals", type: "textarea" },
    ],
  },

  // ───────────── LANDLORD ─────────────
  {
    id: "landlord-intake",
    group: "Landlord",
    title: "Landlord Intake",
    blurb: "Unit, target rent, availability, services needed.",
    intro: "Tell us about your rental and we'll put together a pricing and leasing plan.",
    audience: "client",
    lead: true,
    fields: [
      ...contact(),
      { ...address(), section: "The rental" },
      { id: "units", label: "Units in building", type: "number", half: true },
      { id: "unitsToRent", label: "Unit(s) to rent", type: "text", half: true },
      { id: "rentExpectation", label: "Target rent ($/month)", type: "money", half: true },
      { id: "available", label: "Available date", type: "date", half: true },
      { id: "service", label: "What do you need?", type: "radio", options: ["Find a tenant (lease only)", "Lease + ongoing management", "Rental price opinion only"], section: "Service" },
      { id: "pets", label: "Pets allowed?", type: "select", options: ["Yes", "Cats only", "No", "Case by case"], half: true },
      { id: "utilitiesIncluded", label: "Utilities included", type: "text", half: true },
      { id: "notes", label: "Anything else?", type: "textarea" },
    ],
  },
  {
    id: "landlord-rental-details",
    group: "Landlord",
    title: "Rental Listing Details",
    blurb: "Specs, amenities, access, lease terms for the MLS rental listing.",
    intro: "These details go into your rental listing.",
    audience: "client",
    fields: [
      ...contact(),
      { ...address("Unit address"), section: "Unit" },
      { id: "beds", label: "Bedrooms", type: "number", half: true },
      { id: "baths", label: "Bathrooms", type: "number", half: true },
      { id: "sqft", label: "Approx. sq ft", type: "number", half: true },
      { id: "floor", label: "Floor", type: "text", half: true },
      { id: "amenities", label: "Features", type: "checks", options: ["In-unit laundry", "Dishwasher", "Central air", "Balcony / patio", "Parking", "Storage", "Elevator", "Gym", "Doorman"] },
      { id: "updates", label: "Recent updates", type: "textarea" },
      { id: "leaseTerm", label: "Lease term", type: "text", section: "Terms", half: true },
      { id: "moveInFee", label: "Security deposit / move-in fee", type: "text", half: true },
      { id: "access", label: "Showing access", type: "select", options: ["Lockbox", "Tenant-occupied — notice needed", "Owner lets in", "Management office"] },
      { id: "photos", label: "Need professional photos?", type: "radio", options: YNU },
    ],
  },
  {
    id: "landlord-tenant-selection",
    group: "Landlord",
    title: "Tenant Selection & Lease",
    blurb: "Screening criteria and lease preferences, set before applications arrive.",
    intro: "Set your screening criteria so we can pre-qualify applicants for you.",
    audience: "client",
    fields: [
      ...contact(),
      address("Unit address", false),
      { id: "minCredit", label: "Minimum credit score", type: "select", options: ["No minimum", "600", "650", "700", "750"], section: "Criteria", half: true },
      { id: "incomeMultiple", label: "Income requirement", type: "select", options: ["2.5× rent", "3× rent", "No set rule"], half: true },
      { id: "pets", label: "Pets", type: "select", options: ["Yes", "Cats only", "No", "Case by case"], half: true },
      { id: "smoking", label: "Smoking", type: "select", options: ["Not allowed", "Allowed"], half: true },
      { id: "approveBy", label: "How do you want to review applicants?", type: "radio", options: ["Send me each one", "Agent pre-screens, I pick from top 2–3", "Agent decides within my criteria"] },
      { id: "leaseForm", label: "Lease form", type: "select", options: ["Chicago RLTO lease (agent provides)", "My own lease", "Management company lease"], section: "Lease" },
      { id: "notes", label: "Other requirements", type: "textarea" },
    ],
  },

  // ───────────── BUSINESS ─────────────
  {
    id: "business-seller",
    group: "Business",
    title: "Business Owner / Seller",
    blurb: "Financials, lease, staff, plus laundromat equipment section.",
    intro: "Confidential. Tell us about your business so we can value it and plan a discreet sale.",
    audience: "client",
    lead: true,
    fields: [
      ...contact(),
      { id: "businessName", label: "Business name", type: "text", required: true, section: "Business" },
      { id: "businessType", label: "Type", type: "select", options: ["Laundromat", "Car wash", "Restaurant / café", "Retail", "Service business", "Other"], half: true },
      { id: "yearsOwned", label: "Years owned", type: "number", half: true },
      address("Business address", false),
      { id: "realEstate", label: "Real estate", type: "radio", options: ["I own the building", "I lease", "Both available"], section: "Real estate & financials" },
      { id: "leaseRemaining", label: "Lease years remaining + rent", type: "text" },
      { id: "revenue", label: "Annual revenue (gross)", type: "money", half: true },
      { id: "cashFlow", label: "Owner cash flow / SDE", type: "money", half: true },
      { id: "askingPrice", label: "Price expectation", type: "money", half: true },
      { id: "employees", label: "Employees", type: "number", half: true },
      { id: "taxReturns", label: "Can you share 3 years of tax returns?", type: "radio", options: YNU },
      { id: "washers", label: "Washers (count, sizes, age)", type: "text", section: "Laundromat equipment (if applicable)" },
      { id: "dryers", label: "Dryers (count, sizes, age)", type: "text" },
      { id: "brand", label: "Equipment brand", type: "text", half: true },
      { id: "payment", label: "Payment system", type: "select", options: ["Coin", "Card", "App", "Mixed"], half: true },
      { id: "wdf", label: "Wash-dry-fold / pickup & delivery revenue?", type: "radio", options: YN },
      { id: "reason", label: "Reason for selling", type: "textarea", section: "Plans" },
      { id: "timeline", label: "Timeline", type: "select", options: TIMELINE },
    ],
  },
  {
    id: "business-buyer",
    group: "Business",
    title: "Business Buyer / Investor",
    blurb: "Target business type, budget, cash, SBA, experience.",
    intro: "Tell us what you'd like to buy. We'll match you with on- and off-market opportunities.",
    audience: "client",
    lead: true,
    fields: [
      ...contact(),
      { id: "types", label: "Business types", type: "checks", options: ["Laundromat", "Car wash", "Restaurant / café", "Retail", "Service business", "Real estate + business", "Open to anything"], required: true, section: "Target" },
      { id: "areas", label: "Areas", type: "text" },
      { id: "budget", label: "Purchase budget", type: "money", half: true },
      { id: "cash", label: "Cash available for down payment", type: "money", half: true },
      { id: "sba", label: "Using SBA financing?", type: "select", options: ["Yes", "No", "Not sure"], half: true },
      { id: "involvement", label: "Involvement", type: "select", options: ["Owner-operator", "Semi-absentee", "Absentee"], half: true },
      { id: "experience", label: "Business / industry experience", type: "textarea" },
      { id: "timeline", label: "Timeline", type: "select", options: TIMELINE },
      { id: "nda", label: "OK to sign NDAs to receive financials?", type: "radio", options: YN },
    ],
  },

  // ───────────── LEADS ─────────────
  {
    id: "open-house-signin",
    group: "Leads",
    title: "Open House Sign-in",
    blurb: "QR sign-in at open houses. Add ?p=address to prefill the property.",
    intro: "Welcome! Sign in and we'll send you the details for this home and similar ones.",
    audience: "client",
    lead: true,
    fields: [
      { id: "fullName", label: "Full name", type: "text", required: true },
      { id: "phone", label: "Mobile phone", type: "tel", half: true },
      { id: "email", label: "Email", type: "email", half: true },
      { id: "propertyAddress", label: "Open house address", type: "text" },
      { id: "agent", label: "Working with an agent?", type: "radio", options: ["No", "Yes"] },
      { id: "preapproved", label: "Pre-approved?", type: "radio", options: ["Yes", "No", "Paying cash"] },
      { id: "timeline", label: "When are you hoping to buy?", type: "select", options: TIMELINE },
      { id: "homeToSell", label: "Do you have a home to sell?", type: "radio", options: YN },
      { id: "heardFrom", label: "How did you hear about this open house?", type: "select", options: ["Zillow", "Sign", "Instagram", "Neighbor", "Agent", "Other"] },
    ],
  },
  {
    id: "coop-feedback",
    group: "Leads",
    title: "Showing Feedback (buyer's agent)",
    blurb: "Send to co-op agents after showings; lands in the seller report.",
    intro: "Thanks for showing our listing! Your feedback goes straight to the seller.",
    audience: "client",
    fields: [
      { id: "fullName", label: "Your name", type: "text", required: true, section: "You" },
      { id: "brokerage", label: "Brokerage", type: "text", half: true },
      { id: "phone", label: "Phone", type: "tel", half: true },
      { id: "email", label: "Email", type: "email" },
      { id: "propertyAddress", label: "Property shown", type: "text", required: true, section: "Feedback" },
      { id: "interest", label: "Your client's interest", type: "rating" },
      { id: "price", label: "Price opinion", type: "radio", options: ["Priced well", "A bit high", "Too high", "Good value"] },
      { id: "likes", label: "What they liked", type: "textarea" },
      { id: "concerns", label: "Concerns", type: "textarea" },
      { id: "offerLikely", label: "Likely to make an offer?", type: "radio", options: ["Yes", "Maybe", "No"] },
    ],
  },
  {
    id: "referral",
    group: "Leads",
    title: "Send Us a Referral",
    blurb: "Past clients, friends, other agents refer someone in one step.",
    intro: "Thank you for thinking of us! We'll take great care of them and keep you posted.",
    audience: "client",
    lead: true,
    fields: [
      { id: "fullName", label: "Your name", type: "text", required: true, section: "You" },
      { id: "phone", label: "Your phone", type: "tel", half: true },
      { id: "email", label: "Your email", type: "email", half: true },
      { id: "referralName", label: "Their name", type: "text", required: true, section: "Who are you referring?" },
      { id: "referralPhone", label: "Their phone", type: "tel", half: true },
      { id: "referralEmail", label: "Their email", type: "email", half: true },
      { id: "need", label: "They want to", type: "select", options: ["Buy", "Sell", "Rent", "Lease out a property", "Buy/sell a business"] },
      { id: "area", label: "Area", type: "text", half: true },
      { id: "timeline", label: "Timeline", type: "select", options: TIMELINE, half: true },
      { id: "notes", label: "Anything we should know?", type: "textarea" },
    ],
  },

  // ───────────── TEAM ─────────────
  {
    id: "tc-request",
    group: "Team",
    title: "TC / Contract-to-Close Request",
    blurb: "New contract → Atom/Cris open the file and track deadlines.",
    intro: "Submit right after acceptance so the TC can open the file and calendar deadlines.",
    audience: "team",
    fields: [
      { id: "agentName", label: "Agent", type: "agent", required: true },
      { id: "side", label: "Side", type: "select", options: ["Listing / seller", "Buyer", "Both (dual)", "Landlord", "Tenant"], required: true, half: true },
      { id: "mls", label: "MLS #", type: "text", half: true },
      { id: "propertyAddress", label: "Property address", type: "text", required: true },
      { id: "price", label: "Contract price", type: "money", half: true },
      { id: "acceptance", label: "Acceptance date", type: "date", half: true },
      { id: "inspectionDeadline", label: "Inspection deadline", type: "date", half: true },
      { id: "mortgageDeadline", label: "Mortgage contingency date", type: "date", half: true },
      { id: "closingDate", label: "Closing date", type: "date", half: true },
      { id: "earnest", label: "Earnest money + holder", type: "text", half: true },
      { id: "clients", label: "Client names, phones, emails", type: "textarea", section: "Parties" },
      { id: "coop", label: "Other agent (name, brokerage, phone, email)", type: "textarea" },
      { id: "attorneys", label: "Attorneys (both sides)", type: "textarea" },
      { id: "lender", label: "Lender / title", type: "textarea" },
      { id: "dotloop", label: "Docs in dotloop?", type: "radio", options: ["Yes", "Not yet"] },
      { id: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    id: "new-agent-onboarding",
    group: "Team",
    title: "New Agent Onboarding",
    blurb: "License, MLS ID, bio, socials — kicks off the onboarding checklist.",
    intro: "Welcome to SpaceMatch! This sets up your accounts, website profile and business cards.",
    audience: "team",
    fields: [
      { id: "fullName", label: "Full name", type: "text", required: true },
      { id: "email", label: "Personal email", type: "email", required: true, half: true },
      { id: "phone", label: "Cell", type: "tel", required: true, half: true },
      { id: "license", label: "IL license #", type: "text", half: true },
      { id: "mlsId", label: "MRED MLS ID", type: "text", half: true },
      { id: "startDate", label: "Start date", type: "date", half: true },
      { id: "focus", label: "Focus", type: "select", options: ["Residential", "Commercial", "Both"], half: true },
      { id: "languages", label: "Languages spoken", type: "text" },
      { id: "instagram", label: "Instagram", type: "text", half: true },
      { id: "facebook", label: "Facebook", type: "text", half: true },
      { id: "bio", label: "Short bio (about 100 words)", type: "textarea" },
      { id: "headshot", label: "Headshot", type: "radio", options: ["I'll send one", "Book a shoot with the team photographer"] },
    ],
  },
  {
    id: "deal-sheet",
    group: "Team",
    title: "Deal / Commission Sheet",
    blurb: "Closing-bound deal: price, commission, lead source, splits.",
    intro: "Submit once the deal is firm so commission is processed correctly.",
    audience: "team",
    fields: [
      { id: "agentName", label: "Agent", type: "agent", required: true },
      { id: "propertyAddress", label: "Property address", type: "text", required: true },
      { id: "side", label: "Side", type: "select", options: ["Seller", "Buyer", "Both", "Landlord", "Tenant", "Business sale"], half: true },
      { id: "closingDate", label: "Closing date", type: "date", half: true },
      { id: "price", label: "Sale price / annual rent", type: "money", half: true },
      { id: "commissionPct", label: "Commission %", type: "number", half: true },
      { id: "gci", label: "Gross commission ($)", type: "money", half: true },
      { id: "referralFee", label: "Referral fee owed ($ or %)", type: "text", half: true },
      { id: "leadSource", label: "Lead source", type: "select", options: ["Team lead", "Own / sphere", "Zillow", "Referral network", "Open house", "Other"] },
      { id: "coAgent", label: "Co-agent + split", type: "text" },
      { id: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    id: "marketing-request",
    group: "Team",
    title: "Marketing Request",
    blurb: "Signs & riders, flyers, social posts, reels, mailers, business cards.",
    intro: "Tell Cris what you need and when.",
    audience: "team",
    fields: [
      { id: "agentName", label: "Agent", type: "agent", required: true },
      { id: "items", label: "What do you need?", type: "checks", required: true, options: ["Yard sign", "Sign rider", "Open house signs", "Flyer", "Just listed / sold post", "Reel", "Mailer (Wise Pelican)", "Business cards", "Other"] },
      { id: "propertyAddress", label: "Property address (if listing-related)", type: "text" },
      { id: "dueDate", label: "Needed by", type: "date", half: true },
      { id: "quantity", label: "Quantity", type: "text", half: true },
      { id: "details", label: "Details / wording", type: "textarea" },
    ],
  },
  {
    id: "lead-handoff",
    group: "Team",
    title: "Lead Hand-off",
    blurb: "Pass a lead to another agent or back to the team (e.g. Korean → Sein).",
    intro: "Hand off a lead so nobody falls through the cracks.",
    audience: "team",
    fields: [
      { id: "agentName", label: "From agent", type: "agent", required: true },
      { id: "toAgent", label: "To", type: "agent", help: "Leave blank to send back to the team" },
      { id: "leadName", label: "Lead name", type: "text", required: true },
      { id: "leadPhone", label: "Lead phone", type: "tel", half: true },
      { id: "leadEmail", label: "Lead email", type: "email", half: true },
      { id: "leadType", label: "Type", type: "select", options: ["Buyer", "Seller", "Renter", "Landlord", "Business"], half: true },
      { id: "stage", label: "Stage", type: "select", options: ["New — not contacted", "Contacted", "Showing / meeting set", "Nurture"], half: true },
      { id: "reason", label: "Reason", type: "select", options: ["Language", "Area", "Capacity", "Commercial", "Other"] },
      { id: "notes", label: "Notes / history", type: "textarea" },
    ],
  },
];

export const formById = (id: string) => FORMS.find(f => f.id === id);
