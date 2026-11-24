# Reels API integration (preview only, not in production)

Branch `reel-stats-preview`, commit `bd54269`. It runs on the Hub **preview** with the dev database and dev key.

## How to apply
From the `spacematch-hub/` folder: `git apply reels-preview/reels-api-integration.patch`. It applies cleanly on top of `main` `9504541` (this snapshot). The patch covers 11 code files; the screenshots are left out.

Setup: set `REELS_API_URL` (e.g. `https://spacematch-backend.vercel.app/v1`) and `REELS_API_KEY` on the Convex deployment, then run `bun run sync:build`. To test: `bun run test scripts/test-reel-stats.ts`.

## What changed
- `convex/reelsApi.ts` (new): server-side client for `REELS_API_URL` / `REELS_API_KEY` (Bearer, X-Request-Id, Idempotency-Key on create and refresh, 300 s timeout for reading calls and 15 s for the rest, up to 3 attempts on network/5xx, typed errors), plus:
  - `run` background job (scheduled action) per listing. Links saved: create the property (POST /properties, key reused until it succeeds) or unarchive + PATCH address + PUT /links. All links removed: archive. Refresh now: POST /refresh. A `running` refresh is finished with up to 3 GET /refreshes/{id}. Then GET /analytics → reelStats.
  - Errors: 409/422 with `field: links[i]` are shown under that platform's link; 429 → "Refresh in m:ss" countdown (Retry-After); 401 → ops log line, friendly message.
  - `dailySync` cron (15:00 + 16:00 UTC, runs only in the one that is 10:00 Chicago): GET /analytics?updated_since (paged) → reelStats; housekeeping: sold/withdrawn listing → archive, back on market → unarchive, address change → PATCH, deleted listing → DELETE ?hard=true, live listings with Reel links not yet in the API → create.
- `convex/reelStats.ts`: worker queue and worker endpoints removed; saving links starts the job; Hub-side check refuses a video already on another listing; Refresh now respects the cooldown.
- `convex/schema.ts`: tables `reelsApi` (property id, address sent, archived, job, error, cooldown, last refresh) and `reelsApiSync` (daily cursor).
- `convex/crons.ts`: 13:00 UTC worker queue replaced by the 10:00 Chicago sync.
- `src/components/hub/ReelStats.tsx`: same agent card and seller section; adds "Reading…/Fetching…", per-link API errors, cooldown countdown, "As of {ok_at}".
- `scripts/test-reel-stats.ts`: e2e against the live API (passed: refresh 121 s, 4/4 platforms).


Verified on the preview: the 2026-11-23 daily sync ran at 16:00:44 UTC, and the seller page numbers matched `GET /properties/{id}/analytics` exactly.
No keys or secrets are in these files.
