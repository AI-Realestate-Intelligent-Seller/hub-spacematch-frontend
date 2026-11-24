import { runTest } from "./auth";

// Reel Studio tab bar (Michael 11-12 "make this more noticeable"): black active pill with icons,
// equal-width tabs that fit a phone without sideways scrolling.
runTest("Reel Studio tab bar", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  for (const [w, h, name] of [[1280, 900, "desktop"], [390, 800, "phone"]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await helper.goto("/reels");
    await page.getByRole("heading", { name: "Reel Studio" }).waitFor({ timeout: 20000 });
    const bar = page.getByTestId("reel-tabs");
    await bar.waitFor();
    for (const t of ["New Reel", "My Reels", "Ledger"]) await page.getByRole("tab", { name: t }).waitFor();
    await page.getByRole("tab", { name: /Orders/ }).waitFor();
    const box = await bar.boundingBox();
    if (!box) throw new Error("no tab bar");
    if (box.x < 0 || box.x + box.width > w + 1) throw new Error(`tab bar wider than the screen at ${w}px`);
    if (await bar.evaluate(el => el.scrollWidth > el.clientWidth + 1)) throw new Error(`tab bar scrolls sideways at ${w}px`);
    for (const tab of await page.getByRole("tab").all()) {
      const b = await tab.boundingBox();
      if (!b || b.height < 44) throw new Error(`tab shorter than 44px at ${w}px`);
      if (await tab.locator("span.truncate").evaluate(el => el.scrollWidth > el.clientWidth + 1)) throw new Error(`label cut off at ${w}px: ${await tab.innerText()}`);
    }
    await page.getByRole("tab", { name: "My Reels" }).click();
    await page.getByRole("tab", { name: "My Reels", selected: true }).waitFor();
    await page.waitForTimeout(400); // colour transition
    const bg = await page.getByRole("tab", { name: "My Reels" }).evaluate(el => getComputedStyle(el).backgroundColor);
    if (bg !== "rgb(10, 10, 10)") throw new Error(`active tab not black: ${bg}`);
    await page.getByRole("tab", { name: "New Reel" }).click();
    await page.getByRole("tab", { name: "New Reel", selected: true }).waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `screenshots/reel-tabs-${name}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(h, 520) } });
  }
});
