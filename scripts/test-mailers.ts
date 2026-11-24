import { runTest } from "./auth";

// Seller mailers: tutorial, sample proof, ATN list upload → mailing → print PDF, then the public
// QR landing page logs a scan and a reply (example.com → never pushed to Lofty), then cleanup.
runTest("Seller mailers", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await helper.goto("/home");
  await page.getByText("Seller mailers").first().waitFor({ timeout: 20000 });
  await page.screenshot({ path: "screenshots/mailers-home-tile.png" });
  await page.getByText("Seller mailers").first().click();
  await page.getByTestId("mailer-tutorial").waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "screenshots/mailers-page.png", fullPage: true });

  // Sample proof (opens a new tab with the PDF blob)
  const popup = page.waitForEvent("popup", { timeout: 30000 });
  await page.getByTestId("proof-value").click();
  const p2 = await popup;
  await p2.waitForTimeout(4000);
  console.log("PROOF URL", p2.url().slice(0, 40));
  await p2.close();

  // Upload the ATN-style list
  await page.getByTestId("mailer-file").setInputFiles("scripts/fixtures/atn_sample.csv");
  await page.getByTestId("mailer-stats").waitFor({ timeout: 15000 });
  const stats = await page.getByTestId("mailer-stats").innerText();
  console.log("STATS", stats.replace(/\n/g, " | "));
  if (!/^6\s/.test(stats.trim())) throw new Error("expected 6 homes to mail");
  await page.getByText("John & Mary Smith").first().waitFor();
  await page.screenshot({ path: "screenshots/mailers-upload.png", fullPage: true });
  await page.getByTestId("mailer-name").fill("E2E test mailing");
  const dl = page.waitForEvent("download", { timeout: 60000 });
  await page.getByTestId("mailer-create").click();
  const d = await dl;
  const pdfPath = "screenshots/" + d.suggestedFilename();
  await d.saveAs(pdfPath);
  console.log("PDF", pdfPath);

  // My mailings → detail with codes
  await page.getByTestId("mailer-campaign").first().waitFor({ timeout: 15000 });
  await page.getByText("1641 Alexis Ct, Glenview, IL 60025").first().waitFor({ timeout: 15000 });
  const codeA = (await page.locator("td.font-mono").first().innerText()).trim();
  console.log("CODE", codeA);
  await page.screenshot({ path: "screenshots/mailers-mine.png", fullPage: true });

  // Wise Pelican options: panel opens, list downloads with WP headers and 6 homes
  const wp = page.getByTestId("mailer-wp").last();
  await wp.locator("button").first().click();
  const wpDl = page.waitForEvent("download", { timeout: 20000 });
  await page.getByTestId("mailer-wp-csv").click();
  const wpFile = await wpDl;
  const wpPath = "screenshots/" + wpFile.suggestedFilename();
  await wpFile.saveAs(wpPath);
  const wpCsv = (await import("fs")).readFileSync(wpPath, "utf8").trim().split("\n");
  console.log("WP CSV", wpCsv[0], "|", wpCsv.length - 1, "rows");
  if (!wpCsv[0].startsWith("Full Name,Address,City,State,Zip Code") || wpCsv.length - 1 !== 6) throw new Error("bad Wise Pelican CSV");
  await page.screenshot({ path: "screenshots/mailers-wise-pelican.png", fullPage: true });

  // Wise Pelican 6x9 front + back panel: agent-branded PNGs at 300 dpi with one mailing QR
  const fs = await import("fs");
  const pngSize = (f: string) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20), b.indexOf("pHYs") > 0 ? 1 : 0]; };
  for (const [tid, want] of [["mailer-wp-front", "2550x1650"], ["mailer-wp-back", "1200x1500"]] as const) {
    const dlp = page.waitForEvent("download", { timeout: 60000 });
    await page.getByTestId(tid).click();
    const f = await dlp;
    const path = "screenshots/" + f.suggestedFilename();
    await f.saveAs(path);
    const [w, h, dpi] = pngSize(path);
    console.log("WP PNG", tid, `${w}x${h}`, dpi ? "300dpi" : "no-dpi", path);
    if (`${w}x${h}` !== want || !dpi) throw new Error(`bad ${tid} PNG`);
  }
  const wpCode = (await page.getByTestId("mailer-wp-code").innerText()).trim();
  console.log("WP CODE", wpCode);
  await helper.goto(`/v/${wpCode}`);
  await page.getByTestId("mailer-addr").waitFor({ timeout: 15000 });
  await page.screenshot({ path: "screenshots/mailers-wp-landing.png", fullPage: true });
  await page.getByTestId("mailer-addr").fill("1641 N Alexis Ct, Glenview IL");
  await page.getByText("3–6 months").click();
  await page.locator("#nm").fill("WP Test Homeowner");
  await page.locator("#em").fill("mailer-wp-e2e@example.com");
  await page.getByTestId("mailer-submit").click();
  await page.getByTestId("mailer-done").waitFor({ timeout: 15000 });
  await helper.goto("/mailers?path=print");
  await page.getByTestId("tab-mine").click();
  const wpRow = page.getByTestId("mailer-campaign").filter({ hasText: "E2E test mailing" }).first();
  await wpRow.waitFor({ timeout: 15000 });
  const wpTxt = await wpRow.innerText();
  console.log("WP ROW", wpTxt.replace(/\n/g, " | "));
  if (!/6×9 QR: 1 scan\b/.test(wpTxt)) throw new Error("WP scan not counted");
  await wpRow.locator("button").first().click();
  await page.getByText("Replied ✓").first().waitFor({ timeout: 15000 }); // address matched to 1641 Alexis Ct
  const code = codeA;

  // Public landing page
  await helper.goto(`/v/${code}`);
  await page.getByTestId("mailer-landing").waitFor({ timeout: 15000 });
  await page.setViewportSize({ width: 400, height: 860 });
  await page.screenshot({ path: "screenshots/mailers-landing.png", fullPage: true });
  await page.getByText("Just curious").click();
  await page.locator("#nm").fill("Test Homeowner");
  await page.locator("#em").fill("mailer-e2e@example.com");
  await page.getByTestId("mailer-submit").click();
  await page.getByTestId("mailer-done").waitFor({ timeout: 15000 });
  await page.screenshot({ path: "screenshots/mailers-landing-done.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  // Back in the Hub: scan + reply counted
  await helper.goto("/mailers?path=print");
  await page.getByTestId("tab-mine").click();
  const row = page.getByTestId("mailer-campaign").filter({ hasText: "E2E test mailing" }).first();
  await row.waitFor({ timeout: 15000 });
  const txt = await row.innerText();
  console.log("ROW", txt.replace(/\n/g, " | "));
  if (!/Replies/.test(txt)) throw new Error("row missing");
  await row.locator("button").first().click();
  await page.getByText("Replied ✓").first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: "screenshots/mailers-after-reply.png", fullPage: true });
  if (!process.env.MAILERS_KEEP) {
    page.once("dialog", dlg => dlg.accept());
    await page.getByText("Delete mailing").click();
    await page.waitForTimeout(2500);
  }
});
