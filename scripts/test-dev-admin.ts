import { runTest } from "./auth";

// Developer admins (DEV_ADMIN_EMAILS): run with dev HUB_TEST_AS=mirmurtaza@gmail.com → Lead Desk + admin nav visible.
runTest("Developer has admin view", async helper => {
  const { page } = helper;
  await helper.goto("/desk");
  await page.getByTestId("desk-page").waitFor({ timeout: 20000 });
  const err = await page.getByText("The Lead Desk is for admins and ops only").count();
  if (err) throw new Error("Lead Desk blocked for developer");
  await helper.goto("/adoption");
  await page.getByTestId("adoption-page").waitFor({ timeout: 20000 });
  await helper.screenshot("dev-admin.png");
});
