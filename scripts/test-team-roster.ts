import { runTest } from "./auth";

// Team roster (Michael 11-16 "full"): admins add an agent in the Hub (headshot, bio, license #), the
// agent shows up in pickers, meet-me page and signature maker, gets a login, and can be removed/restored.
const EMAIL = "jordan.e2etest@spacematchinc.com";
const NAME = "Jordan Etwoetest";
const SLUG = "jordan-etwoetest";

runTest("Team roster: add, show everywhere, remove, restore", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await page.setViewportSize({ width: 1280, height: 1000 });
  await helper.goto("/team");
  await page.getByRole("heading", { name: "Team roster" }).waitFor({ timeout: 20000 });
  if (await page.getByTestId(`roster-${EMAIL}`).count()) throw new Error("test agent left over from a previous run: run roster:deleteInternal");

  // Add
  await page.getByTestId("add-agent").click();
  await page.getByTestId("agent-name").fill(NAME);
  await page.getByTestId("agent-email").fill(EMAIL);
  await page.getByTestId("agent-phone").fill("3125550142");
  await page.getByTestId("agent-title").fill("Broker");
  await page.getByTestId("agent-lic").fill("475.999999");
  await page.getByTestId("agent-bio").fill("Jordan helps first-time buyers in Logan Square and Avondale.\n\nBefore real estate, Jordan managed rentals for eight years.");
  await page.getByTestId("agent-photo").setInputFiles("public/media/headshots/angel-zhang.jpg");
  await page.locator('[data-testid="agent-form"] img').first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: "screenshots/team-add-form.png", fullPage: true });
  await page.getByTestId("agent-save").click();
  await page.getByTestId("agent-added").waitFor({ timeout: 30000 });
  const pw = await page.getByTestId("new-password").innerText();
  if (!/^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/.test(pw.trim())) throw new Error(`no temp password shown: ${pw}`);
  const row = page.getByTestId(`roster-${EMAIL}`);
  await row.waitFor({ timeout: 15000 });
  if (!(await row.innerText()).includes("(312) 555-0142")) throw new Error("cell not formatted/saved");
  await row.locator("img").waitFor({ timeout: 15000 });
  await page.getByTestId("agent-added").getByText("Skipped on the test deployment").waitFor({ timeout: 20000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "screenshots/team-added.png", fullPage: true });

  // Agent logins lists them with a login
  await helper.goto("/logins");
  await page.getByTestId(`reset-${EMAIL}`).waitFor({ timeout: 20000 });
  if ((await page.getByTestId(`reset-${EMAIL}`).innerText()).includes("Create")) throw new Error("login not created");

  // Meet-me page (public)
  await helper.goto(`/m/${SLUG}`);
  await page.getByTestId("why-hero").waitFor({ timeout: 20000 });
  const why = await page.innerText("body");
  for (const want of [NAME, "first-time buyers in Logan Square", "475.999999", "(312) 555-0142", "Broker · SpaceMatch Inc."]) {
    if (!why.includes(want)) throw new Error(`meet page missing "${want}"`);
  }
  const photoOk = await page.evaluate(() => [...document.querySelectorAll("img")].some(i => i.src.includes("/api/storage/") && i.naturalWidth > 0));
  if (!photoOk) throw new Error("meet page headshot not loaded");
  await page.screenshot({ path: "screenshots/team-meet-page.png" });

  // Signature maker: office picks the new agent, their uploaded headshot fills in
  await helper.goto("/signature");
  await page.getByTestId("sig-for").waitFor({ timeout: 20000 });
  await page.getByTestId("sig-for").selectOption(NAME);
  const shot = page.getByTestId("sig-preview").locator(`img[alt="${NAME}"]`);
  await shot.waitFor({ timeout: 15000 });
  if (!(await shot.getAttribute("src"))?.includes("/api/storage/")) throw new Error("signature didn't use the uploaded headshot");
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("sm-signature-v1:")) localStorage.removeItem(k); });

  // Mailer QR landing page: the new agent's name + uploaded headshot
  await helper.goto(`/v/SAMPLE?a=${SLUG}`);
  const mimg = page.locator(`img[alt="${NAME}"]`);
  await mimg.waitFor({ timeout: 20000 });
  if (!(await mimg.getAttribute("src"))?.includes("/api/storage/")) throw new Error("mailer landing didn't use the uploaded headshot");

  // Remove → Former members → Restore
  await helper.goto("/team");
  await page.getByTestId(`remove-${EMAIL}`).click();
  await page.getByTestId(`confirm-remove-${EMAIL}`).click();
  await page.getByTestId(`restore-${EMAIL}`).waitFor({ timeout: 20000 });
  if (await page.getByTestId(`roster-${EMAIL}`).count()) throw new Error("still on the roster after remove");
  await helper.goto(`/m/${SLUG}`);
  await page.getByText("This link isn't valid anymore").waitFor({ timeout: 20000 });
  await helper.goto("/team");
  await page.getByTestId(`restore-${EMAIL}`).click();
  await page.getByTestId("new-password").waitFor({ timeout: 20000 });
  await page.getByTestId(`roster-${EMAIL}`).waitFor({ timeout: 15000 });

  // Phone layout
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("agent-added").getByText("Done").click();
  await page.getByTestId(`edit-${EMAIL}`).click();
  await page.getByTestId("agent-form").waitFor();
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error("page scrolls sideways on phone");
  await page.screenshot({ path: "screenshots/team-phone-edit.png", fullPage: true });
});
