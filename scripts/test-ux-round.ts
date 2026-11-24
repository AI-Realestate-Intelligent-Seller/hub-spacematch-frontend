import { chromium } from "playwright";
import { runTest } from "./auth";

// Nov UX round (Michael 2026-10-29): one-screen Today, 5 areas + purpose line,
// Get help picker, Agent logins page, sign-in typo catch + no-email reset.
const dir = "screenshots/ux";
const must = async (ok: boolean | Promise<boolean>, what: string) => {
  if (!(await ok)) throw new Error(`Missing: ${what}`);
};

runTest("UX round: Today, areas, help, logins, sign-in", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 390, height: 844 });
  await helper.goto("/home");
  await page.evaluate(() => {
    localStorage.removeItem("hub-start-hidden");
    localStorage.removeItem("hub-install-dismissed");
  });
  await helper.goto("/home");
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${dir}/after-home.png` });
  await page.screenshot({ path: `${dir}/after-home-full.png`, fullPage: true });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log("HOME_HEIGHT", h);
  // Round 2 (11-22): moments + My tools + All tools + Get help replace the 4 big actions.
  for (const id of ["moments", "my-tools", "act-all-tools", "act-help"]) await must(page.getByTestId(id).isVisible(), id);
  await must((await page.getByTestId("today").count()) === 1, "Today card");

  await page.getByTestId("act-help").click();
  await page.waitForTimeout(800);
  await must(page.getByTestId("get-help").isVisible(), "Get help picker");
  await page.screenshot({ path: `${dir}/after-help.png` });
  await page.keyboard.press("Escape");

  // Areas: chips + purpose line
  for (const [path, label] of [["/inbox", "Inbox"], ["/new", "Price a home"], ["/reels", "Make a Reel"], ["/guide", "What to do when"]]) {
    await helper.goto(path);
    await page.waitForTimeout(1500);
    await must(page.getByTestId("area-bar").isVisible(), `area bar on ${path}`);
    await must(page.getByTestId("area-bar").getByText(label, { exact: true }).isVisible(), `${label} chip`);
  }
  await helper.goto("/inbox");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}/after-clients.png` });
  await helper.goto("/listings");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}/after-listings.png` });

  // Trimmed account menu
  await page.getByLabel("Account menu").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/after-menu.png` });
  await page.keyboard.press("Escape");

  // Agent logins (admin/ops)
  await helper.goto("/logins");
  await page.waitForTimeout(2500);
  await must(page.getByTestId("logins-page").isVisible(), "logins page");
  await page.screenshot({ path: `${dir}/after-logins.png` });

  // Signed-out sign-in screen
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const base = new URL(page.url()).origin;
  await p.goto(`${base}/login`);
  await p.waitForTimeout(2500);
  await p.locator("#email").fill("brendan@spacemachinc.com");
  await p.waitForTimeout(300);
  await must(p.getByTestId("email-typo").isVisible(), "email typo hint");
  await p.screenshot({ path: `${dir}/after-login.png` });
  await p.getByTestId("email-typo").click();
  await must((await p.locator("#email").inputValue()) === "brendan@spacematchinc.com", "typo fixed");
  await p.getByText("Forgot password?").click();
  await p.waitForTimeout(500);
  await must(p.getByTestId("reset-by-text").isVisible(), "reset by text");
  await p.screenshot({ path: `${dir}/after-forgot.png` });
  await browser.close();
}).catch(() => process.exit(1));
