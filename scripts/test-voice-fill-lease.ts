// "Talk it in" on /lease (residential): fake mic plays a dictated lease request; transcript → parseLeaseDictation → form.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PageHelper, ensureTestUserExists, revokeSpaceSession } from "./auth";

const wav = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "voice-fill-lease.wav");

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
    await helper.goto("/lease");
    await page.getByTestId("voice-fill").waitFor({ timeout: 15000 });
    await helper.screenshot("voice-lease-idle.png");
    await page.getByTestId("voice-mic").click();
    await page.getByTestId("voice-live").waitFor({ timeout: 30000 });
    await page.getByTestId("voice-filled").waitFor({ timeout: 120000 });
    await page.waitForTimeout(800);
    const val = (n: string) => page.locator(`input[name="${n}"]`).inputValue();
    const got = { street: await val("street"), city: await val("city"), zip: await val("zip"), clientName: await val("clientName") };
    console.log("filled:", JSON.stringify(got));
    const chips = await page.getByTestId("voice-filled").innerText();
    console.log("chips:", chips.replace(/\s+/g, " "));
    if (!/845 Chicago/i.test(got.street)) throw new Error(`street not filled: ${got.street}`);
    if (!/Evanston/i.test(got.city)) throw new Error(`city not filled: ${got.city}`);
    if (got.zip !== "60202") throw new Error(`zip not filled: ${got.zip}`);
    if (!/Lopez/.test(got.clientName)) throw new Error(`client not filled: ${got.clientName}`);
    if ((await page.getByTestId("bt-condo-unit").getAttribute("aria-checked")) !== "true") throw new Error("building type not picked");
    for (const c of ["Beds", "Laundry", "Utilities", "Rent wanted"]) if (!chips.includes(c)) throw new Error(`chip missing: ${c}`);
    if (!(await page.locator("#util-heat").isChecked())) throw new Error("heat not checked");
    if (!(await page.locator("#amen-dishwasher").isChecked())) throw new Error("dishwasher not checked");
    await helper.screenshot("voice-lease-filled.png");
    await page.screenshot({ path: "screenshots/voice-lease-full.png", fullPage: true });
    await page.getByTestId("voice-undo").click();
    await page.waitForTimeout(500);
    if ((await val("street")) !== "") throw new Error("undo did not clear the street");
    console.log("\n✅ Lease voice fill PASSED\n");
  } catch (e) {
    console.error("\n❌ Lease voice fill FAILED\n", e instanceof Error ? e.message : e);
    await helper.screenshot(`voice-lease-error-${Date.now()}.png`).catch(() => {});
    await helper.printDebugInfo().catch(() => {});
    process.exitCode = 1;
  } finally {
    if (sid) await revokeSpaceSession(sid).catch(() => {});
    await browser.close();
  }
})();
