// New Leads tracker (Michael 2026-11-08, #listing-lead-creating-engine 1794181670.555449):
// every new Lofty lead, what already happened (Anna's auto text, replies, calls) and the
// exact next step. Shared by Convex + the /new-leads page. Rule-based, no AI.

export type Kind =
  | "yt_seller"
  | "seller_list"
  | "website"
  | "portal"
  | "business"
  | "commercial"
  | "renter"
  | "office_call"
  | "social_ad"
  | "other";

export function kindOf(source: string): Kind {
  const s = source.toLowerCase();
  if (/peak presence|youtube/.test(s)) return "yt_seller";
  if (/motivated seller|prime listing|expired|fsbo|pricing review|home value|valuation/.test(s)) return "seller_list";
  if (/luxurypresence|team website|spacematch/.test(s)) return "website";
  if (/realtor\.com|zillow|homes\.com|trulia|redfin/.test(s)) return "portal";
  if (/bizbuysell|bizquest|business/.test(s)) return "business";
  if (/crexi|loopnet|commercial/.test(s)) return "commercial";
  if (/rental|rent|zumper|apartments/.test(s)) return "renter";
  if (/office line|office call|quo/.test(s)) return "office_call";
  if (/lofty paid|facebook|instagram|meta/.test(s)) return "social_ad";
  return "other";
}

export type Playbook = {
  label: string;
  who: string; // who this lead usually is
  goal: string;
  speed: string;
  steps: string[];
  ask: string[]; // questions for the first call
  text: string; // quick text template ({first}, {street})
};

const STOP = " Reply STOP to opt out.";

export const PLAYBOOKS: Record<Kind, Playbook> = {
  yt_seller: {
    label: "YouTube seller (Peak Presence)",
    who: "A homeowner who watched Michael's YouTube video about selling and left their number. Usually a real seller, often 3–12 months out.",
    goal: "Book a listing appointment or a 10-minute phone call.",
    speed: "Call within 5 minutes. These are paid leads.",
    steps: [
      "Check team@ for a \"NEW YOUTUBE ADS APPOINTMENT!\" email for this person. If they booked a call, that call is the priority: be on time.",
      "Confirm the city. The lead email drops it, so the street alone can be in the wrong town.",
      "Look up the owner on the county site (often an LLC or investor), and if it's listed on MLS with another agent, stop.",
      "Call. If no answer, leave a short voicemail. Send the quick text only if Anna hasn't texted them.",
      "On the call, use the questions below. Offer a free CMA, then book the listing appointment on the Lead Desk.",
      "Not ready yet: set the Lofty stage to Nurture and tag the timeline. Out of state: offer a referral to a local agent.",
    ],
    ask: ["When are you thinking of selling?", "Where would you move next?", "What would you need to net from the sale?", "Has anyone else valued the home yet?"],
    text: `Hi {first}, it's Michael Kang with SpaceMatch. Thanks for watching my video about selling your home{onStreet}. Are you thinking about selling soon, or mostly curious what it's worth today? Happy to help either way.${STOP}`,
  },
  seller_list: {
    label: "Seller lead (list / valuation)",
    who: "A likely seller from a seller-list service, a valuation form, or Pricing Review.",
    goal: "Get a free CMA in their hands, then book the listing appointment.",
    speed: "Call within 15 minutes during business hours.",
    steps: [
      "Check the property: is it listed now? If it's active with another agent, stop. If it's expired or withdrawn, say that you saw it.",
      "Order a CMA in the Hub (it takes about 1 minute to request).",
      "Call. Lead with the value: \"I'm putting together what your home would sell for today.\"",
      "No answer: send the quick text if Anna hasn't texted them, then try again the next day at a different time.",
      "Interested: book the listing appointment on the Lead Desk. Not now: Nurture in Lofty with a follow-up task.",
    ],
    ask: ["What's prompting the move?", "When would you ideally like to be moved?", "Any updates done to the home?", "Who else is involved in the decision?"],
    text: `Hi {first}, it's Michael Kang with SpaceMatch. You asked about selling{onStreet}. I can put together what it would likely sell for today, free and no pressure. Want me to send it over?${STOP}`,
  },
  website: {
    label: "Website sign-up (spacematchinc.com)",
    who: "Usually a buyer who clicked a Luxury Presence Google ad, viewed a listing and registered to keep browsing. Lower intent than a contact form.",
    goal: "Find out if they're a real buyer in the next 6 months and connect them with an agent.",
    speed: "Text within 1 hour, call the same day.",
    steps: [
      "Anna (Lofty's AI) usually texts within 2 minutes, 8 AM–8 PM. Check her text below before sending another one.",
      "Look at what they viewed in Lofty (Activity tab). Mention that listing when you call.",
      "Call once the same day. No answer: no voicemail needed, send the quick text if Anna's text didn't go through.",
      "Real buyer: ask the questions below, then assign an agent in Lofty (area / language) or book a showing on the Lead Desk.",
      "Fake name or junk number: mark \"Not a real lead\" here and set Bad Info/DNC in Lofty.",
    ],
    ask: ["Are you looking to buy in the next 3–6 months?", "Which areas and price range?", "Have you talked to a lender yet?", "Are you working with an agent?"],
    text: `Hi {first}, it's Michael Kang with SpaceMatch. Thanks for signing up on our site. Want me to send you more homes like the ones you were looking at, or set up a time to see one?${STOP}`,
  },
  portal: {
    label: "Portal inquiry (Realtor.com / Zillow / Homes.com)",
    who: "A buyer asking about a specific listing. Usually high intent.",
    goal: "Book a showing.",
    speed: "Call within 5 minutes.",
    steps: [
      "Open the lead in Lofty and find the listing they asked about.",
      "Call right away. Offer two showing times.",
      "No answer: send the quick text with the address if Anna hasn't texted them.",
      "Booked: put the showing on the Lead Desk so an agent gets the invite.",
    ],
    ask: ["Is this the right size and area for you?", "When can you see it?", "Are you pre-approved?", "Do you need to sell first?"],
    text: `Hi {first}, it's Michael Kang with SpaceMatch. Thanks for your inquiry{onStreet}. Want more details or a time to see it?${STOP}`,
  },
  business: {
    label: "Business buyer (BizBuySell)",
    who: "Someone asking about one of the business listings (laundromats, etc.).",
    goal: "Qualify the buyer and get the NDA signed before sharing financials.",
    speed: "Call the same day.",
    steps: [
      "Check which listing they asked about in the BizBuySell email or Lofty notes.",
      "Call. Ask: business only or with the real estate, cash available, experience.",
      "Send the NDA. Share financials only after it's signed.",
      "Serious buyer: book a call with Michael on the Lead Desk.",
    ],
    ask: ["Business only, or with the real estate?", "How much cash can you put in?", "Have you owned a business before?", "SBA loan or cash?"],
    text: `Hi {first}, it's Michael Kang with SpaceMatch. Thanks for your inquiry on BizBuySell. Are you looking at the business only or with the real estate? Happy to send details and set up a call.${STOP}`,
  },
  commercial: {
    label: "Commercial (Crexi)",
    who: "Someone asking about a commercial listing to buy or lease.",
    goal: "Find out buy vs lease, use and budget, then set a tour.",
    speed: "Call the same day.",
    steps: [
      "Check which property they asked about.",
      "Call. Ask buy or lease, what business, size needed, budget.",
      "Send the flyer / OM and offer two tour times.",
    ],
    ask: ["Buy or lease?", "What's the use?", "How much space?", "Timeline and budget?"],
    text: `Hi {first}, it's Michael Kang with SpaceMatch. Thanks for your inquiry on Crexi. Are you looking to buy or lease? Happy to send details or set up a tour.${STOP}`,
  },
  renter: {
    label: "Renter",
    who: "Someone looking for an apartment.",
    goal: "Get move-in date and budget, send 3 options, book a showing.",
    speed: "Text within 1 hour.",
    steps: [
      "Text first (renters answer texts more than calls).",
      "Get move-in date, budget, areas, pets, credit.",
      "Assign a rental agent in Lofty, or send 3 options from MLS.",
    ],
    ask: ["Move-in date?", "Monthly budget?", "Areas?", "Pets? Credit score range?"],
    text: `Hi {first}, it's Michael Kang with SpaceMatch. Thanks for reaching out about a rental. What's your move-in date and budget? I can send a few options today.${STOP}`,
  },
  office_call: {
    label: "Office line caller",
    who: "Someone who called (773) 985-7153.",
    goal: "Call back and find out what they need.",
    speed: "Call back within 15 minutes.",
    steps: [
      "Check the office-line card in Slack / Quo for the voicemail.",
      "Call back. Find out: buy, sell or rent.",
      "Log the outcome below so the team knows it's handled.",
    ],
    ask: ["How can we help: buying, selling or renting?", "Which area?", "Timeline?"],
    text: `Hi {first}, it's Michael Kang with SpaceMatch, returning your call. Are you looking to buy, sell or rent? Happy to help.${STOP}`,
  },
  social_ad: {
    label: "Facebook / Instagram ad",
    who: "Someone who filled out a form on a social ad. Mixed intent.",
    goal: "Find out if they're real and what they want.",
    speed: "Text within 1 hour, call the same day.",
    steps: ["Check which ad they came from in Lofty.", "Call once. Send the quick text only if Anna hasn't texted them.", "Real: assign an agent. Not real: mark Not a real lead."],
    ask: ["What made you reach out?", "Buying or selling, and when?", "Which area?"],
    text: `Hi {first}, it's Michael Kang with SpaceMatch. Thanks for reaching out. Are you looking to buy or sell, and roughly when?${STOP}`,
  },
  other: {
    label: "Other source",
    who: "A lead from another source.",
    goal: "Find out what they need and route them.",
    speed: "Same day.",
    steps: ["Check the source and notes in Lofty.", "Call. No answer and no text from Anna: send the quick text.", "Route to the right agent or the Lead Desk."],
    ask: ["Buying, selling or renting?", "Which area?", "Timeline?"],
    text: `Hi {first}, it's Michael Kang with SpaceMatch. Following up on your inquiry. Are you looking to buy, sell or rent? Happy to help.${STOP}`,
  },
};

export const quickText = (kind: Kind, name: string, street?: string) =>
  PLAYBOOKS[kind].text
    .replace("{first}", (name.trim().split(/\s+/)[0] || "there").replace(/^./, c => c.toUpperCase()))
    .replace("{onStreet}", street ? ` on ${street.split(",")[0].trim()}` : "");

/** Anna (Lofty AI) already texted and it didn't bounce → never text from the office line (Michael 2026-11-09). */
export const annaTexting = (comms: { kind: string; status?: string }[]) =>
  comms.some(c => c.kind === "auto_text" && !/undeliver|fail/i.test(c.status ?? ""));

export type TrackComm = { at: number; kind: "auto_text" | "text_out" | "text_in" | "call_out" | "call_in" | "hub_text" | "hub_call"; status?: string; text?: string; by?: string };

export type TrackLead = {
  createdAt: number;
  name: string;
  phone?: string;
  stage: string;
  cannotText?: boolean;
  comms: TrackComm[];
  handled?: string; // done | not_lead
};

export type NextStep = { id: string; tone: "red" | "amber" | "green" | "gray"; title: string; detail: string };

const HUMAN = new Set(["text_out", "call_out", "call_in", "hub_text", "hub_call"]);
const mins = (ms: number) => Math.round(ms / 60000);
export const isOptOut = (t?: string) => /^\s*(stop|unsubscribe|stop all|cancel|end|quit)\W*\s*$/i.test(t ?? "");

/** What's happened + the single next step, from Lofty comms and Hub actions. */
export function nextStep(l: TrackLead, now: number): NextStep {
  const comms = [...l.comms].sort((a, b) => a.at - b.at);
  const replies = comms.filter(c => c.kind === "text_in" || c.kind === "call_in");
  const lastReply = replies[replies.length - 1];
  const human = comms.filter(c => HUMAN.has(c.kind));
  const lastHuman = human[human.length - 1];
  const auto = comms.filter(c => c.kind === "auto_text");
  const age = now - l.createdAt;
  if (l.handled === "not_lead") return { id: "closed", tone: "gray", title: "Not a real lead", detail: "Marked by the team. Nothing to do." };
  if (comms.some(c => c.kind === "text_in" && isOptOut(c.text))) return { id: "optout", tone: "gray", title: "Texted STOP", detail: "Don't text again. Call only if they asked you to. Set Bad Info/DNC or Nurture in Lofty." };
  if (l.handled === "done") return { id: "done", tone: "gray", title: "Handled", detail: "Marked handled by the team." };
  if (/appointment/i.test(l.stage)) return { id: "appt", tone: "green", title: "Appointment set", detail: "Prep: order the CMA / pick showings, confirm the day before." };
  if (lastReply && (!lastHuman || lastHuman.at < lastReply.at)) {
    const w = mins(now - lastReply.at);
    if (w > 3 * 1440) return { id: "replied_old", tone: "amber", title: `Replied ${Math.round(w / 1440)} d ago, no call yet`, detail: `"${(lastReply.text ?? "(call)").slice(0, 140)}". Still worth one call today, then log it below or mark it handled.` };
    return { id: "replied", tone: "red", title: `They replied ${w < 60 ? `${w} min` : w < 1440 ? `${Math.round(w / 60)} h` : `${Math.round(w / 1440)} d`} ago: call now`, detail: `"${(lastReply.text ?? "(call)").slice(0, 140)}". Anna may keep chatting, but a person should call now. Then log the call below.` };
  }
  const undelivered = auto.length > 0 && auto.every(c => /undeliver|fail/i.test(c.status ?? ""));
  if (!lastHuman && undelivered) return { id: "undelivered", tone: "red", title: "Text didn't go through: call", detail: "Anna's text bounced, so they haven't heard from us. Call them. If the number is dead, email and set Bad Info in Lofty." };
  if (!lastHuman && !auto.length) {
    if (!l.phone) return { id: "nophone", tone: "amber", title: "No phone number: email them", detail: "Send a short email from Lofty and look for a number in the lead's notes." };
    if (l.cannotText) return { id: "call", tone: "amber", title: "Can't be texted: call", detail: "Lofty has texting turned off for this lead. Call instead." };
    if (age > 15 * 60000) return { id: "notext", tone: "red", title: "Nobody has texted yet", detail: "Anna didn't text this lead (source not covered, or overnight). Send the quick text now, then call." };
    return { id: "wait_anna", tone: "gray", title: "Just came in", detail: "Anna normally texts within a few minutes (8 AM–8 PM). Check back shortly or call now." };
  }
  if (!human.some(c => c.kind === "call_out" || c.kind === "hub_call")) {
    if (age > 20 * 3600e3) return { id: "call_due", tone: "amber", title: "No call yet: call once today", detail: "They got a text but nobody has called. One call, then log it below." };
    return { id: "waiting", tone: "gray", title: "Texted, waiting for a reply", detail: "Call during business hours today to beat other agents to them." };
  }
  if (/new lead/i.test(l.stage)) return { id: "stage", tone: "amber", title: "Called: update the Lofty stage", detail: "Move them out of New Leads (Attempting Contact, Connected Qualifying, Nurture…) so the pipeline stays honest." };
  return { id: "working", tone: "gray", title: "Being worked", detail: "We've reached out. Follow the Lofty stage from here." };
}

export const TONE: Record<NextStep["tone"], string> = {
  red: "bg-red-600 text-white",
  amber: "bg-amber-100 text-amber-900",
  green: "bg-emerald-100 text-emerald-900",
  gray: "bg-stone-100 text-stone-700",
};

export const CALL_RESULTS = ["Talked", "Left voicemail", "No answer", "Wrong number", "Booked an appointment"] as const;

// ── Auto CMA on "what's it worth / more info" replies (Michael 2026-11-09 "both") ──
const VALUE_ASK = /\b(worth|value|valuation|apprais\w*|cma|comps|price[ds]?|pricing|how much|what (can|could|would) (i|we) get|more info(rmation)?|info please|interested|send (me )?(the )?(info|details|numbers))\b/i;
const NOT_NOW = /\b(stop|unsubscribe|wrong number|not interested|not selling|no longer|already sold|remove me|don'?t (text|contact|call))\b/i;
/** A seller-side reply that asks for a value or more information → auto CMA. */
export const wantsValue = (text?: string) => !!text && !isOptOut(text) && VALUE_ASK.test(text) && !NOT_NOW.test(text);
/** Auto CMAs per Chicago day (≈$4–5 each in Viktor credits). */
export const AUTO_CMA_DAILY_CAP = 5;
