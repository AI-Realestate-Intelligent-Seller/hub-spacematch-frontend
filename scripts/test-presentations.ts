import { runTest } from "./auth";

runTest("Listing presentations", async helper => {
  const { page } = helper;
  page.on("console", m => console.log("CONSOLE", m.type(), m.text()));
  page.on("requestfailed", r => console.log("REQFAIL", r.url()));
  page.on("response", r => { if (r.url().includes("/decks/")) console.log("RESP", r.status(), r.url(), r.headers()["content-type"]); });
  await helper.goto("/presentations");
  await page.getByText("Pre-Listing Package").first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: "screenshots/presentations.png", fullPage: true });
  await page.getByPlaceholder("e.g. Jane & Tom Smith").first().fill("Jane Smith");
  const dl = page.waitForEvent("download", { timeout: 30000 });
  await page.getByRole("button", { name: "Download" }).first().click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "screenshots/presentations-after.png" });
  const d = await dl;
  const path = "screenshots/" + d.suggestedFilename();
  await d.saveAs(path);
  console.log("DOWNLOADED", path);
  // From Nov 9 2026 (Real switch) there is no Coldwell Banker edition picker.
  if (await page.getByText("Coldwell Banker", { exact: false }).count()) throw new Error("CB edition still offered");
});
