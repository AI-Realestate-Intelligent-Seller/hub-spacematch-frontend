import { runTest } from "./auth";

runTest("Real Broker forms in Templates", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 1280, height: 900 });
  await helper.goto("/templates");
  await page.getByTestId("section-listing").waitFor({ timeout: 15000 });
  const rows = await page.getByTestId("template-row").count();
  if (rows !== 87) throw new Error(`Expected 87 template rows, got ${rows}`);
  await page.getByText("Real Broker forms are here now").waitFor();
  await page.screenshot({ path: "screenshots/templates-real-banner.png" });
  await page.getByPlaceholder(/Search \(e\.g\./).fill("real broker");
  await page.waitForTimeout(400);
  for (const t of ["Exclusive Right to Sell Listing Agreement", "Affiliated Business Arrangement", "Wire Fraud Alert", "Exclusive Right to Lease Listing Agreement", "Real Agent Referral Agreement"]) {
    await page.getByTestId("template-row").filter({ hasText: t }).first().waitFor({ timeout: 5000 });
  }
  for (const bad of ["Important Illinois Information", "Wire Fraud Warning (client advisory)"]) {
    if (await page.getByTestId("template-row").filter({ hasText: bad }).count()) throw new Error(`Should not be listed: ${bad}`);
  }
  await page.screenshot({ path: "screenshots/templates-real-search.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "screenshots/templates-real-phone.png" });
});
