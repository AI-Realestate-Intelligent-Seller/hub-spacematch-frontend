import { runTest } from "./auth";

// Emails page + net sheet + back bar (Michael 2026-10-31, #team-app-design 1793460359.025149).
// Phone-size screenshots for the approval post. AS=agent|admin picks which checks run.
const dir = `screenshots/emails${process.env.AS === "admin" ? "-admin" : ""}`;
const must = async (ok: boolean | Promise<boolean>, what: string) => {
  if (!(await ok)) throw new Error(`Missing: ${what}`);
};
const AS = process.env.AS ?? "agent";

runTest(`Emails + net sheet (${AS})`, async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 390, height: 844 });

  // Ready-made library
  await helper.goto("/emails");
  await page.waitForTimeout(2500);
  await must(page.getByTestId("back-bar").isVisible(), "back bar");
  await must(page.getByTestId("email-kickoff-1").isVisible(), "kickoff email");
  await page.getByTestId("lib-first").fill("Jordan");
  await page.getByTestId("seg-kickoff").click();
  await page.getByTestId("email-kickoff-1").getByRole("button").first().click();
  await page.waitForTimeout(400);
  await must(page.getByTestId("email-kickoff-1").getByTestId("email-subject").getByText("Quick question, Jordan").isVisible(), "filled subject");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${dir}/1-library.png` });
  await page.getByTestId("seg-renters").click();
  await page.waitForTimeout(300);
  await page.getByTestId("email-renters-1").getByRole("button").first().click();
  await page.waitForTimeout(300);
  await page.getByTestId("email-renters-1").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/2-library-renters.png` });

  // New groups (10-31): Clients in a deal / Win listings
  await page.getByTestId("grp-deal").click();
  await page.waitForTimeout(300);
  await must(page.getByTestId("seg-under-contract").isVisible(), "under contract segment");
  await page.getByTestId("email-uc-1").getByRole("button").first().click();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${dir}/2b-deal.png` });
  await page.getByTestId("grp-listings").click();
  await page.waitForTimeout(300);
  await page.getByTestId("seg-expired").click();
  await must(page.getByTestId("email-exp-1").isVisible(), "expired email");
  await page.screenshot({ path: `${dir}/2c-listings.png` });
  await page.getByTestId("grp-touch").click();

  // Rent vs own
  await page.getByTestId("tab-rent").click();
  await page.getByTestId("rvo-first").fill("Jordan");
  await page.getByTestId("rvo-zip").fill("60611");
  await page.getByTestId("rvo-extra-500").click();
  await page.waitForTimeout(500);
  const price = await page.getByTestId("rvo-price").innerText();
  console.log("RVO_PRICE", price);
  await must(/\$3\d\d,000/.test(price), "rent vs own price ~$300Ks");
  await must(page.getByTestId("rvo-email").getByText("Streeterville").first().isVisible(), "area in email");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${dir}/3-rent-inputs.png` });
  await page.getByTestId("rvo-result").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/4-rent-result.png` });
  await page.getByTestId("rvo-email").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/5-rent-email.png` });
  console.log("RVO_EMAIL_START\n" + (await page.getByTestId("rvo-email").getByTestId("email-body").innerText()) + "\nRVO_EMAIL_END");

  // Move-up
  await page.getByTestId("tab-moveup").click();
  await page.getByTestId("mu-first").fill("Chris");
  await page.waitForTimeout(400);
  await must(page.getByTestId("mu-result").isVisible(), "move-up result");
  await page.getByTestId("mu-result").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/6-moveup.png` });
  console.log("MU_EMAIL_START\n" + (await page.getByTestId("mu-email").getByTestId("email-body").innerText()) + "\nMU_EMAIL_END");

  // My templates: create, suggest
  await page.getByTestId("tab-mine").click();
  await page.getByTestId("tpl-new").click();
  await page.getByTestId("tpl-title").fill("E2E open house follow-up");
  await page.getByTestId("tpl-subject").fill("Thanks for stopping by, {first_name}");
  await page.getByTestId("tpl-body").fill("Hi {first_name},\n\nThanks for coming by the open house today. Want the disclosures?");
  await page.getByText("+ Neighborhood").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/7-builder.png` });
  await page.getByTestId("tpl-save").click();
  await page.waitForTimeout(1500);
  await must(page.getByTestId("tpl-row").first().isVisible(), "saved template row");
  await page.getByTestId("tpl-suggest").first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}/8-mine.png` });

  if (AS === "admin") {
    await must(page.getByTestId("tab-review").isVisible(), "review tab for admin");
  }

  // Net sheet
  await helper.goto("/net-sheet?price=450000&payoff=250000&zip=60614");
  await page.waitForTimeout(2000);
  const net = await page.getByTestId("ns-net").innerText();
  console.log("NET", net);
  await must(/\$1\d\d,\d{3}/.test(net), "net sheet number");
  await page.screenshot({ path: `${dir}/9-netsheet.png` });
  await page.getByTestId("ns-result").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/10-netsheet-result.png`, fullPage: false });

  // Back bar goes back
  await page.getByTestId("back-bar").getByText("Back").click();
  await page.waitForTimeout(1500);
  console.log("AFTER_BACK", page.url());
});
