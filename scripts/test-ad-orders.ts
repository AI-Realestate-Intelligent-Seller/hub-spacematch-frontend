import { execSync } from "node:child_process";
import { runTest } from "./auth";

// Agent orders an ad package → admin approves with tier change → kit → live → ledger.
// Dev runs as team@ (admin) via HUB_TEST_AS; ADKIT_META_DRAFTS=off on dev.
runTest("Ad Kit orders (agent order, admin approve, ledger)", async helper => {
  const { page } = helper;
  await helper.goto("/listings");
  await page.getByRole("button", { name: /New listing/ }).first().click();
  await page.getByPlaceholder("1234 N Main St, Chicago, IL 60614").fill("2147 W Thomas St, Chicago, IL 60622");
  await page.getByPlaceholder("$549,000").fill("$689,000");
  await page.getByLabel(/Seller name/).fill("Ada Adtest");
  await page.getByRole("button", { name: "Create listing" }).click();
  await page.getByText("Seller's live page").waitFor({ timeout: 15000 });
  const listingId = page.url().split("/listings/")[1];

  await page.getByRole("button", { name: "Ads & web" }).click();
  await page.getByRole("button", { name: "Order ads" }).click();
  const dlg = page.getByRole("dialog", { name: "Order ads" });
  await dlg.getByRole("button", { name: /^Signature/ }).click();
  await dlg.getByText(/Add open-house ads/).click();
  // Signature 825 + OH 75 + closing 50 = 950
  await dlg.getByTestId("order-total").getByText("$950").waitFor({ timeout: 5000 });
  await dlg.getByText("Pay ahead", { exact: true }).click();
  await dlg.getByTestId("order-total").getByText("$900").waitFor({ timeout: 5000 });
  await dlg.getByText("Take it from my commission").click();
  if (!(await dlg.getByRole("button", { name: /Send order/ }).isDisabled())) throw new Error("Order should need authorization");
  await dlg.getByLabel("Authorize charge").check();
  await page.screenshot({ path: "screenshots/adorder-dialog.png", fullPage: false });
  await dlg.getByRole("button", { name: /Send order/ }).click();
  await page.getByTestId("ad-order").getByText("Waiting for approval").waitFor({ timeout: 8000 });

  // Admin queue: change to Luxury and approve.
  await helper.goto("/ad-orders");
  const card = page.getByTestId("order-card").filter({ hasText: "2147 W Thomas" }).first();
  await card.getByText("$950").waitFor({ timeout: 8000 });
  await card.getByLabel("Change tier").selectOption("luxury");
  await card.getByPlaceholder("Note to agent (optional)").fill("Bumped to Luxury for the YouTube push");
  await page.screenshot({ path: "screenshots/adorder-queue.png", fullPage: true });
  await card.getByRole("button", { name: /Approve/ }).click();
  // Luxury 1400 + OH 75 + 50 = 1525
  await card.getByText("total $1,525").waitFor({ timeout: 8000 });
  await card.getByRole("button", { name: "Mark ads live" }).click();
  await card.getByText("Ads live").waitFor({ timeout: 8000 });

  await page.getByRole("button", { name: "Ledger" }).click();
  await page.getByRole("row").filter({ hasText: "$1,525" }).first().waitFor({ timeout: 8000 });
  await page.screenshot({ path: "screenshots/adorder-ledger.png", fullPage: true });
  await page.getByRole("button", { name: /^Orders/ }).click();
  await card.getByRole("button", { name: "Mark deducted at closing" }).click();
  await card.getByText("Deducted at closing").waitFor({ timeout: 8000 });

  // Listing: kit visible, launch step ticked.
  await helper.goto(`/listings/${listingId}`);
  await page.getByRole("button", { name: "Ads & web" }).click();
  await page.getByRole("button", { name: "Open ad kit" }).click();
  await page.getByTestId("ad-kit").getByText("SM | 2147 W Thomas St | Meta | Launch").waitFor({ timeout: 8000 });
  await page.getByTestId("ad-kit").getByText("utm_campaign=2147-w-thomas-st", { exact: false }).first().waitFor({ timeout: 5000 });
  await page.screenshot({ path: "screenshots/adorder-kit.png", fullPage: true });
  await page.getByRole("button", { name: "Launch steps" }).click();
  await page.getByRole("button", { name: "Mark Ads live not done" }).waitFor({ timeout: 5000 });

  // Clean up.
  execSync(`bunx convex run adOrders:removeForListingInternal '${JSON.stringify({ listingId })}'`, { stdio: "ignore" });
  await page.getByRole("button", { name: "Details" }).click();
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: /Delete listing/ }).click();
  await page.waitForURL(/\/listings$/, { timeout: 10000 });
});
