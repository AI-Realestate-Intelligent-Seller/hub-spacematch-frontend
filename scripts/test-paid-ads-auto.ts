// Meta Ads + Google Ads cards fill in from the connected ads accounts (real data).
// Matching by typed campaign name here; street-in-name matching is the same code path.
import { runTest } from "./auth";

runTest("Paid ads auto (Meta + Google)", async helper => {
  const { page } = helper;
  await helper.goto("/listings");
  await page.getByRole("button", { name: /New listing/ }).first().click();
  await page.getByPlaceholder("1234 N Main St, Chicago, IL 60614").fill("3333 W Autotest Ave, Chicago, IL 60618");
  await page.getByLabel(/Seller name/).fill("Pat Test");
  await page.getByRole("button", { name: "Create listing" }).click();
  await page.getByText("Seller's live page").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Ads & web" }).click();

  const meta = page.getByTestId("ad-card-meta");
  await meta.getByText(/Fills in by itself: put the street \(“3333 W Autotest”\)/).waitFor({ timeout: 10000 });
  await meta.getByRole("button", { name: "Add campaign name" }).click();
  await meta.getByPlaceholder("As named in the ads account").fill("RealtyGen");
  await meta.getByRole("button", { name: /^Save Instagram/ }).click();
  await meta.getByTestId("ad-auto-meta").getByText(/RealtyGen \| Upsizing Campaign/).waitFor({ timeout: 60000 });
  await meta.getByText(/Automatic from Meta Ads/).waitFor();
  await meta.getByText("$1,298.40").waitFor();

  const g = page.getByTestId("ad-card-google");
  await g.getByRole("button", { name: "Add campaign name" }).click();
  await g.getByPlaceholder("As named in the ads account").fill("YT A - 10-09-26");
  await g.getByRole("button", { name: /^Save Google/ }).click();
  await g.getByTestId("ad-auto-google").getByText(/Sellers - Homeowner\+PS/).waitFor({ timeout: 60000 });
  await g.getByText(/Automatic from Google Ads/).waitFor();
  // Agent edits a note on an auto card: numbers stay automatic.
  await g.getByRole("button", { name: "Edit link & note" }).click();
  await g.locator("textarea").fill("YouTube ads to North Shore homeowners");
  await g.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(1500);
  await g.getByText(/Automatic from Google Ads/).waitFor();
  await page.screenshot({ path: "screenshots/paid-ads-agent.png", fullPage: true });

  const sellerUrl = (await page.locator(".font-mono").first().textContent())!.trim();
  const ctx2 = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 } });
  const sp = await ctx2.newPage();
  await sp.goto(sellerUrl.replace(/^https?:\/\/[^/]+/, new URL(page.url()).origin));
  await sp.getByText("Your ad campaigns").waitFor({ timeout: 15000 });
  await sp.getByTestId("seller-ad-meta").getByText(/automatic from Meta Ads/).waitFor({ timeout: 5000 });
  await sp.getByTestId("seller-ad-google").getByText(/automatic from Google Ads/).waitFor({ timeout: 5000 });
  await sp.getByText("YouTube ads to North Shore homeowners").waitFor();
  const html = await sp.content();
  if (/1,298|574\.|Spend|budget|RealtyGen|YT A/i.test(html)) throw new Error("Spend or campaign name leaked to seller view");
  await sp.getByText("Your ad campaigns").scrollIntoViewIfNeeded();
  await sp.screenshot({ path: "screenshots/paid-ads-seller.png", fullPage: true });
  await ctx2.close();

  await page.getByRole("button", { name: "Details" }).click();
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: /Delete listing/ }).click();
  await page.waitForURL(/\/listings$/, { timeout: 10000 });
});
