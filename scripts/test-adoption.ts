import { runTest } from "./auth";

// Adoption scoreboard: page pings land in hubActivity and show on /adoption (dev HUB_TEST_AS=team@ → admin).
runTest("Adoption scoreboard", async helper => {
  const { page } = helper;
  await helper.goto("/home");
  await page.waitForTimeout(1500);
  await helper.goto("/templates");
  await page.waitForTimeout(1500);
  await helper.goto("/adoption");
  await page.getByTestId("adoption-page").waitFor({ timeout: 20000 });
  const rows = await page.getByTestId("adoption-row").count();
  if (rows < 15) throw new Error(`expected roster rows, got ${rows}`);
  const shared = page.getByTestId("adoption-row").filter({ hasText: "Shared team login" });
  await shared.getByText("Templates").waitFor({ timeout: 10000 });
  await shared.getByText("Home").first().waitFor({ timeout: 10000 });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "screenshots/adoption-desktop.png", fullPage: true });
  // Week switcher
  const before = await page.getByTestId("week-label").textContent();
  await page.getByLabel("Previous week").click();
  await page.waitForFunction(b => document.querySelector('[data-testid="week-label"]')?.textContent !== b, before, { timeout: 10000 });
  await page.getByLabel("Next week").click();
  await page.waitForFunction(b => document.querySelector('[data-testid="week-label"]')?.textContent === b, before, { timeout: 10000 });
  // Phone
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "screenshots/adoption-mobile.png", fullPage: true });
  // Menu link
  await page.getByLabel("Account menu").click();
  await page.getByRole("menuitem", { name: "Adoption scoreboard" }).waitFor({ timeout: 5000 });
});
