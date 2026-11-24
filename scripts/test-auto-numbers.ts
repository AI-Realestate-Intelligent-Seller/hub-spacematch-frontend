// Zillow daily report emails + Instagram Reel views fill the seller page by themselves.
// Dev prerequisite: `bunx convex run zillow:scan '{"mailbox":"hurrikang","days":3000,"max":200}'`
// (Michael's 110 real reports for 2147 W Thomas / 5253 W Devon).
import { runTest } from "./auth";

runTest("Auto numbers: Zillow + Reel", async helper => {
  const { page } = helper;
  const create = async (address: string, seller: string) => {
    await helper.goto("/listings");
    await page.getByRole("button", { name: /New listing/ }).first().click();
    await page.getByPlaceholder("1234 N Main St, Chicago, IL 60614").fill(address);
    await page.getByLabel(/Seller name/).fill(seller);
    await page.getByRole("button", { name: "Create listing" }).click();
    await page.getByText("Seller's live page").waitFor({ timeout: 15000 });
    return page.url();
  };

  // 1) Zillow: listing live June 2026 → June reports roll up into weekly numbers.
  const zUrl = await create("2147 W Thomas St, Chicago, IL 60622", "Zed Test");
  await page.getByRole("button", { name: "Details" }).click();
  await page.locator('input[type="date"]').fill("2026-06-01");
  await page.getByRole("button", { name: "Save details" }).click();
  await page.getByText("Saved", { exact: true }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Weekly numbers" }).click();
  await page.getByTestId("zillow-status").getByText(/On\. Latest Zillow report: .*Jun 24 had 72 views and 4 saves/).waitFor({ timeout: 15000 });
  // Week of Jun 22 = Jun 22+23+24 → 104+83+72 views, 2+5+4 saves.
  for (let i = 0; i < 40; i++) {
    if ((await page.locator("form div.font-semibold").first().textContent())?.startsWith("Jun 22")) break;
    await page.getByRole("button", { name: "‹" }).click();
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(500);
  const inputs = page.locator("form input[inputmode=numeric]");
  if ((await inputs.nth(0).inputValue()) !== "259") throw new Error(`Week views ${await inputs.nth(0).inputValue()} != 259`);
  if ((await inputs.nth(1).inputValue()) !== "11") throw new Error(`Week saves ${await inputs.nth(1).inputValue()} != 11`);
  if (!(await inputs.nth(0).evaluate(e => (e as HTMLInputElement).readOnly))) throw new Error("Zillow field should be read-only when auto");
  await page.getByText("· auto").first().waitFor();
  // Agent adds MLS numbers for that week; the Zillow auto numbers must survive.
  await inputs.nth(2).fill("5");
  await page.getByRole("button", { name: "Save week" }).click();
  await page.getByText("Saved. Your seller sees it now.").waitFor({ timeout: 5000 });
  await page.waitForTimeout(800);
  if ((await inputs.nth(0).inputValue()) !== "259") throw new Error("Auto Zillow number was overwritten by Save week");
  // Forwarding helper opens and the code lookup answers.
  await page.getByRole("button", { name: /How to forward Zillow emails/ }).click();
  await page.getByTestId("forward-help").waitFor();
  await page.getByRole("button", { name: "Get my code" }).click();
  await page.getByText(/No code yet|^\d{6,12}$/).first().waitFor({ timeout: 30000 });
  await page.screenshot({ path: "screenshots/auto-numbers-agent.png", fullPage: true });

  // Seller view shows the Zillow totals.
  const sellerUrl = (await page.locator(".font-mono").first().textContent())!.trim();
  const ctx2 = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 } });
  const sp = await ctx2.newPage();
  await sp.goto(sellerUrl.replace(/^https?:\/\/[^/]+/, new URL(page.url()).origin));
  await sp.getByText("Hi Zed").waitFor({ timeout: 15000 });
  await sp.getByText(/week of Jun 22 · [\d,]+ total/).waitFor({ timeout: 5000 });
  await sp.screenshot({ path: "screenshots/auto-numbers-seller-zillow.png", fullPage: true });

  // 2) Reel: "2541 Cobblewood" is in a real @spacematchchicago Reel caption.
  await create("2541 Cobblewood Dr, Northbrook, IL 60062", "Rae Test");
  await page.getByRole("button", { name: "Weekly numbers" }).click();
  await page.getByTestId("reel-status").getByText(/On\. The Reel has [\d,]+ views \(found by the address in its caption\)/).waitFor({ timeout: 60000 });
  const rv = await page.locator("form input[inputmode=numeric]").nth(5).inputValue();
  if (!/^\d+$/.test(rv) || Number(rv) < 1) throw new Error(`Reel views input empty: ${rv}`);
  await page.screenshot({ path: "screenshots/auto-numbers-reel.png", fullPage: true });
  const sellerUrl2 = (await page.locator(".font-mono").first().textContent())!.trim();
  await sp.goto(sellerUrl2.replace(/^https?:\/\/[^/]+/, new URL(page.url()).origin));
  await sp.getByText("Hi Rae").waitFor({ timeout: 15000 });
  await sp.getByText("total so far on Instagram").waitFor({ timeout: 5000 });
  await sp.getByRole("link", { name: /Instagram Reel/ }).waitFor({ timeout: 5000 });
  await sp.screenshot({ path: "screenshots/auto-numbers-seller-reel.png", fullPage: true });
  await ctx2.close();
  console.log("ZILLOW_LISTING", zUrl);
});
