// Page path → Hub area for the adoption scoreboard (keep labels in sync with convex/adoption.ts AREAS).
const MAP: [string, string][] = [
  ["/home", "Home"], ["/tools", "Home"], ["/do", "Home"], ["/new", "CMA"], ["/requests", "CMA"], ["/lease", "CMA"],
  ["/forms", "Forms"], ["/inbox", "Inbox"], ["/listings", "Listings"], ["/resources", "Vendors"], ["/commission-rentals", "100% rentals"],
  ["/why", "Why SpaceMatch"], ["/mailers", "Mailers"], ["/seller-lists", "Seller lists"], ["/presentations", "Decks & guides"],
  ["/templates", "Templates"], ["/playbooks", "Playbooks"], ["/training", "Academy"], ["/growth", "Growth"],
  ["/broll", "B-roll"], ["/my-videos", "My videos"], ["/reels", "Reel Studio"], ["/ad-orders", "Ad orders"], ["/help", "Help"],
  ["/feedback", "Feedback"], ["/announcements", "Announcements"], ["/announce", "Announcements"],
  ["/guide", "Guide"], ["/reviews", "Market myself"], ["/card", "Market myself"], ["/open-houses", "Market myself"], ["/past-clients", "Market myself"], ["/post-ideas", "Market myself"], ["/market-update", "Market myself"], ["/muse", "Muse coach"], ["/settings", "Settings"],
];

export function areaOf(path: string): string | null {
  for (const [p, a] of MAP) if (path === p || path.startsWith(`${p}/`)) return a;
  return null;
}
