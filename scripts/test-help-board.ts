import { runTest } from "./auth";

runTest("Help board + tool setup", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 1280, height: 900 });
  await helper.goto("/home");
  const setup = page.getByTestId("tool-setup");
  await setup.waitFor({ timeout: 15000 });
  const before = await setup.locator("span.text-sm.font-semibold").innerText();
  await setup.getByRole("button", { name: /Tick Lofty CRM|Untick Lofty CRM/ }).click();
  await page.waitForTimeout(800);
  const after = await setup.locator("span.text-sm.font-semibold").innerText();
  if (before === after) throw new Error(`Setup count didn't change (${before})`);
  await setup.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshots/tool-setup.png", clip: { x: 0, y: Math.max(0, (await setup.boundingBox())!.y - 60), width: 1280, height: 620 } });

  // New urgent request
  await page.getByTestId("request-help-CC").click();
  await page.getByTestId("help-dialog").waitFor();
  await page.getByRole("button", { name: "Sign install / removal" }).click();
  await page.locator("textarea").fill("e2e board test — please ignore");
  await page.getByRole("button", { name: /Send to Cris/ }).click();
  await page.getByText(/Sent to Cris/).waitFor({ timeout: 10000 });

  await helper.goto("/help");
  const newCol = page.getByTestId("help-col-new");
  const card = newCol.getByTestId("help-card").filter({ hasText: "e2e board test" }).first();
  await card.waitFor({ timeout: 10000 });
  await card.getByPlaceholder("Note for the agent (optional)").fill("On it, sign goes in Thursday");
  await card.getByRole("button", { name: "Start" }).click();
  const prog = page.getByTestId("help-col-in_progress").getByTestId("help-card").filter({ hasText: "e2e board test" }).first();
  await prog.waitFor({ timeout: 10000 });
  await prog.getByText("On it, sign goes in Thursday").waitFor();
  await prog.getByLabel("Reassign").selectOption("tc@spacematchinc.com");
  await prog.getByText(/→ Anthony/).waitFor({ timeout: 8000 });
  await page.screenshot({ path: "screenshots/help-board.png", fullPage: true });
  await page.getByLabel("Filter urgency").selectOption("now");
  await page.getByLabel("Filter urgency").selectOption("");

  // Phone layout: one column at a time
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^In progress \(/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "screenshots/help-board-phone.png", fullPage: false });

  // Clean up: mark done
  await page.setViewportSize({ width: 1280, height: 900 });
  await prog.getByRole("button", { name: "Done" }).click();
  await page.getByTestId("help-col-done").getByText("e2e board test").first().waitFor({ timeout: 8000 });
});
