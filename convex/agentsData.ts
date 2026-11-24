// Roster = SEED_AGENTS below (the original team, in code) merged with the rosterAgents table, which
// the Team roster screen (/team) writes: adds, edits and removals (Michael 2026-11-16 "full").
// AGENTS and REMOVED_EMAILS are live arrays: convex/roster.ts syncRoster(ctx) refreshes them at the
// start of functions (functions.ts wrappers, hubViewer, raw handlers), and the browser gets the
// same list from roster:publicList (src/components/RosterGate.tsx). Never reassign them, only mutate.
export type Agent = {
  name: string;
  email: string;
  phone: string;
  // Only set for agents added or edited on the Team roster screen:
  title?: string;
  lic?: string;
  bio?: string;
  photo?: string; // square JPG URL (Convex storage): meet page, signature, mailers
  folderId?: string; // Drive video upload folder
  added?: boolean; // added on the screen, not in SEED_AGENTS
};

// Former team members: blocked from signing in to the Hub (Michael, 2026-10-27;
// Thalia Mena + Newell Broadway disabled 2026-11-17). Removals on /team add to this at runtime.
const SEED_REMOVED = [
  "nathaniel@spacematchinc.com",
  "thalia.mena@spacematchinc.com",
  "newell@spacematchinc.com",
];
export const REMOVED_EMAILS: string[] = [...SEED_REMOVED];

// Guests: outside emails allowed to sign in and see the Hub as an agent would.
// NOT in AGENTS, so they never appear in client pickers, lead routing, the Lead Desk,
// mailers, adoption or "all agents" emails (Michael, 2026-10-29: Mir = his developer).
export const GUESTS: Record<string, string> = {
  "mirmurtaza@gmail.com": "Mir Murtaza",
  "m.haseeb25122003@gmail.com": "Haseeb",
};
export const isGuestEmail = (email?: string | null) =>
  !!email && Object.prototype.hasOwnProperty.call(GUESTS, email.trim().toLowerCase());

const SEED_AGENTS: Agent[] = [
  {
    name: "Michael Kang",
    email: "michael@spacematchinc.com",
    phone: "(773) 985-7153",
  },
  {
    name: "Angel Zhang",
    email: "angel@spacematchinc.com",
    phone: "(312) 479-2800",
  },
  {
    name: "Brandon Banks",
    email: "brandon@spacematchinc.com",
    phone: "(773) 510-5649",
  },
  {
    name: "Brendan Murphy",
    email: "brendan@spacematchinc.com",
    phone: "(773) 879-2437",
  },
  {
    name: "Cynthia Beltran",
    email: "cynthiabeltran.realtor@spacematchinc.com",
    phone: "(312) 981-5500",
  },
  {
    name: "Eduardo Rodriguez",
    email: "eduardo@spacematchinc.com",
    phone: "(954) 708-8821",
  },
  {
    name: "Emilie Rose Danno",
    email: "emilierose.danno@spacematchinc.com",
    phone: "(630) 917-8805",
  },
  {
    name: "Jennifer Guevara",
    email: "jennifer.guevara@spacematchinc.com",
    phone: "(847) 721-8091",
  },
  {
    name: "Matthew Davila",
    email: "matthewdavila@spacematchinc.com",
    phone: "(224) 420-2434",
  },
  {
    name: "Rob Robinson",
    email: "rob@spacematchinc.com",
    phone: "(773) 957-3784",
  },
  {
    name: "Sabina Hodzic",
    email: "sabina@spacematchinc.com",
    phone: "(312) 684-3177",
  },
  {
    name: "Sein Shin",
    email: "sein@spacematchinc.com",
    phone: "(702) 762-2218",
  },
  {
    name: "Sergio Monjane",
    email: "sergio.monjane@spacematchinc.com",
    phone: "(347) 743-4956",
  },
  {
    name: "Shagha Mughtadai",
    email: "shagha@spacematchinc.com",
    phone: "(773) 590-7147",
  },
  {
    name: "Shan Keter White-Henderson",
    email: "shan@spacematchinc.com",
    phone: "(414) 439-9863",
  },
  {
    name: "Susan Strange",
    email: "susan.strange@spacematchinc.com",
    phone: "(773) 742-4918",
  },
  {
    name: "Tarik Hage",
    email: "tarik@spacematchinc.com",
    phone: "(630) 209-6111",
  },
];

export const AGENTS: Agent[] = SEED_AGENTS.map(a => ({ ...a }));

export type RosterRow = {
  email: string;
  name: string;
  phone: string;
  status: string; // active | removed
  title?: string;
  lic?: string;
  bio?: string;
  photoUrl?: string;
  folderId?: string;
};

const byName = (a: Agent, b: Agent) =>
  a.email === "michael@spacematchinc.com" ? -1 : b.email === "michael@spacematchinc.com" ? 1 : a.name.localeCompare(b.name);

/** Rebuild AGENTS + REMOVED_EMAILS in place from the seed and the rosterAgents rows. */
export function applyRoster(rows: RosterRow[]) {
  const byEmail = new Map(rows.map(r => [r.email.toLowerCase(), r]));
  const seedEmails = new Set(SEED_AGENTS.map(a => a.email.toLowerCase()));
  const next: Agent[] = [];
  for (const a of SEED_AGENTS) {
    const r = byEmail.get(a.email.toLowerCase());
    if (r?.status === "removed") continue;
    next.push(r ? merge({ ...a }, r) : { ...a });
  }
  for (const r of rows) {
    const e = r.email.toLowerCase();
    if (seedEmails.has(e) || r.status !== "active") continue;
    next.push(merge({ name: r.name, email: e, phone: r.phone, added: true }, r));
  }
  next.sort(byName);
  AGENTS.splice(0, AGENTS.length, ...next);
  const removed = new Set(SEED_REMOVED);
  for (const r of rows) {
    const e = r.email.toLowerCase();
    if (r.status === "removed") removed.add(e);
    else removed.delete(e);
  }
  REMOVED_EMAILS.splice(0, REMOVED_EMAILS.length, ...removed);
}

/** Browser: the finished list from roster:publicList. */
export function setAgents(list: Agent[]) {
  AGENTS.splice(0, AGENTS.length, ...list);
}

function merge(a: Agent, r: RosterRow): Agent {
  if (r.name) a.name = r.name;
  if (r.phone) a.phone = r.phone;
  if (r.title) a.title = r.title;
  if (r.lic) a.lic = r.lic;
  if (r.bio) a.bio = r.bio;
  if (r.photoUrl) a.photo = r.photoUrl;
  if (r.folderId) a.folderId = r.folderId;
  return a;
}

export const isSeedAgent = (email: string) => SEED_AGENTS.some(a => a.email.toLowerCase() === email.toLowerCase());

export const agentSlug = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const agentBySlug = (slug?: string | null) =>
  slug ? AGENTS.find(a => agentSlug(a.name) === slug.toLowerCase()) : undefined;

export const agentByEmail = (email?: string | null) =>
  email ? AGENTS.find(a => a.email.toLowerCase() === email.toLowerCase()) : undefined;

// Admins see everything: Michael's logins + Brandon + Sergio (Michael, 2026-10-18).
// Cris (smm@) + Atom (tc@) get team forms.
export const ADMIN_EMAILS = ["team@spacematchinc.com", "michael@spacematchinc.com", "brandon@spacematchinc.com", "sergio.monjane@spacematchinc.com"];
// Developers with the full admin view (Michael 2026-11-03 "give the developers full access").
// Kept out of ADMIN_EMAILS so they never receive admin notifications, own website requests,
// bypass the CMA cap or post team-wide announcements.
export const DEV_ADMIN_EMAILS = ["mirmurtaza@gmail.com", "m.haseeb25122003@gmail.com"];
export const isAdminEmail = (email?: string | null) => {
  const e = (email ?? "").trim().toLowerCase();
  return !!e && (ADMIN_EMAILS.includes(e) || DEV_ADMIN_EMAILS.includes(e));
};
export const OPS_EMAILS = ["smm@spacematchinc.com", "tc@spacematchinc.com"];
// New Leads tracker: ONLY Michael, Cristina (smm@), Anthony (tc@) + the developers. Not Brandon/Sergio (Michael 2026-11-09).
export const NEW_LEADS_EMAILS = ["team@spacematchinc.com", "michael@spacematchinc.com", ...OPS_EMAILS, ...DEV_ADMIN_EMAILS];
export const TEAM_COPY_EMAIL = "team@spacematchinc.com";
