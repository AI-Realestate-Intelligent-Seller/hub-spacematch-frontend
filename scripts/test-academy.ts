import { runTest } from "./auth";
import { TRAINING_TRACKS } from "../convex/trainingDefs";

runTest("SpaceMatch Academy", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await helper.goto("/training");
  await page.getByText("Systems that close deals").waitFor({ timeout: 15000 });
  for (const t of TRAINING_TRACKS) await page.getByTestId(`track-${t.id}`).waitFor();
  await page.screenshot({ path: "screenshots/academy.png", fullPage: true });
  // drill
  await page.getByTestId("drill-btn-numbers").click();
  await page.getByTestId("drill-numbers").waitFor();
  // quiz: wrong first, then right
  const t = TRAINING_TRACKS.find(x => x.id === "numbers")!;
  await page.getByTestId("quiz-btn-numbers").click();
  const quiz = page.getByTestId("quiz-numbers");
  for (const [i, q] of t.quiz.entries()) await quiz.locator("fieldset").nth(i).getByRole("button", { name: q.options[(q.answer + 1) % q.options.length], exact: true }).click();
  await page.getByTestId("quiz-submit-numbers").click();
  await page.getByTestId("quiz-result-numbers").getByText(/Not yet/).waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: "Try again" }).click();
  for (const [i, q] of t.quiz.entries()) await quiz.locator("fieldset").nth(i).getByRole("button", { name: q.options[q.answer], exact: true }).click();
  await page.getByTestId("quiz-submit-numbers").click();
  await page.getByTestId("quiz-result-numbers").getByText(/5\/5 · Passed/).waitFor({ timeout: 8000 });
  await page.getByTestId("track-numbers").screenshot({ path: "screenshots/academy-quiz.png" });
  // complete modules → ready → sign off (michael is staff)
  for (const m of t.modules) await page.getByTestId(`train-${m.id}`).click().then(() => page.waitForTimeout(400));
  await page.getByTestId("track-numbers").getByText("Awaiting sign-off").waitFor({ timeout: 8000 });
  await page.getByTestId("team-progress").getByRole("button", { name: "Sign off" }).first().click();
  await page.getByTestId("track-numbers").getByText("Certified").waitFor({ timeout: 8000 });
  await page.getByTestId("team-progress").screenshot({ path: "screenshots/academy-team.png" });
  // undo
  await page.getByTestId("team-progress").getByTitle(/Signed off by/).first().click();
  await page.waitForTimeout(600);
  for (const m of t.modules) await page.getByTestId(`train-${m.id}`).click().then(() => page.waitForTimeout(400));
  // new playbook renders
  await helper.goto("/playbooks/ai-toolkit");
  await page.getByText("Prompts that work").waitFor({ timeout: 10000 });
  await page.getByTestId("playbook-done").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await helper.goto("/training");
  await page.getByTestId("track-start").waitFor({ timeout: 15000 });
  await page.screenshot({ path: "screenshots/academy-phone.png" });
  console.log("ACADEMY OK");
});
