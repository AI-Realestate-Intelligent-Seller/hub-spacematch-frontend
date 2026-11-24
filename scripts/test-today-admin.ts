import { runTest } from "./auth";
// Dev only: HUB_TEST_AS maps the e2e session to an email (team@ → shared admin; Today defaults to Michael).
runTest("Today with Lofty (as team@ admin)", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 1280, height: 900 });
  await helper.goto("/home");
  await page.getByTestId("shared-banner").waitFor({ timeout: 15000 });
  await page.getByTestId("today-new-leads-assigned").waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.locator("section:has(h2:text('Today'))").screenshot({ path: "screenshots/today-admin.png" });
  await page.screenshot({ path: "screenshots/home-admin.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "screenshots/home-admin-phone.png", fullPage: true });
});
