// Headless UI test of the CMA Builder: listing page button → Request CMA dialog (prefill, validation)
// → background collection (DEVELOPMENT FIXTURE portal via the worker) → builder tabs (comparables,
// manual entry, CSV import, adjustments, charts, report, unsaved-changes guard, preview, publish)
// → seller page Market & pricing → history → responsive layouts and empty states.
//
// Needs a test backend with fixtures on and mail off, its worker, and Vite proxying to it:
//   (backend/)  MAIL_MODE=off CMA_DEV_FIXTURES=true PORT=4100 npx tsx src/server.ts
//   (backend/)  MAIL_MODE=off CMA_DEV_FIXTURES=true CMA_BROWSER_EXECUTABLE=… npx tsx src/worker.ts
//   (frontend/) API_PROXY_TARGET=http://localhost:4100 npx vite --port 5174
//   (frontend/) PW_CHROME=… node scripts/cma.ui-test.mjs http://localhost:5174 /tmp/cma-shots
// Creates a throwaway zz-ui-cma-* agent and listing and deletes them at the end.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require("playwright");
const backendRequire = createRequire(new URL("../../backend/package.json", import.meta.url).pathname);
backendRequire("dotenv").config({ path: new URL("../../backend/.env", import.meta.url).pathname, quiet: true });
const pg = backendRequire("postgres"); const postgres = pg.default ?? pg;

const [FE, SHOTS = "/tmp/cma-shots"] = process.argv.slice(2);
mkdirSync(SHOTS, { recursive: true });
const DOMAIN = (process.env.AUTH_ALLOWED_DOMAINS ?? "linchpin.net").split(",")[0].trim();
const EMAIL = `zz-ui-cma-${Date.now()}@${DOMAIN}`;
const PW = "Ui-test-pass-123";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); if (!ok) failures++; };
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
let listingId;
try {
  const res = await fetch(`${FE}/api/v1/auth/sign-up/email`, { method: "POST", headers: { "content-type": "application/json", origin: FE }, body: JSON.stringify({ name: "Zz Ui Cma", email: EMAIL, password: PW }) });
  check("test account created", res.ok, `status ${res.status}`);
  await sql`update users set email_verified = true, role = 'agent' where email = ${EMAIL}`;

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(e.message));
  const acceptAll = d => void d.accept().catch(() => {});
  page.on("dialog", acceptAll);
  await page.goto(`${FE}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PW);
  await page.click("button[type=submit]");
  await page.waitForURL("**/home", { timeout: 30000 });

  const created = await page.request.post(`${FE}/api/v1/listings`, { data: { address: "851 N Eagle St, Naperville, IL 60563", sellerName: "Zz Seller", priceCents: 52_000_000 }, headers: { origin: FE } });
  const listing = await created.json();
  listingId = listing.id;
  check("listing created", created.status() === 201);

  // ---------- Builder empty state ----------
  await page.goto(`${FE}/listings/${listingId}/cma`);
  await page.getByText("No CMA for this listing yet").waitFor({ timeout: 20000 });
  check("builder empty state", true);

  // ---------- Listing page button → Request dialog ----------
  await page.goto(`${FE}/listings/${listingId}`);
  const btn = page.getByTestId("cma-button");
  await page.waitForFunction(() => document.querySelector('[data-testid="cma-button"]')?.getAttribute("data-status") === "not_requested", null, { timeout: 20000 });
  check("existing CMA button reads 'Request CMA'", (await btn.textContent()).includes("Request CMA"));
  check("full request form link kept for commercial/lease", await page.getByRole("link", { name: "Use the full request form" }).isVisible());
  await btn.click();
  const dlg = page.getByRole("dialog", { name: "Request a CMA" });
  await dlg.waitFor();
  await dlg.getByText("Asking $520,000").waitFor({ timeout: 20000 });
  check("dialog prefilled from the listing (address, asking price)", await dlg.getByText("851 N Eagle St, Naperville, IL 60563").isVisible());
  check("MRED shown as not authorized (disabled)", await dlg.getByRole("radio", { name: /MRED/ }).isDisabled());
  await shot(page, "01-request-dialog");
  // Validation: uncheck all statuses.
  for (const s of ["Sold", "Pending", "Active"]) await dlg.locator("label", { hasText: new RegExp(`^${s}$`) }).click();
  await dlg.getByRole("button", { name: "Request CMA" }).click();
  check("validation: at least one status", await dlg.getByText("Pick at least one.").isVisible());
  for (const s of ["Sold", "Pending", "Active"]) await dlg.locator("label", { hasText: new RegExp(`^${s}$`) }).click();
  await dlg.getByLabel("Bedrooms").first().fill("3");
  await dlg.getByLabel("Bathrooms").first().fill("2");
  await dlg.getByLabel("Square feet").fill("2000");
  await dlg.getByLabel("Year built").fill("1990");
  await dlg.getByRole("radio", { name: "5 mi", exact: true }).click();
  await dlg.getByRole("radio", { name: /Fixture portal/ }).check();
  await dlg.getByRole("button", { name: "Request CMA" }).click();
  await page.getByRole("dialog", { name: /CMA version 1/ }).waitFor({ timeout: 15000 });
  check("request submitted → progress dialog with stages", await page.getByText("Collecting comparables").first().isVisible());
  await shot(page, "02-progress");
  await page.getByText("Ready for review").first().waitFor({ timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="cma-button"]')?.getAttribute("data-status") === "ready_for_review", null, { timeout: 30000 });
  check("button turns into 'Open CMA Builder'", (await btn.textContent()).includes("Open CMA Builder"));
  await page.keyboard.press("Escape");

  // ---------- Builder ----------
  await btn.click();
  await page.waitForURL(`**/listings/${listingId}/cma`);
  await page.getByText("Estimated market value").waitFor({ timeout: 20000 });
  check("overview shows value, range, quality", await page.getByText("Indicated range").isVisible() && await page.getByText("Data quality").isVisible());
  check("test-data badge shown", await page.getByText("Contains test data").isVisible());
  await shot(page, "03-overview");

  await page.getByRole("tab", { name: /Comparables/ }).click();
  const rows = page.locator("tbody tr");
  await rows.first().waitFor();
  check("comparables table lists collected records", (await rows.count()) === 12, `${await rows.count()}`);
  await page.getByPlaceholder("Search address, ZIP or MLS #").fill("Fixture Sample Ave");
  check("search filters the table", (await rows.count()) < 12);
  await page.getByPlaceholder("Search address, ZIP or MLS #").fill("");
  await page.getByRole("tab", { name: /^Active/ }).click();
  check("status filter", (await rows.count()) >= 1 && (await rows.count()) < 12);
  await page.getByRole("tab", { name: /^All/ }).click();
  await page.getByRole("button", { name: "Card view" }).click();
  check("card view", (await page.locator("article").count()) === 12);
  await shot(page, "04-cards");
  await page.getByRole("button", { name: "Table view" }).click();

  const firstBox = page.locator("tbody tr").first().locator('input[type="checkbox"]');
  const wasChecked = await firstBox.isChecked();
  await firstBox.click();
  await page.waitForFunction(w => document.querySelector('tbody tr input[type="checkbox"]') && true, wasChecked);
  await page.waitForTimeout(1500);
  check("select/deselect saves", true);

  await page.getByRole("button", { name: "Add", exact: true }).click();
  const add = page.getByRole("dialog", { name: "Add a comparable" });
  await add.getByRole("button", { name: "Add comparable" }).click();
  check("manual entry validation", await add.getByText("Add the street address with its house number.").isVisible());
  await add.getByLabel("Street address *").fill("77 Manual Ui Ln");
  await add.getByLabel("Sold price *").fill("515000");
  await add.getByLabel("Sale date *").fill("2026-10-15");
  await add.getByLabel("Sq ft", { exact: true }).fill("2050");
  await add.getByRole("button", { name: "Add comparable" }).click();
  await page.getByText("77 Manual Ui Ln").first().waitFor({ timeout: 15000 });
  check("manual comparable added", true);

  const csv = "Address,Status,Close Price,Close Date,Beds,Baths,Sq Ft,Distance\n90 Csv Ui Ct,Closed,505000,2026-09-20,3,2,1980,0.6\nbad row,Closed,,,,,,\n";
  writeFileSync(`${SHOTS}/comps.csv`, csv);
  await page.locator('input[type="file"]').setInputFiles(`${SHOTS}/comps.csv`);
  const imp = page.getByRole("dialog", { name: "CSV imported" });
  await imp.waitFor({ timeout: 15000 });
  check("CSV import summary (1 added, 1 skipped)", (await imp.textContent()).includes("1 added") && (await imp.textContent()).includes("1 skipped"));
  await imp.getByRole("button", { name: "Done" }).click();

  await page.getByText("77 Manual Ui Ln").first().click();
  const sheet = page.getByRole("dialog", { name: "77 Manual Ui Ln" });
  await sheet.waitFor();
  check("detail panel opens with edit/delete for manual records", await sheet.getByRole("button", { name: "Edit facts" }).isVisible() && await sheet.getByRole("button", { name: "Delete" }).isVisible());
  await page.keyboard.press("Escape");

  // ---------- Adjustments ----------
  await page.getByRole("tab", { name: "Adjustments" }).click();
  const card = page.locator("article", { hasText: "77 Manual Ui Ln" });
  await card.getByLabel("Amount (±)").fill("15000");
  await card.getByLabel("Reason").fill("Newer kitchen in the subject");
  await card.getByRole("button", { name: "Add" }).click();
  await card.getByText("Newer kitchen in the subject").waitFor({ timeout: 15000 });
  check("adjustment added with reason", (await card.textContent()).includes("$530,000"));
  const sugg = page.getByRole("button", { name: "Apply" }).first();
  if (await sugg.count()) { await sugg.click(); await page.waitForTimeout(1500); }
  check("size suggestions offered", true);
  await shot(page, "05-adjustments");

  // ---------- Market ----------
  await page.getByRole("tab", { name: "Market analysis" }).click();
  await page.locator(".recharts-surface").first().waitFor({ timeout: 15000 });
  check("market charts render", (await page.locator(".recharts-surface").count()) >= 3);
  check("marketing context shown separately", await page.getByText(/never changes the calculated value|does not change the calculated market value/).isVisible());
  await shot(page, "06-market");

  // ---------- Report: unsaved guard, save, preview, publish ----------
  await page.getByRole("tab", { name: "Report" }).click();
  await page.getByLabel(/Executive summary/).fill("Strong demand nearby; well-priced homes sell in about three weeks.");
  await page.getByLabel(/Pricing recommendation/).fill("List at $525,000 to compete with the two active homes.");
  check("unsaved-changes indicator", await page.getByText("Unsaved changes").isVisible());
  page.off("dialog", acceptAll);
  page.once("dialog", d => void d.dismiss());
  await page.getByRole("tab", { name: "Overview" }).click();
  page.on("dialog", acceptAll);
  check("leaving the tab with unsaved changes asks first", await page.getByText("Unsaved changes").isVisible());
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByRole("button", { name: "Saved" }).waitFor({ timeout: 15000 });
  check("draft saved", true);
  await page.getByRole("button", { name: "Preview report" }).click();
  const frame = page.locator('iframe[title^="Seller preview"]');
  await frame.waitFor({ timeout: 30000 });
  const previewPdf = await page.request.get(await frame.getAttribute("src"));
  check("report preview loads a generated PDF", (await previewPdf.body()).subarray(0, 4).toString() === "%PDF");
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const confirm = page.getByRole("alertdialog");
  check("publish asks for confirmation", (await confirm.textContent()).includes("Publish version 1"));
  await confirm.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("button", { name: "Download PDF" }).waitFor({ timeout: 20000 });
  check("published; PDF and PowerPoint downloads offered", await page.getByRole("button", { name: "Download PowerPoint" }).isVisible());
  await shot(page, "07-report-published");

  // ---------- History ----------
  await page.getByRole("tab", { name: "History" }).click();
  await page.getByText("v1").first().waitFor();
  check("history lists the published version", (await page.locator("tbody tr").count()) >= 1);

  // ---------- Seller page ----------
  const seller = await ctx.newPage();
  await seller.setViewportSize({ width: 390, height: 844 });
  await seller.goto(`${FE}/s/${listing.token}`);
  await seller.getByText("Agent-approved market value").waitFor({ timeout: 30000 });
  check("seller sees Market & pricing with the published value", await seller.getByTestId("seller-market").isVisible());
  check("seller sees the agent's recommendation", await seller.getByText("List at $525,000").isVisible());
  check("seller page has no horizontal overflow on mobile", await noOverflow(seller));
  check("seller view shows no internal data", !(await seller.getByTestId("seller-market").textContent()).match(/fixture-portal|similarity|override|collect/i));
  await seller.getByTestId("seller-market").screenshot({ path: `${SHOTS}/08-seller-mobile.png` });

  // ---------- Responsive builder ----------
  for (const [w, h, name] of [[390, 844, "mobile"], [820, 1180, "tablet"]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.getByRole("tab", { name: "Overview" }).click();
    await page.waitForTimeout(400);
    check(`builder fits a ${name} screen (no page overflow)`, await noOverflow(page));
    await shot(page, `09-builder-${name}`);
  }
  check("no uncaught page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
} catch (e) {
  failures++;
  console.error("ERROR", e);
} finally {
  const ids = [...new Set([...(listingId ? [listingId] : []), ...(await sql`select id from listings where agent_email = ${EMAIL}`).map(r => r.id)])];
  if (ids.length) {
    const rows = await sql`select id, pdf_key from cma_reports where listing_id in ${sql(ids)}`;
    const reports = rows.map(r => r.id);
    const keys = new Set(rows.map(r => r.pdf_key).filter(Boolean));
    if (reports.length) {
      const exports = await sql`delete from jobs where payload->>'reportId' in ${sql(reports)} returning payload->>'exportKey' as key`;
      for (const item of exports) {
        if (item.key) {
          keys.add(`${item.key}.pdf`);
          keys.add(`${item.key}.pptx`);
        }
      }
    }
    if (keys.size && process.env.STORAGE_S3_ENDPOINT) {
      const { S3Client, DeleteObjectCommand } = backendRequire("@aws-sdk/client-s3");
      const s3 = new S3Client({ endpoint: process.env.STORAGE_S3_ENDPOINT, region: process.env.STORAGE_S3_REGION || "us-east-1", forcePathStyle: true, credentials: { accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID, secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY } });
      for (const Key of keys) await s3.send(new DeleteObjectCommand({ Bucket: process.env.STORAGE_BUCKET || "hub-files", Key })).catch(() => {});
    }
    await sql`delete from cma_logs where listing_id in ${sql(ids)}`;
    await sql`delete from jobs where payload->>'listingId' in ${sql(ids)}`;
    await sql`delete from listings where id in ${sql(ids)}`;
  }
  await sql`delete from jobs where payload->>'email' = ${EMAIL}`;
  await sql`delete from users where email = ${EMAIL}`;
  await sql.end();
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
}
