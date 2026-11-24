import { runTest } from "./auth";

runTest("Agent Hub", async helper => {
  const { page } = helper;
  await helper.goto("/home");
  await page.waitForTimeout(2500);
  await page.getByText("Your tools").waitFor({ timeout: 10000 });
  await page.screenshot({ path: "screenshots/hub-home.png", fullPage: true });

  // Search: keyword intent + form + vendor
  await page.getByLabel("Search the hub").fill("lender");
  await page.waitForTimeout(600);
  await page.getByText("Find a lender").waitFor({ timeout: 5000 });
  await page.getByLabel("Search the hub").fill("photo");
  await page.waitForTimeout(600);
  await page.getByText("Chicago Real Estate Photography").first().waitFor({ timeout: 5000 });
  await helper.screenshot("hub-search.png");
  await page.getByLabel("Search the hub").fill("");

  // Forms + share dialog
  await helper.goto("/forms");
  await page.waitForTimeout(1500);
  await page.getByText("Seller Intake").first().click();
  await page.waitForTimeout(1200);
  await page.getByText("QR code").waitFor({ timeout: 5000 });
  await helper.screenshot("hub-forms-share.png");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "screenshots/hub-forms.png", fullPage: true });

  // Public client form → submit
  await helper.goto("/f/seller-intake?a=angel-zhang");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Submit" }).click();
  await page.waitForTimeout(800);
  await page.getByText(/Please fill in/).waitFor({ timeout: 5000 });
  const inputs = page.locator("input:visible");
  await inputs.nth(0).fill("Test Seller (e2e)");
  await page.locator('input[type="tel"]').fill("312-555-0100");
  await page.locator('input[placeholder^="Street"]').fill("1824 W Wolfram St, Chicago 60657");
  await page.locator("select").first().selectOption("Condo");
  await page.locator("select").nth(2).selectOption("1–3 months");
  await page.screenshot({ path: "screenshots/hub-public-form.png", fullPage: true });
  await page.getByRole("button", { name: "Submit" }).click();
  await page.getByText("Thank you!").waitFor({ timeout: 10000 });
  await helper.screenshot("hub-public-thanks.png");

  // Vendors: add one
  await helper.goto("/resources");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Add vendor" }).click();
  await page.waitForTimeout(500);
  const dlg = page.getByRole("dialog");
  await dlg.locator("input").nth(0).fill("Test Lender E2E");
  await dlg.locator("input").nth(1).fill("E2E Mortgage Co");
  await dlg.locator('input[inputmode="tel"]').fill("(312) 555-0199");
  await dlg.getByRole("button", { name: "Add vendor" }).click();
  await page.waitForTimeout(1500);
  await page.getByText("E2E Mortgage Co").waitFor({ timeout: 5000 });
  await page.screenshot({ path: "screenshots/hub-vendors.png", fullPage: true });

  // Inbox + CMA page still work
  await helper.goto("/inbox");
  await page.waitForTimeout(1500);
  await page.getByRole("heading", { name: "Inbox" }).waitFor({ timeout: 5000 });
  await helper.goto("/new");
  await page.waitForTimeout(2000);
  await helper.screenshot("hub-cma.png");

  // Phone layout
  await page.setViewportSize({ width: 390, height: 844 });
  await helper.goto("/home");
  await page.waitForTimeout(2000);
  await helper.screenshot("hub-home-phone.png");
}).catch(() => process.exit(1));
