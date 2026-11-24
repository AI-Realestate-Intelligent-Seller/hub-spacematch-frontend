import { runTest } from "./auth";
// Read-only prod check + screenshots for the Market myself pages (no writes).
const dir = "screenshots/market-me";
runTest("market-me prod shots", async helper => {
  const { page } = helper;
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [p, id] of [["/do/market", "moment-page"], ["/reviews", "reviews-page"], ["/open-houses", "oh-page"], ["/past-clients", "pc-page"], ["/post-ideas", "pi-page"], ["/market-update", "mu-page"], ["/c/michael-kang", "public-card"]] as const) {
    await helper.goto(p);
    await page.getByTestId(id).waitFor({ timeout: 20000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${dir}/prod${p.replace(/\//g, "_")}.png` });
  }
  await helper.goto("/card");
  await page.getByText(/Share it|isn't on the team roster/).first().waitFor({ timeout: 20000 });
  await helper.goto("/r/doesnotexist");
  await page.getByText("This link isn't active anymore").waitFor({ timeout: 20000 });
  if (errors.length) throw new Error(errors.join(" | "));
  console.log("PROD_OK");
});
