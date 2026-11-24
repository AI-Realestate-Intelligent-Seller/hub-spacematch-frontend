import { runTest } from "./auth";

runTest("Templates library + training center", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 1280, height: 900 });
  await helper.goto("/templates");
  await page.getByTestId("section-listing").waitFor({ timeout: 15000 });
  const rows = await page.getByTestId("template-row").count();
  if (rows < 70) throw new Error(`Expected ~79 template rows, got ${rows}`);
  for (const bad of ["Coldwell", "WB-", "Wisconsin", "Asset Purchase Agreement"]) {
    if (await page.getByTestId("template-row").filter({ hasText: bad }).count()) throw new Error(`Removed template still listed: ${bad}`);
  }
  await page.screenshot({ path: "screenshots/templates.png", fullPage: false });
  await page.getByPlaceholder(/Search \(e\.g\./).fill("wire");
  await page.getByTestId("template-row").filter({ hasText: "Wire Fraud Warning" }).first().waitFor();
  await page.getByPlaceholder(/Search \(e\.g\./).fill("");
  await page.getByTestId("tab-scripts").click();
  await page.getByText("Expired listing — first contact").waitFor();
  await page.screenshot({ path: "screenshots/templates-scripts.png", fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("tab-docs").click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "screenshots/templates-phone.png", fullPage: false });

  await page.setViewportSize({ width: 1280, height: 900 });
  await helper.goto("/training");
  await page.getByTestId("track-start").waitFor({ timeout: 15000 });
  const btn = page.getByTestId("train-pb:speed-to-lead");
  await btn.click();
  await page.waitForTimeout(800);
  await helper.goto("/playbooks/lofty-daily");
  await page.getByTestId("playbook-done").click();
  await page.getByText("Done (tap to undo)").waitFor({ timeout: 8000 });
  await helper.goto("/training");
  await page.getByTestId("track-leads").getByText("2/5").waitFor({ timeout: 8000 });
  await page.screenshot({ path: "screenshots/training.png", fullPage: true });
  // clean up
  await page.getByTestId("train-pb:speed-to-lead").click();
  await page.waitForTimeout(500);
  await page.getByTestId("train-pb:lofty-daily").click();
  await page.getByTestId("track-leads").getByText("0/5").waitFor({ timeout: 8000 });
  await helper.goto("/home");
  await page.getByTestId("training-link").waitFor({ timeout: 15000 });
});
