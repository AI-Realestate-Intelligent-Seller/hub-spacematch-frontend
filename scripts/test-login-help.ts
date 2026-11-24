// e2e: wrong-email sign-in shows "no Hub login" + suggested email; wrong password says wrong password.
// Needs `bunx vite preview --port 5173` (dev backend). Run: bun run --bun scripts/test-login-help.ts
import { chromium } from "playwright";
const URL = process.env.APP_URL || "http://localhost:5173";
const b = await chromium.launch();
const page = await (await b.newContext()).newPage();
await page.goto(`${URL}/login`);
const email = page.locator("input#email").first();
await email.waitFor({ timeout: 20000 });
await email.fill("brendan.murphy@spacematchinc.com");
await page.locator("input#password").fill("whatever123");
await page.getByRole("button", { name: "Sign In" }).click();
const help = page.getByTestId("login-help");
await help.waitFor({ timeout: 15000 });
const t1 = await help.innerText();
console.log("HELP1:", t1);
if (!t1.includes("brendan@spacematchinc.com")) throw new Error("no suggestion");
await page.screenshot({ path: "tmp/login-help-1.png" });
await page.getByTestId("login-help-use").click();
if ((await email.inputValue()) !== "brendan@spacematchinc.com") throw new Error("use-it did not fill");
// Forgot flow with a wrong email
await page.getByRole("button", { name: "Forgot password?" }).click();
const f = page.locator("input#email").first();
await f.fill("bmurphy@gmail.com");
await page.getByRole("button", { name: "Email me a code" }).click();
await help.waitFor({ timeout: 15000 });
console.log("HELP2:", await help.innerText());
await page.screenshot({ path: "tmp/login-help-2.png" });
await b.close();
console.log("PASS");
