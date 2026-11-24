import { runTest } from "./auth";

// Academy private PDF module (Michael 2026-11-19): Edge track shows the advanced business-sale
// training PDF right after the Galena cheat sheet, served from Convex storage to signed-in team members only.
runTest("Academy advanced training file", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await helper.goto("/training");
  const track = page.getByTestId("track-edge");
  await track.waitFor({ timeout: 15000 });
  await track.getByText("Advanced business sales: financials & bank underwriting").waitFor();
  const link = track.locator('a[data-testid="train-file-advanced-business-underwriting"]');
  await link.waitFor({ timeout: 10000 });
  const galena = track.locator('a[data-testid="train-file-biz-building-cheat-sheet"]');
  await galena.waitFor({ timeout: 10000 });
  const gBox = await galena.boundingBox();
  const aBox = await link.boundingBox();
  if (!gBox || !aBox || aBox.y <= gBox.y) throw new Error("advanced module must sit after the Galena cheat sheet");
  const href = await link.getAttribute("href");
  if (!href || !href.includes("/api/storage/")) throw new Error(`bad href ${href}`);
  if (href.includes("viktor.space/")) throw new Error("file must not be in public/");
  const res = await page.request.get(href);
  const type = res.headers()["content-type"] ?? "";
  if (!res.ok() || !type.includes("pdf")) throw new Error(`PDF fetch failed ${res.status()} ${type}`);
  await link.scrollIntoViewIfNeeded();
  await track.screenshot({ path: "screenshots/training-file-advanced.png" });
  console.log("ADVANCED TRAINING FILE OK", (await res.body()).length, "bytes");
});
