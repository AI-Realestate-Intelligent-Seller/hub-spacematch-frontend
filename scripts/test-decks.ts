// Unit test for the browser deck builder: serves /decks/* from public/ via a fetch stub.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { buildDeck } from "../src/lib/deckBuilder";
const out = process.env.OUT ?? "/tmp/decks";
mkdirSync(out, { recursive: true });
(globalThis as any).fetch = async (u: string) => {
  const b = readFileSync("public" + u);
  return new Response(b, { status: 200 });
};
const agents = [
  { name: "Angel Zhang", email: "angel@spacematchinc.com", phone: "(312) 479-2800" },
  { name: "New Person", email: "new.person@spacematchinc.com", phone: "(312) 555-0100" },
];
for (const kind of ["pre", "appt", "full"] as const) for (const edition of ["cb", "real"] as const) {
  const a = kind === "appt" && edition === "real" ? agents[1] : agents[0];
  const t = Date.now();
  const pdf = await buildDeck({ kind, edition, agent: a, seller: kind === "full" ? "" : "Jane & Tom Smith", address: kind === "full" ? "" : "1641 Alexis Ct, Glenview", date: "2026-10-30" });
  writeFileSync(`${out}/${kind}_${edition}.pdf`, pdf);
  console.log(kind, edition, a.name, (pdf.length / 1e6).toFixed(2) + "MB", Date.now() - t + "ms");
}
