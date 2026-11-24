// Seller page: "Your Reel across social" (IG/FB/TikTok typed, YouTube auto from
// @spacematchinc — "10 E Ontario" is in a real upload title) + "What we'd do next"
// rule suggestions: agent reviews/edits/publishes, seller approves.
import { runTest } from "./auth";

const SHOTS = "/work/data/broll/hub_feature_shots";

runTest("Seller social reel + next-step suggestions", async helper => {
  const { page } = helper;
  await helper.goto("/listings");
  await page.getByRole("button", { name: /New listing/ }).first().click();
  await page.getByPlaceholder("1234 N Main St, Chicago, IL 60614").fill("10 E Ontario St, Chicago, IL 60611");
  await page.getByLabel(/Seller name/).fill("Sana Test");
  await page.getByRole("button", { name: "Create listing" }).click();
  await page.getByText("Seller's live page").waitFor({ timeout: 15000 });

  // Live 15 days ago → Day-14 pricing + open-house rules fire.
  const live = new Date(Date.now() - 15 * 864e5 - 5 * 36e5).toISOString().slice(0, 10);
  await page.getByRole("button", { name: "Details" }).click();
  await page.locator('input[type="date"]').fill(live);
  await page.getByRole("button", { name: "Save details" }).click();
  await page.getByText("Saved", { exact: true }).waitFor({ timeout: 5000 });

  // TikTok + Facebook typed (2 fields each); YouTube should go auto.
  await page.getByRole("button", { name: "Weekly numbers" }).click();
  await page.getByLabel("TikTok views").fill("4200");
  await page.getByLabel("TikTok link").fill("https://www.tiktok.com/@spacematch/video/1");
  await page.getByLabel("Facebook views").fill("1300");
  await page.getByRole("button", { name: "Save week" }).click();
  await page.getByText("Saved. Your seller sees it now.").waitFor({ timeout: 5000 });
  const yt = page.getByLabel("YouTube Shorts views");
  for (let i = 0; i < 60 && !(await yt.inputValue()); i++) await page.waitForTimeout(1000);
  const ytv = await yt.inputValue();
  if (!/^\d+$/.test(ytv)) throw new Error(`YouTube views not auto-filled: "${ytv}"`);
  await page.getByTestId("social-fields").getByText("· auto").waitFor();
  // Re-save must keep typed TikTok and auto YouTube.
  await page.getByRole("button", { name: "Save week" }).click();
  await page.waitForTimeout(800);
  if ((await page.getByLabel("TikTok views").inputValue()) !== "4200") throw new Error("TikTok lost");
  if ((await yt.inputValue()) !== ytv) throw new Error("YouTube auto overwritten");

  // Suggestions: drafts appear, edit one, dismiss one, add custom, publish.
  await page.getByRole("button", { name: "Next steps" }).click();
  const pricing = page.getByTestId("suggestion").filter({ has: page.locator('input[value="Pricing review against new comps"]') });
  await pricing.waitFor({ timeout: 10000 });
  await pricing.getByLabel("Why").fill("15 days on market and no offers yet. Two new comps listed nearby.");
  const oh = page.getByTestId("suggestion").filter({ has: page.locator('input[value="Schedule an open house"]') });
  await oh.waitFor();
  await page.getByLabel("New suggestion title").fill("Stage the second bedroom");
  await page.getByLabel("New suggestion why").fill("Buyers asked how a queen bed fits.");
  await page.getByRole("button", { name: "Add draft" }).click();
  await page.getByText("Added as a draft").waitFor();
  await page.screenshot({ path: `${SHOTS}/agent-suggestions-editor.png`, fullPage: true });
  await pricing.getByRole("button", { name: "Publish" }).click();
  await page.getByText("Published to your seller's page").first().waitFor();
  await oh.getByRole("button", { name: "Publish" }).click();
  await page.waitForTimeout(600);
  await page.getByTestId("suggestion").filter({ has: page.locator('input[value="Stage the second bedroom"]') }).getByRole("button", { name: "Dismiss" }).click();
  await page.waitForTimeout(600);

  // Seller page, phone width.
  const sellerUrl = (await page.locator(".font-mono").first().textContent())!.trim();
  const ctx2 = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const sp = await ctx2.newPage();
  await sp.goto(sellerUrl.replace(/^https?:\/\/[^/]+/, new URL(page.url()).origin));
  await sp.getByText("Hi Sana").waitFor({ timeout: 15000 });
  const card = sp.getByTestId("social-reel");
  await card.getByTestId("social-tiktok").getByText("4,200").waitFor();
  await card.getByTestId("social-facebook").getByText("1,300").waitFor();
  await card.getByTestId("social-youtube").getByText(/Updated/).waitFor();
  if (await card.getByTestId("social-instagram").count()) throw new Error("Instagram row should be hidden with no data");
  const ns = sp.getByTestId("next-steps");
  await ns.getByText("Two new comps listed nearby").waitFor();
  await ns.getByText("Schedule an open house").waitFor();
  if (await ns.getByText("Stage the second bedroom").count()) throw new Error("Dismissed suggestion visible to seller");
  const body = (await sp.locator("body").textContent()) ?? "";
  if (/buyer'?s agent:/i.test(body)) throw new Error("Buyer agent leaked");
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: `${SHOTS}/seller-social-card.png` });
  await ns.screenshot({ path: `${SHOTS}/seller-suggestions-card.png` });
  await sp.screenshot({ path: `${SHOTS}/seller-page-full-390.png`, fullPage: true });
  await ns.getByRole("button", { name: "Approve plan" }).click();
  await ns.getByTestId("plan-approved").waitFor({ timeout: 10000 });
  await ns.screenshot({ path: `${SHOTS}/seller-suggestions-approved.png` });
  await sp.getByText("Sana approved the plan").waitFor({ timeout: 5000 });

  // Agent sees the approval.
  await page.getByText(/seller approved/).first().waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /^Activity/ }).click();
  await page.getByText("Sana approved the plan").waitFor({ timeout: 5000 });
  await ctx2.close();
  console.log("PASS seller social + suggestions; youtube views", ytv);
});
