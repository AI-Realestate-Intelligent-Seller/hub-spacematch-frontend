import { execSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { runTest } from "./auth";

// Reel Studio on a phone (Michael 11-08): missing steps are flagged, the order bar sits above the
// phone tab bar at a Fold-width portrait screen (640–767 px, where it used to hide), and a clip
// uploaded straight from the phone goes up in 16 MB parts, lands in the Reel and reaches the worker brief.
const AGENT = "eduardo@spacematchinc.com";
const cx = (fn: string, args: object = {}) =>
  JSON.parse(execSync(`bunx convex run ${fn} '${JSON.stringify(args)}'`, { encoding: "utf8" }).trim() || "null");

runTest("Reel Studio phone upload", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await page.setViewportSize({ width: 706, height: 1000 });
  await helper.goto("/reels");
  await page.getByRole("heading", { name: "Reel Studio" }).waitFor({ timeout: 20000 });
  await page.getByLabel("Order for").selectOption(AGENT);
  await page.getByTestId("clip-uploader").waitFor({ timeout: 20000 });

  // Nothing picked: bar says what's left; tapping it flags step 2.
  await page.getByTestId("missing-list").getByText("Add your videos").waitFor();
  await page.getByTestId("place-order").click();
  await page.locator('#reel-step-clips[data-need="needed"]').getByText("Needed").waitFor();
  await page.waitForTimeout(1200);
  if ((await page.evaluate(() => window.scrollY)) < 200) throw new Error("tapping What's left didn't jump to step 2");

  // Order bar fully above the phone tab bar.
  const bar = await page.getByTestId("order-bar").locator("> div").boundingBox();
  const tab = await page.locator("nav.fixed").boundingBox();
  if (!bar || !tab) throw new Error("bar/tab not found");
  if (bar.y + bar.height > tab.y + 1) throw new Error(`order bar hidden behind tab bar: ${bar.y + bar.height} > ${tab.y}`);
  await page.screenshot({ path: "screenshots/reels-phone-missing.png" });

  // 35 MB "phone video" → 3 parts.
  const buf = randomBytes(35 * 1024 * 1024);
  const sha = createHash("sha256").update(buf).digest("hex");
  await page.getByLabel("Add videos from your phone").setInputFiles({ name: "IMG_4411.MOV", mimeType: "video/quicktime", buffer: buf });
  await page.getByTestId("upload-row").getByText(/% of/).first().waitFor({ timeout: 10000 }).catch(() => null);
  await page.getByTestId("upload-row").getByText("Done · in your Reel").waitFor({ timeout: 120000 });
  await page.getByTestId("clip-order").getByText("IMG_4411.MOV").waitFor();
  await page.locator('#reel-step-clips[data-need="done"]').waitFor();
  await page.getByTestId("clip-list").getByText("IMG_4411.MOV").waitFor({ timeout: 10000 });
  if ((await page.getByTestId("place-order").getAttribute("data-ready")) !== "true") throw new Error("not ready after upload");
  await page.getByTestId("clip-uploader").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshots/reels-phone-uploaded.png" });

  // Look step (Michael 11-08): "Trending now" is the default and says what it will do; captions never go mid-face.
  await page.getByTestId("trend-pick").getByText("This week for").waitFor({ timeout: 10000 });
  // Michael 11-08 "there should be some on top and the middle": thumbnails show each style's own caption spot.
  await page.getByRole("button", { name: "All styles", exact: true }).click();
  await page.getByRole("group", { name: "Style" }).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -140));
  await page.waitForTimeout(400);
  await page.screenshot({ path: "screenshots/reels-phone-styles.png" });
  await page.getByTestId("caption-spot").getByRole("button", { name: /^Top/ }).click();
  await page.getByTestId("trend-pick").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "screenshots/reels-phone-look.png" });

  // Music (Michael 11-08): every mood plays, 2 versions each, and this week's trending songs.
  const mp = page.getByTestId("music-picker");
  // "How do I listen to these" (Michael 11-08): each trending song has a ▶ with Apple's 30 s preview + full-song link.
  const ts = mp.getByTestId("trend-sounds");
  await ts.getByRole("button", { name: /^Play Hold On/ }).click();
  await ts.getByRole("button", { name: /^Stop Hold On/ }).waitFor({ timeout: 15000 });
  await ts.getByRole("link", { name: /Full song/ }).first().waitFor();
  await ts.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "screenshots/reels-phone-songs.png" });
  await ts.getByRole("button", { name: /^Stop Hold On/ }).click();
  await mp.getByTestId("trend-sounds").getByRole("button", { name: "Use" }).first().click();
  await mp.getByTestId("trend-sounds").getByRole("button", { name: "Picked" }).waitFor();
  await mp.getByRole("button", { name: "Luxury / elegant", exact: true }).click();
  await mp.getByTestId("music-takes").getByRole("button", { name: /Version B/ }).click();
  await mp.getByRole("button", { name: "Play version B" }).click();
  const mres = await page.request.get(new URL("/reel-music/luxury_b.mp3", page.url()).href);
  if (mres.status() !== 200 || (await mres.body()).length < 100_000) throw new Error("music sample missing");
  await mp.getByTestId("music-takes").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  await page.waitForTimeout(400);
  await page.screenshot({ path: "screenshots/reels-phone-music.png" });

  const ups = cx("reelOrders:listClipUploadsInternal").filter((u: { agentEmail: string; name: string }) => u.agentEmail === AGENT && u.name === "IMG_4411.MOV");
  const upId = ups[ups.length - 1]?._id;
  if (!upId || ups[ups.length - 1].parts !== 3) throw new Error(`upload not saved in 3 parts: ${JSON.stringify(ups)}`);

  let orderId: string | undefined;
  try {
    await page.getByTestId("place-order").click();
    await page.getByRole("tab", { name: "My Reels", selected: true }).waitFor({ timeout: 15000 });
    const queued = cx("reelOrders:listInternal", {}) as { _id: string; agentName: string; createdAt: number }[];
    orderId = queued.sort((a, b) => b.createdAt - a.createdAt)[0]?._id;
    const o = cx("reelOrders:getInternal", { id: orderId });
    const hub = o.hubClips?.[0];
    if (o.style.key !== "trending" || o.style.position !== "upper" || o.captionSpot !== "high") throw new Error(`caption spot/style wrong in brief: ${JSON.stringify(o.style)}`);
    if (o.musicFile !== "luxury_b.mp3" || o.options.trendSound) throw new Error(`music take wrong in brief: ${o.musicFile} ${o.options.trendSound}`);
    if (!o.trend?.pick?.name) throw new Error("trend pick missing from worker brief");
    if (!hub || hub.partUrls.length !== 3 || o.clips[0].id !== `hub:${upId}`) throw new Error("hub clip not in worker brief");
    const parts = await Promise.all(hub.partUrls.map((u: string) => fetch(u).then(r => r.arrayBuffer())));
    const joined = Buffer.concat(parts.map(p => Buffer.from(p)));
    if (createHash("sha256").update(joined).digest("hex") !== sha) throw new Error("joined parts don't match the file");
    console.log("reel phone upload ok", orderId, joined.length);
  } finally {
    if (orderId) cx("reelOrders:removeInternal", { ids: [orderId] });
    cx("reelOrders:removeClipUploadInternal", { id: upId });
  }
});
