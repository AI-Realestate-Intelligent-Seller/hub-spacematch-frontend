import { runTest } from "./auth";

// Needs a ready commercial test row ("1234 W Test Ave") owned by the test user
// on dev: cma_queue.py --dev status <id> ready --low .. --high .. --list ..
runTest("Edit list price + edit details", async helper => {
  const { page } = helper;
  await helper.goto("/requests");
  await page.waitForTimeout(2500);
  const row = page
    .getByTestId("request-row")
    .filter({ hasText: "1234 W Test Ave" })
    .filter({ has: page.getByTestId("edit-list-price") })
    .first();
  const rowCount = await page.getByTestId("request-row").count();
  await row.getByTestId("edit-list-price").click();
  await page.getByTestId("list-price-dialog").waitFor({ timeout: 5000 });
  await page.getByTestId("new-list-price").fill("1,799,000");
  await page.locator("#list-price-note").fill("Owner wants to test 1.8");
  await page.waitForTimeout(300);
  await helper.screenshot("list-price-dialog.png");
  await page.getByTestId("save-list-price").click();
  // Row stays identifiable by its agent-price line after the update.
  const updated = page
    .getByTestId("request-row")
    .filter({ hasText: "Viktor suggested" })
    .first();
  await updated.getByText("Updating", { exact: true }).waitFor({ timeout: 10000 });
  if ((await page.getByTestId("request-row").count()) !== rowCount)
    throw new Error("row count changed");
  await helper.screenshot("list-price-updated.png");

  await updated.getByTestId("edit-details").click();
  await page.getByTestId("edit-banner").waitFor({ timeout: 10000 });
  const units = page.locator('input[name="units"]');
  if (!(await units.inputValue())) throw new Error("units not prefilled");
  await page.getByTestId("kept-list").waitFor({ timeout: 5000 });
  await units.fill((await units.inputValue()) === "9" ? "10" : "9");
  await page.screenshot({ path: "screenshots/edit-form.png", fullPage: true });
  await page.getByTestId("submit-cma").click();
  await page.waitForTimeout(2500);
  console.log("URL", page.url());
  console.log("TOASTS", await page.locator("[data-sonner-toast]").allInnerTexts());
  await helper.screenshot("edit-after-save.png");
  await page.waitForURL(/\/requests$/, { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page
    .getByTestId("request-row")
    .filter({ hasText: "Viktor suggested" })
    .first()
    .getByText("Building facts & income")
    .waitFor({ timeout: 10000 });
  await helper.screenshot("edit-saved.png");
}).catch(e => {
  console.error(e);
  process.exit(1);
});
