import { runTest } from "./auth";

runTest("Ad campaigns (agent + seller)", async helper => {
  const { page } = helper;
  await helper.goto("/listings");
  await page.getByRole("button", { name: /New listing/ }).first().click();
  await page.getByPlaceholder("1234 N Main St, Chicago, IL 60614").fill("1651 N Karlov Avenue, Chicago, IL 60639");
  await page.getByPlaceholder("If you have it").fill("12544139");
  await page.getByPlaceholder("$549,000").fill("$389,000");
  await page.getByLabel(/Seller name/).fill("Ada Test");
  await page.getByRole("button", { name: "Create listing" }).click();
  await page.getByText("Seller's live page").waitFor({ timeout: 15000 });

  await page.getByRole("button", { name: "Ads & web" }).click();
  // Website card: real Google Analytics pull through the Convex action.
  const web = page.getByTestId("ad-card-website");
  await web.getByText(/Matched by MLS #, address/).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Refresh website numbers" }).click();
  await web.getByText("/properties/1651-n-karlov-avenue", { exact: false }).waitFor({ timeout: 60000 });
  if ((await web.getByText("Last update failed").count()) > 0) throw new Error("GA error shown");

  // Meta card: typed numbers incl. spend (agent only).
  const meta = page.getByTestId("ad-card-meta");
  await meta.getByRole("button", { name: "Add campaign name" }).click();
  await meta.getByLabel("meta status").selectOption("running");
  await meta.getByLabel("meta reach").fill("12480");
  await meta.getByLabel("meta clicks").fill("312");
  await meta.getByLabel("meta leads").fill("9");
  await meta.getByLabel("meta spend").fill("187.50");
  await meta.getByPlaceholder(/Targeting buyers/).fill("Targeting buyers in Hermosa & Logan Square");
  await meta.getByRole("button", { name: /^Save Instagram/ }).click();
  await page.getByText("Saved. Your seller sees the results now.").waitFor({ timeout: 8000 });
  await meta.getByText("$187.50").waitFor({ timeout: 5000 });
  await meta.getByText("$20.83").waitFor({ timeout: 5000 });
  await page.screenshot({ path: "screenshots/ads-agent.png", fullPage: true });

  // Seller view: results yes, spend never.
  const sellerUrl = (await page.locator(".font-mono").first().textContent())!.trim();
  const ctx2 = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 } });
  const sp = await ctx2.newPage();
  await sp.goto(sellerUrl.replace(/^https?:\/\/[^/]+/, new URL(page.url()).origin));
  await sp.getByText("Your ad campaigns").waitFor({ timeout: 15000 });
  await sp.getByTestId("seller-ad-meta").getByText("12,480").waitFor({ timeout: 5000 });
  await sp.getByTestId("seller-ad-website").waitFor({ timeout: 5000 });
  await sp.getByText("Targeting buyers in Hermosa").waitFor({ timeout: 5000 });
  const html = await sp.content();
  if (/187\.5|20\.83|Spend|budget/i.test(html)) throw new Error("Spend leaked to seller view");
  await sp.getByText("Your ad campaigns").scrollIntoViewIfNeeded();
  await sp.screenshot({ path: "screenshots/ads-seller.png", fullPage: true });
  await ctx2.close();

  await helper.goto("/listings");
  await page.getByText("1 ad running").first().waitFor({ timeout: 8000 });
  // Clean up the test listing.
  await page.getByText("1651 N Karlov Ave").first().click();
  await page.getByRole("button", { name: "Details" }).click();
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: /Delete listing/ }).click();
  await page.waitForURL(/\/listings$/, { timeout: 10000 });
});
