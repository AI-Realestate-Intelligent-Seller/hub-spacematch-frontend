// Hub information architecture (Michael 2026-10-29, #team-app-design 1793285849.414399):
// 5 areas = the 5 tabs. Each area has plain-named pages shown as chips under the
// header, each with a one-line purpose so agents know what a page is for.
import {
  BookOpen,
  Building2,
  Clapperboard,
  Home,
  Users,
} from "lucide-react";

export type AreaPage = { to: string; label: string; purpose: string; also?: string[]; isNew?: boolean };
export type Area = {
  id: "today" | "clients" | "listings" | "marketing" | "learn";
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  pages: AreaPage[];
  badge?: boolean;
};

export const AREAS: Area[] = [
  { id: "today", label: "Today", to: "/home", icon: Home, pages: [] },
  {
    id: "clients",
    label: "Clients",
    to: "/inbox",
    icon: Users,
    badge: true,
    pages: [
      { to: "/inbox", label: "Inbox", purpose: "Forms your clients sent back. Call new ones within the hour." },
      { to: "/commission-rentals", label: "100% rentals", purpose: "Chicago rental buildings that pay you a full month's rent or more, plus a list of the ones that don't pay. The stamp means the office confirmed it." },
      { to: "/emails", label: "Emails", purpose: "Ready-to-send emails for every client group, plus rent-vs-own and move-up emails with their numbers." },
      { to: "/forms", label: "Send a form", purpose: "Text or email a client a form: seller intake, showing request, offer and more." },
      { to: "/appointments", label: "Appointments", purpose: "Appointments the team booked for you. Accept them and log how they went." },
      { to: "/resources", label: "Vendors", purpose: "Lenders, inspectors, contractors and movers to refer your clients to." },
    ],
  },
  {
    id: "listings",
    label: "Listings",
    to: "/listings",
    icon: Building2,
    pages: [
      { to: "/listings", label: "My listings", purpose: "Each listing gets a live launch page your seller can open anytime." },
      { to: "/new", label: "Price a home", purpose: "Send an address and get a branded CMA (pricing report) back in about an hour.", also: ["/requests", "/lease"] },
      { to: "/net-sheet", label: "Net sheet", purpose: "What a seller walks away with after commission, transfer taxes, title and payoff." },
      { to: "/presentations", label: "Listing decks", purpose: "Pre-listing package and listing appointment deck, already branded for you." },
      { to: "/ad-orders", label: "Ads", purpose: "Ads you ordered for a listing and what you owe. Order from a listing's Ads & web tab." },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    to: "/reels",
    icon: Clapperboard,
    pages: [
      { to: "/reels", label: "Make a Reel", purpose: "Send your clips. Our editor sends back a finished Reel." },
      { to: "/signature", label: "Email signature", purpose: "Your own SpaceMatch and Real email signature with your photo, cell and social links. Copy and paste into Gmail.", isNew: true },
      { to: "/seller-lists", label: "Seller lists", purpose: "Mail a ZIP code or a whole building, no listing needed. We find the owners most likely to sell and the best postcard for each." },
      { to: "/mailers", label: "Postcards", purpose: "Jumbo seller postcards with your photo and a tracked QR code." },
      { to: "/my-videos", label: "My videos", purpose: "Upload raw clips and get your edited videos back." },
      { to: "/broll", label: "B-Roll clips", purpose: "Branded clips for your own Reels, with your name bar and end card." },
      { to: "/why", label: "Why SpaceMatch link", purpose: "On a call? Text a seller your branded pitch page and see when they open it." },
    ],
  },
  {
    id: "learn",
    label: "Learn",
    to: "/guide",
    icon: BookOpen,
    pages: [
      { to: "/guide", label: "What to do when", purpose: "Pick the situation (new lead, listing appointment, open house) and get the steps." },
      { to: "/muse", label: "Muse coach", purpose: "Ask \"what do I say?\" before an appointment. Our playbooks in your pocket." },
      { to: "/playbooks", label: "Playbooks", purpose: "Step-by-step scripts for every stage of a deal." },
      { to: "/growth", label: "90-day plan", purpose: "45 minutes a day. Check items off and track your progress." },
      { to: "/training", label: "Academy", purpose: "Short training modules. Finish a track to get certified." },
      { to: "/templates", label: "Templates", purpose: "Forms, documents, scripts and emails you can copy." },
      { to: "/announcements", label: "News", purpose: "Team announcements from Michael.", also: ["/announce"] },
    ],
  },
];

const match = (path: string, to: string) => path === to || path.startsWith(`${to}/`);

export function areaFor(path: string): { area: Area; page?: AreaPage } | null {
  for (const area of AREAS) {
    for (const page of area.pages) {
      if (match(path, page.to) || page.also?.some(a => match(path, a))) return { area, page };
    }
  }
  if (match(path, "/home")) return { area: AREAS[0] };
  return null;
}
