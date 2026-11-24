import { runTest } from "./auth";

// Agent videos: Home tile → /my-videos, tutorial, staff "View as" an agent, uploads list with a
// low-quality flag, "Tell the editor" note, team panel. Seed the dev cache first:
//   bunx convex run agentVideos:saveFiles '{"agentEmail":"eduardo@spacematchinc.com","files":[...]}'
runTest("Agent videos", async helper => {
  const { page } = helper;
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await helper.goto("/home");
  await page.getByText("My videos").first().waitFor({ timeout: 20000 });
  await page.screenshot({ path: "screenshots/videos-home.png" });
  await page.getByText("My videos").first().click();
  await page.getByTestId("videos-page").waitFor({ timeout: 15000 });
  await page.getByTestId("videos-tutorial").getByText("Set your camera to 4K").waitFor();
  await page.getByTestId("no-folder").waitFor(); // team@ has no folder of its own
  await page.getByRole("tab", { name: "Android" }).click();
  await page.getByText("Rear video size").waitFor();
  await page.getByRole("tab", { name: "iPhone" }).click();
  await page.getByText("4K at 30 fps.").first().waitFor();

  await page.getByLabel("View as agent").selectOption("eduardo@spacematchinc.com");
  await page.getByTestId("upload-folder").waitFor({ timeout: 10000 });
  const href = await page.getByTestId("upload-folder").getAttribute("href");
  if (!href?.includes("drive.google.com/drive/folders/1OlnLQ9ex67ta4unU7rYWYFxtJOCcNk9D")) throw new Error(`bad folder link ${href}`);
  const team = await page.getByTestId("team-folder").getAttribute("href");
  if (!team?.includes("1YxAo-HTVZSwPIevPCojlJHf8QZsw99se")) throw new Error(`bad team folder link ${team}`);
  await page.getByTestId("videos-files").waitFor({ timeout: 10000 });
  await page.getByText("WhatsApp copy").first().waitFor();
  await page.screenshot({ path: "screenshots/videos-page.png", fullPage: true });

  await page.getByTestId("open-brief").click();
  await page.getByTestId("brief-files").waitFor();
  await page.getByTestId("brief-title").fill("E2E test: 3 things before you list");
  await page.screenshot({ path: "screenshots/videos-brief.png" });
  await page.getByTestId("brief-send").click();
  await page.getByTestId("videos-briefs").getByText("E2E test: 3 things before you list").waitFor({ timeout: 10000 });
  await page.getByTestId("videos-team").getByText("Eduardo Rodriguez").first().waitFor();
  await page.screenshot({ path: "screenshots/videos-team.png", fullPage: true });

  // cleanup
  await page.getByTestId("videos-briefs").getByRole("button", { name: "Remove note" }).first().click();
  await page.waitForTimeout(1500);
  if (await page.getByText("E2E test: 3 things before you list").count()) throw new Error("note not removed");
  console.log("agent videos ok");
});
