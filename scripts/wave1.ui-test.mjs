// Headless UI test: Vendors (/resources), Help requests (Get help dialog + /help) and Email templates
// (/emails → My templates) against the new backend: validation, loading, empty and error states.
// From frontend/: start the backend and Vite (proxying /api/v1 to it), then
//   node scripts/wave1.ui-test.mjs http://localhost:5173 /tmp/shots
// Creates a throwaway zz-ui-* agent and deletes it and everything it made at the end.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require("playwright");
const backendRequire = createRequire(new URL("../../backend/package.json", import.meta.url).pathname);
backendRequire("dotenv").config({ path: new URL("../../backend/.env", import.meta.url).pathname, quiet: true });
const pg = backendRequire("postgres"); const postgres = pg.default ?? pg;

const [FE, SHOTS = "/tmp/wave1-shots"] = process.argv.slice(2);
mkdirSync(SHOTS, { recursive: true });
const DOMAIN = (process.env.AUTH_ALLOWED_DOMAINS ?? "linchpin.net").split(",")[0].trim();
const EMAIL = `zz-ui-${Date.now()}@${DOMAIN}`;
const PW = "Ui-test-pass-123";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); if (!ok) failures++; };
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const visible = (loc, timeout = 20000) => loc.first().waitFor({ timeout }).then(() => true, () => false);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
try {
  const res = await fetch(`${FE}/api/v1/auth/sign-up/email`, { method: "POST", headers: { "content-type": "application/json", origin: FE }, body: JSON.stringify({ name: "Zz Ui Agent", email: EMAIL, password: PW }) });
  check("test account created", res.ok, `status ${res.status}`);
  await sql`update users set email_verified = true, role = 'agent' where email = ${EMAIL}`;
  const [{ n: vendorCount }] = await sql`select count(*)::int as n from vendors where private = false and hidden = false`;

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

  // ================= Vendors =================
  // Loading skeleton: hold the vendors request for 2 s.
  await page.route("**/api/v1/vendors", async route => { await new Promise(r => setTimeout(r, 6000)); await route.continue().catch(() => {}); });
  await page.goto(`${FE}/resources`);
  check("vendors: loading skeleton shows while loading", await visible(page.getByRole("status", { name: "Loading" }), 8000));
  await page.unroute("**/api/v1/vendors");
  if (vendorCount === 0) check("vendors: empty state when there are no vendors", await visible(page.getByText("No vendors yet")));
  await page.getByRole("button", { name: "Add vendor" }).first().click();
  const vf = page.getByTestId("vendor-form");
  await vf.waitFor();
  await vf.getByRole("button", { name: "Add vendor" }).click();
  check("vendors: empty name flagged", await visible(vf.getByText("Add the contact name."), 3000));
  check("vendors: missing contact flagged", await visible(vf.getByText("Add a phone, email or website so agents can reach them."), 3000));
  const phone = vf.getByLabel("Phone");
  await phone.pressSequentially("312abc5550100");
  check("vendors: phone accepts digits only and formats", (await phone.inputValue()) === "(312) 555-0100", await phone.inputValue());
  await vf.getByLabel("Email").fill("pat@");
  await vf.getByLabel("Email").blur();
  check("vendors: bad email flagged", await vf.getByText("That email doesn't look right.").isVisible());
  await vf.getByLabel("Website").fill("not a site");
  await vf.getByLabel("Website").blur();
  check("vendors: bad website flagged", await vf.getByText(/website doesn't look right/).isVisible());
  await shot(page, "01-vendor-errors");
  await vf.getByLabel("Contact name *").fill("Zz Pat Lender");
  await vf.getByLabel("Email").fill("pat@acme.com");
  await vf.getByLabel("Website").fill("acme.com");
  await vf.getByRole("button", { name: "Add vendor" }).click();
  check("vendors: added and shown", await visible(page.getByText("Zz Pat Lender")));
  const card = page.locator("div[id]").filter({ hasText: "Zz Pat Lender" }).first();
  await card.getByRole("button", { name: "Rate 4" }).click();
  check("vendors: rating saved", await visible(page.getByText("Thanks for rating")));
  await card.getByRole("button", { name: "Edit" }).click();
  await page.getByTestId("vendor-form").getByLabel("Company").fill("Zz Acme Mortgage");
  await page.getByTestId("vendor-form").getByRole("button", { name: "Save" }).click();
  check("vendors: edit saved (company shown as the title)", await visible(page.getByText("Zz Acme Mortgage")));
  await page.getByLabel("Search vendors").fill("zzz-nothing-matches");
  check("vendors: no-match empty state", await visible(page.getByText(/No vendors match/)));
  await shot(page, "02-vendor-nomatch");
  await page.getByRole("button", { name: "Show all vendors" }).click();
  await page.locator("div[id]").filter({ hasText: "Zz Acme Mortgage" }).first().getByRole("button", { name: /Remove/ }).click();
  check("vendors: removed", await visible(page.getByText("Vendor removed")));

  // ================= Help requests =================
  // Error state: fail the first load, then Try again.
  await page.route("**/api/v1/help-requests", route => route.abort());
  await page.goto(`${FE}/help`);
  check("help: load error with Try again", await visible(page.getByText("Couldn't load help requests.")));
  await page.unroute("**/api/v1/help-requests");
  await page.getByRole("button", { name: "Try again" }).click();
  check("help: Try again loads; empty state for my requests", await visible(page.getByText("No requests yet")));
  await shot(page, "03-help-empty");

  await page.goto(`${FE}/home`);
  await page.getByRole("button", { name: /Get help/ }).first().click();
  await page.getByTestId("help-pick-CC").click();
  const dlg = page.getByTestId("help-dialog");
  await dlg.getByRole("button", { name: /^Send to/ }).click();
  check("help: topic required", await visible(dlg.getByText("Pick what you need help with."), 3000));
  await dlg.getByRole("button", { name: "Other" }).click();
  await dlg.getByRole("button", { name: /^Send to/ }).click();
  check("help: 'Other' needs details", await dlg.getByText("Say what you need help with.").isVisible());
  await dlg.getByRole("button", { name: "MLS input" }).click();
  await dlg.locator("textarea").fill("Zz test: 1234 N Main St needs MLS input");
  await shot(page, "04-help-dialog");
  await dlg.getByRole("button", { name: /^Send to/ }).click();
  check("help: request sent", await visible(page.getByText(/Sent to Cris/)));
  await page.goto(`${FE}/help`);
  check("help: request listed under Your requests", await visible(page.getByTestId("help-row").filter({ hasText: "MLS input" })));
  await page.getByRole("button", { name: "Don't need it anymore" }).click();
  check("help: asker closes it", await visible(page.getByTestId("help-row").getByText("Done")));

  // ================= Email templates =================
  await page.goto(`${FE}/emails?tab=mine`);
  check("templates: empty state", await visible(page.getByText("No templates yet")));
  await page.getByTestId("tpl-new").click();
  await page.getByTestId("tpl-body").fill("Hi");
  await page.getByTestId("tpl-save").click();
  check("templates: subject required", await visible(page.getByText("Add a subject."), 3000));
  check("templates: too-short email flagged", await page.getByText(/too short to send/).isVisible());
  await page.getByTestId("tpl-subject").fill("Thanks, {firstname}");
  await page.getByTestId("tpl-save").click();
  check("templates: unknown field flagged", await page.getByText(/Unknown field \{firstname\}/).isVisible());
  await shot(page, "05-template-errors");
  await page.getByTestId("tpl-subject").fill("Thanks for coming, {first_name}");
  await page.getByTestId("tpl-title").fill("Zz open house follow-up");
  await page.getByTestId("tpl-body").fill("Hi {first_name},\n\nThanks for stopping by the open house today.");
  await page.getByTestId("tpl-save").click();
  check("templates: saved and listed", await visible(page.getByTestId("tpl-row").filter({ hasText: "Zz open house follow-up" })));
  await page.getByTestId("tpl-suggest").click();
  check("templates: suggested (waiting for approval)", await visible(page.getByText("Waiting for approval")));
  await shot(page, "06-templates");
  await page.getByRole("button", { name: "Delete template" }).click();
  check("templates: deleted", await visible(page.getByText("Template deleted")));

  check("no page errors", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
} catch (e) {
  failures++;
  console.error("ERROR", e.message);
} finally {
  await browser.close();
  await sql`delete from vendors where added_by_email = ${EMAIL}`;
  await sql`delete from help_requests where from_email = ${EMAIL}`;
  await sql`delete from email_templates where owner_email = ${EMAIL}`;
  await sql`delete from users where email = ${EMAIL}`;
  await sql.end();
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
}
