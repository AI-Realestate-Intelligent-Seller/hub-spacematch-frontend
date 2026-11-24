import { runTest } from "./auth";
import { CATALOG, MOMENTS } from "../src/lib/catalog";

// Findability round 2 (Michael 2026-11-22): moments on Home, /do/:id pages, All tools (/tools), My tools.
// "Make sure they work properly": every button on every moment page and every tool row must open a real page
// (no redirect to Home from the catch-all route, no crash).
const dir = "screenshots/findability";

runTest("Findability: moments, All tools, My tools", async helper => {
  const { page } = helper;
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });

  const noSideScroll = async (where: string) => {
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error(`${where} scrolls sideways on a phone`);
  };
  // Opens a link target and checks we stayed on that page (catch-all * redirects unknown paths to Home).
  const checked = new Set<string>();
  const opens = async (href: string, from: string) => {
    const url = new URL(href, page.url());
    if (checked.has(url.pathname + url.search)) return;
    checked.add(url.pathname + url.search);
    await helper.goto(url.pathname + url.search);
    await page.waitForTimeout(900);
    const now = new URL(page.url());
    if (now.pathname !== url.pathname) throw new Error(`${from}: ${href} landed on ${now.pathname}`);
    const body = await page.locator("body").innerText();
    if (/Something went wrong|Page not found/i.test(body)) throw new Error(`${from}: ${href} shows an error`);
  };

  // Home: 6 moments, My tools, All tools, Get help
  await helper.goto("/home");
  await page.getByTestId("moments").waitFor({ timeout: 20000 });
  const n = await page.getByTestId("moments").getByRole("link").count();
  if (n !== MOMENTS.length) throw new Error(`expected ${MOMENTS.length} moments, got ${n}`);
  for (const id of ["my-tools", "act-all-tools", "act-help"]) await page.getByTestId(id).waitFor();
  await noSideScroll("Home");
  await page.getByTestId("moments").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/home-moments.png` });
  await page.screenshot({ path: `${dir}/home-full.png`, fullPage: true });

  // Each moment page: steps numbered, every button works
  for (const m of MOMENTS) {
    await helper.goto("/home");
    await page.getByTestId(`moment-${m.id}`).click();
    await page.waitForURL(new RegExp(`/do/${m.id}$`));
    await page.getByTestId("moment-page").waitFor({ timeout: 15000 });
    const steps = await page.getByTestId("moment-step").count();
    const want = m.groups.reduce((k, g) => k + g.steps.length, 0);
    if (steps !== want) throw new Error(`${m.id}: ${steps} steps, expected ${want}`);
    await noSideScroll(`/do/${m.id}`);
    await page.screenshot({ path: `${dir}/moment-${m.id}.png`, fullPage: true });
    const hrefs = await page.getByTestId("moment-btn").evaluateAll(els => els.map(e => e.getAttribute("href")).filter(Boolean) as string[]);
    for (const h of hrefs) await opens(h, `/do/${m.id}`);
  }
  // Copy-text button (new lead) copies without crashing
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await helper.goto("/do/new-lead");
  await page.getByRole("button", { name: "Copy text" }).click();
  await page.getByText("Text copied").waitFor({ timeout: 5000 });

  // All tools: every group, every row opens its page
  await helper.goto("/home");
  await page.getByTestId("act-all-tools").click();
  await page.waitForURL(/\/tools$/);
  await page.getByTestId("tools-page").waitFor();
  const groups = await page.getByTestId("tools-group").count();
  if (groups < CATALOG.length) throw new Error(`only ${groups} tool groups (test user should be staff and see Office only too)`);
  await noSideScroll("/tools");
  await page.screenshot({ path: `${dir}/tools.png` });
  await page.screenshot({ path: `${dir}/tools-full.png`, fullPage: true });
  await page.getByTestId("tools-filter").fill("postcard");
  await page.getByTestId("tools-item").filter({ hasText: "Postcards" }).first().waitFor();
  await page.screenshot({ path: `${dir}/tools-filter.png` });
  await page.getByTestId("tools-filter").fill("zzqqxx");
  await page.getByTestId("tools-empty").waitFor();
  await page.getByTestId("tools-filter").fill("");
  const toolHrefs = await page.getByTestId("tools-item").evaluateAll(els => els.map(e => e.getAttribute("href")!) );
  if (toolHrefs.length < 30) throw new Error(`only ${toolHrefs.length} tools listed`);
  for (const h of toolHrefs) await opens(h, "/tools");

  // Account menu → All tools
  await helper.goto("/home");
  await page.getByLabel("Account menu").click();
  await page.getByTestId("menu-all-tools").click();
  await page.waitForURL(/\/tools$/);

  // Search "all tools" → All tools
  await helper.goto("/home");
  const box = page.getByLabel("Search the hub");
  await box.fill("all tools");
  await page.getByText("Every Hub tool, grouped by what it's for").first().waitFor({ timeout: 8000 });

  // My tools learns: open Postcards twice → it shows on Home
  await page.evaluate(() => localStorage.removeItem("hub-tool-use"));
  await helper.goto("/mailers");
  await helper.goto("/mailers");
  await page.waitForTimeout(500);
  await helper.goto("/home");
  await page.getByTestId("mytool-mailers").waitFor({ timeout: 10000 });
  await page.evaluate(() => localStorage.removeItem("hub-tool-use"));

  if (errors.length) throw new Error(`page errors: ${errors.join(" | ")}`);
  console.log(`OK: ${checked.size} links opened`);
});
