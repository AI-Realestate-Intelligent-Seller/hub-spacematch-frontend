// Offline proofs using exactly the production PDF/Lob builder, never live mailing.
// bun run scripts/render-mailer-samples.ts <output-dir> <https://live-hub-url> [design,...]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as pdfLib from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { buildMailers, DESIGNS, SAMPLE_HOUSEHOLD, type DesignId } from "../src/lib/mailerBuilder";

async function main() {
  const [output, origin, selection = "fixorsell,movetiming,rightsize,landlord,inherited"] = process.argv.slice(2);
  if (!output || !origin || !origin.startsWith("https://")) {
    throw new Error("Provide an output directory and the HTTPS live Hub origin");
  }
  const url = new URL(origin);
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) throw new Error("Proof QRs need a live Hub URL");
  const keys = selection.split(",") as DesignId[];
  if (keys.some(id => !DESIGNS.some(d => d.id === id))) throw new Error("Unknown design");
  await mkdir(output, { recursive: true });
  for (const design of keys) {
    const input = {
      design,
      agent: { name: "Michael Kang", phone: "(773) 985-7153", email: "michael@spacematchinc.com" },
      households: [SAMPLE_HOUSEHOLD],
      baseUrl: `${url.origin}/v/`,
      qrQuery: `?d=${design}&a=michael-kang`,
      load: async (path: string) => new Uint8Array(await readFile(resolve(import.meta.dir, "../public", path.replace(/^\//, "")))),
      libs: { pdfLib, fontkit },
    };
    await writeFile(resolve(output, `${design}-sample.pdf`), await buildMailers(input));
    const lob = await buildMailers({ ...input, sides: [1], lob: true });
    await writeFile(resolve(output, `${design}-lob-back.pdf`), lob);
    console.log("SAMPLE_AND_LOB_BACK", design, input.baseUrl);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
