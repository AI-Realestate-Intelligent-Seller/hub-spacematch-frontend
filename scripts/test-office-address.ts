// e2e: the office address is Evanston everywhere a client sees it (single source: convex/officeDefs.ts).
import { runTest } from "./auth";
import { OFFICE_ADDRESS, OFFICE_SHORT } from "../convex/officeDefs";

const OLD = /676 N Michigan|Michigan Ave #3010/;

runTest("Office address", async helper => {
  const { page } = helper;
  if (OFFICE_ADDRESS !== "2822 Central St., Evanston, IL 60201") throw new Error(`unexpected office: ${OFFICE_ADDRESS}`);
  // Public mailer landing page (QR target) footer
  await helper.goto("/v/SAMPLE");
  await page.getByText(OFFICE_ADDRESS).first().waitFor({ timeout: 20000 });
  if (OLD.test(await page.locator("body").innerText())) throw new Error("old address on /v/SAMPLE");
  await page.screenshot({ path: "screenshots/office-address-landing.png", fullPage: true });
  // Mailers page: Wise Pelican brand-kit line + sample thumbs load
  await helper.goto("/mailers");
  await page.waitForTimeout(2500);
  if (OLD.test(await page.locator("body").innerText())) throw new Error("old address on /mailers");
  // Lead Desk: meeting-kind label
  await helper.goto("/desk");
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText();
  if (OLD.test(body)) throw new Error("old address on /desk");
  console.log("OFFICE OK", OFFICE_SHORT);
});
