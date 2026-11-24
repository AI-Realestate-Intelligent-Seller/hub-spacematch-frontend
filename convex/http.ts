// PHI console redaction (active only on PHI deployments).
import "./phiLogging";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { STATUS_VALUES } from "./schema";

const http = httpRouter();
// Registers Convex Auth's routes, including the OAuth endpoints used by
// "Sign in with Viktor": /api/auth/signin/viktor and /api/auth/callback/viktor.
auth.addHttpRoutes(http);

// SHA-256 of the worker key held by Viktor's CMA queue worker (plaintext is
// never stored in this repo).
const WORKER_KEY_SHA256 =
  "e8c9e7e6f2f0e86865518359463e8192a2207285ed7cbd966a24774a1a57d53c";

async function authorized(req: Request) {
  const key = req.headers.get("x-worker-key") ?? "";
  if (!key) return false;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  const hex = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === WORKER_KEY_SHA256;
}

const STATUSES: readonly string[] = STATUS_VALUES;

http.route({
  path: "/worker/status",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!(await authorized(req)))
      return new Response("Forbidden", { status: 403 });
    const body = (await req.json()) as {
      id: string;
      status: string;
      statusNote?: string;
      valueLow?: number;
      valueHigh?: number;
      listPrice?: number;
      recommendedListPrice?: number;
    };
    if (!STATUSES.includes(body.status)) {
      return new Response("Bad status", { status: 400 });
    }
    await ctx.runMutation(internal.cmaWorker.setStatus, {
      id: body.id as Id<"cmaRequests">,
      status: body.status as "submitted",
      statusNote: body.statusNote,
      valueLow: body.valueLow,
      valueHigh: body.valueHigh,
      listPrice: body.listPrice,
      recommendedListPrice: body.recommendedListPrice,
    });
    return Response.json({ ok: true });
  }),
});

http.route({
  path: "/worker/upload",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!(await authorized(req)))
      return new Response("Forbidden", { status: 403 });
    const url = new URL(req.url);
    const id = url.searchParams.get("id") as Id<"cmaRequests"> | null;
    const kind = url.searchParams.get("kind");
    if (!id || (kind !== "pdf" && kind !== "xlsx")) {
      return new Response("Need id and kind=pdf|xlsx", { status: 400 });
    }
    const blob = await req.blob();
    const storageId = await ctx.storage.store(blob);
    await ctx.runMutation(internal.cmaWorker.attachFiles, {
      id,
      ...(kind === "pdf"
        ? { pdfStorageId: storageId }
        : { workbookStorageId: storageId }),
    });
    return Response.json({ ok: true, storageId });
  }),
});


// Public, read-only vendor list for the spacematchinc.com "Trusted Local Pros" widget.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
http.route({
  path: "/public/pros",
  method: "GET",
  handler: httpAction(async ctx => {
    const pros = await ctx.runQuery(internal.vendors.publicPros, {});
    return new Response(JSON.stringify({ pros, updatedAt: Date.now() }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  }),
});
http.route({ path: "/public/pros", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })) });

// Website visitor unlocks one pro's contact info by leaving name + email/phone.
// Logs a lead in the Hub inbox (team@ + ops copy). Returns only that pro's contact.
const CORS_POST = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
http.route({
  path: "/public/pro-contact",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...CORS_POST, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    let b: Record<string, unknown>;
    try {
      const raw = await req.text();
      if (raw.length > 6000) return json({ error: "Too long" }, 413);
      b = JSON.parse(raw);
    } catch {
      return json({ error: "Bad request" }, 400);
    }
    const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : "");
    try {
      const res = await ctx.runMutation(internal.proIntro.request, {
        vendorId: str("id"), fullName: str("fullName"), email: str("email"), phone: str("phone"),
        need: str("need"), hp: str("website"), page: str("page"),
      });
      return json(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ error: msg.replace(/^.*Uncaught Error: /s, "").split("\n")[0].slice(0, 200) }, 400);
    }
  }),
});
http.route({ path: "/public/pro-contact", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_POST })) });

// spacematchinc.com/pricing-review: anonymous file uploads + seller submission (Michael 2026-10-27).
// 1) POST /public/pricing-review/upload-url → {url}; the browser POSTs each file to it → {storageId}
// 2) POST /public/pricing-review with the form + [{storageId, name}] → inbox + Lofty + Lead Desk + CMA (approval)
const prJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_POST, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const prError = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  return prJson({ error: msg.replace(/^.*Uncaught Error: /s, "").split("\n")[0].slice(0, 200) }, 400);
};
http.route({
  path: "/public/pricing-review/upload-url",
  method: "POST",
  handler: httpAction(async ctx => {
    try {
      return prJson({ url: await ctx.runMutation(internal.pricingReview.uploadUrl, {}) });
    } catch (e) {
      return prError(e);
    }
  }),
});
http.route({ path: "/public/pricing-review/upload-url", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_POST })) });
http.route({
  path: "/public/pricing-review",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let b: Record<string, unknown>;
    try {
      const raw = await req.text();
      if (raw.length > 20000) return prJson({ error: "Too long" }, 413);
      b = JSON.parse(raw);
    } catch {
      return prJson({ error: "Bad request" }, 400);
    }
    const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : "");
    const files = Array.isArray(b.files)
      ? (b.files as unknown[]).slice(0, 25).flatMap(f => {
          const o = f as Record<string, unknown>;
          return typeof o?.storageId === "string" ? [{ storageId: o.storageId, name: typeof o.name === "string" ? o.name.slice(0, 200) : "file" }] : [];
        })
      : [];
    try {
      const res = await ctx.runMutation(internal.pricingReview.submit, {
        fullName: str("fullName"), email: str("email"), phone: str("phone"),
        street: str("street"), unit: str("unit"), city: str("city"), zip: str("zip"),
        propertyType: str("propertyType"), beds: str("beds"), baths: str("baths"), sqft: str("sqft"),
        condition: str("condition"), reason: str("reason"), timeline: str("timeline"), priceInMind: str("priceInMind"),
        notes: str("notes"), files, hp: str("website"), page: str("page"),
      });
      return prJson(res);
    } catch (e) {
      return prError(e);
    }
  }),
});
http.route({ path: "/public/pricing-review", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_POST })) });

export default http;
