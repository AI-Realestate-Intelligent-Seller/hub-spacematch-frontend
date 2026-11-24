// "Talk it in" on /new: Chromium's fake mic plays a dictated request; live transcript → parse → form filled.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PageHelper, ensureTestUserExists, revokeSpaceSession } from "./auth";

const wav = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "voice-fill-dictation.wav");

(async () => {
  const browser = await chromium.launch({
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${wav}%noloop`,
    ],
  });
  const context = await browser.newContext({ permissions: ["microphone"], viewport: { width: 420, height: 900 } });
  const page = await context.newPage();
  const helper = new PageHelper(page, browser, context);
  let sid: string | undefined;
  try {
    sid = await ensureTestUserExists(page);
    await helper.goto("/new");
    await page.getByTestId("voice-fill").waitFor({ timeout: 15000 });
    await helper.screenshot("voice-idle.png");
    await page.getByTestId("voice-mic").click();
    await page.getByTestId("voice-live").waitFor({ timeout: 30000 });
    await page.waitForTimeout(9000);
    await helper.screenshot("voice-listening.png");
    await page.getByTestId("voice-filled").waitFor({ timeout: 90000 });
    await page.waitForTimeout(800);
    const val = (n: string) => page.locator(`input[name="${n}"]`).inputValue();
    const got = {
      street: await val("street"), city: await val("city"), zip: await val("zip"),
      clientName: await val("clientName"),
    };
    console.log("filled:", JSON.stringify(got));
    console.log("chips:", await page.getByTestId("voice-filled").innerText());
    if (!/1234 Ashland/i.test(got.street)) throw new Error(`street not filled: ${got.street}`);
    if (!/Evanston/i.test(got.city)) throw new Error(`city not filled: ${got.city}`);
    if (got.zip !== "60201") throw new Error(`zip not filled: ${got.zip}`);
    if (!/Park/.test(got.clientName)) throw new Error(`client not filled: ${got.clientName}`);
    if (!(await page.getByLabel("Kitchen remodel").isChecked())) throw new Error("kitchen upgrade not checked");
    await helper.screenshot("voice-filled.png");
    await page.screenshot({ path: "screenshots/voice-filled-full.png", fullPage: true });
    await page.getByTestId("voice-undo").click();
    await page.waitForTimeout(500);
    if ((await val("street")) !== "") throw new Error("undo did not clear the street");
    console.log("\n✅ Voice fill PASSED\n");
  } catch (e) {
    console.error("\n❌ Voice fill FAILED\n", e instanceof Error ? e.message : e);
    await helper.screenshot(`voice-error-${Date.now()}.png`).catch(() => {});
    await helper.printDebugInfo().catch(() => {});
    process.exitCode = 1;
  } finally {
    if (sid) await revokeSpaceSession(sid).catch(() => {});
    await browser.close();
  }
})();
