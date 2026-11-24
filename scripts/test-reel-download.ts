import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { runTest } from "./auth";

// Reel downloads (Michael 11-12: "on apple phones it does not show download"): every delivered file has a real
// Download button. Computer → a file download. Phone → the share sheet ("Save Video" on iPhone); when the
// phone refuses the sheet after a slow fetch, the button asks for one more tap and that tap saves.
// Shares Eduardo's dev orders with the other reel tests: run them one at a time.
const AGENT = "eduardo@spacematchinc.com";
const cx = (fn: string, args: object = {}) =>
  JSON.parse(execSync(`bunx convex run ${fn} '${JSON.stringify(args)}'`, { encoding: "utf8" }).trim() || "null");

runTest("Reel download", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  cx("reelOrders:seedClipInternal", { agentEmail: AGENT });
  await page.setViewportSize({ width: 1100, height: 1000 });
  await helper.goto("/reels");
  await page.getByRole("heading", { name: "Reel Studio" }).waitFor({ timeout: 20000 });
  await page.getByLabel("Order for").selectOption(AGENT);
  await page.getByTestId("clip-list").waitFor({ timeout: 20000 });
  await page.getByTestId("first-free").waitFor({ timeout: 15000 });
  await page.getByTestId("clip-list").getByRole("button").first().click();
  await page.getByRole("button", { name: "Figure it out for me" }).click();
  await page.getByTestId("place-order").click();
  await page.getByText("Free · in line for editing").first().waitFor({ timeout: 15000 });
  const next = cx("reelOrders:nextQueued");
  if (!next?.free || next.agentEmail !== AGENT) throw new Error("free test order not found");
  const id = next._id;
  try {
    cx("reelOrders:workerStatus", { id, status: "editing" });
    const buf = readFileSync(".e2e/reel.mp4");
    for (const f of next.options.formats as string[]) {
      const url = cx("reelOrders:uploadUrl");
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "video/mp4" }, body: buf });
      const { storageId } = (await r.json()) as { storageId: string };
      cx("reelOrders:addOutput", { id, format: f, storageId, size: buf.length, seconds: 2 });
    }
    cx("reelOrders:deliver", { id, note: "Download test." });

    // Computer: Download saves a named .mp4 (no new tab with a bare player).
    await page.getByRole("tab", { name: "My Reels" }).click();
    await page.getByText("Download test.").waitFor({ timeout: 15000 });
    const rows = page.getByTestId("reel-output");
    if ((await rows.count()) !== (next.options.formats as string[]).length) throw new Error("one row per format expected");
    if (await page.getByTestId("reel-ios-hint").count()) throw new Error("iPhone hint shown on a computer");
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.getByTestId("reel-download").first().click()]);
    const name = dl.suggestedFilename();
    if (!/^Eduardo .* - Reel - .+\.mp4$/.test(name)) throw new Error(`file name: ${name}`);
    const saved = await dl.path();
    if (readFileSync(saved).length !== buf.length) throw new Error("downloaded file is not the Reel");
    await page.getByTestId("reel-download").first().and(page.locator('[data-state="saved"]')).waitFor({ timeout: 5000 });
    if (!(await rows.first().getByRole("link", { name: /Open .* in a new tab/ }).getAttribute("href"))?.startsWith("http")) throw new Error("open link lost");
    await page.getByTestId("reel-order").first().screenshot({ path: "screenshots/reel-download-desktop.png" });

    // iPhone: no Download in Safari's player, so the button opens the share sheet. First try is refused
    // (what Safari does after a slow fetch) → "Tap to save" → that tap shares the file.
    await page.addInitScript(() => {
      const w = window as unknown as { __shares: { name: string; type: string; size: number }[]; __refuse: number };
      w.__shares = [];
      w.__refuse = 1;
      Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" });
      const mm = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => (q === "(pointer: coarse)" ? ({ ...mm(q), matches: true, media: q } as MediaQueryList) : mm(q));
      Object.defineProperty(navigator, "canShare", { configurable: true, value: (d: ShareData) => !!d.files?.length });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (d: ShareData) => {
          if (w.__refuse-- > 0) throw new DOMException("no user gesture", "NotAllowedError");
          const f = d.files?.[0];
          w.__shares.push({ name: f?.name ?? "", type: f?.type ?? "", size: f?.size ?? 0 });
        },
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await helper.goto("/reels");
    await page.getByLabel("Order for").selectOption(AGENT);
    await page.getByRole("tab", { name: "My Reels" }).click();
    await page.getByText("Download test.").waitFor({ timeout: 20000 });
    await page.getByTestId("reel-ios-hint").first().waitFor();
    const btn = page.getByTestId("reel-download").first();
    const box = await btn.boundingBox();
    if (!box || box.height < 44) throw new Error("Download button shorter than 44px on a phone");
    const card = await page.getByTestId("reel-order").first().boundingBox();
    if (!card || box.x + box.width > card.x + card.width + 1) throw new Error("Download button runs off the card on a phone");
    let noFile = false;
    page.once("download", () => { noFile = true; });
    await btn.click();
    await btn.and(page.locator('[data-state="ready"]')).waitFor({ timeout: 20000 });
    if (!(await btn.innerText()).includes("Tap to save")) throw new Error("no second-tap prompt");
    await page.getByTestId("reel-ios-hint").first().evaluate(el => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: "screenshots/reel-download-phone-ready.png" });
    await btn.click();
    await btn.and(page.locator('[data-state="saved"]')).waitFor({ timeout: 5000 });
    const shares = await page.evaluate(() => (window as unknown as { __shares: { name: string; type: string; size: number }[] }).__shares);
    if (shares.length !== 1 || shares[0].type !== "video/mp4" || shares[0].size !== buf.length || !shares[0].name.endsWith(".mp4")) throw new Error(`share: ${JSON.stringify(shares)}`);
    if (noFile) throw new Error("phone fell back to a file download instead of the share sheet");
    // Second format: the sheet opens on the first tap when the phone allows it.
    if ((await rows.count()) > 1) {
      const b2 = page.getByTestId("reel-download").nth(1);
      await b2.click();
      await b2.and(page.locator('[data-state="saved"]')).waitFor({ timeout: 20000 });
      const n = await page.evaluate(() => (window as unknown as { __shares: unknown[] }).__shares.length);
      if (n !== 2) throw new Error("second format not shared");
    }
    await page.screenshot({ path: "screenshots/reel-download-phone.png", fullPage: true });
    console.log("reel download ok", name);
  } finally {
    cx("reelOrders:removeInternal", { ids: [id] });
  }
});
