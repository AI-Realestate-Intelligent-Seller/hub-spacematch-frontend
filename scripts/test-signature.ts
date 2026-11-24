import { runTest } from "./auth";

// Email signature maker (Michael 11-12): agents build their own SpaceMatch x Real signature with their
// own details and social links, then copy it into Gmail.
runTest("Email signature maker", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  for (const [w, h, name] of [[1280, 1000, "desktop"], [390, 844, "phone"]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await helper.goto("/signature");
    await page.getByRole("heading", { name: "Email signature" }).waitFor({ timeout: 20000 });
    const preview = page.getByTestId("sig-preview");
    await preview.locator("table").first().waitFor();
    await page.getByTestId("sig-name").fill("Jordan Test");
    await page.getByTestId("sig-title").fill("Broker");
    await page.getByTestId("sig-cell").fill("(312) 555-0199");
    await page.getByTestId("sig-email").fill("jordan@spacematchinc.com");
    await page.getByTestId("sig-link-instagram").fill("@jordansellschicago");
    await page.getByTestId("sig-link-facebook").fill("facebook.com/jordansells");
    await page.getByTestId("sig-link-tiktok").fill("");
    await page.getByTestId("sig-booking").fill("calendly.com/jordan-test");
    const text = await preview.innerText();
    for (const want of ["Jordan Test", "BROKER", "(312) 555-0199", "(773) 985-7153", "jordan@spacematchinc.com", "2822 Central St., Evanston, IL 60201", "500+", "100+", "#19", "a team of Real Broker, LLC", "Instagram", "Facebook"]) {
      if (!text.includes(want)) throw new Error(`preview is missing "${want}" at ${w}px`);
    }
    if (/TikTok|Coldwell/i.test(text)) throw new Error("preview shows an empty link or old brokerage");
    const ig = await preview.getByRole("link", { name: "Instagram" }).getAttribute("href");
    if (ig !== "https://www.instagram.com/jordansellschicago/") throw new Error(`instagram link wrong: ${ig}`);
    const fb = await preview.getByRole("link", { name: "Facebook" }).getAttribute("href");
    if (fb !== "https://facebook.com/jordansells") throw new Error(`facebook link wrong: ${fb}`);
    const cal = await preview.getByRole("link", { name: /Book a consultation with Jordan/ }).getAttribute("href");
    if (cal !== "https://calendly.com/jordan-test") throw new Error(`booking link wrong: ${cal}`);
    // Every picture in the preview really loads (logo bar, and the headshot when there is one).
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="sig-preview"] img')].every(i => (i as HTMLImageElement).complete));
    const broken = await preview.locator("img").evaluateAll(els => els.filter(i => !(i as HTMLImageElement).naturalWidth).map(i => (i as HTMLImageElement).src));
    if (broken.length) throw new Error(`broken images: ${broken.join(", ")}`);
    // The page itself never scrolls sideways.
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error(`page scrolls sideways at ${w}px`);
    // On a phone the whole signature fits the preview box (no sideways scroll inside it either).
    if (await preview.evaluate(el => { const box = el.parentElement as HTMLElement; return box.scrollWidth > box.clientWidth + 1; })) throw new Error(`signature wider than the preview box at ${w}px`);
    // Toggles.
    await page.getByTestId("sig-stats").uncheck();
    if ((await preview.innerText()).includes("#19")) throw new Error("team numbers still showing after switching them off");
    await page.getByTestId("sig-stats").check();
    // Copy HTML: uses the public hub address for images so they load inside an email.
    await page.getByTestId("sig-copy-html").click();
    const code = await page.evaluate(() => navigator.clipboard.readText());
    if (!code.includes("https://hub.spacematchinc.com/media/sig/lockup-band.png") || !code.includes("Jordan Test")) throw new Error("copied HTML is wrong");
    if (code.length > 10000) throw new Error(`signature is ${code.length} chars, over Gmail's 10,000 limit`);
    await page.getByTestId("sig-copy").click();
    await page.getByRole("button", { name: "Copied" }).waitFor({ timeout: 5000 });
    const rich = await page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      return items[0].types.includes("text/html") ? await (await items[0].getType("text/html")).text() : "";
    });
    if (!rich.includes("Jordan Test") || !rich.includes("<table")) throw new Error("rich copy did not put the formatted signature on the clipboard");
    // Saved on this device: a reload keeps what was typed.
    await page.reload();
    await page.getByTestId("sig-preview").locator("table").first().waitFor();
    if ((await page.getByTestId("sig-name").inputValue()) !== "Jordan Test") throw new Error("details were not kept after reload");
    // Office login: start a signature for an agent. Their details and headshot fill in.
    await page.getByTestId("sig-for").selectOption("Michael Kang");
    const p2 = page.getByTestId("sig-preview");
    await p2.getByText("Michael Kang").waitFor();
    const shot = p2.locator('img[alt="Michael Kang"]');
    await shot.waitFor();
    await page.waitForFunction(() => { const i = document.querySelector('[data-testid="sig-preview"] img[alt="Michael Kang"]') as HTMLImageElement | null; return !!i && i.complete && i.naturalWidth > 0; });
    if (!(await shot.getAttribute("src"))?.endsWith("/media/sig/michael-kang.jpg")) throw new Error("agent headshot not used");
    const hb = await shot.boundingBox();
    if (!hb || Math.abs(hb.width - hb.height) > 1.5) throw new Error(`headshot is not round: ${hb?.width}x${hb?.height}`);
    if (!(await p2.innerText()).includes("michael@spacematchinc.com")) throw new Error("agent email not filled in");
    await page.getByTestId("sig-link-instagram").fill("@spacematchchicago");
    await page.getByTestId("sig-link-linkedin").fill("michael-kang-spacematch-inc");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/signature-${name}.png`, fullPage: true });
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("sm-signature-v1:")) localStorage.removeItem(k); });
  }
});
