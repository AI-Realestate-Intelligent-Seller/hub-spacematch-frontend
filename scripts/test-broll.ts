import { runTest } from "./auth";

// B-Roll Library: home link → /broll, filters, viewer plays a Convex-stored clip, download button ready.
runTest("B-Roll Library (browse, filter, preview)", async helper => {
  const { page } = helper;
  await helper.goto("/broll"); // the Home tile moved in the Home redesign
  await page.getByRole("heading", { name: "B-Roll Library" }).waitFor({ timeout: 15000 });
  const tiles = page.getByTestId("broll-tile");
  const all = await tiles.count();
  if (all < 60) throw new Error(`Expected many tiles, got ${all}`);
  await page.screenshot({ path: "screenshots/broll-all.png", fullPage: false });

  await page.getByRole("button", { name: "Title cards & stickers", exact: true }).click();
  await page.getByText("Just Listed title card", { exact: true }).waitFor({ timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-testid=broll-tile]").length === 34, null, { timeout: 5000 }).catch(() => {});
  const st = await tiles.count();
  if (st !== 34) throw new Error(`Expected 34 sticker tiles, got ${st}`);

  await page.getByRole("button", { name: "Your name & end card", exact: true }).click();
  await page.getByTestId("broll-agent").selectOption("Michael Kang");
  await page.waitForFunction(() => document.querySelectorAll("[data-testid=broll-tile]").length === 2, null, { timeout: 5000 }).catch(() => {});
  if ((await tiles.count()) !== 2) throw new Error("Agent filter should leave 2 clips");
  await page.getByText("Michael Kang: end card").click();
  const v = page.locator("video");
  await v.waitFor({ timeout: 10000 });
  await page.waitForFunction(() => { const el = document.querySelector("video"); return !!el && el.readyState >= 2; }, null, { timeout: 15000 });
  if (await page.getByTestId("broll-download").isDisabled()) throw new Error("Download should be enabled");
  await page.screenshot({ path: "screenshots/broll-viewer.png", fullPage: false });
  // Shared save helper (lib/saveVideo): on a computer the button saves the named .mp4.
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.getByTestId("broll-download").click()]);
  if (!dl.suggestedFilename().endsWith(".mp4")) throw new Error(`download name: ${dl.suggestedFilename()}`);
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByTestId("broll-search").fill("buyer");
  await page.getByText("Buyer path to the keys").waitFor({ timeout: 5000 });
  console.log("broll ok", all, st);
});
