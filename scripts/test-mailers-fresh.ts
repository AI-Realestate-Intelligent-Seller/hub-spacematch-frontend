import { runTest } from "./auth";
import { mkdirSync, readFileSync } from "node:fs";

const designs = [
  ["fixorsell", "fix-or-sell plan"],
  ["movetiming", "move-timing plan"],
  ["rightsize", "next-chapter plan"],
  ["landlord", "rental-exit review"],
  ["inherited", "property next-steps checklist"],
  ["soldashland", "selling plan for my home"],
  ["soldoverlook", "selling plan for my home"],
] as const;
const out = process.env.MAILER_TEST_OUT ?? "/work/data/mailers/postcards-five/proofs";
mkdirSync(out, { recursive: true });

runTest("Seller offers and verified team-sale postcards", async helper => {
  const { page } = helper;
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await helper.goto("/mailers?path=print");
  await page.getByTestId("design-inherited").waitFor({ timeout: 25000 });
  if (await page.locator('[data-testid^="design-"]').count() < 15) throw new Error("Missing postcard options");
  const old = ["staging", "value", "launch", "team", "buyers", "netsheet", "market", "spring"];
  for (const d of [...old, ...designs.map(([d]) => d)]) {
    const card = page.getByTestId(`design-${d}`);
    if (!await card.count()) throw new Error(`Missing ${d}`);
    const image = card.locator("img");
    await image.scrollIntoViewIfNeeded();
    if (!await image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)) throw new Error(`Broken thumbnail ${d}`);
  }
  await page.screenshot({ path: `${out}/picker-after.png`, fullPage: true });
  await page.evaluate(() => { (window as unknown as { open: () => null }).open = () => null; });

  for (const [d, offer] of designs) {
    const proof = page.waitForEvent("download", { timeout: 45000 });
    await page.getByTestId(`proof-${d}`).click();
    await (await proof).saveAs(`${out}/${d}-sample.pdf`);
    console.log("SAMPLE_PROOF", d);
    const card = page.getByTestId(`design-${d}`);
    await card.getByRole("button", { name: "Flip card" }).click();
    if (!await card.locator("img").evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)) {
      await card.locator("img").evaluate((el: HTMLImageElement) => el.decode());
    }
    await card.getByRole("button", { name: "Flip card" }).click();
    await card.getByText("Use this", { exact: true }).click();
    await page.getByTestId("mailer-file").setInputFiles("scripts/fixtures/atn_sample.csv");
    await page.getByTestId("mailer-stats").waitFor({ timeout: 15000 });
    await page.getByTestId("mailer-name").fill(`E2E fresh ${d}`);
    const printed = page.waitForEvent("download", { timeout: 60000 });
    await page.getByTestId("mailer-create").click();
    await (await printed).saveAs(`${out}/${d}-campaign.pdf`);
    await page.locator("td.font-mono").first().waitFor({ timeout: 15000 });
    const code = (await page.locator("td.font-mono").first().innerText()).trim();

    const wp = page.getByTestId("mailer-wp").last();
    await wp.locator("button").first().click();
    const pngDownload = page.waitForEvent("download", { timeout: 60000 });
    await page.getByTestId("mailer-wp-front").click();
    const pngPath = `${out}/${d}-wp.png`;
    await (await pngDownload).saveAs(pngPath);
    const bytes = readFileSync(pngPath);
    if (bytes.readUInt32BE(16) !== 2550 || bytes.readUInt32BE(20) !== 1650 || bytes.indexOf("pHYs") < 0) {
      throw new Error(`Invalid Wise Pelican export for ${d}`);
    }
    console.log("CAMPAIGN_AND_WP", d, code, "2550x1650");

    await helper.goto(`/v/${code}`);
    await page.getByTestId("mailer-kicker").waitFor({ timeout: 15000 });
    const want = await page.locator("#want").inputValue();
    if (!want.toLowerCase().includes(offer)) throw new Error(`Wrong real-code request ${d}: ${want}`);
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw new Error(`Mobile overflow ${d}`);
    if (d === "fixorsell") {
      await page.getByText("Just curious", { exact: true }).click();
      await page.locator("#nm").fill("Fresh Postcard Test");
      await page.locator("#em").fill("postcard-fresh-e2e@example.com");
      await page.getByTestId("mailer-submit").click();
      await page.getByTestId("mailer-done").waitFor({ timeout: 15000 });
      if (!(await page.getByTestId("mailer-done").innerText()).includes(offer)) throw new Error("Wrong reply confirmation");
    }
    await page.screenshot({ path: `${out}/${d}-landing-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });

    // Sample QRs must preserve the offer too, with no real submission.
    await helper.goto(`/v/SAMPLE?d=${d}&a=michael-kang`);
    await page.getByTestId("mailer-kicker").waitFor({ timeout: 15000 });
    if (!(await page.locator("#want").inputValue()).toLowerCase().includes(offer)) throw new Error(`Wrong sample offer ${d}`);

    await helper.goto("/mailers?path=print");
    await page.getByTestId("tab-mine").click();
    const row = page.getByTestId("mailer-campaign").filter({ hasText: `E2E fresh ${d}` }).first();
    await row.waitFor({ timeout: 15000 });
    await row.locator("button").first().click();
    page.once("dialog", dlg => dlg.accept());
    await page.getByText("Delete mailing", { exact: true }).click();
    await page.getByTestId("mailer-tutorial").waitFor({ timeout: 15000 });
    await helper.goto("/mailers?path=print");
    await page.getByTestId("design-inherited").waitFor({ timeout: 15000 });
    await page.evaluate(() => { (window as unknown as { open: () => null }).open = () => null; });
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  console.log("ALL_SEVEN_PASSED: sample PDFs, backend campaigns, print PDFs, WP PNGs, real/sample offer routing, mobile layout");
}).catch(() => process.exit(1));
