import { runTest } from "./auth";

// Phone-size screenshots of the main screens. TAG=before|after picks the file prefix.
const TAG = process.env.TAG || "after";
const dir = "screenshots/readability";

runTest("Readability pass", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 390, height: 844 });
  const shot = async (name: string, full = false) =>
    page.screenshot({ path: `${dir}/${TAG}-${name}.png`, fullPage: full });

  await helper.goto("/home");
  await page.evaluate(() => localStorage.removeItem("hub-text-size"));
  await helper.goto("/home");
  await page.waitForTimeout(3000);
  await shot("home");

  await helper.goto("/resources");
  await page.waitForTimeout(2500);
  await shot("vendors");

  await helper.goto("/listings");
  await page.waitForTimeout(2500);
  const link = page.locator('a[href^="/listings/"]').first();
  if (await link.count()) {
    await link.click();
    await page.waitForTimeout(2500);
    await shot("listing");
    const mono = page.locator(".font-mono").first();
    if (await mono.count()) {
      const sellerUrl = ((await mono.textContent()) || "").trim();
      if (sellerUrl.includes("/s/")) {
        await page.goto(sellerUrl.replace(/^https?:\/\/[^/]+/, new URL(page.url()).origin));
        await page.waitForTimeout(3000);
        await shot("seller");
      }
    }
  }

  if (TAG === "after") {
    // Larger-text toggle lives in the account menu.
    await page.evaluate(() => localStorage.removeItem("hub-text-size"));
    await helper.goto("/resources");
    await page.waitForTimeout(2000);
    await page.getByLabel("Account menu").click();
    await page.getByText("Larger text").click();
    await page.waitForTimeout(800);
    const fs = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    if (fs !== "19px") throw new Error("Larger text toggle not applied: " + fs);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await shot("vendors-large");
    await page.getByLabel("Account menu").click();
    await page.getByText("Larger text").click();
    await page.waitForTimeout(500);
    const fs2 = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    if (fs2 !== "17px") throw new Error("Larger text toggle not reset: " + fs2);
  }
}).catch(() => process.exit(1));
