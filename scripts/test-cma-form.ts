import { runTest } from "./auth";

runTest("CMA request form", async helper => {
  const { page } = helper;
  await helper.goto("/new");
  await page.waitForTimeout(2000);
  await helper.screenshot("form-top.png");
  await page.getByTestId("agent").click();
  await page.getByRole("option", { name: "Tarik Hage" }).click();
  await page.locator('input[name="clientName"]').fill("Test Client");
  await page.locator('input[name="street"]').fill("524 Timber Trail Ct");
  await page.locator('input[name="city"]').fill("Naperville");
  await page.locator('input[name="zip"]').fill("60565");
  await page.getByTestId("condition").click();
  await page.getByRole("option", { name: "Partially updated" }).click();
  await page.getByLabel("Kitchen remodel").click();
  await page.getByPlaceholder("Year").first().fill("2023");
  await page
    .getByPlaceholder(/Details/)
    .first()
    .fill("quartz, new cabinets");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/form-full.png", fullPage: true });
  await page.getByTestId("submit-cma").click();
  await page.waitForTimeout(2500);
  await page.getByText("CMA request received").waitFor({ timeout: 10000 });
  await helper.screenshot("submitted.png");
  await helper.goto("/requests");
  await page.waitForTimeout(2500);
  await page.getByTestId("request-row").first().waitFor({ timeout: 10000 });
  await helper.screenshot("requests.png");
}).catch(() => process.exit(1));
