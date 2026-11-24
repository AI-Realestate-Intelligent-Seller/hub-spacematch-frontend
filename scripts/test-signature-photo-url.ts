// Unit check (bun scripts/test-signature-photo-url.ts): a headshot uploaded on the Team roster screen is a full
// https link and must be used as-is; Hub files (/media/sig/...) get the hub address in front. Cris 11-23: Rada's
// signature showed no photo because the roster link was glued onto https://hub.spacematchinc.com.
import { NO_LINKS, buildSignature, type SigInput } from "../src/lib/emailSignature";

const base: SigInput = { name: "Rada Chapkis", title: "Broker", cell: "(224) 343-6767", email: "rada@spacematchinc.com", photo: "", showOffice: true, showStats: true, showCta: true, extra: "", links: NO_LINKS };
const src = (html: string) => /<img src="([^"]+)"[^>]*alt="Rada Chapkis"/.exec(html)?.[1];
const roster = "https://astute-greyhound-719.convex.cloud/api/storage/d281a8a3-547a-4d5c-8d88-a3a791e165d1";
const a = src(buildSignature({ ...base, photo: roster }));
if (a !== roster) throw new Error(`roster photo link changed: ${a}`);
const b = src(buildSignature({ ...base, photo: "/media/sig/tarik-hage.jpg" }));
if (b !== "https://hub.spacematchinc.com/media/sig/tarik-hage.jpg") throw new Error(`hub photo link wrong: ${b}`);
if (src(buildSignature(base))) throw new Error("photo shown when switched off");
console.log("ok: roster link kept, hub path prefixed, no photo when off");

// Booking link (Cris 11-23: "add her calendly link"): a "Book a consultation with <first name>" line, off when empty.
import { plainSignature } from "../src/lib/emailSignature";
const withCal = buildSignature({ ...base, booking: "calendly.com/rada-spacematchinc" });
if (!withCal.includes('href="https://calendly.com/rada-spacematchinc"') || !withCal.includes("Book a consultation with Rada")) throw new Error("booking line missing");
if (buildSignature(base).includes("Book a consultation")) throw new Error("booking line shown when empty");
if (!plainSignature({ ...base, booking: "https://calendly.com/rada-spacematchinc" }).includes("Book a consultation: https://calendly.com/rada-spacematchinc")) throw new Error("plain text missing booking");
if (buildSignature({ ...base, booking: 'x.com/"><script>' }).includes("<script>")) throw new Error("booking not escaped");
console.log("ok: booking line");
