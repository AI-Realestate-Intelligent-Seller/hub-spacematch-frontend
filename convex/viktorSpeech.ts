/**
 * Viktor Speech - realtime speech-to-text sessions for Hub viewers
 * (ported from template v40 `convex/viktorSpeech.ts`, 2026-11-22).
 *
 * "Talk it in" on the CMA form (Michael 2026-11-22: "All agents get it").
 * The template's version is a `billedToolAction` (workspace members only);
 * Michael approved every Hub agent, including email/password logins, so this
 * one admits any signed-in, current SpaceMatch Hub user instead
 * (`voiceFill.speechViewerAllowed`: @spacematchinc.com or admin, not removed).
 * Usage is billed to the workspace as credits.
 */
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { authenticatedAction } from "./functions";
import {
  transcriptionStartError,
  transcriptionUnreachable,
} from "./viktorSpeechErrors";

declare const process: { env: Record<string, string | undefined> };

const VIKTOR_API_URL = process.env.VIKTOR_SPACES_API_URL!;
const PROJECT_NAME = process.env.VIKTOR_SPACES_PROJECT_NAME!;
const PROJECT_SECRET = process.env.VIKTOR_SPACES_PROJECT_SECRET!;
const SPACE_ID = process.env.VIKTOR_AUTH_RESOURCE_ID;

type SessionResponse = { ticket: string; ws_path: string };

const MINT_TIMEOUT_MS = 10_000;

export const startTranscription = authenticatedAction({
  args: {
    languageCode: v.optional(v.string()),
    keyterms: v.optional(v.array(v.string())),
    vadSilenceSeconds: v.optional(v.number()),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, { languageCode, keyterms, vadSilenceSeconds }) => {
    const ok: boolean = await ctx.runQuery(
      internal.voiceFill.speechViewerAllowed,
      { userId: ctx.userId },
    );
    if (!ok) {
      throw new ConvexError({
        kind: "refused",
        message: "Voice fill is for SpaceMatch agents. Sign in with your @spacematchinc.com email.",
      });
    }
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), MINT_TIMEOUT_MS);
    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(
        `${VIKTOR_API_URL}/api/viktor-spaces/realtime-transcription/sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: timeout.signal,
          body: JSON.stringify({
            project_name: PROJECT_NAME,
            project_secret: PROJECT_SECRET,
            space_id: SPACE_ID,
            viewer_id: ctx.userId,
            language_code: languageCode,
            keyterms,
            vad_silence_seconds: vadSilenceSeconds,
          }),
        },
      );
    } catch {
      throw new ConvexError(transcriptionUnreachable());
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        detail?: unknown;
      } | null;
      throw new ConvexError(
        transcriptionStartError(response.status, body?.detail),
      );
    }
    const session = (await response.json()) as SessionResponse;
    const wsBase = VIKTOR_API_URL.replace(/^http/, "ws").replace(/\/$/, "");
    return {
      url: `${wsBase}${session.ws_path}?ticket=${encodeURIComponent(session.ticket)}`,
    };
  },
});
