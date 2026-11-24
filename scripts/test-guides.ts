import { statSync } from "node:fs";
import { runTest } from "./auth";

runTest("Buyer & Seller guides", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await helper.goto("/presentations?guide=buyer");
  await page.getByTestId("guides").waitFor({ timeout: 15000 });
  await page.getByText("Home Buyer's Guide").first().waitFor();
  await page.getByTestId("guide-client").fill("Jane & Tom Smith");
  for (const k of ["buyer", "seller"]) {
    const dl = page.waitForEvent("download", { timeout: 40000 });
    await page.getByTestId(`dl-${k}`).click();
    const d = await dl;
    const path = `screenshots/${d.suggestedFilename()}`;
    await d.saveAs(path);
    const size = statSync(path).size;
    console.log("DOWNLOADED", path, size);
    if (size < 500_000) throw new Error(`${k} guide too small: ${size}`);
  }
  await page.getByTestId("guides").screenshot({ path: "screenshots/guides.png" });
  await helper.goto("/templates?q=guide");
  await page.getByText("Home Buyer's Guide (branded for you)").first().waitFor({ timeout: 10000 });
  await page.getByText("Home Seller's Guide (branded for you)").first().waitFor({ timeout: 10000 });
  if (await page.getByText("SpaceMatch Standard Seller Guide").count()) throw new Error("old seller guide still listed");
  await helper.goto("/home");
  await page.getByText("Decks & guides").first().waitFor({ timeout: 10000 });
  console.log("GUIDES OK");
});
