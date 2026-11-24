/**
 * Viktor Tools - Call any Viktor SDK function from your Convex app.
 *
 * Available tools include:
 * - quick_ai_search: AI-powered web search with summarized results
 * - text2im: Generate images from text prompts
 * - file_to_markdown: Convert PDF/DOCX/XLSX files to markdown
 * - And all MCP integration tools configured for your user
 *
 * To add a new tool, first test it to see the response shape.
 */
import { v } from "convex/values";
import { authenticatedAction } from "./functions";

declare const process: { env: Record<string, string | undefined> };

const VIKTOR_API_URL = process.env.VIKTOR_SPACES_API_URL!;
const PROJECT_NAME = process.env.VIKTOR_SPACES_PROJECT_NAME!;
const PROJECT_SECRET = process.env.VIKTOR_SPACES_PROJECT_SECRET!;
// Identifies this space across workspaces (project names are only unique per
// owner). Set at init; undefined on deployments that predate it, in which
// case the backend resolves the space from the name + secret.
const SPACE_ID = process.env.VIKTOR_AUTH_RESOURCE_ID;

export async function callTool<T>(
  role: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const response = await viktorToolsFetch(
    `${VIKTOR_API_URL}/api/viktor-spaces/tools/call`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_name: PROJECT_NAME,
        project_secret: PROJECT_SECRET,
        space_id: SPACE_ID,
        role,
        arguments: args,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error ?? "Tool call failed");
  }
  return json.result as T;
}

export const quickAiSearch = authenticatedAction({
  args: { query: v.string() },
  returns: v.string(),
  handler: async (_ctx, { query }) => {
    const result = await callTool<{ search_response: string }>(
      "quick_ai_search",
      {
        search_question: query,
      },
    );
    return result.search_response;
  },
});

export const generateImage = authenticatedAction({
  args: {
    prompt: v.string(),
    aspectRatio: v.optional(
      v.union(
        v.literal("1:1"),
        v.literal("16:9"),
        v.literal("9:16"),
        v.literal("4:3"),
        v.literal("3:2"),
      ),
    ),
  },
  returns: v.string(),
  handler: async (_ctx, { prompt, aspectRatio }) => {
    const result = await callTool<{ response_text: string }>("text2im", {
      prompt,
      aspect_ratio: aspectRatio ?? "1:1",
    });
    return result.response_text;
  },
});

// Waits out the Viktor gateway's 429 and its Retry-After (a paused integration, a
// per-Space rate limit), then retries: at most 2 retries, 20 s per wait, 30 s in
// all, so a Convex action stays far inside its 10-minute limit. Any other status,
// a missing Retry-After or a longer pause returns the response unchanged.
async function viktorToolsFetch(
  ...request: Parameters<typeof fetch>
): Promise<Response> {
  let waitedMs = 0;
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(...withViktorToolAttempt(request, attempt));
    const retryAfter = Number(response.headers.get("Retry-After") || Number.NaN);
    if (
      response.status !== 429 ||
      attempt > 2 ||
      !(retryAfter >= 0 && retryAfter <= 20)
    ) {
      return response;
    }
    // Jitter spreads the calls a pause stopped together, so they do not trip it again.
    const waitMs = Math.max(250, retryAfter * 1000) * (1 + Math.random() * 0.25);
    if (waitedMs + waitMs > 30_000) {
      return response;
    }
    await response.arrayBuffer().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    waitedMs += waitMs;
  }
}

// Marks a retry with its attempt number, so the gateway can count the 429s a retry
// recovers. The first attempt goes out unchanged.
function withViktorToolAttempt(
  request: Parameters<typeof fetch>,
  attempt: number,
): Parameters<typeof fetch> {
  if (attempt === 1) {
    return request;
  }
  const [input, init] = request;
  const headers = new Headers(init?.headers);
  headers.set("X-Viktor-Tool-Attempt", String(attempt));
  return [input, { ...init, headers }];
}
