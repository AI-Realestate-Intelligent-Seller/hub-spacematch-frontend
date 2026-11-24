import { runTest } from "./auth";

// One listing = one record: listing page → CMA / Reel Studio / Seller lists prefilled.
runTest("Listing sync: pick a listing in other tools", async helper => {
  const { page } = helper;
  await helper.goto("/listings");
  await page.getByRole("button", { name: /New listing/ }).first().click();
  await page.getByPlaceholder("1234 N Main St, Chicago, IL 60614").fill("4421 N Paulina St #2, Chicago, IL 60640");
  await page.getByPlaceholder("If you have it").fill("12345678");
  await page.getByPlaceholder("$549,000").fill("$612,000");
  await page.getByLabel(/Seller name/).fill("Casey Synctest");
  await page.getByRole("button", { name: "Create listing" }).click();
  await page.getByText("Seller's live page").waitFor({ timeout: 15000 });
  const id = page.url().split("/listings/")[1];
  console.log("LISTING_ID", id);
  await page.getByTestId("listing-connected").waitFor();
  await page.getByText(/Add the seller's email or phone/).waitFor({ timeout: 5000 });
  await page.screenshot({ path: "screenshots/sync-listing.png", fullPage: true });

  // CMA form prefilled from the listing.
  await page.getByRole("link", { name: "Request a CMA" }).click();
  await page.waitForURL(/\/new\?listing=/);
  const street = page.locator("input[name=street]");
  await page.waitForFunction(() => (document.querySelector("input[name=street]") as HTMLInputElement | null)?.value?.includes("4421"), null, { timeout: 15000 });
  if (!(await street.inputValue()).startsWith("4421 N Paulina St")) throw new Error(`street: ${await street.inputValue()}`);
  if ((await page.locator("input[name=city]").inputValue()) !== "Chicago") throw new Error("city not filled");
  if ((await page.locator("input[name=clientName]").inputValue()) !== "Casey Synctest") throw new Error("client not filled");
  await page.getByTestId("listing-picker").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshots/sync-cma.png" });

  // Reel Studio: Reel type + address.
  await helper.goto(`/reels?listing=${id}`);
  const addr = page.getByPlaceholder("2202 N Clybourn Ave #3");
  await addr.waitFor({ timeout: 15000 });
  if (!(await addr.inputValue()).includes("4421 N Paulina")) throw new Error(`reel address: ${await addr.inputValue()}`);
  await page.getByTestId("listing-picker").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshots/sync-reel.png" });

  // Seller lists: listing ZIP added.
  await helper.goto(`/seller-lists?listing=${id}`);
  await page.getByTestId("zip-chip-60640").waitFor({ timeout: 15000 });
  await page.getByTestId("listing-picker").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshots/sync-sellerlists.png" });

  // Seller email added → Lofty sync runs (dev: test email is never sent).
  await helper.goto(`/listings/${id}`);
  await page.getByRole("button", { name: "Details" }).click();
  await page.locator("input[type=email]").first().fill("casey.synctest@example.com");
  await page.getByRole("button", { name: "Save details" }).click();
  await page.getByText(/not sent to Lofty|turned off/).waitFor({ timeout: 15000 });
  await page.screenshot({ path: "screenshots/sync-lofty.png", fullPage: true });
});
