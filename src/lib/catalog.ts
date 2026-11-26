// Findability round 2 (Michael 2026-11-22, DM 1795360151.449479): "a lot of tools but hard to find",
// "make it easier to read like buttons", "is there an all tools button and tools categorized?".
// ONE catalog of every Hub tool (→ /tools, My tools on Home) + 6 "moment" pages (→ /do/:id).
// Static copy, no AI. Every `to` must be an existing route.
import {
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  CalendarCheck,
  Camera,
  ClipboardList,
  Clapperboard,
  CalendarDays,
  CreditCard,
  Heart,
  LineChart,
  Star,
  Compass,
  FileBarChart,
  FileText,
  Film,
  GraduationCap,
  Headset,
  Home,
  Inbox,
  KeyRound,
  Landmark,
  LifeBuoy,
  Lightbulb,
  Link2,
  ListChecks,
  Mail,
  MailOpen,
  Megaphone,
  MessageCircle,
  Newspaper,
  PenLine,
  Presentation,
  Rocket,
  Settings,
  Sparkles,
  Target,
  Users,
  UsersRound,
} from "lucide-react";

type Icon = React.ComponentType<{ className?: string }>;
export type Access = "all" | "staff" | "admin" | "newLeads";
export type CatalogTool = {
  to: string;
  name: string;
  what: string; // one plain line
  icon: Icon;
  keys?: string; // extra words for the filter box
  access?: Access;
};
export type CatalogGroup = { id: string; title: string; blurb: string; tools: CatalogTool[] };

export const CATALOG: CatalogGroup[] = [
  {
    id: "clients",
    title: "Leads & clients",
    blurb: "Reach people, send forms, find a vendor",
    tools: [
      { to: "/inbox", name: "Inbox", what: "Forms and leads that came back to you", icon: Inbox, keys: "replies leads new" },
      { to: "/forms", name: "Send a form", what: "Text or email a client a form: intake, showing, offer", icon: ClipboardList, keys: "intake questionnaire link qr" },
      { to: "/appointments", name: "Appointments", what: "Meetings the team booked for you", icon: CalendarCheck, keys: "meeting booked calendar" },
      { to: "/emails", name: "Emails", what: "Ready-to-send emails for every client group", icon: MailOpen, keys: "email templates just listed just sold rent vs own move up" },
      { to: "/resources", name: "Vendors", what: "Lenders, attorneys, inspectors, contractors, movers", icon: Users, keys: "lender attorney inspector contractor mover stager" },
      { to: "/commission-rentals", name: "100% rentals", what: "Buildings that pay a full month's rent or more", icon: Building2, keys: "rental apartment commission pays renter" },
    ],
  },
  {
    id: "listings",
    title: "Pricing & listings",
    blurb: "Price it, present it, launch it",
    tools: [
      { to: "/new", name: "Price a home", what: "Order a branded CMA, back in about an hour", icon: FileBarChart, keys: "cma comps value worth pricing" },
      { to: "/lease", name: "Lease CMA", what: "Rent range and suggested asking rent", icon: Landmark, keys: "rent rental landlord lease" },
      { to: "/requests", name: "My CMA requests", what: "CMAs you ordered and their PDFs", icon: FileText, keys: "cma pdf workbook" },
      { to: "/listings", name: "My listings", what: "Each listing's live launch page for your seller", icon: Home, keys: "seller portal launch listing" },
      { to: "/net-sheet", name: "Net sheet", what: "What the seller walks away with", icon: Calculator, keys: "net proceeds transfer tax payoff" },
      { to: "/presentations", name: "Listing decks & guides", what: "Pre-listing package, appointment deck, buyer and seller guides", icon: Presentation, keys: "deck presentation pre-listing package guide" },
      { to: "/ad-orders", name: "Ads", what: "Listing ads you ordered and what you owe", icon: Megaphone, keys: "ads meta google facebook instagram ad kit" },
      { to: "/demo/seller", name: "Seller portal demo", what: "Show a seller the page they'll get", icon: Sparkles, keys: "demo portal" },
    ],
  },
  {
    id: "marketing",
    title: "Marketing",
    blurb: "Get your name out",
    tools: [
      { to: "/seller-lists", name: "Seller lists", what: "Owners most likely to sell in a ZIP or building", icon: Target, keys: "farm zip building owners list" },
      { to: "/mailers", name: "Postcards", what: "Jumbo postcards with your photo and a QR code", icon: Mail, keys: "mailer postcard farm qr" },
      { to: "/reels", name: "Make a Reel", what: "Send clips, get a finished Reel back", icon: Clapperboard, keys: "reel video instagram tiktok" },
      { to: "/my-videos", name: "My videos", what: "Upload raw clips and get edited videos back", icon: Camera, keys: "upload video clips" },
      { to: "/broll", name: "B-Roll clips", what: "Branded clips with your name bar", icon: Film, keys: "broll b-roll clips footage" },
      { to: "/why", name: "Why SpaceMatch link", what: "Your pitch page. See when they open it", icon: Link2, keys: "pitch link meet me page" },
      { to: "/signature", name: "Email signature", what: "Your signature with photo, cell and social links", icon: PenLine, keys: "signature gmail" },
      { to: "/reviews", name: "Google reviews", what: "Send clients your review link and see who left one", icon: Star, keys: "google review reviews testimonial" },
      { to: "/card", name: "My business card", what: "Digital card with QR code. Clients save your contact in one tap", icon: CreditCard, keys: "business card vcard qr contact" },
      { to: "/open-houses", name: "Open house calendar", what: "Host open houses on team listings to meet buyers", icon: CalendarDays, keys: "open house calendar host slot" },
      { to: "/past-clients", name: "Past clients", what: "Who to text this month: anniversaries, holidays, updates", icon: Heart, keys: "past clients sphere anniversary touch plan follow up" },
      { to: "/post-ideas", name: "Post ideas", what: "4 posts a month with what to film and a caption", icon: Lightbulb, keys: "social instagram post ideas content calendar caption" },
      { to: "/market-update", name: "Market update kit", what: "Your areas' MLS numbers turned into a script and post", icon: LineChart, keys: "market update stats numbers mls median days on market" },
    ],
  },
  {
    id: "learn",
    title: "Learn & coaching",
    blurb: "What to do and what to say",
    tools: [
      { to: "/guide", name: "What to do when", what: "Pick the situation, get the steps", icon: Compass, keys: "guide how situation" },
      { to: "/muse", name: "Muse coach", what: "Ask \"what do I say?\" on your phone", icon: MessageCircle, keys: "ai coach practice objections role play" },
      { to: "/playbooks", name: "Playbooks", what: "Step-by-step scripts for every stage", icon: BookOpen, keys: "scripts how to process" },
      { to: "/growth", name: "90-day plan", what: "45 minutes a day, tracked", icon: Rocket, keys: "growth plan daily" },
      { to: "/training", name: "Academy", what: "Short training modules and certification", icon: GraduationCap, keys: "training course quiz" },
      { to: "/templates", name: "Templates", what: "Forms, documents, scripts and emails to copy", icon: FileText, keys: "contract buyer rep listing agreement documents" },
    ],
  },
  {
    id: "team",
    title: "Team & help",
    blurb: "News, help and your settings",
    tools: [
      { to: "/announcements", name: "News", what: "Team announcements from Michael", icon: Newspaper, keys: "announcements news" },
      { to: "/help", name: "Get help", what: "Ask Cris, Atom, Brandon, Sergio or Michael", icon: LifeBuoy, keys: "help question stuck" },
      { to: "/feedback", name: "Suggest a fix", what: "Something broken or missing? Tell us", icon: Lightbulb, keys: "bug idea feedback" },
      { to: "/settings", name: "Settings", what: "Your account and notifications", icon: Settings, keys: "settings account password" },
    ],
  },
  {
    id: "office",
    title: "Office only",
    blurb: "Only staff see this group",
    tools: [
      { to: "/desk", name: "Lead Desk", what: "Calls and leads waiting on the office", icon: Headset, access: "staff", keys: "desk calls" },
      { to: "/new-leads", name: "New Leads", what: "Every new Lofty lead and its next step", icon: ListChecks, access: "newLeads", keys: "lofty leads anna" },
      { to: "/team", name: "Team roster", what: "Add, edit or remove agents", icon: UsersRound, access: "staff", keys: "agents roster add agent" },
      { to: "/logins", name: "Agent logins", what: "Who has signed in and who hasn't", icon: KeyRound, access: "staff", keys: "logins password" },
      { to: "/adoption", name: "Adoption scoreboard", what: "Who used the Hub this week", icon: BarChart3, access: "admin", keys: "usage adoption" },
    ],
  },
];

export const ALL_TOOLS: CatalogTool[] = CATALOG.flatMap(g => g.tools);

export type Viewer = { isAdmin?: boolean; isOps?: boolean; canNewLeads?: boolean } | null | undefined;
export function canSee(t: CatalogTool, me: Viewer): boolean {
  const a = t.access ?? "all";
  if (a === "all") return true;
  if (!me) return false;
  if (a === "admin") return !!me.isAdmin;
  if (a === "newLeads") return !!me.canNewLeads;
  return !!(me.isAdmin || me.isOps);
}

// ── My tools: the 4 tools this agent opens most, counted on this phone (no backend, no credits) ──
const USE_KEY = "hub-tool-use";
export const DEFAULT_MY_TOOLS = ["/new", "/commission-rentals", "/forms", "/inbox"];
const toolForPath = (path: string) =>
  ALL_TOOLS.filter(t => !t.access && t.to !== "/settings")
    .filter(t => path === t.to || path.startsWith(`${t.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];

export function recordToolUse(path: string) {
  const t = toolForPath(path);
  if (!t) return;
  try {
    const m = JSON.parse(localStorage.getItem(USE_KEY) ?? "{}") as Record<string, number>;
    m[t.to] = (m[t.to] ?? 0) + 1;
    localStorage.setItem(USE_KEY, JSON.stringify(m));
  } catch {
    /* private mode */
  }
}

export function myTools(n = 4): CatalogTool[] {
  let m: Record<string, number> = {};
  try {
    m = JSON.parse(localStorage.getItem(USE_KEY) ?? "{}");
  } catch {
    /* private mode */
  }
  const used = Object.entries(m)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([to]) => to);
  const order = [...new Set([...used, ...DEFAULT_MY_TOOLS])];
  return order.map(to => ALL_TOOLS.find(t => t.to === to)).filter((t): t is CatalogTool => !!t).slice(0, n);
}

// ── Moments: "What are you working on?" ──
export type MomentButton = { label: string; to?: string; icon?: Icon; light?: boolean; copy?: "text-back" };
export type MomentStep = { text: string; buttons: MomentButton[] };
export type MomentGroup = { when?: string; steps: MomentStep[] };
export type Moment = {
  id: string;
  label: string; // button on Home
  sub: string; // tools named on the button
  icon: Icon;
  title: string;
  goal: string;
  groups: MomentGroup[];
  muse: string;
};

export const MOMENTS: Moment[] = [
  {
    id: "new-lead",
    label: "New lead",
    sub: "Call, text, intake",
    icon: Sparkles,
    title: "A new lead just came in",
    goal: "Talk to them within the hour and book a meeting.",
    groups: [
      {
        steps: [
          { text: "Call now. Use the speed-to-lead script.", buttons: [{ label: "Open script", to: "/playbooks/speed-to-lead", icon: BookOpen }] },
          { text: "No answer? Text them right away.", buttons: [{ label: "Copy text", copy: "text-back", icon: MessageCircle }] },
          { text: "Send your Why SpaceMatch link. You'll see when they open it.", buttons: [{ label: "Send link", to: "/why", icon: Link2 }] },
          {
            text: "Send the intake form.",
            buttons: [
              { label: "Seller", to: "/forms?open=seller-intake", icon: ClipboardList },
              { label: "Buyer", to: "/forms?open=buyer-intake", icon: ClipboardList, light: true },
            ],
          },
          { text: "Booked a meeting? Log it.", buttons: [{ label: "Appointments", to: "/appointments", icon: CalendarCheck }] },
        ],
      },
    ],
    muse: "Not sure what to say? Ask Muse",
  },
  {
    id: "appointment",
    label: "Listing appointment",
    sub: "CMA, deck, net sheet",
    icon: Presentation,
    title: "I booked a listing appointment",
    goal: "Walk in with their number and walk out with a signed listing.",
    groups: [
      {
        when: "2 days before",
        steps: [
          { text: "Order the CMA. Add every upgrade they mentioned.", buttons: [{ label: "Price a home", to: "/new", icon: FileBarChart }] },
          { text: "Send the Seller Intake form.", buttons: [{ label: "Send form", to: "/forms?open=seller-intake", icon: ClipboardList }] },
        ],
      },
      {
        when: "Day before",
        steps: [
          { text: "Email the pre-listing package and Seller guide.", buttons: [{ label: "Pre-listing package", to: "/presentations", icon: Presentation }] },
          { text: "Run their net sheet.", buttons: [{ label: "Net sheet", to: "/net-sheet", icon: Calculator }] },
        ],
      },
      {
        when: "At the table",
        steps: [
          {
            text: "Present the deck, then show the seller portal demo: \"this is the page you'll get.\"",
            buttons: [
              { label: "Deck", to: "/presentations", icon: Presentation },
              { label: "Portal demo", to: "/demo/seller", icon: Sparkles, light: true },
            ],
          },
        ],
      },
    ],
    muse: "Practice objections with Muse",
  },
  {
    id: "live",
    label: "My listing is live",
    sub: "Portal, ads, open house",
    icon: Home,
    title: "My listing is live",
    goal: "Keep the seller informed without 20 texts a week.",
    groups: [
      {
        when: "Launch week",
        steps: [
          { text: "Tick off launch steps on the listing. Your seller sees them right away.", buttons: [{ label: "My listings", to: "/listings", icon: Home }] },
          { text: "Order ads from the listing's Ads & web tab.", buttons: [{ label: "My listings", to: "/listings", icon: Megaphone }, { label: "My ad orders", to: "/ad-orders", icon: FileText, light: true }] },
          {
            text: "Tell the neighbors: Just Listed postcards and emails.",
            buttons: [
              { label: "Postcards", to: "/mailers", icon: Mail },
              { label: "Neighbor emails", to: "/emails", icon: MailOpen, light: true },
            ],
          },
        ],
      },
      {
        when: "Every week",
        steps: [
          { text: "Open house: show the sign-in QR at the door. Sign-ins go to the Hub inbox and update the seller page count.", buttons: [{ label: "Sign-in QR", to: "/forms?open=open-house-signin", icon: ClipboardList }] },
          { text: "Approve showing feedback on the listing's Activity tab before the seller sees it.", buttons: [{ label: "My listings", to: "/listings", icon: Home }] },
        ],
      },
      {
        when: "Day 14 and no offers",
        steps: [
          {
            text: "Order an updated CMA and have the price talk with data.",
            buttons: [
              { label: "Price a home", to: "/new", icon: FileBarChart },
              { label: "Pricing talk", to: "/playbooks/pricing", icon: BookOpen, light: true },
            ],
          },
        ],
      },
    ],
    muse: "Prep the price talk with Muse",
  },
  {
    id: "buyer",
    label: "Buyer client",
    sub: "Intake, lender, offer",
    icon: Users,
    title: "I have a buyer",
    goal: "Pre-approved and signed before you tour. Know the walk-away number before you offer.",
    groups: [
      {
        when: "Before tours",
        steps: [
          { text: "Send Buyer Intake to get their areas, budget and timeline.", buttons: [{ label: "Send form", to: "/forms?open=buyer-intake", icon: ClipboardList }] },
          {
            text: "Introduce a lender and send the Buyer guide.",
            buttons: [
              { label: "Lenders", to: "/resources?cat=Lenders", icon: Users },
              { label: "Buyer guide", to: "/presentations?guide=buyer", icon: Presentation, light: true },
            ],
          },
          {
            text: "Run the buyer consult and sign the buyer rep agreement.",
            buttons: [
              { label: "Buyer consult", to: "/playbooks/buyer-consultation", icon: BookOpen },
              { label: "Templates", to: "/templates", icon: FileText, light: true },
            ],
          },
          { text: "After tours, send the Tour Check-in form.", buttons: [{ label: "Tour Check-in", to: "/forms?open=buyer-tour-feedback", icon: ClipboardList }] },
        ],
      },
      {
        when: "Ready to offer",
        steps: [
          { text: "Order a CMA for offer support: open, suggested and walk-away price.", buttons: [{ label: "Price a home", to: "/new", icon: FileBarChart }] },
          {
            text: "Collect the offer details and follow the Illinois offer playbook.",
            buttons: [
              { label: "Offer form", to: "/forms?open=buyer-offer", icon: ClipboardList },
              { label: "Offers in IL", to: "/playbooks/offers-illinois", icon: BookOpen, light: true },
            ],
          },
        ],
      },
    ],
    muse: "Ask Muse how to handle a buyer question",
  },
  {
    id: "rental",
    label: "Rental client",
    sub: "100% rentals, lease CMA",
    icon: Building2,
    title: "I have a rental client",
    goal: "Get paid a full month or more, and fill units fast.",
    groups: [
      {
        when: "Renter",
        steps: [
          { text: "Send Renter Intake, then Rental Application Prep.", buttons: [{ label: "Renter Intake", to: "/forms?open=renter-intake", icon: ClipboardList }, { label: "Application prep", to: "/forms?open=renter-application-prep", icon: ClipboardList, light: true }] },
          { text: "Before you tour, check which buildings pay 100% or more, and which don't pay.", buttons: [{ label: "100% rentals", to: "/commission-rentals", icon: Building2 }] },
          { text: "Approved? Send Lease & Move-in.", buttons: [{ label: "Move-in form", to: "/forms?open=renter-move-in", icon: ClipboardList }] },
        ],
      },
      {
        when: "Landlord",
        steps: [
          { text: "Order a lease CMA: rent range and suggested asking rent.", buttons: [{ label: "Lease CMA", to: "/lease", icon: Landmark }] },
          { text: "Send Landlord Intake, then Rental Listing Details.", buttons: [{ label: "Landlord Intake", to: "/forms?open=landlord-intake", icon: ClipboardList }] },
          { text: "Follow the leasing playbook for screening and signing.", buttons: [{ label: "Leasing playbook", to: "/playbooks/leasing", icon: BookOpen }] },
        ],
      },
    ],
    muse: "Ask Muse about a rental question",
  },
  {
    id: "market",
    label: "Market myself",
    sub: "Reels, postcards, reviews",
    icon: Megaphone,
    title: "Market myself",
    goal: "Be the name people in your area recognize.",
    groups: [
      {
        steps: [
          { text: "Pick your area. Get the owners most likely to sell in a ZIP or building.", buttons: [{ label: "Seller lists", to: "/seller-lists?mode=mail", icon: Target }] },
          { text: "Mail them postcards with your photo. Every QR scan becomes a lead.", buttons: [{ label: "Postcards", to: "/mailers", icon: Mail }] },
          {
            text: "Show up on social with Reels from your own clips or our branded B-roll.",
            buttons: [
              { label: "Make a Reel", to: "/reels", icon: Clapperboard },
              { label: "My videos", to: "/my-videos", icon: Camera, light: true },
              { label: "B-Roll", to: "/broll", icon: Film, light: true },
            ],
          },
          { text: "Send your Why SpaceMatch link to people who are still deciding.", buttons: [{ label: "Send link", to: "/why", icon: Link2 }] },
          {
            text: "Look the part: your business card, email signature and the Just Listed / Just Sold neighbor emails.",
            buttons: [
              { label: "Business card", to: "/card", icon: CreditCard },
              { label: "Email signature", to: "/signature", icon: PenLine, light: true },
              { label: "Neighbor emails", to: "/emails", icon: MailOpen, light: true },
            ],
          },
        ],
      },
      {
        when: "Every month",
        steps: [
          { text: "Post 4 times. Ideas, what to film and captions are ready.", buttons: [{ label: "Post ideas", to: "/post-ideas", icon: Lightbulb }] },
          { text: "Share your area's market numbers as a video, post and text.", buttons: [{ label: "Market update kit", to: "/market-update", icon: LineChart }] },
          { text: "Host an open house on a team listing to meet buyers.", buttons: [{ label: "Open house calendar", to: "/open-houses", icon: CalendarDays }] },
        ],
      },
      {
        when: "Stay in touch",
        steps: [
          { text: "Text past clients what's due this month: anniversaries, holidays, check-ins.", buttons: [{ label: "Past clients", to: "/past-clients", icon: Heart }] },
          { text: "Ask every closed client for a Google review.", buttons: [{ label: "Google reviews", to: "/reviews", icon: Star }] },
        ],
      },
    ],
    muse: "Ask Muse for a post idea",
  },
];

export const momentById = (id: string) => MOMENTS.find(m => m.id === id);
