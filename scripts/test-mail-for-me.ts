import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { runTest } from "./auth";

// "Mail it for me" on dev (Lob TEST key, nothing printed). HUB_TEST_AS=team@ = staff + payment confirmer.
// /mailers 4 choices → order for Eduardo (series) → fake worker delivers the fixture list → cards built + Lob proofs
// → "I sent it" → Michael "Received" → Lob test mailing → card 2 scheduled → build card 2 now → cleanup.
const AGENT = "eduardo@spacematchinc.com";
const cx = (fn: string, args: object = {}) =>
  JSON.parse(execSync(`bunx convex run ${fn} '${JSON.stringify(args)}'`, { encoding: "utf8" }).trim() || "null");
const CONVEX_URL = readFileSync(".env.local", "utf8").match(/VITE_CONVEX_URL=(\S+)/)?.[1];

async function upload(id: string, kind: string, name: string) {
  const url = cx("sellerLists:uploadUrl");
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/csv" }, body: readFileSync("scripts/fixtures/mail_order_sample.csv") });
  const { storageId } = (await r.json()) as { storageId: string };
  cx("sellerLists:addFile", { id, kind, name, storageId, size: 600 });
}

runTest("Mail it for me", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  page.on("dialog", d => d.accept());
  await page.setViewportSize({ width: 1200, height: 1000 });
  if (!CONVEX_URL) console.log("(no VITE_CONVEX_URL; fine)");
  const old = (cx("sellerLists:listInternal") as { _id: string; agentName: string }[]).filter(o => o.agentName.startsWith("Eduardo"));
  if (old.length) cx("mailOrders:removeOrderInternal", { ids: old.map(o => o._id) });
  cx("agentCopy:removeInternal", { email: AGENT });

  // 1. Four choices on Seller mailers
  await helper.goto("/mailers");
  await page.getByTestId("mail-choices").waitFor({ timeout: 20000 });
  for (const k of ["mail", "own", "wp", "print"]) await page.getByTestId(`choice-${k}`).waitFor();
  await page.screenshot({ path: "screenshots/mfm-choices.png" });
  await page.getByTestId("choice-mail").click();

  // 2. Order form
  await page.getByRole("heading", { name: "Mail it for me" }).waitFor({ timeout: 20000 });
  await page.getByLabel("Order for").selectOption(AGENT);
  await page.getByTestId("zip-input").fill("60025 ");
  await page.getByTestId("zip-chip-60025").waitFor();
  await page.getByRole("button", { name: "Top 200" }).click();
  await page.getByTestId("series-on").click();
  await page.getByTestId("price-box").getByText(/\$232\.00 for card 1/).waitFor({ timeout: 10000 }); // free first list + 200 × $1.16
  // Agent's own copy (Michael 2026-11-12): address required before ordering.
  await page.getByTestId("copy-address-form").waitFor({ timeout: 10000 });
  if (!(await page.getByTestId("order-list").isDisabled())) throw new Error("order allowed without a copy address");
  await page.getByTestId("copy-line1").fill("676 N Michigan Ave");
  await page.getByTestId("copy-line2").fill("Ste 3010");
  await page.getByTestId("copy-city").fill("Chicago");
  await page.getByTestId("copy-state").fill("IL");
  await page.getByTestId("copy-zip").fill("60611");
  await page.getByTestId("copy-save").click();
  await page.getByTestId("copy-address").waitFor({ timeout: 10000 });
  await page.screenshot({ path: "screenshots/mfm-form.png", fullPage: true });
  await page.getByTestId("order-list").click();
  await page.getByTestId("seller-list").first().waitFor({ timeout: 15000 });
  const q = cx("sellerLists:nextQueued");
  if (!q?.mail || q.mail.mode !== "series" || q.filters.top !== 200) throw new Error(`bad order ${JSON.stringify(q)}`);
  const id = q._id as string;
  console.log("ORDER", id, q.code);

  // 3. Fake worker: deliver the fixture list
  cx("sellerLists:workerStatus", { id, status: "pulling", note: "Pulling owner records…" });
  await upload(id, "csv", "Seller_list_E2E.csv");
  await upload(id, "xlsx", "Seller_list_E2E.xlsx");
  cx("sellerLists:deliver", { id, summary: { total: 4, zips: [{ zip: "60025", city: "Glenview", clean: 4, inList: 4, houses: 2, condos: 2, triedToSell: 0, designs: { value: 2, market: 2 } }], designs: { value: 2, market: 2 } } });

  // 4. Cards ready to pay
  await page.getByTestId("mail-pay").waitFor({ timeout: 240000 });
  await page.waitForTimeout(2500);
  const o1 = cx("sellerLists:getInternal", { id });
  const d1 = o1.mail.drops[0];
  console.log("DROP1", JSON.stringify({ status: d1.status, cards: d1.cards, amount: d1.amount, payment: o1.payment }));
  // 4 homes in 2 designs + 2 agent copies = 6 cards × $1.16
  if (d1.cards !== 6 || d1.copies !== 2 || d1.amount !== 6.96 || o1.payment?.amount !== 6.96) throw new Error("wrong drop 1 total");
  await page.getByTestId("mail-order").screenshot({ path: "screenshots/mfm-ready.png" });

  // 5. Agent says sent → Michael confirms in All orders → Lob test mailing
  await page.getByTestId("mail-i-sent-it").click();
  await page.getByText(/Lob starts mailing as soon as Michael confirms/).waitFor({ timeout: 10000 });
  await page.getByRole("tab", { name: /All orders/ }).click();
  await page.getByTestId("admin-received").first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: "screenshots/mfm-admin.png", fullPage: true });
  await page.getByTestId("admin-received").first().click();
  await page.waitForTimeout(1500);
  await page.getByRole("tab", { name: "My orders" }).click();
  await page.getByLabel("Order for").selectOption(AGENT);
  await page.getByTestId("drop-mailed").waitFor({ timeout: 300000 });
  await page.getByTestId("series-next").waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.getByTestId("mail-order").screenshot({ path: "screenshots/mfm-mailed.png" });
  const o2 = cx("sellerLists:getInternal", { id });
  console.log("AFTER", JSON.stringify(o2.mail.drops.map((d: { n: number; status: string; sent?: number; refused?: number; scheduledFor?: number }) => ({ n: d.n, status: d.status, sent: d.sent, refused: d.refused, at: d.scheduledFor }))));
  if (o2.mail.drops[1]?.status !== "scheduled") throw new Error("card 2 not scheduled");
  const copies = (cx("lob:campaign", { campaignId: o2.mail.drops[0].campaignIds[0] }) as { copyLobId?: string; copyTo?: string; copyError?: string; cost?: number; lobSent?: number });
  console.log("COPY", JSON.stringify(copies && { copyLobId: copies.copyLobId, copyTo: copies.copyTo, copyError: copies.copyError }));
  if (!copies?.copyLobId) throw new Error("agent copy not mailed");

  // 6. Build card 2 now (normally 4 weeks later): next design per group, refused homes dropped
  cx("mailOrders:buildDrop", { orderId: id, n: 2 });
  for (let i = 0; i < 60; i++) {
    const o3 = cx("sellerLists:getInternal", { id });
    const d2 = o3.mail.drops[1];
    if (d2.status === "ready" || d2.status === "failed") {
      console.log("DROP2", JSON.stringify({ status: d2.status, cards: d2.cards, amount: d2.amount, code: d2.code, error: d2.error, payment: o3.payment }));
      if (d2.status !== "ready" || d2.listAmount !== 0 || o3.payment.code !== `${o3.code}-2`) throw new Error("card 2 wrong");
      break;
    }
    await page.waitForTimeout(4000);
  }
  await page.waitForTimeout(2500);
  await page.getByTestId("mail-order").screenshot({ path: "screenshots/mfm-card2.png" });
  await page.getByTestId("stop-series").click();
  await page.getByText("Series stopped. No more cards").waitFor({ timeout: 10000 });
  if (!process.env.KEEP) cx("mailOrders:removeOrderInternal", { ids: [id] });
});
