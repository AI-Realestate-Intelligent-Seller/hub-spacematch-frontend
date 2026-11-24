import { execSync } from "node:child_process";
import { runTest } from "./auth";

// Market myself, per agent (Michael 2026-11-22 "All of it" + "make sure they work properly"), on dev:
// Google reviews (send → client page → open/Google tap/private note tracked, own link validation),
// business card (QR + public card + vCard download), open house calendar (add → host → give up → remove),
// past clients (add → due touch → done → edit → remove), post ideas, market update kit (MRED row + typed numbers).
const cx = (fn: string, args: object = {}) =>
  JSON.parse(execSync(`bunx convex run ${fn} '${JSON.stringify(args)}'`, { encoding: "utf8" }).trim() || "null");
const dir = "screenshots/market-me";
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

const RUN = String(Date.now()).slice(-5);
runTest("Market myself: reviews, card, open houses, past clients, post ideas, market kit", async helper => {
  const { page } = helper;
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  const toastText = (t: RegExp | string) => page.locator("[data-sonner-toast]").filter({ hasText: t }).first().waitFor({ timeout: 8000 });
  const noSide = async (w: string) => {
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error(`${w} scrolls sideways`);
  };

  // Who is the test user?
  await helper.goto("/home");
  await page.getByLabel("Account menu").click();
  const shown = (await page.locator("[role=menu] .text-muted-foreground").first().innerText()).trim().toLowerCase();
  // The dev space-session test user acts as the shared team@ account in hubViewer.
  const email = shown.endsWith("viktor.invalid") ? "team@spacematchinc.com" : shown;
  await page.keyboard.press("Escape");
  if (!email.includes("@")) throw new Error(`no email in menu: ${email}`);
  console.log("TEST_EMAIL", email, JSON.stringify(cx("marketMe:cleanupE2eInternal", { email })));

  // Market myself moment lists the new tools
  await helper.goto("/do/market");
  for (const name of ["Business card", "Post ideas", "Market update kit", "Open house calendar", "Past clients", "Google reviews"])
    await page.getByRole("link", { name }).first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${dir}/moment-market.png`, fullPage: true });

  // ── 1. Google reviews ──
  await helper.goto("/reviews");
  await page.getByTestId("reviews-page").waitFor();
  await page.getByTestId("rv-url").fill("https://example.com/not-google");
  await page.getByTestId("rv-save-url").click();
  await toastText(/doesn't look like a Google review link/);
  const bad = await page.locator("[data-sonner-toast]").filter({ hasText: /doesn't look like/ }).first().innerText();
  if (/CONVEX|Server Error|at handler/.test(bad)) throw new Error(`raw server error shown: ${bad}`);
  await page.getByTestId("rv-url").fill("");
  await page.getByTestId("rv-save-url").click();
  await toastText("Saved");
  await page.getByTestId("rv-client").fill(`Jordan E2E${RUN} Price`);
  await page.getByTestId("rv-copy").click();
  await toastText(/copied/);
  const msg = await page.evaluate(() => navigator.clipboard.readText());
  const link = msg.match(/https?:\/\/\S+\/r\/[a-z0-9]+/)?.[0];
  if (!link || !msg.startsWith("Hi Jordan")) throw new Error(`bad review message: ${msg}`);
  await page.getByTestId("rv-row").filter({ hasText: `Jordan E2E${RUN} Price` }).getByText("Not opened yet").waitFor();
  await noSide("/reviews");
  await page.screenshot({ path: `${dir}/reviews.png`, fullPage: true });

  // Client side (public page)
  const client = await page.context().browser()!.newPage({ viewport: { width: 390, height: 844 } });
  await client.goto(link);
  await client.getByTestId("review-landing").waitFor({ timeout: 20000 });
  await client.getByText("Please mention").waitFor(); // no own link → team page + mention by name
  const href = await client.getByTestId("review-google").getAttribute("href");
  if (!href?.includes("search.google.com/local/writereview?placeid=ChIJxYWwPf0tDogRqr8Yjem0gek")) throw new Error(`team link wrong: ${href}`);
  await client.screenshot({ path: `${dir}/review-landing.png`, fullPage: true });
  const [popup] = await Promise.all([client.waitForEvent("popup"), client.getByTestId("review-google").click()]);
  await popup.close();
  await client.getByTestId("review-note").fill("E2E: parking info would have helped.");
  await client.getByTestId("review-note-send").click();
  await client.getByTestId("review-note-sent").waitFor();
  await client.close();
  await helper.goto("/reviews");
  const row = page.getByTestId("rv-row").filter({ hasText: `Jordan E2E${RUN} Price` });
  await row.getByText("Tapped Google").waitFor({ timeout: 10000 });
  await row.getByText("parking info").waitFor();
  const stats = await page.getByTestId("rv-stats").innerText();
  if (!/1\s*Sent[\s\S]*1\s*Opened[\s\S]*1\s*Tapped Google/.test(stats)) throw new Error(`stats wrong: ${stats}`);
  // Own link → the button goes there and no "mention" line
  await page.getByTestId("rv-url").fill("https://g.page/r/E2E-test/review");
  await page.getByTestId("rv-save-url").click();
  await toastText("Saved");
  await page.getByTestId("rv-client").fill("Sam E2E");
  await page.getByTestId("rv-copy").click();
  await toastText(/copied/);
  const link2 = (await page.evaluate(() => navigator.clipboard.readText())).match(/https?:\/\/\S+\/r\/[a-z0-9]+/)![0];
  await helper.goto(new URL(link2).pathname);
  await page.getByTestId("review-landing").waitFor();
  if ((await page.getByTestId("review-google").getAttribute("href")) !== "https://g.page/r/E2E-test/review") throw new Error("own review link not used");
  if (await page.getByText("Please mention").count()) throw new Error("mention line shown with own link");

  // ── 2. Business card ──
  await helper.goto("/card");
  await page.getByText(/Your login isn't on the team roster|Share it/).first().waitFor({ timeout: 15000 });
  if (await page.getByTestId("card-page").count()) {
    await page.getByTestId("card-qr-img").waitFor();
    await page.screenshot({ path: `${dir}/card.png`, fullPage: true });
  }
  await helper.goto("/c/michael-kang");
  await page.getByTestId("public-card").waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${dir}/public-card.png`, fullPage: true });
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("card-save").click()]);
  const vcf = await (await dl.createReadStream())!.toArray().then(b => Buffer.concat(b).toString());
  if (!/BEGIN:VCARD[\s\S]*FN:Michael Kang[\s\S]*TEL;TYPE=CELL:[\s\S]*END:VCARD/.test(vcf)) throw new Error(`bad vcard: ${vcf}`);

  // ── 3. Open house calendar ──
  await helper.goto("/open-houses");
  await page.getByTestId("oh-page").waitFor();
  await page.getByTestId("oh-add-toggle").click();
  await page.getByTestId("oh-listing").selectOption("other");
  await page.getByTestId("oh-address").fill("123 E2E Test St, Chicago");
  const tmr = new Date(Date.now() + 2 * 864e5);
  await page.getByTestId("oh-date").fill(ymd(tmr));
  await page.getByTestId("oh-start").fill("11:00");
  await page.getByTestId("oh-end").fill("13:00");
  await page.getByTestId("oh-host-open").click();
  await page.getByTestId("oh-save").click();
  await toastText(/Agents can now claim/);
  const slot = page.getByTestId("oh-slot").filter({ hasText: "123 E2E Test St" });
  await slot.getByTestId("oh-claim").click();
  await slot.getByText("Host: You").waitFor();
  await page.getByTestId("oh-mine").click();
  await slot.waitFor();
  await page.screenshot({ path: `${dir}/open-houses.png`, fullPage: true });
  await page.getByTestId("oh-mine").click();
  await slot.getByTestId("oh-unclaim").click();
  await slot.getByTestId("oh-claim").waitFor();
  page.once("dialog", d => d.accept());
  await slot.getByTestId("oh-remove").click();
  await slot.waitFor({ state: "detached", timeout: 8000 });

  // ── 4. Past clients ──
  await helper.goto("/past-clients");
  await page.getByTestId("pc-page").waitFor();
  await page.getByTestId("pc-add-toggle").click();
  await page.getByTestId("pc-name").fill("Taylor E2E Client");
  await page.getByTestId("pc-closed").fill(ymd(new Date(Date.now() - 6 * 864e5)));
  await page.getByTestId("pc-side").selectOption("buyer");
  await page.getByTestId("pc-phone").fill("3125550100");
  await page.getByTestId("pc-save").click();
  await toastText("Client added");
  const touch = page.getByTestId("pc-touch").filter({ hasText: "Taylor E2E Client · Ask for a Google review" });
  await touch.waitFor();
  const sms = await touch.getByRole("link", { name: "Text" }).getAttribute("href");
  if (!sms?.startsWith("sms:3125550100") || !sms.includes("Google%20review")) throw new Error(`bad sms link: ${sms}`);
  await touch.getByRole("link", { name: "Send review link" }).click();
  await page.waitForURL(/\/reviews\?client=Taylor/);
  if ((await page.getByTestId("rv-client").inputValue()) !== "Taylor E2E Client") throw new Error("review client not prefilled");
  await helper.goto("/past-clients");
  await page.screenshot({ path: `${dir}/past-clients.png`, fullPage: true });
  await page.getByTestId("pc-touch").filter({ hasText: "Taylor E2E Client · Ask for a Google review" }).getByTestId("pc-done").click();
  await page.getByTestId("pc-touch").filter({ hasText: "Taylor E2E Client · Ask for a Google review" }).waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Edit Taylor E2E Client" }).click();
  await page.getByTestId("pc-name").fill("Taylor E2E Renamed");
  await page.getByTestId("pc-save").click();
  await page.getByTestId("pc-row").filter({ hasText: "Taylor E2E Renamed" }).waitFor();
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "Remove Taylor E2E Renamed" }).click();
  await page.getByTestId("pc-row").filter({ hasText: "Taylor E2E Renamed" }).waitFor({ state: "detached" });

  // ── 5. Market update kit ──
  cx("marketMe:saveStatsInternal", { month: "2026-10", rows: [{ area: "evanston", sales: 61, median: 512000, yoyPct: 4.1, domMedian: 9, soldToList: 100.2, active: 98, monthsSupply: 1.7 }] });
  await helper.goto("/market-update");
  await page.getByTestId("mu-page").waitFor();
  await page.getByTestId("mu-area-evanston").click();
  await page.getByTestId("mu-area-hinsdale").click();
  await page.getByTestId("mu-save-areas").click();
  await toastText("Areas saved");
  const ev = page.getByTestId("mu-area").filter({ hasText: "Evanston" });
  await ev.getByText("Source: MRED, October 2026").first().waitFor({ timeout: 10000 });
  const script = await ev.getByTestId("mu-script").innerText();
  if (!script.includes("$512,000") || !script.includes("up 4.1%") || !script.includes("61 homes sold")) throw new Error(`script wrong: ${script}`);
  const hin = page.getByTestId("mu-area").filter({ hasText: "Hinsdale" });
  await hin.getByTestId("mu-coming").waitFor();
  await hin.getByTestId("mu-median").fill("$1,250,000");
  await hin.getByTestId("mu-sales").fill("14");
  await hin.getByTestId("mu-domMedian").fill("21");
  await hin.getByTestId("mu-active").fill("40");
  await hin.getByTestId("mu-enter-save").click();
  await hin.getByText(/Numbers entered by/).first().waitFor({ timeout: 10000 });
  if (!(await hin.getByTestId("mu-script").innerText()).includes("$1,250,000")) throw new Error("typed numbers not in script");
  await noSide("/market-update");
  await page.screenshot({ path: `${dir}/market-update.png`, fullPage: true });

  // ── 6. Post ideas (uses saved areas) ──
  await helper.goto("/post-ideas");
  await page.getByTestId("pi-page").waitFor();
  if ((await page.getByTestId("pi-idea").count()) !== 4) throw new Error("expected 4 post ideas");
  const cap = await page.getByTestId("pi-caption").first().innerText();
  if (!cap.includes("Evanston")) throw new Error(`caption missing area: ${cap}`);
  await page.getByTestId("pi-copy").first().click();
  await toastText("Copied");
  const t1 = await page.getByTestId("pi-idea").nth(1).innerText();
  await page.getByTestId("pi-next").click();
  if ((await page.getByTestId("pi-idea").nth(1).innerText()) === t1) throw new Error("next month shows the same seasonal idea");
  await page.screenshot({ path: `${dir}/post-ideas.png`, fullPage: true });

  // ── All tools lists them ──
  await helper.goto("/tools");
  await page.getByTestId("tools-filter").fill("review");
  await page.getByTestId("tools-item").filter({ hasText: "Google reviews" }).waitFor();

  cx("marketMe:cleanupE2eInternal", { email });
  if (errors.length) throw new Error(`page errors: ${errors.join(" | ")}`);
  console.log("MARKET_ME_OK");
});
