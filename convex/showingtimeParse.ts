// Parses ShowingTime notification emails (feedback + showing confirmations).
// Plain code, no AI. Login links in these emails are dropped and never stored.
export type ParsedShowing = {
  kind: "feedback" | "showing" | "cancelled";
  address: string;
  mls?: string;
  when?: string; // "Wed, March 24, 2021 11:30 AM"
  interest?: string;
  priceOpinion?: string;
  rating?: string;
  experience?: string;
  comments?: string;
  answers: { q: string; a: string }[];
  buyerAgent?: string; // agent-only, never shown to sellers
};

const stripLinks = (s: string) =>
  s
    .replace(/\[(?:https?|tel|mailto):[^\]]*\]/gi, " ")
    .replace(/\[[^\]\s]+@[^\]\s]+\]/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[ \t]+/g, " ");

export function parseShowingTime(subject: string, body: string): ParsedShowing | null {
  const subj = subject.replace(/^\s*((re|fwd?|fw)\s*:\s*)+/i, "").trim();
  const head = subj.toUpperCase();
  let kind: ParsedShowing["kind"] | null = null;
  if (head.startsWith("FEEDBACK RECEIVED")) kind = "feedback";
  else if (/^(2ND |3RD |\d+TH )?SHOWING CONFIRMED/.test(head)) kind = "showing";
  else if (head.startsWith("SHOWING CANCELLED") || head.startsWith("SHOWING CANCELED")) kind = "cancelled";
  if (!kind) return null;

  const text = stripLinks(body);
  const flat = text.replace(/\s+/g, " ");
  const address = (subj.split("|")[1] ?? "").replace(/\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun),.*$/i, "").trim();
  const mls = flat.match(/(?:MLS|ID)\s*#\s*(\d{6,10})/i)?.[1];
  const date = flat.match(/\b(?:Mon|Tues?|Wed(?:nes)?|Thu(?:rs)?|Fri|Sat(?:ur)?|Sun)[a-z]*,\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}/)?.[0];
  const time = flat.match(/\b\d{1,2}:\d{2}\s?[AP]M(?:\s*-\s*\d{1,2}:\d{2}\s?[AP]M)?/i)?.[0];
  const out: ParsedShowing = { kind, address, mls, when: [date, time].filter(Boolean).join(" ") || undefined, answers: [] };

  if (kind === "feedback") {
    const start = flat.search(/\b1\.\s/);
    const end = flat.search(/Publish to Seller|Manage Feedback|Appointment Details/i);
    const block = start >= 0 ? flat.slice(start, end > start ? end : undefined) : "";
    const parts = block.split(/(?:^|\s)\d{1,2}\.\s/).map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      const m = p.match(/^(.*?(?:\?|:|showing\.|listing\.))\s*(.*)$/i);
      const q = (m ? m[1] : p).trim();
      const a = (m ? m[2] : "").trim();
      out.answers.push({ q, a });
      const ql = q.toLowerCase();
      if (!a) continue;
      if (ql.includes("interested")) out.interest = a;
      else if (ql.includes("price")) out.priceOpinion = a;
      else if (ql.includes("rate this listing")) out.rating = a;
      else if (ql.includes("experience")) out.experience = a;
      else if (ql.includes("comment")) out.comments = a;
    }
    const ba = text.match(/Buyer's Agent Details\s*\n+\s*([^\n]+)\n\s*([^\n]+)/i);
    if (ba) out.buyerAgent = `${ba[1].trim()} (${ba[2].trim()})`;
  }
  return out;
}
