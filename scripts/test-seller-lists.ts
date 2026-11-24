import { execSync } from "node:child_process";
import { runTest } from "./auth";

// Seller lists on dev (HUB_TEST_AS=team@ → staff + payment confirmer). Two phases:
//   PHASE=order (default): clean old test orders → order for Eduardo (free first list) → validation → 2nd order not free.
//     Leaves ONE queued order; then run the real worker: seller_lists_queue.py fill <id> --dev
//   PHASE=delivered: delivered view → groups → "Make this mailing" preloads /mailers → fake cost → Zelle → confirm.
const AGENT = "eduardo@spacematchinc.com";
const cx = (fn: string, args: object = {}) =>
  JSON.parse(execSync(`bunx convex run ${fn} '${JSON.stringify(args)}'`, { encoding: "utf8" }).trim() || "null");
const phase = process.env.PHASE ?? "order";

runTest("Seller lists", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await page.setViewportSize({ width: 1100, height: 1000 });

  if (phase === "order") {
    const old = (cx("sellerLists:listInternal") as { _id: string; agentName: string }[]).filter(o => o.agentName.startsWith("Eduardo"));
    if (old.length) cx("sellerLists:removeInternal", { ids: old.map(o => o._id) });
    await helper.goto("/seller-lists?mode=list");
    await page.getByRole("heading", { name: "Seller lists" }).waitFor({ timeout: 20000 });
    await page.getByLabel("Order for").selectOption(AGENT);
    await page.getByTestId("price-box").getByText("Your first list is free").waitFor({ timeout: 15000 });
    // Bad ZIP is rejected server-side.
    await page.getByTestId("zip-input").fill("90210");
    await page.getByTestId("zip-input").press("Enter");
    await page.getByTestId("order-list").click();
    await page.getByText(/isn't a northern Illinois ZIP/).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "Remove 90210" }).click();
    // Paste 4 ZIPs → only 3 kept.
    await page.getByTestId("zip-input").fill("60169 60025 60657 60614 ");
    await page.getByTestId("zip-chip-60657").waitFor();
    if (await page.getByTestId("zip-chip-60614").count()) throw new Error("4th ZIP accepted");
    await page.getByRole("button", { name: "Remove 60025" }).click();
    await page.getByRole("button", { name: "Remove 60657" }).click();
    await page.getByTestId("type-sfr").click();
    await page.getByRole("button", { name: "Top 200" }).click();
    await page.getByRole("button", { name: "15 years" }).click();
    await page.screenshot({ path: "screenshots/seller-lists-form.png", fullPage: true });
    await page.getByTestId("order-list").click();
    await page.getByTestId("seller-list").first().waitFor({ timeout: 15000 });
    await page.getByTestId("list-status").first().getByText(/In line.*free/).waitFor({ timeout: 10000 });
    await page.screenshot({ path: "screenshots/seller-lists-queued.png", fullPage: true });
    const q = cx("sellerLists:nextQueued");
    if (!q?.free || q.zips.join() !== "60169" || q.filters.types !== "sfr" || q.filters.top !== 200 || q.filters.years !== 15 || !q.filters.skipTrusts)
      throw new Error(`queued order wrong: ${JSON.stringify(q)}`);
    // Second order: not free; then cancel it.
    await page.getByRole("tab", { name: "New order" }).click();
    await page.getByLabel("Order for").selectOption(AGENT);
    await page.getByTestId("price-box").getByText(/per ZIP code/).waitFor({ timeout: 15000 });
    await page.getByTestId("zip-input").fill("60025 60614 ");
    await page.getByTestId("price-box").getByText("$10").waitFor({ timeout: 10000 }); // $5 per ZIP × 2
    await page.screenshot({ path: "screenshots/seller-lists-price.png", fullPage: true });
    await page.getByTestId("order-list").click();
    await page.getByTestId("seller-list").nth(1).waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "Cancel" }).first().click();
    await page.getByText("Cancelled").first().waitFor({ timeout: 10000 });
    // Max 2 open per agent would block a 3rd while two are queued — covered by mutation; skip here.
    console.log("QUEUED_ID", q._id);
    return;
  }

  // PHASE=delivered
  const mine = (cx("sellerLists:listInternal", { status: "delivered" }) as { _id: string; agentName: string; free: boolean }[]).filter(o => o.agentName.startsWith("Eduardo"));
  if (!mine.length) throw new Error("no delivered test order: run the worker first");
  const id = mine[0]._id;
  await helper.goto("/seller-lists?tab=mine&mode=list");
  await page.getByLabel("Order for").selectOption(AGENT);
  await page.getByTestId("download-xlsx").first().waitFor({ timeout: 20000 });
  await page.getByTestId("download-csv").first().waitFor();
  await page.screenshot({ path: "screenshots/seller-lists-delivered.png", fullPage: true });
  // Free first list: price freezes at $0, no Zelle card.
  const fr = cx("sellerLists:finalizeCost", { id });
  if (fr.price !== 0) throw new Error("free list billed");
  // Paid path on a clone: flat $5 per ZIP (1-ZIP clone) → "I sent it" → Michael confirms.
  const paidId = cx("sellerLists:e2eCloneInternal", { id });
  cx("sellerLists:addCost", { id: paidId, credits: 1000, note: "e2e" });
  const pr = cx("sellerLists:finalizeCost", { id: paidId });
  if (pr.price !== 5) throw new Error(`expected $5, got ${JSON.stringify(pr)}`);
  await page.reload();
  await page.getByLabel("Order for").selectOption(AGENT);
  await page.getByTestId("pay-box").getByText("$5").waitFor({ timeout: 20000 });
  await page.getByTestId("pay-box").first().screenshot({ path: "screenshots/seller-lists-pay.png" });
  await page.getByTestId("i-sent-it").click();
  await page.getByText("Waiting for Michael to confirm").waitFor({ timeout: 10000 });
  await page.getByRole("tab", { name: /All orders/ }).click();
  await page.getByRole("button", { name: "Received" }).first().click();
  await page.getByText("confirmed").first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: "screenshots/seller-lists-admin.png", fullPage: true });
  await page.getByRole("tab", { name: "My lists" }).click();
  await page.getByLabel("Order for").selectOption(AGENT);

  // One tap into /mailers with the suggested design.
  const group = await page.locator("[data-testid^=group-]").first().getAttribute("data-testid");
  const g = group!.replace("group-", "");
  await page.getByTestId(`make-mailing-${g}`).first().click();
  await page.waitForURL(/\/mailers\?list=/);
  await page.getByTestId("mailer-stats").waitFor({ timeout: 30000 });
  await page.getByTestId(`design-${g}`).getByText("✓ Selected").waitFor({ timeout: 10000 });
  const kept = await page.getByTestId("mailer-stats").innerText();
  console.log("MAILER STATS", kept.replace(/\s+/g, " "));
  await page.screenshot({ path: "screenshots/seller-lists-to-mailers.png", fullPage: true });
});
