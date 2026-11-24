import { runTest } from "./auth";

// Schools option on the sale CMA form: default include, agent can opt out,
// hidden for commercial; lease form shows it for residential.
runTest("CMA schools option", async helper => {
  const { page } = helper;
  await helper.goto("/new");
  await page.waitForTimeout(2000);
  const sel = page.getByTestId("cma-schools");
  await sel.waitFor({ timeout: 10000 });
  const def = (await sel.textContent())?.trim();
  if (def !== "Include assigned schools") throw new Error(`default was ${def}`);
  await page.getByTestId("agent").click();
  await page.getByRole("option", { name: "Tarik Hage" }).click();
  await page.locator('input[name="clientName"]').fill("Schools Test");
  await page.locator('input[name="street"]').fill("419 W Root St");
  await page.locator('input[name="city"]').fill("Chicago");
  await page.locator('input[name="zip"]').fill("60609");
  await page.getByTestId("condition").click();
  await page.getByRole("option", { name: "Partially updated" }).click();
  await sel.scrollIntoViewIfNeeded();
  await sel.click();
  await page.getByRole("option", { name: "Leave schools out" }).click();
  await page.waitForTimeout(300);
  await sel.screenshot({ path: "screenshots/schools-select.png" });
  await page
    .getByText("Schools for this address")
    .locator("xpath=ancestor::div[contains(@class,'grid')][1]")
    .screenshot({ path: "screenshots/schools-section.png" });
  await page.getByTestId("submit-cma").click();
  await page.getByText("CMA request received").waitFor({ timeout: 15000 });

  await helper.goto("/lease");
  await page.waitForTimeout(2000);
  await page.getByTestId("lease-schools").waitFor({ timeout: 10000 });
  console.log("PASS schools option");
}).catch(() => process.exit(1));
