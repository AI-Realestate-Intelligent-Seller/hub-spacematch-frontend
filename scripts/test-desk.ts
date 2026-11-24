import { runTest } from "./auth";

const sh = (args: string[]) => {
  const r = Bun.spawnSync(["bunx", "convex", ...args], { stdout: "pipe", stderr: "pipe" });
  return new TextDecoder().decode(r.stdout);
};
const recent = () => JSON.parse(sh(["run", "desk:recentInternal"])) as { id: string; token?: string; name: string; stage: string; textError?: string }[];

runTest("Lead Desk: vet, book, accept, report", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 1280, height: 900 });
  // leftovers from a failed run
  const old = recent().filter(r => r.name.startsWith("E2E Desk")).map(r => r.id);
  if (old.length) sh(["run", "desk:removeInternal", JSON.stringify({ ids: old })]);

  await helper.goto("/home");
  await page.getByTestId("desk-tile").waitFor({ timeout: 15000 });

  await helper.goto("/desk");
  await page.getByTestId("desk-page").waitFor();
  await page.getByTestId("desk-row").first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: "screenshots/desk-queue.png", fullPage: false });

  // New buyer lead from an office call
  await page.getByTestId("desk-new").click();
  await page.getByRole("button", { name: "Buyer", exact: true }).click();
  await page.getByTestId("lead-name").fill("E2E Desk Buyer");
  await page.getByTestId("lead-phone").fill("(312) 555-0142");
  await page.getByTestId("lead-email").fill("e2e-desk@example.com");
  await page.getByTestId("f-areas").fill("60614, Lincoln Park, 1 Bennett Park");
  await page.getByTestId("f-budget").fill("$600k–$750k");
  await page.getByTestId("f-financing").selectOption("Pre-approved");
  await page.getByTestId("f-timeline").selectOption("1–3 months");
  await page.getByRole("button", { name: "Hot", exact: true }).click();
  await page.getByTestId("lead-notes").fill("Relocating from Denver in January. Prefers texts after 5pm.");
  await page.screenshot({ path: "screenshots/desk-new-lead.png", fullPage: true });
  await page.getByTestId("lead-save").click();

  const panel = page.getByTestId("book-panel");
  await panel.waitFor({ timeout: 10000 });
  await page.getByText(/Calendars checked/).waitFor({ timeout: 30000 });
  await panel.getByTestId("book-kind").selectOption("phone");
  const rob = panel.getByTestId("agent-option").filter({ hasText: "Rob Robinson" });
  await rob.click();
  await panel.getByTestId("slot").first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: "screenshots/desk-book.png", fullPage: true });
  await panel.getByTestId("slot").nth(2).click();
  await panel.getByTestId("book-submit").click();
  await page.getByTestId("booking-status").getByText(/Waiting for Rob/).waitFor({ timeout: 10000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "screenshots/desk-booked.png", fullPage: true });

  // Agent one-tap link
  const lead = recent().find(r => r.name === "E2E Desk Buyer");
  if (!lead?.token) throw new Error("no token");
  await page.setViewportSize({ width: 390, height: 844 });
  await helper.goto(`/a/${lead.token}`);
  await page.getByTestId("a-accept").waitFor({ timeout: 10000 });
  await page.screenshot({ path: "screenshots/desk-agent-link.png", fullPage: true });
  await page.getByTestId("a-accept").click();
  await page.getByTestId("appt-msg").waitFor({ timeout: 10000 });

  await page.setViewportSize({ width: 1280, height: 900 });
  await helper.goto(`/desk?tab=booked&open=${lead.id}`);
  await page.getByTestId("booking-status").getByText(/accepted/).waitFor({ timeout: 10000 });

  await helper.goto("/desk?tab=report");
  await page.getByTestId("desk-report").waitFor();
  await page.screenshot({ path: "screenshots/desk-report.png", fullPage: false });
  await helper.goto("/desk?tab=agents");
  await page.getByTestId("desk-agents").waitFor();
  await page.screenshot({ path: "screenshots/desk-agents.png", fullPage: false });

  if (!process.env.DESK_KEEP) sh(["run", "desk:removeInternal", JSON.stringify({ ids: [lead.id] })]);
});
