import { runTest } from "./auth";

// Growth Score on dev (HUB_TEST_AS=team@ → staff, not an agent): ranking → open Michael's card →
// fixes + SPACE parts → edit profiles → recheck runs → Google connect guide.
runTest(
  "Growth Score: staff ranking, agent card, profiles, Google guide",
  async helper => {
    const { page } = helper;
    await page.setViewportSize({ width: 1280, height: 900 });
    await helper.goto("/growth");
    const team = page.getByTestId("team-scores");
    await team.waitFor({ timeout: 20000 });
    await page.getByTestId("team-row-michael@spacematchinc.com").click();
    const card = page.getByTestId("growth-score");
    await card
      .getByText("Michael Kang's Growth Score")
      .waitFor({ timeout: 10000 });
    await card.getByTestId("score-total").waitFor();
    for (const k of ["S", "P", "A", "C", "E"])
      await card.getByTestId(`part-${k}`).waitFor();
    await card.getByText(/Instagram: \d+ posts in 28 days/).waitFor();
    await card.getByTestId("fix-gbp_connect").waitFor();
    await page.screenshot({
      path: "screenshots/growth-score-card.png",
      fullPage: false,
    });

    // Edit profiles: change the Zillow count, save → check runs and finishes with the new number.
    await card.getByTestId("toggle-profiles").click();
    const n = String(100 + (Date.now() % 50));
    await card.getByTestId("pf-zillow-count").fill(n);
    await card.getByTestId("pf-save").click();
    await card.getByText(`Zillow: ${n} reviews`).waitFor({ timeout: 60000 });
    await card
      .getByText(/Checked (just now|\d+ min ago)/)
      .waitFor({ timeout: 60000 });

    // Bad link is refused with a clear message.
    await card.getByTestId("toggle-profiles").click();
    await card.getByTestId("pf-realtor").fill("https://example.com/me");
    await card.getByTestId("pf-save").click();
    await page
      .getByText(
        "Realtor.com profile: that link isn't a Realtor.com profile address.",
      )
      .waitFor({ timeout: 8000 });
    await card.getByTestId("pf-realtor").fill("");

    // Google connect guide from the fix.
    await card.getByTestId("fix-connect-google").click();
    const dlg = page.getByTestId("gbp-dialog");
    await dlg.waitFor();
    await dlg.getByTestId("copy-manager-email").waitFor();
    await dlg.getByText("People and access").first().waitFor();
    await page.screenshot({ path: "screenshots/growth-google-guide.png" });
    await dlg.getByText("I don't have one yet").click();
    await dlg.getByText("business.google.com/create").waitFor();
    await page.keyboard.press("Escape");

    // Playbook step link switches level and scrolls to the item.
    await page.getByTestId("team-row-brandon@spacematchinc.com").click();
    await card
      .getByText("Brandon Banks's Growth Score")
      .waitFor({ timeout: 10000 });
    await card.getByTestId("profiles-form").waitFor({ timeout: 10000 });
    await page.screenshot({ path: "screenshots/growth-first-time.png" });
  },
);
