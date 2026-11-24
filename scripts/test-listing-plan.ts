import { runTest } from "./auth";

// Neighborhood & marketing plan: auto-builds on a new listing, renders every section.
runTest("Listing plan: auto-build and plan page", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 412, height: 915 });
  await helper.goto("/listings");
  await page.getByRole("button", { name: /New listing/ }).first().click();
  await page.getByPlaceholder("1234 N Main St, Chicago, IL 60614").fill("1719 N Ridgeway Ave, Chicago, IL 60647");
  await page.getByPlaceholder("$549,000").fill("$549,900");
  await page.getByLabel(/Seller name/).fill("Plan Testseller");
  await page.getByRole("button", { name: "Create listing" }).click();
  await page.getByText("Seller's live page").waitFor({ timeout: 15000 });
  const id = page.url().split("/listings/")[1];
  console.log("LISTING_ID", id);
  const card = page.getByTestId("listing-plan-card");
  await card.waitFor();
  await page.getByTestId("plan-building").waitFor({ timeout: 15000 });
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshots/plan-building.png" });
  await page.getByTestId("plan-open").waitFor({ timeout: 300000 });
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshots/plan-card-ready.png" });
  await page.getByTestId("plan-open").click();
  await page.waitForURL(/\/plan$/);
  for (const s of ["headline", "snapshot", "highlights", "demographics", "buyers", "lifestyle", "schools", "cons", "marketing", "content", "farming", "verify", "sources"]) {
    await page.getByTestId(`plan-${s}`).waitFor({ timeout: 10000 });
  }
  const schools = await page.getByTestId("plan-schools").innerText();
  if (!/Stowe/i.test(schools) || !/North-Grand/i.test(schools)) throw new Error(`boundary schools missing: ${schools.slice(0, 300)}`);
  const data = await page.getByTestId("plan-demographics").innerText();
  if (!/\$\d{2,3},\d{3}/.test(data)) throw new Error("census numbers missing");
  await page.screenshot({ path: "screenshots/plan-top.png" });
  await page.getByTestId("plan-buyers").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshots/plan-buyers.png" });
  await page.getByTestId("plan-marketing").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshots/plan-marketing.png" });
  await page.getByTestId("plan-farming").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshots/plan-farming.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "screenshots/plan-desktop-full.png", fullPage: true });
});
