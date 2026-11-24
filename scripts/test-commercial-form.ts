import { writeFileSync } from "node:fs";
import { runTest } from "./auth";

runTest("Commercial CMA request with OM upload", async helper => {
  const { page } = helper;
  writeFileSync("/tmp/Test_OM.pdf", "%PDF-1.4\n% test offering memorandum\n");
  writeFileSync("/tmp/Rent_Roll.csv", "unit,rent\n1,1500\n2,1650\n");
  await helper.goto("/new");
  await page.waitForTimeout(2000);
  await page.getByTestId("kind-commercial").click();
  await page.getByTestId("agent").click();
  await page.getByRole("option", { name: "Michael Kang" }).click();
  await page.locator('input[name="clientName"]').fill("Test Owner LLC");
  await page.locator('input[name="street"]').fill("1234 W Test Ave");
  await page.locator('input[name="city"]').fill("Chicago");
  await page.locator('input[name="zip"]').fill("60640");
  await page.locator('input[name="buildingSf"]').fill("9800");
  await page.locator('input[name="units"]').fill("8");
  await page.getByTestId("condition").click();
  await page.getByRole("option", { name: "Average / well maintained" }).click();
  await page.locator('input[name="noi"]').fill("$96,000");
  await page
    .getByTestId("file-input")
    .setInputFiles(["/tmp/Test_OM.pdf", "/tmp/Rent_Roll.csv"]);
  await page.getByTestId("file-list").waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "screenshots/commercial-form-full.png",
    fullPage: true,
  });
  await page.getByTestId("submit-cma").click();
  await page
    .getByText("Commercial CMA request received")
    .waitFor({ timeout: 20000 });
  await helper.screenshot("commercial-submitted.png");
  await helper.goto("/requests");
  await page.waitForTimeout(2500);
  await page.getByText("Rent_Roll.csv").first().waitFor({ timeout: 10000 });
  await helper.screenshot("commercial-requests.png");
}).catch(e => {
  console.error(e);
  process.exit(1);
});
