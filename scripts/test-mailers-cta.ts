import { runTest } from "./auth";

// Original CTA designs remain available as more seller offers and verified sale spotlights are added.
// each new design's sample proof builds, a netsheet mailing builds a print PDF + 6x9 front,
// and the QR landing page repeats that card's ask. Replies use example.com (never pushed to Lofty).
const NEW = ["buyers", "netsheet", "market", "spring"];
runTest("Seller mailers CTA designs", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await helper.goto("/mailers?path=print");
  await page.getByTestId("design-spring").waitFor({ timeout: 20000 });
  const cards = await page.locator('[data-testid^="design-"]').count();
  const offers = await page.locator('[data-testid^="offer-"]').count();
  console.log("CARDS", cards, "OFFERS", offers);
  if (cards < 13 || offers < 9) throw new Error("expected all original 13 designs / 9 offer cards to remain");
  await page.waitForTimeout(1500);
  await page.getByTestId("design-buyers").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshots/mailers-cta-picker.png", fullPage: true });

  // window.open → null makes the proof fall back to a file download we can inspect
  await page.evaluate(() => { (window as unknown as { open: () => null }).open = () => null; });
  for (const d of NEW) {
    const dlp = page.waitForEvent("download", { timeout: 40000 });
    await page.getByTestId(`proof-${d}`).click();
    const pf = await dlp;
    const path = `screenshots/proof-${d}.pdf`;
    await pf.saveAs(path);
    console.log("PROOF", d, path);
  }

  await page.getByTestId("design-netsheet").getByText("Use this").click();
  await page.getByTestId("mailer-file").setInputFiles("scripts/fixtures/atn_sample.csv");
  await page.getByTestId("mailer-stats").waitFor({ timeout: 15000 });
  await page.getByTestId("mailer-name").fill("E2E CTA mailing");
  const dl = page.waitForEvent("download", { timeout: 60000 });
  await page.getByTestId("mailer-create").click();
  const f = await dl;
  const pdfPath = "screenshots/" + f.suggestedFilename();
  await f.saveAs(pdfPath);
  console.log("PDF", pdfPath);
  await page.getByTestId("mailer-campaign").first().waitFor({ timeout: 15000 });
  const code = (await page.locator("td.font-mono").first().innerText()).trim();

  const wp = page.getByTestId("mailer-wp").last();
  await wp.locator("button").first().click();
  const wdl = page.waitForEvent("download", { timeout: 60000 });
  await page.getByTestId("mailer-wp-front").click();
  const wf = await wdl;
  const wpPath = "screenshots/" + wf.suggestedFilename();
  await wf.saveAs(wpPath);
  console.log("WP FRONT", wpPath);

  // Sample landing for another design
  await helper.goto("/v/SAMPLE?d=market");
  await page.getByTestId("mailer-kicker").waitFor({ timeout: 15000 });
  const k1 = await page.getByTestId("mailer-kicker").innerText();
  console.log("SAMPLE KICKER", k1);
  if (!/neighborhood/i.test(k1)) throw new Error("sample landing ignores design");

  // Real code landing: net sheet ask + reply
  await helper.goto(`/v/${code}`);
  await page.getByTestId("mailer-kicker").waitFor({ timeout: 15000 });
  await page.setViewportSize({ width: 400, height: 860 });
  const k2 = await page.getByTestId("mailer-kicker").innerText();
  const btn = await page.getByTestId("mailer-submit").innerText();
  const want = await page.locator("#want").inputValue();
  console.log("LANDING", k2, "|", btn, "|", want);
  if (!/net sheet/i.test(k2) || !/net sheet/i.test(btn)) throw new Error("landing ask mismatch");
  await page.screenshot({ path: "screenshots/mailers-cta-landing.png", fullPage: true });
  await page.getByText("Just curious").click();
  await page.locator("#nm").fill("CTA Test Homeowner");
  await page.locator("#em").fill("mailer-cta-e2e@example.com");
  await page.getByTestId("mailer-submit").click();
  await page.getByTestId("mailer-done").waitFor({ timeout: 15000 });
  console.log("DONE", (await page.getByTestId("mailer-done").innerText()).replace(/\n/g, " | "));
  await page.setViewportSize({ width: 1280, height: 900 });

  await helper.goto("/mailers?path=print");
  await page.getByTestId("tab-mine").click();
  const row = page.getByTestId("mailer-campaign").filter({ hasText: "E2E CTA mailing" }).first();
  await row.waitFor({ timeout: 15000 });
  await row.locator("button").first().click();
  await page.getByText("Replied ✓").first().waitFor({ timeout: 15000 });
  if (!process.env.MAILERS_KEEP) {
    page.once("dialog", dlg => dlg.accept());
    await page.getByText("Delete mailing").click();
    await page.waitForTimeout(2500);
  }
});
