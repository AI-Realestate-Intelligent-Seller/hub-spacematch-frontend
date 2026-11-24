import { runTest } from "./auth";

runTest("Hub Guide + landing page", async helper => {
  const { page, browser } = helper;
  // Signed-out landing page (fresh context, phone size)
  await helper.goto("/home");
  const base = new URL(page.url()).origin;
  const anon = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ap = await anon.newPage();
  await ap.goto(base + "/");
  await ap.getByText("What's inside").waitFor({ timeout: 15000 });
  const groups = await ap.getByTestId("landing-group").count();
  if (groups !== 5) throw new Error(`expected 5 groups, got ${groups}`);
  await ap.screenshot({ path: "screenshots/landing-mobile.png", fullPage: true });
  await anon.close();

  // Home card → guide
  await page.getByTestId("guide-card").waitFor({ timeout: 15000 });
  await page.screenshot({ path: "screenshots/home-guide-card.png" });
  await page.getByTestId("guide-card").click();
  await page.getByText("What do I use, and when?").waitFor({ timeout: 10000 });
  const n = await page.getByTestId("situation").count();
  if (n < 15) throw new Error(`expected >=15 situations, got ${n}`);
  await page.screenshot({ path: "screenshots/guide-top.png" });

  // Stage filter + open a situation
  await page.getByRole("button", { name: "Active listing" }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="situation"]').length === 3, null, { timeout: 5000 }).catch(() => {});
  const m = await page.getByTestId("situation").count();
  if (m !== 3) throw new Error(`expected 3 listing situations, got ${m}`);
  await page.getByText("I just signed a listing").click();
  await page.getByRole("link", { name: /Launch checklist/ }).waitFor();
  await page.screenshot({ path: "screenshots/guide-listing.png", fullPage: true });

  // Step link goes to the form
  await page.getByRole("link", { name: /Launch checklist/ }).click();
  await page.waitForURL(/\/forms/);

  // Search intent
  await helper.goto("/home");
  await page.getByLabel("Search the hub").fill("which tool");
  await page.getByText("Hub Guide").first().waitFor({ timeout: 5000 });

  // Deep link + search inside guide
  await helper.goto("/guide?s=no-offers");
  await page.getByText("Open the listing's Next steps tab").waitFor({ timeout: 10000 });
  await page.getByLabel("Search the guide").fill("landlord");
  await page.waitForTimeout(400);
  await page.screenshot({ path: "screenshots/guide-search.png", fullPage: true });

  // Phone view
  await page.setViewportSize({ width: 390, height: 844 });
  await helper.goto("/guide");
  await page.getByText("Your first week").waitFor();
  await page.screenshot({ path: "screenshots/guide-mobile.png" });
});
