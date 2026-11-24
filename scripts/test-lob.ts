import { runTest } from "./auth";

// Lob print + mail (dev = TEST key, nothing printed): upload list → mailing → free Lob proof →
// "Mail without charge" (test user team@ is a payment confirmer) → all cards accepted → cleanup.
runTest("Lob mailing", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  page.on("dialog", d => d.accept());
  await helper.goto("/mailers");
  await page.getByTestId("choice-print").click();
  await page.getByTestId("mailer-file").waitFor({ state: "attached", timeout: 20000 });
  await page.getByTestId("mailer-file").setInputFiles("scripts/fixtures/lob_sample.csv");
  await page.getByTestId("mailer-stats").waitFor({ timeout: 15000 });
  await page.getByTestId("mailer-name").fill("E2E Lob mailing");
  const dl = page.waitForEvent("download", { timeout: 60000 });
  await page.getByTestId("mailer-create").click();
  await dl;
  const panel = page.getByTestId("lob-panel").first();
  await panel.waitFor({ timeout: 20000 });
  await page.getByTestId("lob-proof").click();
  await page.getByTestId("lob-proof-ready").waitFor({ timeout: 120000 });
  const href = await page.getByTestId("lob-proof-ready").locator("a").getAttribute("href");
  console.log("PROOF", href);
  await page.waitForTimeout(3000);
  await panel.screenshot({ path: "screenshots/lob-proof.png" });
  await page.getByTestId("lob-waive").click();
  await page.getByTestId("lob-sent").waitFor({ timeout: 240000 });
  console.log("SENT", (await page.getByTestId("lob-sent").innerText()).replace(/\n/g, " | "));
  await panel.screenshot({ path: "screenshots/lob-sent.png" });
  if (!process.env.LOB_KEEP) {
    await page.getByText("Delete mailing").click();
    await page.waitForTimeout(2500);
  }
});
