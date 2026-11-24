import { runTest } from "./auth";

// Investor numbers add-on on the sale CMA form + Follow Up Boss card in Settings
// (both Hub feedback items approved by Michael 2026-11-02).
runTest("Investor CMA + FUB connect", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 1100, height: 1400 });
  await helper.goto("/new");
  await page.waitForTimeout(2000);
  await page.getByTestId("agent").click();
  await page.getByRole("option", { name: "Rob Robinson" }).click();
  await page.locator('input[name="clientName"]').fill("Investor Test");
  await page.locator('input[name="street"]').fill("744 W 77th St");
  await page.locator('input[name="city"]').fill("Chicago");
  await page.locator('input[name="zip"]').fill("60620");
  await page.getByTestId("propertyType").click();
  await page.getByRole("option", { name: "2–4 unit" }).click();
  await page.getByTestId("condition").click();
  await page.getByRole("option", { name: "Needs work" }).click();
  const sec = page.getByTestId("investor-section");
  await sec.scrollIntoViewIfNeeded();
  if (await page.getByTestId("investor-units").count()) throw new Error("units visible before toggle");
  await page.getByTestId("investor-toggle").click();
  await page.waitForTimeout(300);
  const rows = await page.locator('[data-testid="investor-units"] tbody tr').count();
  if (rows !== 2) throw new Error(`expected 2 unit rows for 2–4 unit, got ${rows}`);
  await page.locator("#investor-units").click();
  await page.getByRole("option", { name: "3", exact: true }).click();
  await page.waitForTimeout(300);
  const rows3 = await page.locator('[data-testid="investor-units"] tbody tr').count();
  if (rows3 !== 3) throw new Error(`expected 3 unit rows, got ${rows3}`);
  await page.getByLabel("Unit 1 beds").fill("2");
  await page.getByLabel("Unit 1 current rent").fill("1,150");
  await page.locator("#investor-u1-status").click();
  await page.getByRole("option", { name: "Rented" }).click();
  await page.getByLabel("Unit 2 beds").fill("2");
  await page.locator("#investor-u2-status").click();
  await page.getByRole("option", { name: "Vacant" }).click();
  await page.getByLabel("Unit 3 beds").fill("3");
  await page.getByLabel("Unit 3 current rent").fill("1,400");
  await page.locator("#investor-rehab").click();
  await page.getByRole("option", { name: "Medium (kitchens + baths)" }).click();
  await page.getByText("HUD Fair Market Rent benchmark").waitFor();
  await page.waitForTimeout(300);
  await sec.screenshot({ path: "screenshots/investor-section.png" });
  await page.getByTestId("submit-cma").click();
  await page.getByText("CMA request received").waitFor({ timeout: 15000 });
  await page.getByText("after-repair value").waitFor();

  await helper.goto("/requests");
  await page.waitForTimeout(2500);
  await page.getByTestId("investor-badge").first().waitFor({ timeout: 10000 });

  await helper.goto("/settings");
  await page.waitForTimeout(2000);
  const card = page.getByTestId("fub-card");
  await card.waitFor({ timeout: 10000 });
  await page.getByTestId("fub-key").fill("fka_0000000000000000000000000000invalid");
  await page.getByTestId("fub-connect").click();
  const err = page.getByTestId("fub-error");
  await err.waitFor({ timeout: 20000 });
  const t = (await err.textContent()) ?? "";
  if (!t.includes("didn't accept")) throw new Error(`unexpected FUB error: ${t}`);
  await card.screenshot({ path: "screenshots/fub-card.png" });
  console.log("PASS investor + fub");
}).catch(() => process.exit(1));
