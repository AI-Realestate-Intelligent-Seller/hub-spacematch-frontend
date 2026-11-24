"use node";
// Lob sender (see lob.ts for the flow). Each card = 2 one-page PDFs (front, back) stamped with the
// same builder the Hub uses for the print PDF (src/lib/mailerBuilder.ts), minus the address lines:
// Lob prints its own address block + postage on the back (4 x 2.375 in, bottom right).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import * as pdfLib from "pdf-lib";
import fontkitMod from "@pdf-lib/fontkit";
import { buildMailers, type DesignId } from "../src/lib/mailerBuilder";
import { oneLine, type CopyAddress } from "./agentCopy";
import { AGENTS, agentSlug } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { LOB_FROM } from "./lobDefs";

const BATCH = 24; // cards per action run (keeps each run well under the time limit)
const PARALLEL = 4;
const hub = () => process.env.HUB_URL ?? "https://hub-spacematchinc.viktor.space";

const cache = new Map<string, Promise<Uint8Array>>();
const load = (path: string) => {
  let p = cache.get(path);
  if (!p) {
    p = fetch(/^https?:/.test(path) ? path : `${hub()}${path}`).then(async r => {
      if (!r.ok) throw new Error(`Couldn't load ${path} (${r.status})`);
      return new Uint8Array(await r.arrayBuffer());
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
};

function agentFor(c: Doc<"mailCampaigns">) {
  const a = AGENTS.find(x => x.email.toLowerCase() === c.agentEmail) ?? AGENTS.find(x => x.name === c.agentName);
  return a ?? { name: c.agentName, email: c.agentEmail, phone: "(773) 985-7153" };
}

async function cardPdfs(c: Doc<"mailCampaigns">, h: Doc<"mailHouseholds">, qrQuery?: string) {
  const agent = agentFor(c);
  const fontkit = (fontkitMod as unknown as { default?: unknown }).default ?? fontkitMod;
  const base = { design: c.design as DesignId, agent, households: [h], baseUrl: `${hub()}/v/`, qrQuery, load, lob: true, libs: { pdfLib, fontkit } };
  const [front, back] = await Promise.all([buildMailers({ ...base, sides: [0] }), buildMailers({ ...base, sides: [1] })]);
  return { front, back, agent };
}

type LobResult = { id?: string; expected?: string; url?: string; thumbs?: string[]; error?: string; fatal?: boolean };

const clip = (s: string | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// copy = the agent's own card: same design and text as home `h`, mailed to the agent, QR → sample page.
async function lobCreate(key: string, c: Doc<"mailCampaigns">, h: Doc<"mailHouseholds">, idem: string, copy?: CopyAddress): Promise<LobResult> {
  if (!copy && (!h.mailAddr || !h.mailCity || !h.mailState || !h.mailZip)) return { error: "Missing street, city, state or ZIP" };
  const { front, back, agent } = copy
    ? await cardPdfs(c, { ...h, code: "SAMPLE" }, `?d=${c.design}&a=${agentSlug(agentFor(c).name)}`)
    : await cardPdfs(c, h);
  const fd = new FormData();
  const add = (k: string, val: string) => { if (val) fd.append(k, val); };
  add("description", clip(`${c.name} · ${copy ? "agent copy" : h.code}`, 255));
  add("to[name]", clip(copy ? copy.name : h.nameLine || "Current Homeowner", 40));
  add("to[address_line1]", clip(copy ? copy.line1 : h.mailAddr, 64));
  if (copy?.line2) add("to[address_line2]", clip(copy.line2, 64));
  add("to[address_city]", clip(copy ? copy.city : h.mailCity, 200));
  add("to[address_state]", clip(copy ? copy.state : h.mailState, 2).toUpperCase());
  add("to[address_zip]", clip(copy ? copy.zip : h.mailZip, 10));
  add("from[name]", clip(`${agent.name}, SpaceMatch`, 40));
  add("from[address_line1]", LOB_FROM.line1);
  add("from[address_city]", LOB_FROM.city);
  add("from[address_state]", LOB_FROM.state);
  add("from[address_zip]", LOB_FROM.zip);
  add("size", "6x11");
  add("mail_type", "usps_standard");
  add("use_type", "marketing");
  add("metadata[code]", copy ? "AGENT-COPY" : h.code);
  add("metadata[campaign]", String(c._id));
  add("metadata[agent]", clip(agent.name, 100));
  fd.append("front", new Blob([front as BlobPart], { type: "application/pdf" }), "front.pdf");
  fd.append("back", new Blob([back as BlobPart], { type: "application/pdf" }), "back.pdf");
  const auth = `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
  for (let attempt = 0; ; attempt++) {
    let r: Response;
    try {
      r = await fetch("https://api.lob.com/v1/postcards", { method: "POST", headers: { Authorization: auth, "Idempotency-Key": idem }, body: fd });
    } catch (e) {
      if (attempt < 2) { await new Promise(res => setTimeout(res, 2000 * (attempt + 1))); continue; }
      return { error: `Couldn't reach Lob: ${String(e).slice(0, 120)}` };
    }
    const j = (await r.json().catch(() => ({}))) as {
      id?: string; expected_delivery_date?: string; url?: string; thumbnails?: { large?: string; medium?: string }[];
      error?: { message?: string; code?: string };
    };
    if (r.ok && j.id) {
      return { id: j.id, expected: j.expected_delivery_date, url: j.url, thumbs: (j.thumbnails ?? []).map(t => t.large ?? t.medium ?? "").filter(Boolean) };
    }
    if ((r.status === 429 || r.status >= 500) && attempt < 3) { await new Promise(res => setTimeout(res, 3000 * (attempt + 1))); continue; }
    const msg = j.error?.message ?? `Lob error ${r.status}`;
    const fatal = r.status === 401 || r.status === 403 || r.status === 429 || r.status >= 500 || j.error?.code === "payment_method_unverified";
    return { error: friendly(msg, j.error?.code), fatal };
  }
}

function friendly(msg: string, code?: string) {
  if (code === "payment_method_unverified" || /payment method/i.test(msg)) {
    return "Lob can't mail yet: the Lob account needs a verified card or bank account (Lob dashboard → Settings → Billing).";
  }
  return msg;
}

// Free test render of card #1 so the agent sees exactly what Lob will print.
export const proof = internalAction({
  args: { campaignId: v.id("mailCampaigns") },
  handler: async (ctx, { campaignId }) => {
    await syncRoster(ctx);
    const key = process.env.LOB_API_KEY_TEST;
    const d = await ctx.runQuery(internal.lob.forSend, { campaignId, limit: 6 });
    if (!d || !d.first) return;
    if (!key) {
      await ctx.runMutation(internal.lob.proofDone, { campaignId, error: "Lob isn't set up yet (no test key)." });
      return;
    }
    try {
      // First card Lob accepts (the first homes on a list can have an address Lob won't mail to).
      let r: LobResult = { error: "Lob didn't return a proof" };
      for (const h of d.pending.length ? d.pending : [d.first]) {
        r = await lobCreate(key, d.c, h, `proof-${campaignId}-${h.code}-${Date.now()}`);
        if (r.id || r.fatal) break;
      }
      await ctx.runMutation(internal.lob.proofDone, r.id ? { campaignId, url: r.url, thumbs: r.thumbs } : { campaignId, error: r.error ?? "Lob didn't return a proof" });
    } catch (e) {
      await ctx.runMutation(internal.lob.proofDone, { campaignId, error: `Couldn't build the proof: ${String(e).slice(0, 200)}` });
    }
  },
});

export const send = internalAction({
  args: { campaignId: v.id("mailCampaigns"), run: v.number() },
  handler: async (ctx, { campaignId, run }) => {
    await syncRoster(ctx);
    const d = await ctx.runQuery(internal.lob.forSend, { campaignId, limit: BATCH });
    if (!d || d.c.lobStatus !== "sending" || d.c.lobRun !== run) return;
    const key = d.c.lobMode === "live" ? process.env.LOB_API_KEY_LIVE : process.env.LOB_API_KEY_TEST;
    if (!key) {
      await ctx.runMutation(internal.lob.finish, { campaignId, run, error: "The Lob key isn't set in the Hub." });
      return;
    }
    if (d.pending.length === 0) {
      // Every home is done: one more card to the agent (Michael 2026-11-12), unless no home went out.
      if ((d.c.lobSent ?? 0) > 0 && !d.c.copyLobId && !d.c.copyError && d.copyTo && d.sample) {
        const to = oneLine(d.copyTo);
        try {
          const r = await lobCreate(key, d.c, d.sample, `${campaignId}-copy-${run}`, d.copyTo);
          await ctx.runMutation(internal.lob.copyDone, { campaignId, run, to, lobId: r.id, error: r.id ? undefined : r.error });
        } catch (e) {
          await ctx.runMutation(internal.lob.copyDone, { campaignId, run, to, error: `Couldn't build the copy: ${String(e).slice(0, 160)}` });
        }
      }
      await ctx.runMutation(internal.lob.finish, { campaignId, run });
      return;
    }
    const results: { id: Doc<"mailHouseholds">["_id"]; lobId?: string; error?: string; expected?: string }[] = [];
    let fatal: string | undefined;
    const queue = [...d.pending];
    await Promise.all(Array.from({ length: PARALLEL }, async () => {
      while (queue.length && !fatal) {
        const h = queue.shift()!;
        try {
          const r = await lobCreate(key, d.c, h, `${campaignId}-${h.code}-${run}`);
          if (r.fatal) { fatal = r.error; return; }
          results.push({ id: h._id, lobId: r.id, error: r.id ? undefined : r.error, expected: r.expected });
        } catch (e) {
          results.push({ id: h._id, error: `Couldn't build this card: ${String(e).slice(0, 160)}` });
        }
      }
    }));
    await ctx.runMutation(internal.lob.record, { campaignId, run, results });
    if (fatal) {
      await ctx.runMutation(internal.lob.finish, { campaignId, run, error: fatal });
      return;
    }
    await ctx.scheduler.runAfter(0, internal.lobSend.send, { campaignId, run });
  },
});


// Ops check: can the LIVE key mail yet? Three steps, cheapest first, each returns Lob's answer only:
//   list     = read-only GET (a paused account may already refuse this)
//   address  = create + delete a saved address (free)
//   postcard = create one card to our own office and cancel it at once (inside Lob's cancellation
//              window, so nothing prints or bills). Scheduled send dates need a paid edition, so
//              run it with test: true first and check that `cancelled` comes back true.
export const liveCheck = internalAction({
  args: { step: v.union(v.literal("list"), v.literal("address"), v.literal("postcard")), test: v.optional(v.boolean()) },
  handler: async (ctx, { step, test }) => {
    await syncRoster(ctx);
    const key = test ? process.env.LOB_API_KEY_TEST : process.env.LOB_API_KEY_LIVE;
    if (!key) return { ok: false, status: 0, code: "no_key", message: `${test ? "LOB_API_KEY_TEST" : "LOB_API_KEY_LIVE"} is not set` };
    const auth = `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
    type J = { id?: string; count?: number; send_date?: string; date_created?: string; deleted?: boolean; error?: { message?: string; code?: string } };
    const call = async (method: string, path: string, body?: FormData) => {
      const r = await fetch(`https://api.lob.com/v1/${path}`, { method, headers: { Authorization: auth }, body });
      return { r, j: (await r.json().catch(() => ({}))) as J };
    };
    const fail = (r: Response, j: J) => ({ ok: false, step, status: r.status, code: j.error?.code ?? "", message: (j.error?.message ?? "").slice(0, 300) });
    if (step === "list") {
      const { r, j } = await call("GET", "postcards?limit=1");
      return r.ok ? { ok: true, step, status: r.status, count: j.count } : fail(r, j);
    }
    const office: Record<string, string> = { name: "SpaceMatch Inc.", address_line1: LOB_FROM.line1, address_city: LOB_FROM.city, address_state: LOB_FROM.state, address_zip: LOB_FROM.zip };
    const fd = new FormData();
    if (step === "address") {
      for (const [k, val] of Object.entries(office)) fd.append(k, val);
      fd.append("description", "Live key check (deleted right away)");
    } else {
      const side = (t: string) => `<html><body style="width:11.25in;height:6.25in;margin:0;font:40px sans-serif"><p style="padding:1in">${t}</p></body></html>`;
      for (const [k, val] of Object.entries(office)) { fd.append(`to[${k}]`, val); fd.append(`from[${k}]`, val); }
      for (const [k, val] of Object.entries({ description: "Live key check (cancelled right away)", size: "6x11", mail_type: "usps_standard", use_type: "marketing", front: side("Live key check"), back: side("Live key check") })) fd.append(k, val);
    }
    const path = step === "address" ? "addresses" : "postcards";
    const { r, j } = await call("POST", path, fd);
    if (!r.ok || !j.id) return fail(r, j);
    const d = await call("DELETE", `${path}/${j.id}`);
    return { ok: true, step, status: r.status, id: j.id, created: j.date_created, sendDate: j.send_date, cancelled: d.r.ok && d.j.deleted === true, cancelStatus: d.r.status, cancelMessage: (d.j.error?.message ?? "").slice(0, 200) };
  },
});
