import { runTest } from "./auth";

// Academy private PDF module (Michael 2026-11-19): Edge track shows the business + building cheat sheet,
// served from Convex storage to signed-in team members only.
runTest("Academy training file", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await helper.goto("/training");
  const track = page.getByTestId("track-edge");
  await track.waitFor({ timeout: 15000 });
  await track.getByText("Cheat sheet: selling a business with its building").waitFor();
  const link = track.locator('a[data-testid="train-file-biz-building-cheat-sheet"]');
  await link.waitFor({ timeout: 10000 });
  const href = await link.getAttribute("href");
  if (!href || !href.includes("/api/storage/")) throw new Error(`bad href ${href}`);
  const res = await page.request.get(href);
  const type = res.headers()["content-type"] ?? "";
  if (!res.ok() || !type.includes("pdf")) throw new Error(`PDF fetch failed ${res.status()} ${type}`);
  if (href.includes("viktor.space/")) throw new Error("file must not be in public/");
  await track.scrollIntoViewIfNeeded();
  await track.screenshot({ path: "screenshots/training-file-edge.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await helper.goto("/training");
  await page.getByTestId("track-edge").scrollIntoViewIfNeeded();
  await page.getByTestId("track-edge").screenshot({ path: "screenshots/training-file-phone.png" });
  console.log("TRAINING FILE OK", (await res.body()).length, "bytes");
});
