// e2e: Why SpaceMatch link — tutorial gate → create link → prospect page (mobile) → live tracking → request.
// Dev runs as team@ (HUB_TEST_AS) = staff → sends as Michael Kang. Reset first:
//   bunx convex run whyLinks:resetTutorialInternal '{"email":"team@spacematchinc.com"}'
import { runTest } from "./auth";

runTest("Why SpaceMatch link", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 1280, height: 900 });
  await helper.goto("/home");
  await page.getByTestId("why-tile").waitFor({ timeout: 20000 });
  await page.screenshot({ path: "screenshots/why-home-tile.png" });
  await page.getByTestId("why-tile").click();

  // Tutorial
  await page.getByTestId("why-tutorial").waitFor({ timeout: 15000 });
  await page.screenshot({ path: "screenshots/why-tutorial.png", fullPage: true });
  for (let i = 0; i < 5; i++) await page.getByTestId("tutorial-next").click();
  // wrong answer first → stays locked
  const pick = async (q: number, k: number) => page.getByTestId(`quiz-${q}`).getByRole("button").nth(k).click();
  await pick(0, 0); await pick(1, 2); await pick(2, 1); await pick(3, 1);
  await page.getByTestId("quiz-submit").click();
  await page.getByText("Not quite.").first().waitFor({ timeout: 8000 });
  await pick(0, 1);
  await page.screenshot({ path: "screenshots/why-quiz.png", fullPage: true });
  await page.getByTestId("quiz-submit").click();
  await page.getByTestId("why-tool").waitFor({ timeout: 10000 });

  // Create a link (Copy) and capture it
  await page.evaluate(() => {
    (window as unknown as { __copied: string }).__copied = "";
    navigator.clipboard.writeText = async (t: string) => { (window as unknown as { __copied: string }).__copied = t; };
  });
  await page.getByLabel("Their first name").fill("Jordan");
  await page.getByTestId("tool-path-both").click();
  await page.getByTestId("why-copy").click();
  await page.waitForFunction(() => !!(window as unknown as { __copied: string }).__copied, null, { timeout: 10000 });
  const copied = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
  const url = /https?:\/\/\S+/.exec(copied)?.[0];
  if (!url || !url.includes("/m/michael-kang?k=")) throw new Error(`bad link in message: ${copied}`);
  console.log("LINK", url);
  await page.screenshot({ path: "screenshots/why-tool.png", fullPage: true });

  // Prospect on a phone
  const ctx2 = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const sp = await ctx2.newPage();
  sp.on("pageerror", e => console.log("PROSPECT PAGEERROR", e.message));
  await sp.goto(url.replace(/^https?:\/\/[^/]+/, new URL(page.url()).origin));
  await sp.getByText("Prepared for Jordan").waitFor({ timeout: 15000 });
  const hero = await sp.getByTestId("why-hero").textContent();
  if (!hero?.includes("Jordan")) throw new Error(`hero not personalized: ${hero}`);
  await sp.screenshot({ path: "screenshots/why-m-hero.png" });
  // path preselected = both (from the link)
  await sp.getByText("Four ways to time it").waitFor({ timeout: 5000 });
  await sp.getByTestId("path-sell").scrollIntoViewIfNeeded();
  await sp.getByRole("tab", { name: "The SpaceMatch way" }).click();
  await sp.getByText("Stagifi digital staging and decluttering").first().waitFor({ timeout: 5000 });
  await sp.locator("#difference").screenshot({ path: "screenshots/why-m-compare.png" });

  // Agent sees "viewing now" live
  await page.getByTestId("live-now").waitFor({ timeout: 30000 });
  await page.screenshot({ path: "screenshots/why-tool-live.png" });

  const ba = sp.getByTestId("before-after");
  await ba.scrollIntoViewIfNeeded();
  const box = (await ba.boundingBox())!;
  await sp.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
  await sp.mouse.down();
  await sp.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 5 });
  await sp.mouse.up();
  await sp.locator("#staging").screenshot({ path: "screenshots/why-m-staging.png" });

  await sp.getByTestId("open-demo").click();
  await sp.getByText("Demo listing.").waitFor({ timeout: 8000 });
  await sp.screenshot({ path: "screenshots/why-m-demo.png" });
  await sp.getByTestId("close-demo").click();

  await sp.locator("#numbers").scrollIntoViewIfNeeded();
  const result = await sp.getByTestId("calc-result").textContent();
  if (!result?.startsWith("$")) throw new Error(`calculator: ${result}`);
  await sp.locator("#numbers").screenshot({ path: "screenshots/why-m-calc.png" });
  await sp.locator("#proof").screenshot({ path: "screenshots/why-m-proof.png" });
  await sp.locator("#agent").screenshot({ path: "screenshots/why-m-agent.png" });

  await sp.locator("#next").scrollIntoViewIfNeeded();
  await sp.getByLabel("Mobile phone").fill("(312) 555-0142");
  await sp.getByLabel("Email").fill("jordan.test@example.com"); // example.com → never pushed to Lofty
  await sp.getByLabel("Property address").fill("2150 Ridge Ave, Evanston");
  await sp.getByTestId("why-submit").click();
  await sp.getByTestId("why-done").waitFor({ timeout: 10000 });
  await sp.screenshot({ path: "screenshots/why-m-full.png", fullPage: true });
  await ctx2.close();

  // Agent list shows the request + what they saw
  await page.getByText("Asked for a plan").first().waitFor({ timeout: 15000 });
  await page.getByText("Saw:").first().waitFor({ timeout: 5000 });
  await page.screenshot({ path: "screenshots/why-tool-after.png", fullPage: true });

  // Generic link (no token) works and isn't tracked
  const g = await page.context().newPage();
  await g.setViewportSize({ width: 390, height: 844 });
  await g.goto(`${new URL(page.url()).origin}/m/tarik-hage`);
  await g.getByText("Tarik Hage").first().waitFor({ timeout: 10000 });
  await g.getByTestId("path-buy").click();
  await g.getByText("Your path to the keys.").waitFor({ timeout: 5000 });
  await g.screenshot({ path: "screenshots/why-m-generic-buyer.png", fullPage: true });
  await g.close();
});
