import { execSync } from "node:child_process";
import { runTest } from "./auth";

// Pay by card (Stripe) on dev: STRIPE_MOCK=1 fakes Stripe, HUB_TEST_AS=team@ → Michael (can connect Stripe).
// Settings: bad key / no fee choice rejected → connect → list paid with the 3% fee through the UI →
// fee switched to "I cover it" → Reel paid through the UI → own-list mailing + ad order paid server-side →
// paying twice refused → turned off → button gone. Cleans up.
const AGENT = "eduardo@spacematchinc.com";
const sh = (c: string) => execSync(c, { encoding: "utf8" }).trim();
const cx = (fn: string, args: object = {}) => JSON.parse(sh(`bunx convex run ${fn} '${JSON.stringify(args)}'`) || "null");
const must = (ok: unknown, msg: string) => { if (!ok) throw new Error(msg); };

runTest("Card pay", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  sh("bunx convex env set HUB_URL http://localhost:4173");
  try {
    cx("cardPayE2e:reset", { config: true });
    const ids = cx("cardPayE2e:seed") as { list: string; reel: string; lob: string; ad: string | null };
    const state = () => cx("cardPayE2e:state", ids.ad ? ids : { list: ids.list, reel: ids.reel, lob: ids.lob });
    await page.setViewportSize({ width: 1100, height: 1000 });

    // Stripe not connected: Zelle only.
    await helper.goto("/seller-lists?tab=mine&mode=list");
    await page.getByLabel("Order for").selectOption(AGENT);
    await page.getByTestId("pay-box").waitFor({ timeout: 20000 });
    must((await page.getByTestId("pay-by-card").count()) === 0, "Pay by card shown before Stripe is connected");

    // Settings: connect.
    await helper.goto("/settings");
    const card = page.getByTestId("stripe-card");
    await card.waitFor({ timeout: 20000 });
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: "screenshots/card-pay-settings-empty.png" });
    await page.getByTestId("stripe-key").fill("sk_test_mocke2e1234567890");
    await page.getByTestId("stripe-connect").click();
    await page.getByTestId("stripe-error").getByText("Pick who pays").waitFor({ timeout: 10000 });
    await page.getByTestId("fee-agent").click();
    await page.getByTestId("stripe-key").fill("pk_live_abcdefghijklmnop");
    await page.getByTestId("stripe-connect").click();
    await page.getByTestId("stripe-error").getByText("publishable key").waitFor({ timeout: 10000 });
    await page.getByTestId("stripe-key").fill("sk_test_mocke2e1234567890");
    await page.getByTestId("stripe-connect").click();
    await page.getByTestId("stripe-connected").getByText("Agents see Pay by card").waitFor({ timeout: 20000 });
    must(!(await card.innerText()).includes("sk_test_mocke2e"), "the key is shown on the page");
    must(JSON.stringify(cx("cardPay:statusInternal")).includes("sk_test_mocke2e") === false, "key leaked by statusInternal");

    // Seller list: $10 + 3% = $10.30 by card.
    await helper.goto("/seller-lists?tab=mine&mode=list");
    await page.getByLabel("Order for").selectOption(AGENT);
    const btn = page.getByTestId("pay-by-card-btn");
    await btn.waitFor({ timeout: 20000 });
    must((await btn.innerText()).includes("Pay $10.30 by card"), `list button: ${await btn.innerText()}`);
    must((await page.getByTestId("pay-by-card").innerText()).includes("$10.00 + $0.30 card fee (3%)"), "fee line missing");
    await page.getByTestId("pay-box").screenshot({ path: "screenshots/card-pay-list.png" });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.getByTestId("pay-box").scrollIntoViewIfNeeded();
    await page.getByTestId("pay-box").screenshot({ path: "screenshots/card-pay-list-phone.png" });
    await page.setViewportSize({ width: 1100, height: 1000 });
    await btn.click();
    await page.waitForURL(/\/pay\/return\?s=cs_test_mock_1030_/, { timeout: 30000 });
    await page.getByTestId("pay-paid").getByText("$10.30").waitFor({ timeout: 30000 });
    await page.screenshot({ path: "screenshots/card-pay-paid.png" });
    let s = state();
    must(s.list.status === "confirmed" && s.list.method === "card" && s.list.confirmedBy === "Card (Stripe)", `list not settled: ${JSON.stringify(s.list)}`);
    await page.getByTestId("pay-back").click();
    await page.waitForURL(/\/seller-lists\?tab=mine/);

    // Michael switches to "I cover the fee": the Reel is $25.00 flat by card.
    await helper.goto("/settings");
    await page.getByTestId("fee-absorb").click();
    await page.locator('[data-testid="fee-absorb"][aria-checked="true"]').waitFor({ timeout: 10000 });
    must(cx("cardPay:statusInternal").config.feeMode === "absorb", "fee choice not saved");
    await helper.goto("/reels?tab=mine");
    await page.getByLabel("Order for").selectOption(AGENT);
    const rbtn = page.getByTestId("pay-by-card-btn");
    await rbtn.waitFor({ timeout: 20000 });
    must((await rbtn.innerText()).includes("Pay $25.00 by card"), `reel button: ${await rbtn.innerText()}`);
    must((await page.getByTestId("pay-by-card").innerText()).includes("No extra fee"), "no-fee line missing");
    await page.getByTestId("pay-card").screenshot({ path: "screenshots/card-pay-reel.png" });
    await rbtn.click();
    await page.waitForURL(/\/pay\/return\?s=cs_test_mock_2500_/, { timeout: 30000 });
    await page.getByTestId("pay-paid").getByText("$25.00").waitFor({ timeout: 30000 });
    s = state();
    must(s.reel.status === "queued" && s.reel.payment.status === "confirmed" && s.reel.payment.method === "card", `reel not settled: ${JSON.stringify(s.reel)}`);

    // Own-list Lob mailing and a pay-ahead ad order (their buttons are hidden from Michael's own login): server-side.
    must(cx("cardPayE2e:pay", { kind: "lob", id: ids.lob }).status === "paid", "lob not paid");
    if (ids.ad) must(cx("cardPayE2e:pay", { kind: "ad", id: ids.ad }).status === "paid", "ad not paid");
    s = state();
    must(s.lob.lobStatus !== "requested" && s.lob.lobPayment === "paid" && s.lob.lobApprovedBy === "Card (Stripe)", `lob not started: ${JSON.stringify(s.lob)}`);
    if (ids.ad) must(s.ad.paymentStatus === "paid" && /Card \(Stripe\): paid/.test(s.ad.paymentNote), `ad not paid: ${JSON.stringify(s.ad)}`);
    // Paying an order that's already paid is refused before any card page opens.
    let refused = false;
    try { cx("cardPayE2e:pay", { kind: "list", id: ids.list }); } catch { refused = true; }
    must(refused, "a paid order could be paid again");
    must(s.payments.every((p: { status: string }) => p.status === "paid") && s.payments.length === (ids.ad ? 4 : 3), `payments: ${JSON.stringify(s.payments)}`);
    console.log("PAYMENTS", JSON.stringify(s.payments));

    // Michael's log, then off → the button disappears for agents.
    await helper.goto("/settings");
    await page.getByTestId("stripe-payments").getByText("SL-E2E1").waitFor({ timeout: 20000 });
    await page.getByTestId("stripe-card").scrollIntoViewIfNeeded();
    await page.getByTestId("stripe-card").screenshot({ path: "screenshots/card-pay-settings.png" });
    page.once("dialog", d => void d.accept());
    await page.getByTestId("stripe-off").click();
    await page.getByTestId("stripe-key").waitFor({ timeout: 10000 });
    must(cx("cardPay:statusInternal").config === null, "config not removed");
  } finally {
    cx("cardPayE2e:reset", { config: true });
    sh("bunx convex env remove HUB_URL");
  }
});
