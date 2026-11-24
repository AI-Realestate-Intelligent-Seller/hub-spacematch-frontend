// Lofty, connectMLS, dotloop first: agents open them daily (Michael 2026-10-18).
// Static hub content: tool links, team support, docs. Edit here, redeploy.
export type Tool = { name: string; href: string; note: string; color: string; icon: string; tags?: string; android?: string; setup?: boolean };

// Android: open the installed app (Play package ids verified 2026-10-18), else the website.
// iOS: plain https links; apps with universal links (Drive, Canva, dotloop) open themselves.
export function toolHref(t: Tool): string {
  if (!t.android || typeof navigator === "undefined" || !/Android/i.test(navigator.userAgent)) return t.href;
  const u = new URL(t.href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=${t.android};S.browser_fallback_url=${encodeURIComponent(t.href)};end`;
}

export const TOOLS: Tool[] = [
  { name: "Lofty CRM", href: "https://crm.lofty.com", note: "Leads, texts, pipeline", color: "#2D6BFF", icon: "/tools/lofty.png", tags: "crm leads chime", android: "com.renren.estate.android", setup: true },
  { name: "connectMLS", href: "https://connectmls.mredllc.com", note: "MRED listings & comps", color: "#0E7C66", icon: "/tools/connectmls.png", tags: "mls mred comps", setup: true },
  { name: "dotloop", href: "https://www.dotloop.com", note: "Contracts & e-sign", color: "#1E9BD7", icon: "/tools/dotloop.png", tags: "contracts loop sign", android: "com.dotloop.mobile", setup: true },
  { name: "ShowingTime", href: "https://www.showingtime.com", note: "Showings & feedback", color: "#E5573F", icon: "/tools/showingtime.png", tags: "showings feedback", android: "com.showingtime.mobile.android", setup: true },
  { name: "reZEN (Real)", href: "https://bolt.therealbrokerage.com", note: "Real Broker transactions", color: "#111111", icon: "/tools/real.png", tags: "real broker rezen commission", setup: true },
  { name: "Follow Up Boss", href: "https://app.followupboss.com", note: "Your own CRM · connect it in Settings to get Hub leads", color: "#1F6FEB", icon: "/tools/fub.png", tags: "crm leads fub follow up boss" },
  { name: "Zenlist", href: "https://zenlist.com", note: "Client search portal", color: "#7A5AF8", icon: "/tools/zenlist.png", tags: "search portal" },
  { name: "Giraffe360", href: "https://dashboard.giraffe360.com", note: "Listing photos, 3D tour & floor plan", color: "#F2A900", icon: "/tools/giraffe360.png", tags: "photos 3d tour floor plan media listing giraffe" },
  { name: "Canva", href: "https://www.canva.com", note: "Flyers & social posts", color: "#00B4C5", icon: "/tools/canva.png", tags: "design flyer marketing", android: "com.canva.editor", setup: true },
  { name: "Team Drive", href: "https://drive.google.com/drive/folders/1fUCkxxpkGF8Dzw6Cg-GIhiojegetxf-O", note: "Agreements & templates", color: "#F4B400", icon: "/tools/drive.png", tags: "drive templates agreements docs", android: "com.google.android.apps.docs", setup: true },
  { name: "Crexi", href: "https://www.crexi.com", note: "Commercial listings (team@ login — ask Michael)", color: "#1D3557", icon: "/tools/crexi.png", tags: "commercial" },
  { name: "CoStar", href: "https://www.costar.com", note: "Commercial data (seat from Michael)", color: "#C8102E", icon: "/tools/costar.png", tags: "commercial" },
  { name: "spacematchinc.com", href: "https://spacematchinc.com", note: "Team website", color: "#9C7434", icon: "/tools/spacematch.png", tags: "website" },
];

export type Doc = { name: string; href: string; note: string; tags?: string };

export const DOCS: Doc[] = [
  { name: "Growth Playbook (90-day plan)", href: "/growth", note: "45 minutes a day · check items off, track your progress", tags: "training plan new agent growth 90 day checklist progress" },
  { name: "Pay-at-Closing Lead Sources", href: "https://drive.google.com/file/d/1x3J6B1kwfKkAjC0bWIYHx7rUoWy2gzcI/view", note: "Referral networks, pick and apply", tags: "leads" },
  { name: "Lofty Agent Onboarding Guide", href: "https://docs.google.com/document/d/1HIwVTqCbC91l-Ow_6PQOprzpTunCbxqGksApeBZjV5M", note: "Set up Lofty in 20 minutes", tags: "crm lofty training" },
  { name: "Agreements & Templates", href: "https://drive.google.com/drive/folders/1fUCkxxpkGF8Dzw6Cg-GIhiojegetxf-O", note: "Team agreement, exhibits, templates", tags: "contract agreement" },
  { name: "Cloud CMA packets (per agent)", href: "https://drive.google.com/drive/folders/1e1Fed7pm2oK8PqJ0Q8Njucb7RMQ3QfcM", note: "Your branded CMA pages", tags: "cma cloud" },
  { name: "Mission, Vision, Values & Culture", href: "https://docs.google.com/document/d/1ZLZF8M3ZxofhT2lr4TfpqGUSqZ9yG8Ia2I8ck3uK2b4", note: "Who we are", tags: "culture" },
  { name: "Commercial how-tos (Crexi, Buildout)", href: "https://drive.google.com/drive/folders/1MhN15IMVI_lPdAO3Y7hvD69BqEeq4ugw", note: "Commercial listing guides", tags: "commercial" },
];

export type Person = { name: string; role: string; does: string; phone?: string; email?: string; initials: string; topics: string[]; whatsapp?: boolean };

export const TEAM: Person[] = [
  { name: "Cris Castillo", role: "Operations", does: "dotloop, contracts, MLS help, signs, print, Canva, Instagram", email: "smm@spacematchinc.com", initials: "CC", whatsapp: true, topics: ["dotloop / contracts","MLS input","Sign install / removal","Print & marketing","Canva / Instagram post","Other"] },
  { name: "Anthony “Atom” Arpia", role: "Operations", does: "Lofty access, lead routing, CRM, TC files", email: "tc@spacematchinc.com", initials: "AA", whatsapp: true, topics: ["Lofty access","Lead routing","CRM question","TC / transaction file","Other"] },
  { name: "Michael Kang", role: "Team leader", does: "Pricing, deals, splits, escalations", phone: "(773) 344-0738", email: "michael@spacematchinc.com", initials: "MK", topics: ["Pricing a listing","Deal strategy","Commission / split","Escalation","Other"] },
  { name: "Brandon Banks", role: "Team lead", does: "Training, deals, coaching", phone: "(773) 510-5649", email: "brandon@spacematchinc.com", initials: "BB", topics: ["Deal help","Coaching / role-play","Training","Other"] },
  { name: "Sergio Monjane", role: "Director", does: "Deals, coaching", phone: "(347) 743-4956", email: "sergio.monjane@spacematchinc.com", initials: "SM", topics: ["Deal help","Coaching","Other"] },
];

export const TEAM_LINE = "(773) 985-7153";

export const telHref = (p?: string) => (p ? `tel:${p.replace(/[^\d+]/g, "")}` : undefined);
export const smsHref = (p?: string, body?: string) =>
  p ? `sms:${p.replace(/[^\d+]/g, "")}${body ? `?&body=${encodeURIComponent(body)}` : ""}` : undefined;
