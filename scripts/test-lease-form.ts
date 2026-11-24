import { runTest } from "./auth";

runTest("Lease CMA form (residential + commercial)", async helper => {
  const { page } = helper;
  // Residential
  await helper.goto("/lease");
  await page.waitForTimeout(2000);
  await page.getByTestId("bt-condo-unit").click();
  await page.getByTestId("lease-agent").click();
  await page.getByRole("option", { name: "Tarik Hage" }).click();
  await page.locator('input[name="clientName"]').fill("Lease Test Res");
  await page.locator('input[name="street"]').fill("1550 N Lake Shore Dr");
  await page.locator('input[name="city"]').fill("Chicago");
  await page.locator('input[name="zip"]').fill("60610");
  await page.getByTestId("lease-condition").click();
  await page.getByRole("option", { name: "Partially updated" }).click();
  await page.locator("label", { hasText: "Heat" }).click();
  await page.locator("label", { hasText: "Doorman" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "screenshots/lease-res.png", fullPage: true });
  await page.getByTestId("submit-lease").click();
  await page.getByTestId("lease-done").waitFor({ timeout: 15000 });

  // Commercial
  await helper.goto("/lease");
  await page.waitForTimeout(1500);
  await page.getByTestId("lease-kind-commercial").click();
  await page.getByTestId("bt-retail-storefront").click();
  await page.getByTestId("lease-agent").click();
  await page.getByRole("option", { name: "Tarik Hage" }).click();
  await page.locator('input[name="clientName"]').fill("Lease Test Com");
  await page.locator('input[name="street"]').fill("676 N Michigan Ave");
  await page.locator('input[name="city"]').fill("Chicago");
  await page.locator('input[name="zip"]').fill("60611");
  await page.getByTestId("lease-condition").click();
  await page.getByRole("option", { name: /Second-generation/ }).click();
  await page.locator("label", { hasText: "Corner location" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "screenshots/lease-com.png", fullPage: true });
  await page.getByTestId("submit-lease").click();
  await page.getByTestId("lease-done").waitFor({ timeout: 15000 });

  await helper.goto("/requests");
  await page.getByTestId("lease-badge").first().waitFor({ timeout: 10000 });
  await helper.screenshot("lease-requests.png");
}).catch(e => { console.error(e); process.exit(1); });
