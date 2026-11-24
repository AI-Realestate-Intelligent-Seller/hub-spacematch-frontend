import { runTest } from "./auth";

runTest("Home polish: Today, tools, tabs, help, growth", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 1280, height: 900 });
  await helper.goto("/home");
  await page.getByText("Your tools").waitFor({ timeout: 15000 });
  await page.waitForTimeout(2500);
  const who = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log("HOME TOP:", who.replace(/\n+/g, " | "));
  // Tool icons are images, Lofty first
  const firstTool = await page.locator("section:has(h2:text('Your tools')) a").first().innerText();
  if (!firstTool.includes("Lofty")) throw new Error(`First tool is ${firstTool}`);
  const imgs = await page.locator("section:has(h2:text('Your tools')) img").count();
  if (imgs < 12) throw new Error(`Expected 12 tool icons, got ${imgs}`);
  await page.screenshot({ path: "screenshots/home-desktop.png", fullPage: true });

  // Request help → logged
  await page.getByTestId("request-help-CC").click();
  await page.getByTestId("help-dialog").waitFor();
  await page.getByRole("button", { name: "Sign install / removal" }).click();
  await page.locator("textarea").fill("e2e test — please ignore");
  await page.screenshot({ path: "screenshots/help-dialog.png" });
  await page.getByRole("button", { name: /Send to Cris/ }).click();
  await page.getByText(/Sent to Cris/).waitFor({ timeout: 10000 });
  await helper.goto("/help");
  await page.getByText("e2e test — please ignore").first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: "screenshots/help-page.png", fullPage: true });

  // Growth playbook progress
  await helper.goto("/growth");
  await page.getByTestId("growth-item-l1-1").waitFor({ timeout: 10000 });
  const before = await page.getByTestId("growth-total").innerText();
  const disabled = await page.getByTestId("growth-item-l1-1").isDisabled();
  if (!disabled) {
    await page.getByTestId("growth-item-l1-1").click();
    await page.waitForFunction(b => document.querySelector('[data-testid="growth-total"]')?.textContent !== b, before, { timeout: 10000 });
  }
  await page.screenshot({ path: "screenshots/growth.png", fullPage: true });

  // Phone: 5 tabs
  await page.setViewportSize({ width: 390, height: 844 });
  await helper.goto("/home");
  await page.getByText("Your tools").waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  const tabs = await page.locator("nav.fixed a").count();
  if (tabs !== 5) throw new Error(`Expected 5 tabs, got ${tabs}`);
  await page.screenshot({ path: "screenshots/home-phone.png", fullPage: false });
  await page.screenshot({ path: "screenshots/home-phone-full.png", fullPage: true });
});
