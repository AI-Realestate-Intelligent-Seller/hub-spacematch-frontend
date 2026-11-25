// Headless UI test of sign-up / verify / sign-in / sign-out against the new backend.
// From frontend/: start the backend with MAIL_MODE=off logging to a file, start Vite, then
//   node scripts/new-auth.ui-test.mjs http://localhost:5173 /path/to/backend.log /tmp/shots
// Optional: PW_CHROME=/path/to/chrome-headless-shell. Deletes nothing: remove zz-ui-* users afterwards.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require("playwright");

const [FE, LOG, SHOTS] = process.argv.slice(2);
const EMAIL = `zz-ui-${Date.now()}@linchpin.net`;
const PW = "Ui-test-pass-123";
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); if (!ok) failures++; };
const codeFor = (email, tag) => {
  for (const l of readFileSync(LOG, "utf8").trim().split("\n").reverse()) {
    try { const j = JSON.parse(l); if (j.to === email && j.tag === tag && j.text) return j.text.match(/\b(\d{6})\b/)?.[1]; } catch {}
  }
};
const wait = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
try {
  // ---- Sign up → code → Home
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(e.message));
  await page.goto(`${FE}/signup`);
  await page.fill("#name", "UI Test");
  await page.fill("#email", "someone@gmail.com");
  await page.fill("#password", PW);
  await page.click("button[type=submit]");
  await page.getByText("Only @linchpin.net email addresses can sign up.").waitFor({ timeout: 5000 });
  check("sign-up form rejects a @gmail.com address", (await page.locator("#code").count()) === 0);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PW);
  await page.click("button[type=submit]");
  await page.waitForSelector("#code", { timeout: 15000 });
  check("sign-up form → code step", true);
  await wait(500);
  const code = codeFor(EMAIL, "auth-code:email-verification");
  check("verification code issued", /^\d{6}$/.test(code ?? ""));
  await page.fill("#code", code);
  await page.click("button[type=submit]");
  await page.waitForURL("**/home", { timeout: 20000 });
  check("after verifying, lands on /home", page.url().endsWith("/home"), page.url());
  await wait(3000); // let the old Convex queries settle
  const crashed = await page.getByText("An unexpected error occurred.").count();
  check("original Home renders (no error screen)", crashed === 0, pageErrors.length ? `page errors: ${pageErrors.slice(0, 2).join(" | ")}` : "");
  const avatar = page.getByRole("button", { name: "Account menu" });
  check("avatar shows the user's initials", (await avatar.innerText()).trim() === "UT", await avatar.innerText());
  await avatar.click();
  const menu = await page.locator("[role=menu]").innerText();
  check("account menu shows name and email", menu.includes("UI Test") && menu.includes(EMAIL));
  await page.screenshot({ path: `${SHOTS}/home-after-signup.png` });

  // ---- Sign out from the user menu → leaves the app
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  const overlay = await page.getByTestId("signing-out").waitFor({ timeout: 3000 }).then(() => true).catch(() => false);
  check("'Signing out…' loading screen appears", overlay);
  await page.waitForURL(u => !u.pathname.startsWith("/home"), { timeout: 15000 });
  check("sign out from the menu leaves the app", !new URL(page.url()).pathname.startsWith("/home"), page.url());
  const me = await page.evaluate(() => fetch("/api/v1/users/me").then(r => r.status));
  check("session is gone after sign out (/users/me → 401)", me === 401, String(me));
  // ---- Sign in again (fresh browser) → Home
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const p2 = await ctx2.newPage();
  await p2.goto(`${FE}/login`);
  await p2.fill("#email", EMAIL);
  await p2.fill("#password", "wrong-password-1");
  await p2.click("button[type=submit]");
  await p2.getByText("Wrong email or password").waitFor({ timeout: 10000 });
  check("wrong password shows a plain message", true);
  await p2.fill("#password", PW);
  await p2.click("button[type=submit]");
  await p2.waitForURL("**/home", { timeout: 20000 });
  check("sign-in lands on /home", p2.url().endsWith("/home"));
  await p2.goto(`${FE}/login`);
  await p2.waitForURL("**/home", { timeout: 10000 });
  check("signed-in user visiting /login is sent to /home", p2.url().endsWith("/home"));
  await ctx2.close();

  // ---- Protected page without a session → /login
  const ctx3 = await browser.newContext();
  const p3 = await ctx3.newPage();
  await p3.goto(`${FE}/home`);
  await p3.waitForURL("**/login", { timeout: 15000 });
  check("signed-out visit to /home redirects to /login", p3.url().endsWith("/login"));
  await p3.screenshot({ path: `${SHOTS}/login.png` });
  await ctx3.close();
} catch (e) {
  failures++; console.log("ERROR", e.message);
} finally {
  await browser.close();
  console.log(`TEST_EMAIL=${EMAIL}`);
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
}
