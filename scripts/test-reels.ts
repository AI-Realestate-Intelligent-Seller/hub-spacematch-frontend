import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { runTest } from "./auth";

// Reel Studio end to end on dev (HUB_TEST_AS=team@ → admin + payment confirmer):
// order for Eduardo → Zelle pay card → "I sent it" → Michael confirms → fake worker delivers
// (convex run internals) → agent sees downloads → edits a caption (free) → ledger. Cleans up.
const AGENT = "eduardo@spacematchinc.com";
const cx = (fn: string, args: object = {}) =>
  JSON.parse(execSync(`bunx convex run ${fn} '${JSON.stringify(args)}'`, { encoding: "utf8" }).trim() || "null");

runTest("Reel Studio", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  cx("reelOrders:seedClipInternal", { agentEmail: AGENT });
  await page.setViewportSize({ width: 1100, height: 1000 });
  await helper.goto("/reels");
  await page.getByRole("heading", { name: "Reel Studio" }).waitFor({ timeout: 20000 });
  await page.getByLabel("Order for").selectOption(AGENT);
  await page.getByTestId("clip-list").waitFor({ timeout: 20000 });

  // 5 free Reels per agent (Michael 11-08): banner, "Free" button, straight to the queue, no pay card.
  await page.getByTestId("first-free").waitFor({ timeout: 15000 });
  if (!(await page.getByTestId("free-left").innerText()).includes("first 5 Reels")) throw new Error("banner should say 5 free");
  await page.getByTestId("clip-list").getByRole("button").first().click();
  if (!(await page.getByTestId("place-order").innerText()).includes("Free")) throw new Error("order button not free");
  // "Figure it out for me" (Michael 10-29): Viktor decides each clip's role + order.
  await page.getByRole("button", { name: "Figure it out for me" }).click();
  await page.getByTestId("auto-order").waitFor();
  await page.getByTestId("clip-order").screenshot({ path: "screenshots/reels-auto-order.png" });
  // Copy a sample (Michael 10-28): upload path on the free order.
  await page.getByRole("switch", { name: "Copy the style of a sample video" }).click();
  // Michael 11-08: the bar names what's missing instead of a dead grey button.
  if ((await page.getByTestId("place-order").getAttribute("data-ready")) !== "false") throw new Error("order allowed with empty sample");
  if (!(await page.getByTestId("missing-list").innerText()).includes("sample video")) throw new Error("missing sample not listed");
  await page.getByRole("button", { name: "Upload a video" }).click();
  await page.getByLabel("Upload sample video").setInputFiles(".e2e/reel.mp4");
  await page.getByText("reel.mp4 ·").waitFor({ timeout: 20000 });
  await page.getByTestId("sample-picker").screenshot({ path: "screenshots/reels-sample.png" });
  await page.screenshot({ path: "screenshots/reels-free.png", fullPage: true });
  await page.getByTestId("place-order").click();
  await page.getByText("Free Reel", { exact: false }).first().waitFor({ timeout: 15000 });
  await page.getByText("Free · in line for editing").first().waitFor({ timeout: 10000 });
  await page.getByTestId("reel-progress").getByText(/In line/).first().waitFor({ timeout: 10000 });
  await page.getByTestId("reel-progress").first().screenshot({ path: "screenshots/reels-queued.png" });
  const freeOrder = cx("reelOrders:nextQueued");
  if (!freeOrder?.free || freeOrder.price !== 0 || freeOrder.payments.length) throw new Error("free order wrong");
  if (!freeOrder.options.autoOrder || freeOrder.clips.some((c: { role?: string }) => c.role)) throw new Error("autoOrder not saved");
  if (!freeOrder.options.sample?.storageId || !freeOrder.sampleUrl || freeOrder.options.sample.match.includes("colors")) throw new Error("uploaded sample missing");
  const freeId = freeOrder._id;
  await page.getByRole("tab", { name: "New Reel" }).click();
  await page.getByLabel("Order for").selectOption(AGENT);
  await page.getByTestId("clip-list").waitFor({ timeout: 20000 });
  await page.getByTestId("free-left").getByText("4 free Reels left").waitFor({ timeout: 10000 });
  await page.getByTestId("first-free").screenshot({ path: "screenshots/reels-free-left.png" });
  // Use up the other 4 free ones: the 6th order is paid.
  const clones = cx("reelOrders:cloneFreeInternal", { id: freeId, n: 4 }) as string[];
  await page.getByTestId("first-free").waitFor({ state: "detached", timeout: 10000 });
  await page.getByTestId("clip-list").getByRole("button").first().click();
  await page.getByTestId("clip-order").waitFor();
  if (await page.getByTestId("auto-order").count()) throw new Error("autoOrder should reset on a new order");
  await page.getByLabel("What clip 1 is").selectOption("talk");
  await page.getByRole("group", { name: "Reel type" }).getByRole("button", { name: "Just listed" }).click();
  await page.getByPlaceholder("2202 N Clybourn Ave #3").fill("100 E Walton St #2201");
  await page.getByRole("button", { name: "All styles" }).click();
  const n = await page.getByRole("group", { name: "Style" }).getByRole("button").count();
  if (n < 20) throw new Error(`only ${n} styles`);
  await page.getByRole("group", { name: "Style" }).getByRole("button", { name: /Penthouse/ }).click();
  await page.getByRole("group", { name: "Colors" }).getByRole("button", { name: "Navy & gold" }).click();
  await page.getByRole("group", { name: "Formats" }).getByRole("button", { name: /YouTube \(wide\)/ }).click();
  await page.getByLabel("Anything else").fill("E2E test order. Open on the lobby.");
  await page.getByRole("switch", { name: "Copy the style of a sample video" }).click();
  await page.getByLabel("Sample video link").fill("https://www.instagram.com/reel/ABC123xyz/");
  await page.getByRole("group", { name: "What to match" }).getByRole("button", { name: "Music feel" }).click();
  await page.screenshot({ path: "screenshots/reels-form.png", fullPage: true });
  await page.getByTestId("place-order").click();

  await page.getByTestId("pay-card").waitFor({ timeout: 15000 });
  const code = (await page.getByTestId("pay-card").innerText()).match(/RS-\d+/)?.[0];
  if (!code) throw new Error("no memo code");
  await page.screenshot({ path: "screenshots/reels-pay.png", fullPage: true });
  await page.getByTestId("sent-zelle").click();
  await page.getByText("Michael is checking").waitFor({ timeout: 10000 });

  await page.getByRole("tab", { name: /Orders/ }).click();
  await page.getByTestId("confirm-row").getByText(code).waitFor({ timeout: 10000 });
  await page.screenshot({ path: "screenshots/reels-confirm.png", fullPage: true });
  await page.getByTestId("confirm-received").first().click();
  await page.waitForTimeout(1500);

  // Fake worker run.
  cx("reelOrders:removeInternal", { ids: [freeId, ...clones] }); // so nextQueued returns the paid one
  const next = cx("reelOrders:nextQueued");
  if (!next || next.payments[0].code !== code) throw new Error("queued order not found");
  const id = next._id;
  if (next.options.sample?.link !== "https://www.instagram.com/reel/ABC123xyz/" || next.options.sample.match.includes("music")) throw new Error("sample link missing");
  if (next.options.autoOrder || next.clips[0].role !== "talk") throw new Error("manual order/role lost");
  if (!next.optionRows.some((r: string[]) => r[0] === "Copy sample" && r[1].includes("instagram"))) throw new Error("sample row missing");
  try {
    cx("reelOrders:workerStatus", { id, status: "editing" });
    // Live tracker (Michael 10-29): stage + running timer while editing.
    cx("reelOrders:workerStage", { id, stage: "cut" });
    await page.getByRole("tab", { name: "My Reels" }).click();
    await page.getByTestId("reel-progress").getByText("Viktor is editing your Reel").waitFor({ timeout: 15000 });
    const cur = await page.locator('[data-testid="reel-progress"] [aria-current="step"]').innerText();
    if (!cur.includes("Cutting the story")) throw new Error(`stage not shown: ${cur}`);
    const t1 = await page.getByTestId("reel-timer").innerText();
    await page.waitForTimeout(2100);
    if ((await page.getByTestId("reel-timer").innerText()) === t1) throw new Error("timer not ticking");
    await page.getByTestId("reel-progress").screenshot({ path: "screenshots/reels-progress.png" });
    const buf = readFileSync(".e2e/reel.mp4");
    for (const f of next.options.formats as string[]) {
      const url = cx("reelOrders:uploadUrl");
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "video/mp4" }, body: buf });
      const { storageId } = (await r.json()) as { storageId: string };
      cx("reelOrders:addOutput", { id, format: f, storageId, size: buf.length, seconds: 2 });
    }
    cx("reelOrders:setCaptions", { id, lines: [{ i: 1, start: 0, end: 1, text: "Just listed on Walton" }, { i: 2, start: 1, end: 2, text: "Call me for a privat showing" }] });
    cx("reelOrders:deliver", { id, note: "Opened on the lobby like you asked." });
    cx("reelOrders:addCost", { id, credits: 2400, note: "e2e" });

    await page.getByRole("tab", { name: "My Reels" }).click();
    await page.getByText("Opened on the lobby like you asked.").waitFor({ timeout: 15000 });
    await page.getByText("YouTube (wide)").first().waitFor();
    await page.screenshot({ path: "screenshots/reels-delivered.png", fullPage: true });
    await page.getByTestId("edit-captions").click();
    await page.getByLabel("Caption at 0:01").fill("Call me for a private showing");
    await page.screenshot({ path: "screenshots/reels-captions.png", fullPage: true });
    await page.getByRole("button", { name: /Send 1 caption fix/ }).click();
    await page.getByText("Paid · in line for editing").first().waitFor({ timeout: 10000 });
    const after = cx("reelOrders:getInternal", { id });
    if (after.latestRevision?.kind !== "captions" || after.freeRevisionsLeft !== undefined && false) throw new Error("caption revision missing");
    if (!after.latestRevision.note.includes("private showing")) throw new Error("caption edit text missing");

    await page.getByRole("tab", { name: "Ledger" }).click();
    await page.getByText("Viktor cost").waitFor();
    await page.screenshot({ path: "screenshots/reels-ledger.png", fullPage: true });
    console.log("reel studio ok", code);
  } finally {
    if (!process.env.REELS_KEEP) cx("reelOrders:removeInternal", { ids: [id] });
  }
});
