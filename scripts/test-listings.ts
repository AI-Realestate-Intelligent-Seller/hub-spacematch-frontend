import { runTest } from "./auth";

runTest("Seller Launch Portal", async helper => {
  const { page } = helper;
  await helper.goto("/listings");
  await page.getByRole("button", { name: /New listing/ }).first().click();
  await page.getByPlaceholder("1234 N Main St, Chicago, IL 60614").fill("5907 N Campbell Ave, Chicago, IL 60659");
  await page.getByPlaceholder("If you have it").fill("11027056");
  await page.getByPlaceholder("$549,000").fill("$445,000");
  await page.getByLabel(/Seller name/).fill("Jordan Test");
  await page.getByRole("button", { name: "Create listing" }).click();
  await page.getByText("Seller's live page").waitFor({ timeout: 15000 });
  const url = page.url();
  const id = url.split("/listings/")[1];
  console.log("LISTING_ID", id);

  // Tick three launch steps (media, coming soon, MLS live).
  for (const s of ["Media day", "Coming Soon", "Live on MLS"]) {
    await page.getByRole("button", { name: `Mark ${s} done` }).click();
    await page.waitForTimeout(400);
  }
  await page.getByText("Active", { exact: true }).first().waitFor({ timeout: 5000 });
  await page.screenshot({ path: "screenshots/listing-steps.png", fullPage: true });

  // Weekly numbers.
  await page.getByRole("button", { name: "Weekly numbers" }).click();
  const inputs = page.locator("form input[inputmode=numeric]");
  const vals = ["412", "37", "6", "4", "3"];
  for (let i = 0; i < vals.length; i++) await inputs.nth(i).fill(vals[i]);
  await page.getByRole("button", { name: "Save week" }).click();
  await page.getByText("Saved. Your seller sees it now.").waitFor({ timeout: 5000 });

  // Paste a ShowingTime feedback email → review → publish.
  await page.getByRole("button", { name: /Activity/ }).click();
  await page.getByText("Paste a ShowingTime email").click();
  await page.getByPlaceholder("FEEDBACK RECEIVED | 123 N Main St…").fill(
    "FEEDBACK RECEIVED | 5907 North Campbell Avenue, Chicago, Illinois 60659\n\nFeedback Received for\n5907 North Campbell Avenue Chicago, Illinois 60659\n$445,000 | ACTIVE | MLS# 11027056\n\n1. Is your client interested in this listing? Somewhat interested 2. Please rate your overall experience at this showing. Good 3. Your (and your client's) opinion of the price: Just right 4. Please rate this listing (5=Best; 1=Worst): 4 5. COMMENTS / RECOMMENDATIONS: Beautiful kitchen, buyers want a second look.\n\nPublish to Seller\n\nAppointment Details\nShowing Wed, March 24, 2021 11:30 AM - 12:00 PM\n\nBuyer's Agent Details\n\nCurtis Oliver\nI Got Properties\n",
  );
  await page.getByRole("button", { name: "Add it" }).click();
  await page.getByText(/Review before your seller sees it/).waitFor({ timeout: 5000 });
  await page.getByText(/Buyer's agent: Curtis Oliver/).waitFor({ timeout: 5000 });
  await page.screenshot({ path: "screenshots/listing-review.png", fullPage: true });
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByPlaceholder(/Broker open went great/).fill("Broker open: 14 agents came through");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await page.getByText("Posted to your seller's page").waitFor({ timeout: 5000 });

  // Seller view (public, no login) must show data but never the buyer agent.
  const sellerUrl = (await page.locator(".font-mono").first().textContent())!.trim();
  const ctx2 = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 } });
  const sp = await ctx2.newPage();
  await sp.goto(sellerUrl.replace(/^https?:\/\/[^/]+/, new URL(page.url()).origin));
  await sp.getByText("Hi Jordan").waitFor({ timeout: 15000 });
  await sp.getByText("Beautiful kitchen").waitFor({ timeout: 5000 });
  await sp.getByText("Broker open: 14 agents came through").waitFor({ timeout: 5000 });
  await sp.getByText("412").first().waitFor({ timeout: 5000 });
  if ((await sp.getByText("Curtis Oliver").count()) > 0) throw new Error("Buyer agent leaked to seller view");
  await sp.screenshot({ path: "screenshots/seller-portal.png", fullPage: true });
  await sp.goto(new URL(page.url()).origin + "/s/not-a-real-token-xxxxxxxxxxxx");
  await sp.getByText("This link has expired").waitFor({ timeout: 10000 });
  await ctx2.close();

  await helper.goto("/listings");
  await page.getByText("5907 N Campbell Ave").first().waitFor({ timeout: 5000 });
  await page.screenshot({ path: "screenshots/listings.png", fullPage: true });
});
