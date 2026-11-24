// Agent feedback on the Hub ("Suggest a fix or add-on", Michael 2026-10-18).
// Shared FE/BE: kinds, app areas, categories, statuses, keyword auto-category.
// Viktor re-categorizes, merges duplicates and estimates cost in the weekly review.

export const FEEDBACK_KINDS = [
  { id: "fix", label: "Fix something", sub: "Broken, wrong or confusing" },
  { id: "improve", label: "Make it better", sub: "Easier, faster, clearer" },
  { id: "addon", label: "Add-on idea", sub: "Something new the Hub should do" },
] as const;

export const FEEDBACK_AREAS = [
  "Home & Today",
  "CMA requests",
  "Forms & Inbox",
  "Listings & seller page",
  "Ads & analytics",
  "Vendors",
  "Templates, decks & playbooks",
  "Help requests & support",
  "Growth Playbook",
  "Sign-in, phone app & speed",
  "Something not in the Hub yet",
] as const;

export const FEEDBACK_CATEGORIES: Record<string, string> = {
  bug: "Bug / broken",
  ease: "Easier to use / design",
  feature: "New feature / add-on",
  integration: "Connect another tool",
  content: "Content: forms, templates, vendors",
  training: "Question / training (not an app change)",
};

// Agent-facing labels. new → reviewed (in Michael's weekly update) → approved → building → shipped.
export const FEEDBACK_STATUS: Record<string, string> = {
  new: "Submitted",
  reviewed: "In review",
  approved: "Approved",
  building: "Being built",
  shipped: "Live",
  later: "Not now",
  declined: "Declined",
  merged: "Merged",
};
export const FEEDBACK_OPEN = ["new", "reviewed", "approved", "building"];

const INTEGRATION_RE = /\b(lofty|mls|mred|connectmls|dotloop|zillow|showingtime|instagram|facebook|meta|google ads|calendar|gmail|rezen|real broker|zenlist|canva|giraffe|quickbooks|sync|connect|integrat)/i;
const BUG_RE = /\b(broken|bug|error|crash|doesn'?t work|does not work|not working|won'?t|can'?t|cannot|wrong|missing|fail|stuck|blank|slow|freez|404|glitch)/i;
const CONTENT_RE = /\b(form|template|vendor|lender|inspector|contractor|doc|document|checklist|script|playbook|deck|flyer)/i;
const TRAINING_RE = /\b(how do i|how to|where (is|do)|what is|\?$)/i;

export function autoCategory(kind: string, area: string, text: string): string {
  const t = text.trim();
  if (kind === "fix" || BUG_RE.test(t)) return kind === "addon" ? "feature" : "bug";
  if (TRAINING_RE.test(t) && kind !== "addon") return "training";
  if (INTEGRATION_RE.test(t)) return "integration";
  if (kind === "improve") return "ease";
  if (CONTENT_RE.test(t) || area === "Vendors" || area === "Templates, decks & playbooks") return "content";
  return "feature";
}
