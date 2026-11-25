// Headless UI test of the listings module against the new backend: New listing form (validation +
// create), detail page forms (details, weekly numbers, activity, suggestions, steps) and the seller portal.
// From frontend/: start the backend and Vite (proxying /api/v1 to it), then
//   node scripts/listings.ui-test.mjs http://localhost:5173 /tmp/shots
// Creates a throwaway zz-ui-* agent and deletes it (and its listings) at the end.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require("playwright");
const backendRequire = createRequire(new URL("../../backend/package.json", import.meta.url).pathname);
backendRequire("dotenv").config({ path: new URL("../../backend/.env", import.meta.url).pathname, quiet: true });
const pg = backendRequire("postgres"); const postgres = pg.default ?? pg;

const [FE, SHOTS = "/tmp/listings-shots"] = process.argv.slice(2);
mkdirSync(SHOTS, { recursive: true });
const DOMAIN = (process.env.AUTH_ALLOWED_DOMAINS ?? "linchpin.net").split(",")[0].trim();
const EMAIL = `zz-ui-${Date.now()}@${DOMAIN}`;
const PW = "Ui-test-pass-123";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });
let failures = 0;
const created = []; // listing ids, for cleanup
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); if (!ok) failures++; };
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
try {
  // Account: sign up through the API, mark verified in the DB.
  const res = await fetch(`${FE}/api/v1/auth/sign-up/email`, { method: "POST", headers: { "content-type": "application/json", origin: FE }, body: JSON.stringify({ name: "Zz Ui Agent", email: EMAIL, password: PW }) });
  check("test account created", res.ok, `status ${res.status}`);
  await sql`update users set email_verified = true, role = 'agent' where email = ${EMAIL}`;

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(e.message));
  page.on("dialog", d => d.accept());
  await page.goto(`${FE}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PW);
  await page.click("button[type=submit]");
  await page.waitForURL("**/home", { timeout: 30000 });

  // ---------- Listings page + New listing form ----------
  await page.goto(`${FE}/listings`);
  await page.getByText("No listings yet").waitFor({ timeout: 30000 });
  check("empty listings page loads from the new backend", true);
  await page.getByRole("button", { name: "New listing" }).first().click();
  const form = page.locator("form").filter({ hasText: "New listing" });
  await form.waitFor();

  const addr = form.getByLabel("Property address *");
  const mls = form.getByLabel("MLS #");
  const price = form.getByLabel("List price");
  const name = form.getByLabel("Seller name *");
  const phone = form.getByLabel("Seller mobile");
  const email = form.getByLabel("Seller email");

  await mls.pressSequentially("12ab34-56");
  check("MLS # accepts digits only", (await mls.inputValue()) === "123456", await mls.inputValue());
  await price.pressSequentially("5x49000");
  check("price accepts digits only and adds $ and commas", (await price.inputValue()) === "$549,000", await price.inputValue());
  await phone.pressSequentially("312abc5550100");
  check("phone accepts digits only and formats", (await phone.inputValue()) === "(312) 555-0100", await phone.inputValue());
  await name.pressSequentially("Jane9 Doe");
  check("seller name drops digits", (await name.inputValue()) === "Jane Doe", await name.inputValue());

  await name.fill("");
  await form.getByRole("button", { name: "Create listing" }).click();
  await form.getByText("Add the property address.").waitFor({ timeout: 3000 });
  check("submit with empty required fields shows errors", await form.getByText("Add the seller's name.").isVisible());
  await addr.fill("Main Street");
  await addr.blur();
  check("address without house number is flagged", await form.getByText(/house number/).isVisible());
  await email.fill("jane@");
  await email.blur();
  check("bad email is flagged", await form.getByText("That email doesn't look right.").isVisible());
  await mls.fill("123");
  await mls.blur();
  check("short MLS # is flagged", await form.getByText("MLS # is 6 to 10 digits.").isVisible());
  await shot(page, "01-new-listing-errors");

  await addr.fill("1234 n main st, chicago il 60614");
  await mls.fill("12345678");
  await name.fill("Jane Doe");
  await email.fill("jane@example.com");
  await form.getByRole("button", { name: "Create listing" }).click();
  await page.waitForURL(/\/listings\/[A-Za-z0-9]+$/, { timeout: 30000 });
  await page.getByRole("heading", { name: "1234 N Main St" }).waitFor({ timeout: 30000 });
  check("create → detail page shows the saved listing", await page.getByText(/Jane Doe · Zz Ui Agent · MLS 12345678 · \$549,000/).isVisible());
  const listingId = page.url().split("/").pop();
  created.push(listingId);
  await shot(page, "02-detail");

  // ---------- Launch steps ----------
  await page.getByRole("button", { name: "Mark Media day done" }).click();
  await page.getByText(/^Done \d/).first().waitFor({ timeout: 20000 });
  check("tick a launch step", true);

  // ---------- Details: edit + validation ----------
  await page.getByRole("button", { name: "Details", exact: true }).click();
  const dPrice = page.getByLabel("List price");
  await dPrice.fill("");
  await dPrice.pressSequentially("525000");
  const zillow = page.getByLabel("Zillow listing");
  await zillow.fill("http://zillow.com/x");
  await page.getByRole("button", { name: "Save details" }).click();
  check("http link is refused in the form", await page.getByText("Use a full link starting with https://").first().isVisible());
  await zillow.fill("https://www.zillow.com/homedetails/x");
  await page.getByLabel("Mobile").fill("");
  await page.getByRole("button", { name: "Save details" }).click();
  await page.getByText(/· \$525,000/).waitFor({ timeout: 20000 });
  check("edited price saved and shown in the header", true);
  await page.reload();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  check("saved values come back after reload", (await page.getByLabel("Zillow listing").inputValue()) === "https://www.zillow.com/homedetails/x" && (await page.getByLabel("List price").inputValue()) === "$525,000");
  await shot(page, "03-details");

  // ---------- Status ----------
  await page.getByLabel("Status").selectOption("Active");
  await page.getByText("Status: Active").waitFor({ timeout: 20000 });
  check("status change saved", true);

  // ---------- Weekly numbers ----------
  await page.getByRole("button", { name: "Weekly numbers" }).click();
  const zv = page.getByLabel("Zillow views");
  await zv.pressSequentially("4a2b0");
  check("weekly numbers accept digits only", (await zv.inputValue()) === "420", await zv.inputValue());
  await page.getByLabel("TikTok link").fill("not a link");
  await page.getByRole("button", { name: "Save week" }).click();
  check("bad TikTok link is flagged", await page.getByText("Use a full link starting with https://").isVisible());
  await page.getByLabel("TikTok link").fill("https://www.tiktok.com/@x/video/1");
  await page.getByRole("button", { name: "Save week" }).click();
  await page.getByText("Saved. Your seller sees it now.").waitFor({ timeout: 20000 });
  await page.getByRole("cell", { name: "420" }).waitFor({ timeout: 20000 });
  check("weekly numbers saved and listed", true);
  await shot(page, "04-numbers");

  // ---------- Activity ----------
  await page.getByRole("button", { name: /^Activity/ }).click();
  await page.getByRole("button", { name: "Post", exact: true }).click();
  check("empty update is flagged", await page.getByText("Add a short title.").isVisible());
  await page.getByPlaceholder("Broker open went great, 14 agents").fill("Broker open went great");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await page.getByText("Posted to your seller's page").waitFor({ timeout: 20000 });
  await page.locator("li").filter({ hasText: "Broker open went great" }).first().waitFor({ timeout: 20000 });
  check("update posted and listed", true);

  // ---------- Next steps ----------
  await page.getByRole("button", { name: "Next steps" }).click();
  await page.getByRole("button", { name: "Add draft" }).click();
  check("empty suggestion is flagged", await page.getByText("Add a title.").isVisible());
  await page.getByLabel("New suggestion title").fill("Stage the second bedroom");
  await page.getByRole("button", { name: "Add draft" }).click();
  await page.getByText("Added as a draft").waitFor({ timeout: 20000 });
  const sugg = page.getByTestId("suggestion").filter({ has: page.locator('input[value="Stage the second bedroom"]') });
  await sugg.waitFor({ timeout: 20000 });
  await sugg.getByRole("button", { name: "Publish" }).click();
  await page.getByText("Published to your seller's page").waitFor({ timeout: 20000 });
  check("suggestion added and published", true);
  await shot(page, "05-next-steps");

  // ---------- Seller portal ----------
  const [row] = await sql`select token from listings where id = ${listingId}`;
  const seller = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  seller.on("pageerror", e => pageErrors.push(`portal: ${e.message}`));
  await seller.goto(`${FE}/s/${row.token}`);
  await seller.getByText("Stage the second bedroom").waitFor({ timeout: 30000 });
  check("seller portal shows the published suggestion", true);
  check("seller portal shows the posted update", await seller.getByText("Broker open went great").isVisible());
  await shot(seller, "06-portal");
  await seller.getByRole("button", { name: "Approve plan" }).click();
  await seller.getByTestId("plan-approved").waitFor({ timeout: 30000 });
  check("seller approves the plan", true);
  await seller.goto(`${FE}/s/not-a-real-token-xxxxxxxxxxxx`);
  await seller.getByText("This link has expired").waitFor({ timeout: 30000 });
  check("unknown portal link shows the expired page", true);

  // ---------- List page shows it ----------
  await page.goto(`${FE}/listings`);
  await page.getByText("1234 N Main St").first().waitFor({ timeout: 30000 });
  check("listing appears on the Listings page", await page.getByText("1/11").isVisible());
  await shot(page, "07-list");

  // ---------- Delete ----------
  await page.goto(`${FE}/listings/${listingId}`);
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page.getByRole("button", { name: "Delete listing" }).click();
  await page.waitForURL("**/listings", { timeout: 30000 });
  const [left] = await sql`select count(*)::int as n from listings where id = ${listingId}`;
  check("delete listing", left.n === 0);

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
} catch (e) {
  failures++;
  console.error("ERROR", e.message);
} finally {
  await browser.close();
  const ids = [...new Set([...created, ...(await sql`select id from listings where agent_email = ${EMAIL}`).map(r => r.id)])];
  if (ids.length) {
    await sql`delete from listings where id in ${sql(ids)}`;
    await sql`delete from jobs where payload->>'listingId' in ${sql(ids)}`;
  }
  await sql`delete from jobs where payload->>'email' = ${EMAIL}`;
  await sql`delete from users where email = ${EMAIL}`;
  await sql.end();
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
}
