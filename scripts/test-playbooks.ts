import { runTest } from "./auth";

runTest("Playbooks + announcements", async helper => {
  const { page } = helper;
  await helper.goto("/playbooks");
  await page.getByText("Speed-to-Lead").first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: "screenshots/playbooks.png", fullPage: true });
  await helper.goto("/playbooks/open-house");
  await page.getByText("7 days before").waitFor({ timeout: 10000 });
  await page.screenshot({ path: "screenshots/playbook-open-house.png", fullPage: true });
  await helper.goto("/announcements");
  await page.getByText("Important team news").waitFor({ timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "screenshots/announcements.png", fullPage: true });
  await helper.goto("/home");
  await page.getByLabel("Search the hub").fill("open house");
  await page.waitForTimeout(700);
  await page.screenshot({ path: "screenshots/search-playbook.png" });
});
