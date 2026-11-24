// New Leads tracker side: Lofty sync (every 5 min), quick texts from the office line,
// Lofty notes, reply alerts, and Peak Presence email leads → Lofty (so Anna texts them).
// Env: DESK_TEXTS=on (office-line texts), PEAK_TO_LOFTY=on (auto-create Peak leads in Lofty).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { authenticatedAction } from "./functions";
import { lofty } from "./lofty";
import { annaTexting, kindOf, isOptOut } from "./leadTrackDefs";
import { esc, hubUrl, sendMail, shell } from "./notify";

declare const process: { env: Record<string, string | undefined> };

const QUO_LINE = "PNw9iO94aa"; // (773) 985-7153
const ALERT_EMAILS = ["michael@spacematchinc.com", "smm@spacematchinc.com", "tc@spacematchinc.com"];
const DAYS = 14;
const SKIP_SOURCES = new Set([19212014]); // CSV Import
const INTERNAL = /@(spacematchinc\.com|cbrealty\.com|example\.com)$/i;
// Peak Presence email leads created in Lofty automatically only after this (older ones were imported by hand).
const PEAK_PUSH_SINCE = Date.parse("2026-11-09T01:00:00Z");

const t = (s?: string) => (s ? Date.parse(s.replace("GMT", "Z")) : 0);

async function callTool(role: string, args: Record<string, unknown>) {
  const res = await fetch(`${process.env.VIKTOR_SPACES_API_URL}/api/viktor-spaces/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_name: process.env.VIKTOR_SPACES_PROJECT_NAME,
      project_secret: process.env.VIKTOR_SPACES_PROJECT_SECRET,
      space_id: process.env.VIKTOR_AUTH_RESOURCE_ID,
      role,
      arguments: args,
    }),
  });
  if (!res.ok) throw new Error(`${role} HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? `${role} failed`);
  const r = json.result as { content?: string; error?: string; draft_id?: string };
  if (r?.draft_id) throw new Error("Texting needs approval in Slack first");
  if (r?.error) throw new Error(r.error);
  return r;
}

type FeedRow = { id: number | string; leadId: number | string; agentId?: number | string; direction?: string; status?: string; communicationTime?: string; communicationType?: string; eventType?: string; callOutcome?: string | null };

async function feed(type: "TEXT" | "CALL", start: number, end: number): Promise<FeedRow[]> {
  const out: FeedRow[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 6; i++) {
    const qs = new URLSearchParams({ type, teamView: "true", startTime: String(start), endTime: String(end), limit: "1000", ...(cursor ? { cursor } : {}) });
    const b = await lofty("get", `/v2.0/communication/agent?${qs}`);
    out.push(...((b?.data ?? []) as FeedRow[]));
    cursor = b?.nextCursor ?? undefined;
    if (!cursor) break;
  }
  return out;
}

type Comm = { at: number; kind: string; status?: string; text?: string; by?: string };

async function syncCore(ctx: { runQuery: any; runMutation: any }) {
  const now = Date.now();
  const since = now - DAYS * 864e5;
  // 1) newest Lofty leads (API returns newest first)
  const raw: any[] = [];
  for (let off = 0; off < 400; off += 100) {
    const b = await lofty("get", `/v1.0/leads?limit=100&offset=${off}`);
    const page = (b?.leads ?? []) as any[];
    raw.push(...page);
    if (page.length < 100 || t(page[page.length - 1]?.createTime) < since) break;
  }
  const leads = raw.filter(l => {
    if (t(l.createTime) < since || SKIP_SOURCES.has(Number(l.leadSource))) return false;
    if ((l.emails ?? []).some((e: string) => INTERNAL.test(e))) return false;
    return !/space ?match/i.test(`${l.firstName ?? ""} ${l.lastName ?? ""}`);
  });
  // 2) team comms feed (texts + calls) for the same window
  const [texts, calls, membersBody] = await Promise.all([feed("TEXT", since, now), feed("CALL", since, now), lofty("get", "/v1.0/members?limit=100")]);
  const who = new Map<string, string>();
  for (const m of (membersBody?.members ?? []) as any[]) {
    const n = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || m.name || m.email;
    for (const k of [m.id, m.memberUserId, m.userId]) if (k) who.set(String(k), n);
  }
  const byLead = new Map<string, FeedRow[]>();
  for (const r of [...texts, ...calls]) {
    const k = String(r.leadId);
    byLead.set(k, [...(byLead.get(k) ?? []), r]);
  }
  const prev = new Map<string, { textCount: number }>(((await ctx.runQuery(internal.leadTrack.forSync, {})) as { loftyLeadId: string; textCount: number }[]).map(p => [p.loftyLeadId, p]));
  const out: any[] = [];
  let fetched = 0;
  for (const l of leads) {
    const id = String(l.leadId);
    const ev = byLead.get(id) ?? [];
    const sig = ev.length;
    const base = {
      loftyLeadId: id,
      name: `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim().slice(0, 120) || "Unknown",
      phone: (l.phones ?? [])[0] || undefined,
      email: (l.emails ?? [])[0] || undefined,
      source: String(l.source ?? "Unknown").trim().slice(0, 80),
      kind: kindOf(String(l.source ?? "")),
      leadTypes: ((l.leadTypes ?? []) as number[]).map(Number),
      stage: String(l.stage ?? ""),
      agentName: l.assignedUser || undefined,
      street: [l.streetAddress, l.city].filter(Boolean).join(", ") || undefined,
      tags: ((l.tags ?? []) as any[]).map(x => (typeof x === "string" ? x : x?.tagName)).filter(Boolean).slice(0, 20),
      cannotText: !!l.cannotText,
      createdAt: t(l.createTime),
    };
    const p = prev.get(id);
    if (p && p.textCount === sig) {
      out.push(base);
      continue;
    }
    // Something changed (or first time): rebuild the Lofty-side timeline, with text contents.
    // Text bodies: matched by time + direction (64-bit ids lose precision in JS).
    let contents = new Map<string, { text?: string; outcome?: string }>();
    let complete = true;
    if (ev.some(e => e.eventType === "Text")) {
      if (fetched >= 40) complete = false; // finish on the next run
      else {
        fetched++;
        try {
          const b = await lofty("get", `/v1.0/communication/text?leadId=${id}&limit=50`);
          contents = new Map(((b?.texts ?? []) as any[]).map(x => [`${x.textTime}|${/inbound/i.test(x.direction ?? "") ? "in" : "out"}`, { text: x.textContent, outcome: x.textOutcome }]));
        } catch (e) {
          complete = false;
          console.error("leadTrack texts", id, String(e));
        }
      }
    }
    const comms: Comm[] = ev.map(e => {
      const inbound = /inbound/i.test(e.direction ?? "");
      const isText = e.eventType === "Text";
      const c = contents.get(`${e.communicationTime}|${inbound ? "in" : "out"}`);
      const kind = isText ? (inbound ? "text_in" : e.communicationType === "Auto" ? "auto_text" : "text_out") : inbound ? "call_in" : "call_out";
      return {
        at: t(e.communicationTime),
        kind,
        status: (isText ? (c?.outcome ?? e.status) : (e.callOutcome ?? e.status)) || undefined,
        text: c?.text?.slice(0, 600) || undefined,
        by: kind === "auto_text" ? "Anna (Lofty AI)" : inbound ? undefined : who.get(String(e.agentId)),
      };
    });
    out.push({ ...base, comms, textCount: complete ? sig : -1 });
  }
  for (let i = 0; i < out.length; i += 50) {
    await ctx.runMutation(internal.leadTrack.upsert, { leads: out.slice(i, i + 50), meta: { ok: true, leads: out.length } });
  }
  if (!out.length) await ctx.runMutation(internal.leadTrack.upsert, { leads: [], meta: { ok: true, leads: 0 } });
  return { leads: out.length, fetched };
}

export const sync = internalAction({
  args: {},
  handler: async ctx => {
    try {
      return await syncCore(ctx);
    } catch (e) {
      const error = String((e as Error).message ?? e).slice(0, 300);
      console.error("leadTrack sync", error);
      await ctx.runMutation(internal.leadTrack.upsert, { leads: [], meta: { ok: false, error, leads: 0 } });
      return { leads: 0, fetched: 0, error };
    }
  },
});

/** "Refresh" button: sync now unless one ran in the last minute. */
export const syncNow = authenticatedAction({
  args: {},
  handler: async (ctx): Promise<{ ran: boolean; error?: string }> => {
    const me = await ctx.runQuery(internal.leadTrack.viewerInternal, { userId: ctx.userId });
    if (!me.allowed) throw new Error("New Leads is for Michael, Cristina, Anthony and the developers only");
    const last: number = await ctx.runQuery(internal.leadTrack.lastSyncInternal, {});
    if (Date.now() - last < 60000) return { ran: false };
    try {
      await syncCore(ctx);
      return { ran: true };
    } catch (e) {
      return { ran: true, error: String((e as Error).message ?? e).slice(0, 200) };
    }
  },
});

function e164(p?: string) {
  const d = (p ?? "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return "";
}

/** Quick text from the office line (773) 985-7153, logged in Lofty as a note. */
export const sendText = authenticatedAction({
  args: { id: v.id("trackedLeads"), text: v.string() },
  handler: async (ctx, { id, text }): Promise<{ ok: true }> => {
    const me = await ctx.runQuery(internal.leadTrack.viewerInternal, { userId: ctx.userId });
    if (!me.allowed) throw new Error("New Leads is for Michael, Cristina, Anthony and the developers only");
    const l = await ctx.runQuery(internal.leadTrack.getInternal, { id });
    if (!l) throw new Error("Lead not found");
    const body = text.trim().slice(0, 600);
    if (body.length < 10) throw new Error("Write the text first");
    if (l.cannotText) throw new Error("Lofty has texting turned off for this lead. Call instead.");
    if (annaTexting(l.comms)) throw new Error("Anna (Lofty AI) is already texting this lead. Don't text from the office line. Call instead.");
    if (l.comms.some(c => c.kind === "text_in" && isOptOut(c.text))) throw new Error("They texted STOP. Don't text them again.");
    const to = e164(l.phone);
    if (!to) throw new Error("No valid US mobile number on this lead");
    if (l.comms.some(c => c.kind === "hub_text" && c.at > Date.now() - 10 * 60000)) throw new Error("Someone texted this lead from the Hub in the last 10 minutes");
    if (process.env.DESK_TEXTS !== "on") throw new Error("Texts are turned off on this copy of the Hub (test environment)");
    await callTool("mcp_pd_openphone_send_message", { from: QUO_LINE, to, content: body });
    await ctx.runMutation(internal.leadTrack.addHubComm, { id, comm: { at: Date.now(), kind: "hub_text", text: body, by: me.name }, note: "Sent a text from the office line" });
    try {
      await lofty("post", "/v1.0/notes", { leadId: Number(l.loftyLeadId), content: `Text sent from the office line (773) 985-7153 via the Hub by ${me.name}: "${body}"` });
    } catch (e) {
      console.error("leadTrack note", String(e));
    }
    return { ok: true };
  },
});

export const loftyNote = internalAction({
  args: { loftyLeadId: v.string(), content: v.string() },
  handler: async (_ctx, { loftyLeadId, content }) => {
    if (!/^\d+$/.test(loftyLeadId)) return;
    try {
      await lofty("post", "/v1.0/notes", { leadId: Number(loftyLeadId), content: content.slice(0, 3000) });
    } catch (e) {
      console.error("leadTrack loftyNote", String(e));
    }
  },
});

export const replyAlert = internalAction({
  args: { id: v.id("trackedLeads"), name: v.string(), text: v.string(), source: v.string() },
  handler: async (ctx, { id, name, text, source }) => {
    const url = `/new-leads?open=${id}`;
    const html = shell(
      `${name} replied`,
      `<p style="margin:0 0 14px;font-size:15px">"${esc(text.slice(0, 300))}"</p><p style="margin:0 0 14px">Source: ${esc(source)}. Anna (Lofty's AI) may answer, but a person should call now.</p>`,
      { href: `${hubUrl()}${url}`, label: "Open in New Leads" },
    );
    for (const e of ALERT_EMAILS) {
      try {
        await sendMail(e, `💬 ${name} replied: "${text.slice(0, 60)}"`, html);
      } catch (err) {
        console.error("leadTrack alert mail", String(err));
      }
      try {
        await ctx.runAction(internal.push.toEmail, { email: e, title: `${name} replied`, body: `"${text.slice(0, 120)}" · call now`, url });
      } catch (err) {
        console.error("leadTrack alert push", String(err));
      }
    }
  },
});

/** Peak Presence email leads aren't in Lofty: create them so Anna texts within minutes. */
export const peakToLofty = internalAction({
  args: {},
  handler: async ctx => {
    if (process.env.PEAK_TO_LOFTY !== "on") return { created: 0 };
    const rows = (await ctx.runQuery(internal.desk.recentInternalFull, {})) as any[];
    let created = 0;
    for (const r of rows) {
      if (r.createdBy !== "auto" || !/peak presence/i.test(r.source) || r.loftyLeadId || r.loftyError || r.createdAt < PEAK_PUSH_SINCE) continue;
      try {
        const digits = (r.phone ?? "").replace(/\D/g, "").slice(-10);
        let leadId: number | undefined;
        // find an existing Lofty lead by name, then match the phone
        const first = String(r.name).split(/\s+/)[0];
        if (first && digits) {
          const b = await lofty("get", `/v1.0/leads?key=${encodeURIComponent(first)}&limit=50`);
          const hit = ((b?.leads ?? []) as any[]).find(x => (x.phones ?? []).some((p: string) => p.replace(/\D/g, "").slice(-10) === digits));
          if (hit) leadId = hit.leadId;
        }
        if (!leadId) {
          const [fn, ...rest] = String(r.name).split(/\s+/);
          const res = await lofty("post", "/v1.0/leads", {
            firstName: fn.slice(0, 30),
            lastName: rest.join(" ").slice(0, 30) || undefined,
            emails: r.email ? [r.email] : [],
            phones: r.phone ? [String(r.phone).slice(0, 20)] : [],
            leadTypes: [1],
            source: "Peak Presence YouTube Ads",
            streetAddress: r.details?.address?.slice(0, 120) || undefined,
            tagsAdd: ["YouTube Seller", "Peak Presence"],
          });
          leadId = res?.leadId;
          if (!leadId) throw new Error(`no leadId (${JSON.stringify(res).slice(0, 120)})`);
          await lofty("post", "/v1.0/notes", { leadId, content: `Peak Presence YouTube seller lead (auto from team@ email by the Hub).${r.details?.address ? `\nProperty: ${r.details.address}` : ""}${r.notes ? `\n${r.notes}` : ""}` });
          created++;
        }
        await ctx.runMutation(internal.desk.patchInternal, { id: r._id, set: { loftyLeadId: String(leadId), loftyError: undefined }, note: "Added to Lofty automatically (Anna texts them)" });
      } catch (e) {
        await ctx.runMutation(internal.desk.patchInternal, { id: r._id, set: { loftyError: String((e as Error).message ?? e).slice(0, 300) } });
      }
    }
    return { created };
  },
});


/**
 * "What's it worth / more info" reply (or a staff "Order CMA" tap): read the address from
 * Lofty, queue a CMA for the worker cron, and alert Michael, Cristina and Anthony.
 * The CMA goes to the team only, never to the lead (Michael 2026-11-09).
 */
export const autoCma = internalAction({
  args: { id: v.id("trackedLeads"), reply: v.string(), by: v.string() },
  handler: async (ctx, { id, reply, by }) => {
    const r = await ctx.runQuery(internal.leadTrack.getInternal, { id });
    if (!r) return;
    let addr = { street: "", city: "", state: "IL", zip: "" };
    if (/^\d+$/.test(r.loftyLeadId)) {
      try {
        const b = await lofty("get", `/v1.0/leads/${r.loftyLeadId}`);
        const l = b?.lead ?? b ?? {};
        const p = ((l.leadPropertyList ?? []) as any[]).find(x => x?.streetAddress) ?? {};
        addr = {
          street: String(l.streetAddress || p.streetAddress || "").trim(),
          city: String(l.city || p.city || "").trim(),
          state: String(l.state || p.state || "IL").trim(),
          zip: String(l.zipCode || p.zipCode || "").trim(),
        };
      } catch (e) {
        console.error("autoCma lofty", String(e));
      }
    }
    if (!addr.street && r.street) {
      const [street, city] = r.street.split(",").map(s => s.trim());
      addr = { ...addr, street: street ?? "", city: addr.city || city || "" };
    }
    const res = await ctx.runMutation(internal.leadTrack.createAutoCma, { id, reply, by, ...addr });
    if (!res.ok && res.reason === "exists") return;
    if (by !== "auto") return; // staff tapped the button: the page shows the status
    if (!/^\d+$/.test(r.loftyLeadId)) return; // e2e fake lead: no emails
    const where = [addr.street, addr.city].filter(Boolean).join(", ");
    const headline = res.ok
      ? `CMA building for ${where}. It lands in New Leads (and #comps-cma-residential) in about an hour.`
      : res.reason === "no_address"
        ? "Lofty has no address for them, so no CMA yet: get the address on the call, then tap Order CMA in New Leads."
        : `Today's auto-CMA limit is reached, so no CMA yet: tap Order CMA in New Leads tomorrow or file one on /new.`;
    const url = `/new-leads?open=${id}`;
    const html = shell(
      `${r.name} wants to know what it's worth`,
      `<p style="margin:0 0 14px;font-size:15px">"${esc(reply.slice(0, 300))}"</p><p style="margin:0 0 14px">${esc(headline)}</p><p style="margin:0 0 14px">Call them now to book a 15-minute call or a listing appointment. Don't send the CMA to the lead: walk them through it on the call.</p>`,
      { href: `${hubUrl()}${url}`, label: "Open in New Leads" },
    );
    for (const e of ALERT_EMAILS) {
      try {
        await sendMail(e, `🏠 ${r.name} asked for a value: "${reply.slice(0, 50)}"`, html);
      } catch (err) {
        console.error("autoCma mail", String(err));
      }
      try {
        await ctx.runAction(internal.push.toEmail, { email: e, title: `${r.name} wants a value`, body: res.ok ? `CMA building for ${where} · call now` : `"${reply.slice(0, 100)}" · call now`, url });
      } catch (err) {
        console.error("autoCma push", String(err));
      }
    }
  },
});

/** The worker finished a CMA that New Leads started → email + push the team. */
export const cmaReadyAlert = internalAction({
  args: { cmaId: v.id("cmaRequests") },
  handler: async (ctx, { cmaId }) => {
    const lead = await ctx.runQuery(internal.leadTrack.byCmaInternal, { cmaId });
    if (!lead || !/^\d+$/.test(lead.loftyLeadId)) return; // e2e fake lead: no emails
    const c = await ctx.runQuery(internal.cmaWorker.getRequest, { id: cmaId });
    if (!c) return;
    const $ = (n?: number) => (n ? `$${Math.round(n).toLocaleString("en-US")}` : "");
    const range = c.valueLow && c.valueHigh ? `${$(c.valueLow)}–${$(c.valueHigh)}` : "";
    const list = c.agentListPrice ?? c.listPrice;
    const where = [c.street, c.city].filter(Boolean).join(", ");
    const url = `/new-leads?open=${lead._id}`;
    const html = shell(
      `CMA ready: ${lead.name}`,
      `<p style="margin:0 0 14px;font-size:15px">${esc(where)}${range ? `<br>Value ${esc(range)}` : ""}${list ? ` · suggested list ${esc($(list))}` : ""}</p><p style="margin:0 0 14px">${esc(c.statusNote ?? "")}</p><p style="margin:0 0 14px">Call ${esc(lead.name)} to walk them through it and book the listing appointment. Don't send the PDF to the lead without Michael's OK.</p>`,
      { href: `${hubUrl()}${url}`, label: "Open the CMA in New Leads" },
    );
    for (const e of ALERT_EMAILS) {
      try {
        await sendMail(e, `📊 CMA ready: ${lead.name}, ${where}${range ? ` (${range})` : ""}`, html);
      } catch (err) {
        console.error("cmaReady mail", String(err));
      }
      try {
        await ctx.runAction(internal.push.toEmail, { email: e, title: `CMA ready: ${lead.name}`, body: `${where}${range ? ` · ${range}` : ""} · call them`, url });
      } catch (err) {
        console.error("cmaReady push", String(err));
      }
    }
  },
});
