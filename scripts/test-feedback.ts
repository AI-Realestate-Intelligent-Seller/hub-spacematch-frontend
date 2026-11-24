import { runTest } from "./auth";

runTest("Feedback: suggest, me-too, admin review", async helper => {
  const { page } = helper;
  const tag = String(Date.now()).slice(-6);
  const IDEA = `e2e idea ${tag}: seller net sheet`;
  const FIX = `e2e fix ${tag}: Today doesn't load showings`;
  await page.setViewportSize({ width: 1280, height: 900 });
  await helper.goto("/home");
  await page.getByTestId("feedback-link").click();
  await page.getByTestId("feedback-form").waitFor({ timeout: 15000 });

  // Submit an add-on idea with a screenshot
  await page.getByTestId("kind-addon").click();
  await page.getByLabel("Where in the Hub").selectOption("Listings & seller page");
  await page.getByPlaceholder(/buyer net sheet/).fill(IDEA);
  await page.locator("textarea").fill("Would help at listing appointments");
  await page.getByTestId("feedback-file").setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") });
  await page.getByRole("button", { name: "Send to Michael's review" }).click();
  await page.getByText(/in Michael's weekly review/).waitFor({ timeout: 10000 });
  const row = page.getByTestId("idea-row").filter({ hasText: IDEA }).first();
  await row.waitFor({ timeout: 10000 });
  await row.getByText("New feature / add-on").waitFor();
  await row.getByAltText("Screenshot").waitFor();

  // Me too toggles off/on
  await row.getByRole("button", { name: "Remove my vote" }).click();
  await row.getByRole("button", { name: "Me too" }).waitFor({ timeout: 5000 });
  await row.getByRole("button", { name: "Me too" }).click();
  await row.getByRole("button", { name: "Remove my vote" }).waitFor({ timeout: 5000 });

  // A fix gets auto-categorized as a bug
  await page.getByTestId("kind-fix").click();
  await page.getByLabel("Where in the Hub").selectOption("Home & Today");
  await page.getByPlaceholder(/showings/).fill(FIX);
  await page.getByRole("button", { name: "Send to Michael's review" }).click();
  const fix = page.getByTestId("idea-row").filter({ hasText: FIX }).first();
  await fix.waitFor({ timeout: 10000 });
  await fix.getByText("Bug / broken").waitFor();
  await page.screenshot({ path: "screenshots/feedback-agent.png", fullPage: true });

  // Admin review (test user is admin on dev via HUB_TEST_AS)
  const reviewTab = page.getByTestId("review-tab");
  if (await reviewTab.count()) {
    await reviewTab.click();
    const panel = page.getByTestId("review-panel");
    await panel.waitFor();
    const r = panel.getByTestId("idea-row").filter({ hasText: IDEA }).first();
    await r.getByPlaceholder("Note to the agent (optional)").fill("Good one");
    await r.getByRole("button", { name: "Approve" }).click();
    await panel.getByText("Approved, next update").waitFor({ timeout: 8000 });
    await page.screenshot({ path: "screenshots/feedback-review.png", fullPage: true });
    // Phone
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "screenshots/feedback-review-phone.png", fullPage: false });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "Team ideas" }).click();
  }

  // Clean up
  if (process.env.FEEDBACK_KEEP) return;
  page.on("dialog", d => d.accept());
  await page.getByLabel("Filter ideas").selectOption("all");
  for (const t of [IDEA, FIX]) {
    const rr = page.getByTestId("idea-row").filter({ hasText: t }).first();
    await rr.getByRole("button", { name: "Delete" }).click();
    await rr.waitFor({ state: "detached", timeout: 8000 });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "screenshots/feedback-phone.png", fullPage: false });
});
