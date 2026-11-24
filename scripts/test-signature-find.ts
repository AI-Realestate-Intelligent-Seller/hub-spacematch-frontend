import { runTest } from "./auth";

// Michael 11-12: "for the email agent signature in the app make it more noticeable I cannot find it".
// The signature maker is reachable from Home, search, the account menu, the Marketing chips and Emails.
runTest("Email signature is easy to find", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  const onSignature = async (via: string) => {
    await page.waitForURL(/\/signature$/, { timeout: 15000 }).catch(() => { throw new Error(`${via} did not open /signature (at ${page.url()})`); });
    await page.getByRole("heading", { name: "Email signature" }).waitFor({ timeout: 20000 });
  };
  for (const [w, h, name] of [[1280, 1000, "desktop"], [390, 844, "phone"]] as const) {
    await page.setViewportSize({ width: w, height: h });

    // 1. Home card, above the fold area with the other one-tap cards.
    await helper.goto("/home");
    await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("hub-new-")).forEach(k => localStorage.removeItem(k)));
    await helper.goto("/home");
    const card = page.getByTestId("act-signature");
    await card.waitFor({ timeout: 20000 });
    const text = await card.innerText();
    if (!/Make your email signature/.test(text) || !/new/i.test(text)) throw new Error(`home card text wrong: ${text}`);
    // Round 2 (11-22): it is the one "New this week" card; nothing is cut off sideways.
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error(`home scrolls sideways at ${w}px`);
    for (const id of ["moments", "my-tools", "act-all-tools", "act-help", "new-this-week"]) {
      if (!(await page.getByTestId(id).isVisible())) throw new Error(`home lost ${id}`);
    }
    await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -140));
    await page.waitForTimeout(600);
    await page.screenshot({ path: `screenshots/signature-find-home-${name}.png` });
    await card.click();
    await onSignature("home card");

    // 2. Search: "signature" leads with Email signature, not the signs/flyers request.
    await helper.goto("/home");
    const box = page.getByLabel("Search the hub");
    await box.waitFor({ timeout: 20000 });
    for (const q of ["signature", "email signature", "sig line"]) {
      await box.fill(q);
      const first = page.getByTestId("search-hit").first();
      await first.waitFor({ timeout: 8000 });
      const t = await first.innerText();
      if (!t.includes("Email signature")) throw new Error(`search "${q}" leads with: ${t}`);
      const all = (await page.getByTestId("search-hit").allInnerTexts()).join(" | ");
      if (q === "signature" && /Marketing request/.test(all)) throw new Error(`"signature" still suggests the signs request: ${all}`);
    }
    await page.screenshot({ path: `screenshots/signature-find-search-${name}.png` });
    await page.getByTestId("search-hit").first().click();
    await onSignature("search");
    // "sign" still finds the yard-sign request.
    await helper.goto("/home");
    await box.fill("yard sign");
    await page.getByTestId("search-hit").first().waitFor({ timeout: 8000 });
    if (!(await page.getByTestId("search-hit").allInnerTexts()).join(" | ").includes("Marketing request")) throw new Error('"yard sign" no longer finds the Marketing request');
    await box.fill("");

    // 3. Account menu.
    await page.getByLabel("Account menu").click();
    const item = page.getByTestId("menu-signature");
    await item.waitFor({ timeout: 5000 });
    await page.screenshot({ path: `screenshots/signature-find-menu-${name}.png` });
    await item.click();
    await onSignature("account menu");

    // 4. Marketing chips: visible without sideways scrolling, tagged New until you are on it.
    await helper.goto("/reels");
    const chip = page.getByTestId("area-bar").getByRole("link", { name: /Email signature/ });
    await chip.waitFor({ timeout: 20000 });
    const b = await chip.boundingBox();
    if (!b || b.x < 0 || b.x + b.width > w) throw new Error(`Email signature chip is off screen at ${w}px: ${JSON.stringify(b)}`);
    if (!/new/i.test(await chip.innerText())) throw new Error("chip has no New tag");
    await page.screenshot({ path: `screenshots/signature-find-chips-${name}.png`, clip: { x: 0, y: 0, width: w, height: 220 } });
    await chip.click();
    await onSignature("Marketing chip");

    // 5. Emails page link.
    await helper.goto("/emails");
    await page.getByTestId("emails-signature").click();
    await onSignature("Emails page link");
  }
});
