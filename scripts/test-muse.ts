import { readFileSync } from "fs";
import { runTest } from "./auth";

// Muse coach (/muse): Home card, coach PDF download, setup message, Ask Muse buttons, search intent.
runTest("Muse coach", async helper => {
  const { page } = helper;
  const ctx = page.context();
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  ctx.on("page", p => { if (p !== page) void p.close(); }); // muse.ai popups

  await helper.goto("/home");
  await page.getByTestId("muse-card").waitFor({ timeout: 15000 });
  await page.getByTestId("muse-card").click();
  await page.getByTestId("muse-page").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Send to Muse" }).waitFor({ timeout: 20000 });
  await page.screenshot({ path: "screenshots/muse-top.png", fullPage: true });

  // Download the coach file and check it's a real PDF with our content markers
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("muse-download").click()]);
  const path = await dl.path();
  const buf = readFileSync(path!);
  if (buf.subarray(0, 5).toString() !== "%PDF-") throw new Error("not a PDF");
  if (buf.length < 50_000) throw new Error(`PDF too small: ${buf.length}`);
  if (!/SpaceMatch-Coach.*\.pdf/.test(dl.suggestedFilename())) throw new Error(`bad name ${dl.suggestedFilename()}`);
  await page.getByTestId("muse-done").waitFor({ timeout: 5000 });

  // Message
  await page.getByText("See the message").click();
  const msg = await page.getByTestId("muse-message").innerText();
  if (!msg.includes("SpaceMatch Coach") || !msg.includes("Coach ready")) throw new Error("setup message missing text");
  await page.getByTestId("muse-copy").click();
  await page.screenshot({ path: "screenshots/muse-done.png", fullPage: true });

  // Old version → update banner
  await page.evaluate(() => localStorage.setItem("hub-muse-sent-version", "2000-01-01"));
  await page.reload();
  await page.getByTestId("muse-update").waitFor({ timeout: 10000 });
  await page.evaluate(() => localStorage.removeItem("hub-muse-sent-version"));

  // Ask Muse on a playbook + on a Guide situation
  await helper.goto("/playbooks/speed-to-lead");
  await page.getByTestId("ask-muse").first().click();
  await page.getByText("Copied. In Muse, paste it").waitFor({ timeout: 5000 });
  await page.screenshot({ path: "screenshots/muse-playbook.png" });
  await helper.goto("/guide?s=new-lead");
  await page.locator("#s-new-lead [data-testid=ask-muse]").waitFor({ timeout: 10000 });
  await page.screenshot({ path: "screenshots/muse-guide.png" });

  // Search intent
  await helper.goto("/home");
  await page.getByLabel("Search the hub").fill("muse");
  await page.getByText("Muse coach").first().waitFor({ timeout: 5000 });

  // Phone view
  await page.setViewportSize({ width: 390, height: 844 });
  await helper.goto("/muse");
  await page.getByRole("button", { name: "Send to Muse" }).waitFor({ timeout: 20000 });
  await page.screenshot({ path: "screenshots/muse-mobile.png", fullPage: true });
});
