import { runTest } from "./auth";

// New Leads tracker (Michael 2026-11-08). Uses a fake lead (non-numeric Lofty id → no Lofty writes).
const sh = (args: string[]) => {
  const r = Bun.spawnSync(["bunx", "convex", ...args], { stdout: "pipe", stderr: "pipe" });
  return new TextDecoder().decode(r.stdout);
};
const ID = "e2e-newlead-1";
const now = Date.now();
sh(["run", "leadTrack:removeInternal", JSON.stringify({ loftyLeadIds: [ID] })]);
sh(["run", "leadTrack:upsert", JSON.stringify({
  leads: [{
    loftyLeadId: ID, name: "Taylor E2E-Seller", phone: "3125550142", email: "e2e@example.com", source: "Peak Presence YouTube Ads", kind: "yt_seller",
    leadTypes: [1], stage: "New Leads", agentName: "Michael Kang", street: "123 N Test Ave, Chicago", tags: [], cannotText: false, createdAt: now - 40 * 60000,
    comms: [
      { at: now - 38 * 60000, kind: "auto_text", status: "Delivered", text: "Hi Taylor, Anna here. Thinking of selling?", by: "Anna (Lofty AI)" },
      { at: now - 20 * 60000, kind: "text_in", status: "Delivered", text: "Yes, maybe in spring. What is it worth?" },
    ],
    textCount: 2,
  }],
  meta: { ok: true, leads: 1 },
})]);

runTest("New Leads: list, playbook, log call, handled", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 1280, height: 900 });
  await helper.goto("/home");
  await page.getByTestId("new-leads-tile").waitFor({ timeout: 15000 });
  await page.getByTestId("new-leads-tile").screenshot({ path: "screenshots/nl-tile.png" });

  await helper.goto("/new-leads");
  await page.getByTestId("new-leads-page").waitFor();
  const row = page.getByTestId("nl-row").filter({ hasText: "Taylor E2E-Seller" });
  await row.waitFor({ timeout: 10000 });
  if (!(await row.innerText()).includes("call now")) throw new Error("reply should be 'call now'");
  await page.screenshot({ path: "screenshots/nl-list.png", fullPage: false });

  if (!(await row.innerText()).includes("CMA")) throw new Error("CMA badge missing on the row");
  await row.click();
  await page.getByTestId("nl-playbook").waitFor();
  if (!(await page.getByTestId("nl-playbook").innerText()).includes("YouTube seller")) throw new Error("wrong playbook");
  // Anna already texted Taylor → no office-line text box (Michael 2026-11-09).
  await page.getByTestId("nl-no-text").filter({ hasText: "Anna" }).waitFor();
  if (await page.getByTestId("nl-text").count()) throw new Error("quick text shown although Anna texted");
  // "What is it worth?" from a seller → CMA started automatically (Michael 2026-11-09).
  await page.getByTestId("nl-cma-status").filter({ hasText: "Building: 123 N Test Ave" }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: "screenshots/nl-detail.png", fullPage: true });
  const cmaId = JSON.parse(sh(["run", "leadTrack:byCmaLofty", JSON.stringify({ loftyLeadId: ID })]) || "null");
  if (!cmaId) throw new Error("no CMA request linked");
  sh(["run", "cmaWorker:setStatus", JSON.stringify({ id: cmaId, status: "ready", valueLow: 410000, valueHigh: 440000, listPrice: 429900, statusNote: "E2E test build" })]);
  await page.getByTestId("nl-cma-status").filter({ hasText: "Ready" }).waitFor({ timeout: 15000 });
  if (!(await page.getByTestId("nl-cma").innerText()).includes("$410,000–$440,000")) throw new Error("value range missing");
  await page.getByTestId("nl-cma").screenshot({ path: "screenshots/nl-cma-ready.png" });

  await page.getByTestId("nl-result").selectOption("Talked");
  await page.getByTestId("nl-note").fill("Selling in spring, wants a CMA");
  await page.getByTestId("nl-log").click();
  await page.getByTestId("nl-step").filter({ hasText: "update the Lofty stage" }).waitFor({ timeout: 10000 });
  await page.getByTestId("nl-timeline").filter({ hasText: "Selling in spring" }).waitFor();

  await page.getByTestId("nl-done").click();
  await page.getByTestId("nl-step").filter({ hasText: "Handled" }).waitFor({ timeout: 10000 });

  // 375px phone
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "screenshots/nl-detail-phone.png", fullPage: false });
  sh(["run", "leadTrack:removeInternal", JSON.stringify({ loftyLeadIds: [ID] })]);
});
