import { execSync } from "node:child_process";
import { runTest } from "./auth";

// Seller lists by building on dev (Michael 2026-11-10: "choose a single building address or multiple buildings").
//   PHASE=order (default): Home row → Mail it for me, no listing needed → order for Brendan by building:
//     bad ZIP and missing street number refused → 2 buildings queued (condos, everyone, chosen years).
//     Leaves ONE queued order; then run the real worker: seller_lists_queue.py fill <id> --dev
//   PHASE=delivered: the delivered order shows a count per building.
const AGENT = "brendan@spacematchinc.com";
const cx = (fn: string, args: object = {}) =>
  JSON.parse(execSync(`bunx convex run ${fn} '${JSON.stringify(args)}'`, { encoding: "utf8" }).trim() || "null");
const phase = process.env.PHASE ?? "order";

runTest("Seller lists by building", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await page.setViewportSize({ width: 1100, height: 1000 });

  if (phase === "order") {
    const old = (cx("sellerLists:listInternal") as { _id: string; agentName: string }[]).filter(o => o.agentName.startsWith("Brendan"));
    if (old.length) cx("sellerLists:removeInternal", { ids: old.map(o => o._id) });

    // Home → one tap, and the page says no listing is needed.
    // Round 2 (11-22): Home → Market myself → Seller lists.
    await helper.goto("/home");
    await page.getByTestId("moment-market").click();
    await page.getByRole("link", { name: "Seller lists" }).first().click();
    await page.waitForURL(/\/seller-lists\?mode=mail/);
    await page.getByText("You don't need a listing").waitFor({ timeout: 20000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await helper.goto("/do/market");
    await page.screenshot({ path: "tmp/home-mail-row-phone.png" });
    await page.setViewportSize({ width: 1100, height: 1000 });

    await helper.goto("/seller-lists?mode=list");
    await page.getByLabel("Order for").selectOption(AGENT);
    await page.getByTestId("where-building").click();
    if (await page.getByTestId("zip-input").count()) throw new Error("ZIP input still shows in building mode");
    await page.getByTestId("bld-address-0").fill("2800 N Lake Shore Dr");
    await page.getByTestId("bld-zip-0").fill("90210");
    await page.getByTestId("order-list").click();
    await page.getByText(/Add the ZIP code for 2800 N Lake Shore Dr/).first().waitFor({ timeout: 10000 });
    await page.getByTestId("bld-zip-0").fill("60657");
    await page.getByTestId("bld-add").click();
    await page.getByTestId("bld-address-1").fill("Roscoe St");
    await page.getByTestId("bld-zip-1").fill("60657");
    await page.getByTestId("order-list").click();
    await page.getByText(/needs a street number/).first().waitFor({ timeout: 10000 });
    await page.getByTestId("bld-address-1").fill("1800 W Roscoe St");
    await page.getByTestId("bld-years-10").click();
    await page.getByTestId("order-list").getByText("2 buildings").waitFor();
    await page.waitForTimeout(5000); // let the error toasts clear
    await page.screenshot({ path: "tmp/seller-lists-building-form.png", fullPage: true });
    await page.getByTestId("order-list").click();
    await page.getByTestId("seller-list").first().waitFor({ timeout: 15000 });
    await page.getByTestId("order-buildings").first().getByText("2800 N Lake Shore Dr · 1800 W Roscoe St").waitFor();
    // Our own order (another test may have left an older one in line).
    const mine = (cx("sellerLists:listInternal", { status: "queued" }) as { _id: string; agentName: string }[]).find(o => o.agentName.startsWith("Brendan"));
    const q = mine ? cx("sellerLists:getInternal", { id: mine._id }) : null;
    if (q?.buildings?.length !== 2 || q.zips.join() !== "60657" || q.filters.types !== "condo" || q.filters.top !== 0 || q.filters.years !== 10)
      throw new Error(`queued building order wrong: ${JSON.stringify(q)}`);
    console.log("QUEUED_ID", q._id);
    return;
  }

  await helper.goto("/seller-lists?tab=mine&mode=list");
  await page.getByLabel("Order for").selectOption(AGENT);
  const rows = page.getByTestId("building-counts").first();
  await rows.waitFor({ timeout: 20000 });
  for (const b of ["2800 N Lake Shore Dr", "1800 W Roscoe St"]) {
    const txt = (await rows.locator("tr", { hasText: b }).locator("td").nth(1).innerText()).replace(/,/g, "");
    if (!(Number(txt) > 5)) throw new Error(`${b}: expected owners, got "${txt}"`);
  }
  await page.getByTestId("download-csv").first().waitFor();
  await page.screenshot({ path: "tmp/seller-lists-building-delivered.png", fullPage: true });
}).catch(() => process.exit(1));
