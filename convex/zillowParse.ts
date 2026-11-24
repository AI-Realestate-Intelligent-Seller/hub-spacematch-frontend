// Parses Zillow "Your Daily Listing Report: <address>" emails (sender
// my-listing@mail.zillow.com). Plain code, no AI. The numbers only exist in the
// HTML part, e.g. "Wednesday you had... 72 Views 4 Saves". Shared by the
// backend scanner and the tests.

export type ZillowDaily = { address: string; day: string; views: number; saves: number };

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function htmlToText(h: string): string {
  const t = h
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|td|h\d|li|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&rsquo;|&#8217;/gi, "'")
    .replace(/&[a-z]+;|&#\d+;/gi, " ");
  return t.replace(/[ \t\u00a0\u200b-\u200f\u034f\u00ad\ufeff]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

const num = (s: string) => Number(s.replace(/,/g, ""));

/**
 * @param subject original or forwarded subject ("Fwd: Your Daily Listing Report: …")
 * @param text    HTML part converted with htmlToText (plain text also works if it has the numbers)
 * @param sentAt  email date (ms). The report covers the named weekday before it.
 */
export function parseZillowDaily(subject: string, text: string, sentAt: number): ZillowDaily | null {
  if (!/daily listing report/i.test(subject) && !/daily listing report/i.test(text)) return null;
  const flat = text.replace(/\s+/g, " ");
  const m = flat.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday) you had\W*([\d,]+) views? ([\d,]+) saves?\b/i);
  if (!m) return null;
  let address = (flat.match(/listing report is here for (.+?)\s?\.(?:\s|$)/i)?.[1] ?? "").trim();
  if (!address) address = (subject.match(/daily listing report:\s*(.+)$/i)?.[1] ?? "").trim();
  address = address.replace(/\s+/g, " ").replace(/\s+,/g, ",");
  if (!address) return null;
  // Chicago calendar date of the email (UTC-6 is close enough for a morning email),
  // then step back to the named weekday (the report is about an earlier day).
  const want = DAYS.indexOf(m[1].toLowerCase());
  const base = new Date(sentAt - 6 * 3600e3);
  let day = "";
  for (let k = 1; k <= 7; k++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - k));
    if (d.getUTCDay() === want) { day = d.toISOString().slice(0, 10); break; }
  }
  return { address, day, views: num(m[2]), saves: num(m[3]) };
}

/** Gmail API "full" payload → decoded HTML (or plain text) body. */
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
export function gmailBody(payload: Part | undefined): string {
  const found: Record<string, string> = {};
  const walk = (p?: Part) => {
    if (!p) return;
    const mt = (p.mimeType ?? "").toLowerCase();
    if ((mt === "text/html" || mt === "text/plain") && p.body?.data && !found[mt]) found[mt] = b64urlUtf8(p.body.data);
    for (const c of p.parts ?? []) walk(c);
  };
  walk(payload);
  if (found["text/html"]) return htmlToText(found["text/html"]);
  return found["text/plain"] ?? "";
}

function b64urlUtf8(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** "(#123456789) Gmail Forwarding Confirmation - Receive Mail from a@b.com" */
export function parseForwardingConfirmation(subject: string): { code: string; from: string } | null {
  const m = subject.match(/\(#(\d{6,12})\)\s*Gmail Forwarding Confirmation\s*-\s*Receive Mail from\s+(\S+@\S+)/i);
  return m ? { code: m[1], from: m[2].toLowerCase().replace(/[>)]+$/, "") } : null;
}
