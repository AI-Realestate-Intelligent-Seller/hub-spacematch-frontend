// SpaceMatch Coach file for Meta's Muse (Michael 2026-10-27).
// Built on the agent's device from the Hub's own content (playbooks, scripts, Hub Guide,
// Academy drills, 90-day Growth Playbook), so it always matches what's in the Hub.
// No AI, no server. Add a VERSIONS entry whenever playbook/script/guide content changes
// meaningfully, then post a Hub announcement asking agents to resend the file.
import { GROWTH_LEVELS } from "../../convex/growthDefs";
import { TRAINING_TRACKS } from "../../convex/trainingDefs";
import { SITUATIONS, STAGES, TOOLS_GUIDE } from "./hubGuide";
import { PLAYBOOKS } from "./playbooks";
import { TEAM } from "./hub";
import { SCRIPTS } from "./templates";
import { brokerageLine, OFFICE, TEAM_LINE } from "./whyContent";

// Versions: content date, plus an automatic bump on the Real Broker switch (brokerage line changes).
const VERSIONS: { v: string; label: string }[] = [
  { v: "2026-10-27", label: "Oct 27, 2026" },
  { v: "2026-11-09", label: "Nov 9, 2026" },
  { v: "2026-11-12", label: "Nov 12, 2026" },
];
export function packVersion(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
  return [...VERSIONS].reverse().find(x => x.v <= today) ?? VERSIONS[0];
}
export const MUSE_URL = "https://muse.ai";
export const HUB = "https://hub.spacematchinc.com";
export const MUSE_SENT_KEY = "hub-muse-sent-version";

// Left out on purpose: commission splits, fees and cap details (team agreement) and
// anything lender/deal-specific. An agent keeps their Muse copy if they leave.
const EXCLUDED_PLAYBOOKS = new Set(["team-agreement"]);
const PRIVATE_LINE = /\bsplits?\b|\b\d{2}\s*\/\s*\d{2}\b|admin fee|\bcap year\b|sign-up, \$|\$\d[\d,]*\s*(a year|per transaction)/i;

export type Block =
  | { k: "title"; t: string }
  | { k: "h1"; t: string }
  | { k: "h2"; t: string }
  | { k: "h3"; t: string }
  | { k: "p"; t: string }
  | { k: "li"; t: string }
  | { k: "num"; n: number; t: string };

const clean = (s: string) =>
  s
    .replace(/\*\*/g, "")
    .replace(/<\/?[a-z]*\/?>?$/i, "")
    .replace(/<\/$/, "")
    .trim();

const hubLink = (to?: string, href?: string) =>
  href ? href : to ? `${HUB}${to}` : "";

export function packFileName(firstName: string) {
  const who = firstName.replace(/[^A-Za-z]/g, "");
  return `SpaceMatch-Coach${who ? `-${who}` : ""}.pdf`;
}

/** Message the agent pastes into Muse with the file. Short on purpose. */
export function setupMessage(firstName: string) {
  const me = firstName ? `I'm ${firstName}, a` : "I'm a";
  return [
    `${me} real estate agent on SpaceMatch Inc. in Chicago. The attached file is my team's playbook.`,
    "Please save it to your memory and act as my SpaceMatch Coach from now on: when I ask what to do with a client, a lead, a listing or a deal, answer with our process from the file first and tell me which playbook or script you used.",
    "Keep answers short (what to say, what to do, which Hub page to open) because I'm often in the car or at a showing.",
    "Every weekday at 8am, send me my 3 most important tasks from the 90-day Growth Playbook in the file. Ask me today which level and week I'm on.",
    "Reply \"Coach ready\" when it's saved.",
  ].join("\n\n");
}

/** Copied by the "Ask Muse" buttons on playbooks and Hub Guide situations. */
export function askMusePrompt(title: string, kind: "playbook" | "situation" = "playbook") {
  return kind === "playbook"
    ? `Use my SpaceMatch Coach file. Walk me through the "${title}" playbook step by step for this situation: `
    : `Use my SpaceMatch Coach file. "${title}": tell me what to say and what to do next. Here's what's going on: `;
}

export const TRY_PROMPTS: { label: string; text: string }[] = [
  { label: "Listing appointment in 20 min", text: "Use my SpaceMatch Coach file. I have a listing appointment in 20 minutes: a 2-bed condo in Lakeview, and the seller thinks it's worth $450K. Walk me through our appointment and the 3 questions I should ask first." },
  { label: "Practice an objection", text: "Use my SpaceMatch Coach file. Role-play a seller who says \"Redfin only charges 1%.\" Push back like a real seller, then score my answers against our playbook." },
  { label: "Brand-new lead", text: "Use my SpaceMatch Coach file. A seller lead just came in from a home value request. What do I text right now, and what are my next 3 steps?" },
  { label: "After a showing", text: "Use my SpaceMatch Coach file. I just finished a showing. I'll tell you how it went. Write my follow-up text to the buyer and tell me the next step." },
  { label: "Open house tomorrow", text: "Use my SpaceMatch Coach file. I'm hosting an open house tomorrow. Give me the checklist, what to say at the door, and the same-day follow-up script." },
  { label: "Under contract — what now?", text: "Use my SpaceMatch Coach file. My buyer's offer was just accepted in Illinois. What are the deadlines and the steps for the next 10 days?" },
  { label: "Today's 90-day tasks", text: "Use my SpaceMatch Coach file. What are my 3 tasks from the 90-day Growth Playbook today? Ask me which week I'm on if you don't know." },
];

export const MUSE_RULES: string[] = [
  "No client names, phone numbers, emails, financial documents or MLS exports in Muse. Say \"the seller on Halsted\" instead.",
  "Muse coaches, you decide. Pricing, contract terms and anything legal still go through the playbook and Michael or the managing broker.",
  "Social posts must sound like you: your own photos, your own words, real numbers. Nothing that feels AI-written.",
  "Muse is your personal account. Splits, fees and lender details are not in the file. Ask Michael.",
];

export function buildPack(opts: { name: string; firstName: string; now?: Date }): Block[] {
  const { name, firstName } = opts;
  const now = opts.now ?? new Date();
  const you = firstName || "the agent";
  const B: Block[] = [];
  const h1 = (t: string) => B.push({ k: "h1", t });
  const h2 = (t: string) => B.push({ k: "h2", t });
  const h3 = (t: string) => B.push({ k: "h3", t });
  const p = (t: string) => B.push({ k: "p", t: clean(t) });
  const li = (t: string) => B.push({ k: "li", t: clean(t) });

  B.push({ k: "title", t: "SpaceMatch Coach" });
  p(`${name ? `Prepared for ${name}. ` : ""}Version ${packVersion(now).label}. From the SpaceMatch Agent Hub (${HUB}).`);
  p(`${brokerageLine(now)} · ${OFFICE} · ${TEAM_LINE} · spacematchinc.com`);

  // 1. Instructions for the AI
  h1("1. How to coach me (instructions for Muse)");
  p(`You are ${you}'s SpaceMatch Coach. ${firstName ? `${firstName} is` : "I am"} a real estate agent on SpaceMatch Inc., a residential team in Chicago. This file is the team's playbook.`);
  [
    "Answer from this file first. When there is a SpaceMatch playbook, script or Hub tool for the situation, use it and name it (for example: \"From the Speed-to-Lead playbook\").",
    "Keep it short and in order: 1) what to say, 2) what to do, 3) which Hub page to open (give the link). Three to five steps unless asked for more. The agent is often driving, at a showing or about to walk into an appointment, so make it easy to follow by voice.",
    "For scripts, give the exact wording from the Scripts section, filled in with the details the agent gives you.",
    "Role-play when asked: play the client, push back like a real person, then score the agent against the \"A good answer\" list in the Role-play drills section.",
    "If this file doesn't cover it, say so plainly. Suggest asking the team in the Hub (Get help: Cris, Atom, Brandon, Sergio or Michael). Never invent team policy, prices, fees or legal advice.",
    "Pricing, contract terms, legal and fair-housing questions: give the playbook steps, then remind the agent to confirm with Michael or the managing broker before acting.",
    "Privacy: don't ask for client names, phone numbers, emails, financial documents or MLS exports. If the agent shares them, remind them to use a first initial or the street name instead.",
    "Fair housing: describe the property, never the people. Never call a neighborhood or school good, bad, safe or unsafe. Point to public data sources.",
    "Social media: you can help with ideas and rough captions, but the final post must be in the agent's own voice with real photos and real numbers. No buzzwords, no emoji walls, nothing that feels AI-written.",
    "Daily coaching: on request, run the 90-Day Growth Playbook (section 7). On weekday mornings, send the day's 3 most important tasks. On Fridays, ask for the weekly numbers (posts, conversations, appointments, reviews).",
  ].forEach(li);

  // 2. Team facts
  h1("2. Team facts and who to ask");
  [
    `Team: ${brokerageLine(now)}. Chicago residential real estate.`,
    `Office: ${OFFICE}. Team phone: ${TEAM_LINE}. Website: spacematchinc.com. Agent Hub: ${HUB}.`,
    ...TEAM.map(t => `${t.name.replace(/[“”]/g, '"')} (${t.role}): ${t.does}.`),
    `To ask anyone: Hub › Get help (${HUB}/help). Choose how urgent it is and you'll see the reply there.`,
    "Lofty is the team CRM. If it isn't logged in Lofty, it didn't happen.",
  ].forEach(li);

  // 3. Situations
  h1("3. Situations: what to do right now");
  p("Find the moment that matches, follow the steps, then open the playbook for detail.");
  for (const st of STAGES) {
    const list = SITUATIONS.filter(s => s.stage === st.id);
    if (!list.length) continue;
    h2(st.label);
    for (const s of list) {
      h3(s.title);
      p(`Goal: ${s.goal}`);
      s.steps.forEach((x, i) =>
        B.push({ k: "num", n: i + 1, t: clean(`${x.text}${x.to ? ` (Hub: ${x.label ?? "open"}, ${hubLink(x.to)})` : ""}`) }),
      );
      const pb = s.playbook && PLAYBOOKS.find(x => x.id === s.playbook);
      if (pb) p(`Playbook: ${pb.title}.`);
    }
  }

  // 4. Playbooks
  h1("4. Playbooks");
  p("SpaceMatch's step-by-step processes. Also in the Hub under Playbooks.");
  h3("Team agreement");
  p("Splits, fees and the cap are not in this file. The agent's signed team agreement always wins. Questions about money: ask Michael.");
  for (const pb of PLAYBOOKS) {
    if (EXCLUDED_PLAYBOOKS.has(pb.id)) continue;
    h2(`${pb.title}`);
    p(`Who: ${pb.who}. ${pb.summary}`);
    for (const s of pb.sections) {
      const items = s.items.filter(t => !PRIVATE_LINE.test(t));
      if (!items.length) continue;
      h3(s.h);
      items.forEach(li);
      const links = (s.links ?? []).map(l => `${l.label} (${hubLink(l.to, l.href)})`).filter(Boolean);
      if (links.length) p(`Hub: ${links.join("; ")}`);
    }
  }

  // 5. Scripts
  h1("5. Scripts");
  p("Fill in the {braces} with the details the agent gives you. Keep the wording close; it's been tested.");
  for (const s of SCRIPTS) {
    h3(`${s.title} (${s.group})`);
    p(`When: ${s.use}`);
    p(`Script: "${s.body}"`);
  }

  // 6. Drills
  h1("6. Role-play drills");
  p("When the agent says \"let's practice\" or \"role-play\", use these. Play the partner, then score the agent against the list.");
  for (const t of TRAINING_TRACKS) {
    h3(`${t.title}`);
    p(`Scenario: ${t.drill.scenario}`);
    p(`You play: ${t.drill.partner}`);
    p("A good answer:");
    t.drill.good.filter(g => !PRIVATE_LINE.test(g)).forEach(li);
  }

  // 7. Growth playbook
  h1("7. 90-Day Growth Playbook");
  p("45 minutes a day for 90 days. Progress is tracked in the Hub (Growth Playbook).");
  for (const l of GROWTH_LEVELS) {
    h2(`${l.label}: ${l.title}`);
    p(`Who it's for: ${clean(l.who)}`);
    for (const w of l.weeks) {
      h3(clean(w.title));
      w.items.filter(i => i.id !== "l1-muse").forEach(i => li(i.text));
    }
    if (l.doneWhen) p(`Level done when: ${clean(l.doneWhen)}`);
  }

  // 8. Hub tools
  h1("8. Hub tools: what to use when");
  for (const t of TOOLS_GUIDE.filter(x => x.id !== "muse")) {
    h3(t.name);
    li(`What: ${t.what}`);
    li(`When: ${t.when}`);
    li(`Where: ${t.where} (${hubLink(t.to)})`);
  }

  h1("9. Rules");
  MUSE_RULES.forEach(li);
  return B;
}

/** Plain-text/Markdown version (handy for testing and for agents who prefer text). */
export function packToMarkdown(blocks: Block[]) {
  return blocks
    .map(b =>
      b.k === "title" ? `# ${b.t}` :
      b.k === "h1" ? `\n## ${b.t}` :
      b.k === "h2" ? `\n### ${b.t}` :
      b.k === "h3" ? `\n#### ${b.t}` :
      b.k === "li" ? `- ${b.t}` :
      b.k === "num" ? `${b.n}. ${b.t}` :
      b.t,
    )
    .join("\n");
}
