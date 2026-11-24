import { runTest } from "./auth";

// 100% commission rentals on dev (HUB_TEST_AS=team@ → office, can verify).
// Add a building without the stamp → it shows "Not verified yet" → Verify it → gold stamp →
// report a change → stamp turns to Re-check with the note → under-100% and duplicate adds are refused.
// Then the Doesn't pay list: add under-a-full-month + no-commission buildings, confirm one, lists stay separate.
// Cleanup: run commissionBuildings:removeTestRows on dev afterwards.
runTest("100% commission rentals", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 1280, height: 900 });
  const street = `${1000 + Math.floor(Math.random() * 8000)} W Testwood Ave`;
  await helper.goto("/commission-rentals");
  await page.getByTestId("commission-rentals-page").waitFor({ timeout: 20000 });

  const fill = async (pct: string) => {
    await page.getByRole("button", { name: "Add building" }).first().click();
    const form = page.getByTestId("building-form");
    await form.waitFor();
    await form.locator('input[name="address"]').fill(`${street}, Chicago, IL 60657`);
    await form.locator('input[name="name"]').fill("E2E Testwood Tower");
    await form.locator('input[name="neighborhood"]').fill("Lakeview");
    await form.locator('input[name="commissionPct"]').fill(pct);
    await form.locator('input[name="bonus"]').fill("$250 gift card");
    await form.locator('input[name="keyRule"]').fill("Register your client before the tour");
    await form.locator('input[name="sourceNote"]').fill("e2e test, please ignore");
    return form;
  };

  // Under 100% is refused (the browser's min=100 blocks it; the server refuses it too).
  let form = await fill("75");
  await form.getByRole("button", { name: "Add building" }).click();
  await page.waitForTimeout(800);
  if (!(await form.isVisible())) throw new Error("A 75% building was accepted");
  await form.locator('input[name="commissionPct"]').fill("125");
  await form.getByRole("button", { name: "Add building" }).click();
  await form.waitFor({ state: "hidden", timeout: 10000 });

  await page.getByPlaceholder(/Search building/).fill("Testwood");
  const card = page.getByTestId("building-card").filter({ hasText: street }).first();
  await card.waitFor({ timeout: 10000 });
  await card.getByTestId("stamp-unverified").waitFor();
  await card.getByText("125%").waitFor();

  // Same address again → refused as a duplicate.
  form = await fill("100");
  await form.getByRole("button", { name: "Add building" }).click();
  await page.getByText(/already on the list/).first().waitFor({ timeout: 8000 });
  await page.keyboard.press("Escape");
  await form.waitFor({ state: "hidden" });

  // Office verifies → gold stamp.
  await card.getByRole("button", { name: "Verify", exact: true }).click();
  const vd = page.getByTestId("verify-dialog");
  await vd.locator("select").selectOption("Called the leasing office");
  await vd.getByRole("button", { name: "Add the Verified stamp" }).click();
  await card.getByTestId("stamp-verified").waitFor({ timeout: 10000 });
  await card.getByText(/Called the leasing office/).waitFor();

  // Agent reports a change → note shows, stamp asks for a re-check.
  await card.getByRole("button", { name: "Report a change" }).click();
  const rd = page.getByTestId("report-dialog");
  await rd.locator("textarea").fill("Leasing office says it is 50% now");
  await rd.getByRole("button", { name: "Send report" }).click();
  await card.getByTestId("report-note").waitFor({ timeout: 10000 });
  await card.getByTestId("stamp-recheck").waitFor();

  await page.getByPlaceholder(/Search building/).fill("");
  await page.waitForTimeout(600);
  await helper.screenshot("commission-rentals.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await helper.screenshot("commission-rentals-phone.png");

  // "Doesn't pay" list: add an under-a-full-month building and a no-commission one, confirm one,
  // and check neither shows on the 100% list.
  await page.setViewportSize({ width: 1280, height: 900 });
  const npStreet = `${1000 + Math.floor(Math.random() * 8000)} W Nopaywood Ave`;
  await page.getByTestId("list-nopay").click();
  await page.getByTestId("nopay-note").waitFor();
  if (await page.getByTestId("filter-over").count()) throw new Error("Over 100% filter shows on the Doesn't pay list");
  const addNoPay = async (name: string, address: string, reason: string, pct?: string) => {
    await page.getByRole("button", { name: "Add building" }).first().click();
    const f = page.getByTestId("building-form");
    await f.getByText("Add a building that doesn't pay").waitFor();
    await f.locator('input[name="address"]').fill(address);
    await f.locator('input[name="name"]').fill(name);
    await f.locator('input[name="neighborhood"]').fill("Lakeview");
    await f.locator('select[name="noPayReason"]').selectOption(reason);
    if (pct) await f.locator('input[name="commissionPct"]').fill(pct);
    await f.locator('input[name="keyRule"]').fill("Leases only through its own leasing office");
    await f.locator('input[name="sourceNote"]').fill("e2e test, please ignore");
    return f;
  };
  // 100% does not belong on this list.
  let np = await addNoPay("E2E Nopaywood Court", `${npStreet}, Chicago, IL 60657`, "under", "100");
  await np.getByRole("button", { name: "Add building" }).click();
  await page.waitForTimeout(800);
  if (!(await np.isVisible())) throw new Error("A 100% building was accepted on the Doesn't pay list");
  await np.locator('input[name="commissionPct"]').fill("50");
  await np.getByRole("button", { name: "Add building" }).click();
  await np.waitFor({ state: "hidden", timeout: 10000 });
  np = await addNoPay("E2E Nopaywood Flats", `${npStreet.replace(" W ", " N ")}, Chicago, IL 60657`, "none");
  await np.getByRole("button", { name: "Add building" }).click();
  await np.waitFor({ state: "hidden", timeout: 10000 });

  await page.getByPlaceholder(/Search building/).fill("Nopaywood");
  const under = page.getByTestId("building-card").filter({ hasText: "E2E Nopaywood Court" }).first();
  await under.waitFor({ timeout: 10000 });
  await under.getByTestId("nopay-head").getByText("50%").waitFor();
  await under.getByText(/Not confirmed/).waitFor();
  const none = page.getByTestId("building-card").filter({ hasText: "E2E Nopaywood Flats" }).first();
  await none.getByTestId("nopay-head").getByText("No commission").waitFor();

  await under.getByRole("button", { name: "Confirm", exact: true }).click();
  const cd = page.getByTestId("verify-dialog");
  await cd.locator("select").selectOption("Called the leasing office");
  await cd.getByRole("button", { name: "Add the Confirmed stamp" }).click();
  await under.getByTestId("stamp-verified").getByText("Confirmed").waitFor({ timeout: 10000 });
  await page.waitForTimeout(5000); // let the toasts clear
  await helper.screenshot("commission-rentals-nopay.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await helper.screenshot("commission-rentals-nopay-phone.png");
  await page.setViewportSize({ width: 1280, height: 900 });

  // The same address cannot also go on the 100% list, and the 100% list does not show these.
  await page.getByTestId("list-pays").click();
  await page.waitForTimeout(500);
  if (await page.getByTestId("building-card").filter({ hasText: "Nopaywood" }).count()) throw new Error("A Doesn't pay building shows on the 100% list");
  await page.getByRole("button", { name: "Add building" }).first().click();
  const dupForm = page.getByTestId("building-form");
  await dupForm.locator('input[name="address"]').fill(`${npStreet}, Chicago, IL 60657`);
  await dupForm.locator('input[name="sourceNote"]').fill("e2e test, please ignore");
  await dupForm.getByRole("button", { name: "Add building" }).click();
  await page.getByText(/already on the list under Doesn't pay/).first().waitFor({ timeout: 8000 });
  await page.keyboard.press("Escape");
  await dupForm.waitFor({ state: "hidden" });

  // Global search finds it from Home.
  await page.setViewportSize({ width: 1280, height: 900 });
  await helper.goto("/home");
  await page.getByPlaceholder(/Search forms/).first().fill("Testwood");
  await page.getByText("E2E Testwood Tower").first().waitFor({ timeout: 10000 });
}).catch(() => process.exit(1));
