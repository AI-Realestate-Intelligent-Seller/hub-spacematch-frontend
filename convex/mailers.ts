// Seller mailers (Michael, #mailers 2026-10-26): agents upload an ATN Title farm list,
// pick one of 4 designs, and download an agent-branded 6x11 print PDF. Every household gets
// its own QR code → /v/:code (public landing page) logs the scan, and a reply becomes a
// Hub inbox lead for the agent + a Lofty Seller lead tagged "Mailer".
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { AGENTS, TEAM_COPY_EMAIL, agentByEmail, agentSlug, isAdminEmail } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { esc, hubUrl, sendMail, shell, table } from "./notify";

export const MAILER_FORM_ID = "mailer-reply";
export const DESIGN_IDS = ["staging", "value", "launch", "team", "buyers", "netsheet", "market", "spring",
  "fixorsell", "movetiming", "rightsize", "landlord", "inherited", "soldashland", "soldoverlook"] as const;
export const DESIGN_TITLES: Record<string, string> = {
  staging: "Same home, sells like a different one",
  value: "Your home has a number",
  launch: "Most homes get listed. Ours get launched.",
  team: "Your agent, backed by a whole team",
  buyers: "Is there already a buyer for your home?",
  netsheet: "Know what you'll walk away with (net sheet)",
  market: "What did the homes near you sell for?",
  spring: "Spring head start game plan",
  fixorsell: "Fix it up. Or sell it as it is?",
  movetiming: "Sell first? Buy first? Let's map it.",
  rightsize: "Less house. More room for what's next.",
  landlord: "Still want to be the landlord?",
  inherited: "Inherited a home? Start with one clear plan.",
  soldashland: "Team sale: 2743 N Ashland Avenue · $1,015,000",
  soldoverlook: "Team sale: 15840 Overlook Lane · $453,000",
};
const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I
const MAX_HOUSEHOLDS = 5000;
const PRINT_TO = ["michael@spacematchinc.com", TEAM_COPY_EMAIL];

const status = v.union(v.literal("draft"), v.literal("print_requested"), v.literal("mailed"));
const s = (x: string | undefined, max = 200) => (x ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
export const clip = (x: string | undefined, max = 200) => s(x, max);

export function newCode() {
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export async function codeTaken(ctx: QueryCtx, code: string) {
  return !!(await ctx.db.query("mailHouseholds").withIndex("by_code", q => q.eq("code", code)).first())
    || !!(await ctx.db.query("mailCampaigns").withIndex("by_wpCode", q => q.eq("wpCode", code)).first());
}

async function me(ctx: QueryCtx, userId: Id<"users">) {
  const w = await hubViewer(ctx, userId);
  return { ...w, canAll: w.isStaff };
}

export async function ownCampaign(ctx: QueryCtx, userId: Id<"users">, id: Id<"mailCampaigns">) {
  const w = await me(ctx, userId);
  const c = await ctx.db.get(id);
  if (!c) throw new Error("This mailing no longer exists");
  if (!w.canAll && c.agentEmail !== w.email && c.createdByEmail !== w.email) throw new Error("Not your mailing");
  return { c, w };
}

// ── Agent side ──────────────────────────────────────────────────────────────

export const create = authenticatedMutation({
  args: { name: v.string(), design: v.string(), agentName: v.string() },
  handler: async (ctx, a) => {
    const w = await me(ctx, ctx.userId);
    if (!DESIGN_IDS.includes(a.design as never)) throw new Error("Pick a design");
    const agent = AGENTS.find(x => x.name === a.agentName);
    if (!agent) throw new Error("Pick the agent");
    if (!w.canAll && w.agentName && w.agentName !== agent.name) throw new Error("You can only create mailings for yourself");
    const id = await ctx.db.insert("mailCampaigns", {
      name: s(a.name, 80) || `${DESIGN_TITLES[a.design]} · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      design: a.design,
      agentEmail: agent.email.toLowerCase(),
      agentName: agent.name,
      createdByEmail: w.email,
      households: 0,
      status: "draft",
      scans: 0,
      scannedHouseholds: 0,
      leads: 0,
      createdAt: Date.now(),
    });
    return { id, baseUrl: `${hubUrl()}/v/` };
  },
});

const householdIn = v.object({
  nameLine: v.string(),
  who: v.string(),
  mailAddr: v.string(),
  mailCity: v.string(),
  mailState: v.string(),
  mailZip: v.string(),
  propAddr: v.string(),
  propShort: v.string(),
});

// Called in chunks of ≤400 by the browser; returns the codes in row order.
export const addHouseholds = authenticatedMutation({
  args: { campaignId: v.id("mailCampaigns"), rows: v.array(householdIn) },
  handler: async (ctx, { campaignId, rows }) => {
    const { c } = await ownCampaign(ctx, ctx.userId, campaignId);
    if (c.status !== "draft") throw new Error("This mailing was already sent to print");
    if (rows.length > 400) throw new Error("Too many rows in one batch");
    if (c.households + rows.length > MAX_HOUSEHOLDS) throw new Error(`One mailing can have at most ${MAX_HOUSEHOLDS} homes`);
    const codes: string[] = [];
    for (const r of rows) {
      let code = newCode();
      while (await codeTaken(ctx, code)) code = newCode();
      await ctx.db.insert("mailHouseholds", {
        campaignId,
        code,
        nameLine: s(r.nameLine, 80),
        who: s(r.who, 60),
        mailAddr: s(r.mailAddr, 120),
        mailCity: s(r.mailCity, 60),
        mailState: s(r.mailState, 4),
        mailZip: s(r.mailZip, 10),
        propAddr: s(r.propAddr, 160),
        propShort: s(r.propShort, 80),
        scans: 0,
      });
      codes.push(code);
    }
    await ctx.db.patch(campaignId, { households: c.households + rows.length });
    return { codes, baseUrl: `${hubUrl()}/v/` };
  },
});

export const list = authenticatedQuery({
  args: { scope: v.optional(v.union(v.literal("mine"), v.literal("all"))) },
  handler: async (ctx, { scope }) => {
    const w = await me(ctx, ctx.userId);
    const all = scope === "all" && w.canAll;
    const rows = all
      ? await ctx.db.query("mailCampaigns").order("desc").take(300)
      : (await ctx.db.query("mailCampaigns").order("desc").take(1000))
          .filter(c => c.agentEmail === w.email || c.createdByEmail === w.email);
    return { canAll: w.canAll, isAdmin: w.isAdmin, campaigns: rows.filter(c => c.households > 0 || !!c.wpCode || Date.now() - c.createdAt < 3600e3) };
  },
});

export const detail = authenticatedQuery({
  args: { campaignId: v.id("mailCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const { c, w } = await ownCampaign(ctx, ctx.userId, campaignId);
    const households = await ctx.db.query("mailHouseholds").withIndex("by_campaign", q => q.eq("campaignId", campaignId)).collect();
    return { campaign: c, households, baseUrl: `${hubUrl()}/v/`, isAdmin: w.isAdmin };
  },
});

// Wise Pelican 6x9 front: one QR code for the whole mailing (Wise Pelican can't print one per home).
export const wisePelicanCode = authenticatedMutation({
  args: { campaignId: v.id("mailCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const { c } = await ownCampaign(ctx, ctx.userId, campaignId);
    let code = c.wpCode;
    if (!code) {
      code = newCode();
      while (await codeTaken(ctx, code)) code = newCode();
      await ctx.db.patch(campaignId, { wpCode: code, wpScans: c.wpScans ?? 0 });
    }
    return { code, baseUrl: `${hubUrl()}/v/` };
  },
});

export const requestPrint = authenticatedMutation({
  args: { campaignId: v.id("mailCampaigns"), note: v.optional(v.string()) },
  handler: async (ctx, { campaignId, note }) => {
    const { c, w } = await ownCampaign(ctx, ctx.userId, campaignId);
    if (!c.households) throw new Error("Add the mailing list first");
    if (c.status !== "draft") return;
    await ctx.db.patch(campaignId, { status: "print_requested", printRequestedAt: Date.now(), note: s(note, 1000) || undefined });
    await ctx.scheduler.runAfter(0, internal.mailers.printRequestedMail, { campaignId, by: w.name || w.email });
  },
});

export const setStatus = authenticatedMutation({
  args: {
    campaignId: v.id("mailCampaigns"),
    status,
    mailedOn: v.optional(v.string()), // YYYY-MM-DD
    cost: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    await ownCampaign(ctx, ctx.userId, a.campaignId);
    const patch: Partial<Doc<"mailCampaigns">> = { status: a.status };
    if (a.status === "mailed") patch.mailedOn = a.mailedOn || new Date().toISOString().slice(0, 10);
    if (a.cost !== undefined) patch.cost = Math.max(0, Math.round(a.cost * 100) / 100);
    await ctx.db.patch(a.campaignId, patch);
  },
});

export const remove = authenticatedMutation({
  args: { campaignId: v.id("mailCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const { c, w } = await ownCampaign(ctx, ctx.userId, campaignId);
    if (c.status !== "draft" && !w.isAdmin) throw new Error("Only drafts can be deleted");
    if (c.scans > 0 && !w.isAdmin) throw new Error("This mailing already has scans, so it can't be deleted");
    const hs = await ctx.db.query("mailHouseholds").withIndex("by_campaign", q => q.eq("campaignId", campaignId)).collect();
    for (const h of hs) await ctx.db.delete(h._id);
    await ctx.db.delete(campaignId);
  },
});

export const printRequestedMail = internalAction({
  args: { campaignId: v.id("mailCampaigns"), by: v.string() },
  handler: async (ctx, { campaignId, by }) => {
    await syncRoster(ctx);
    const c = await ctx.runQuery(internal.mailers.campaignForMail, { campaignId });
    if (!c) return;
    const html = shell(
      `Print request: ${c.name}`,
      `<p style="margin:0 0 14px;color:#3A3833">${esc(by)} sent a mailer to print. Open it in the Hub to download the print PDF and the mailing list.</p>${table([
        ["Agent", c.agentName],
        ["Design", DESIGN_TITLES[c.design] ?? c.design],
        ["Homes", String(c.households)],
        ["Format", "6 x 11 jumbo postcard, 0.125 in bleed (PDF page 11.25 x 6.25 in), 2 pages per home"],
        ["Note", c.note ?? ""],
      ])}`,
      { href: `${hubUrl()}/mailers?open=${campaignId}`, label: "Open the mailing" },
    );
    for (const to of PRINT_TO) {
      try {
        await sendMail(to, `🖨️ Mailer print request · ${c.agentName} · ${c.households} homes`, html);
      } catch (e) {
        console.error("printRequestedMail", to, String(e));
      }
    }
  },
});

export const campaignForMail = internalQuery({
  args: { campaignId: v.id("mailCampaigns") },
  handler: async (ctx, { campaignId }) => await ctx.db.get(campaignId),
});

// ── Public landing page (/v/:code) ──────────────────────────────────────────

function agentCard(c: Doc<"mailCampaigns">) {
  const a = agentByEmail(c.agentEmail) ?? AGENTS.find(x => x.name === c.agentName);
  return { name: a?.name ?? c.agentName, phone: a?.phone ?? "(773) 985-7153", email: a?.email ?? TEAM_COPY_EMAIL, slug: agentSlug(a?.name ?? c.agentName) };
}

async function byCode(ctx: QueryCtx, raw: string): Promise<{ h: Doc<"mailHouseholds"> | null; c: Doc<"mailCampaigns"> } | null> {
  const code = raw.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 8);
  if (code.length !== 6) return null;
  const h = await ctx.db.query("mailHouseholds").withIndex("by_code", q => q.eq("code", code)).first();
  if (!h) {
    const wc = await ctx.db.query("mailCampaigns").withIndex("by_wpCode", q => q.eq("wpCode", code)).first();
    return wc ? { h: null, c: wc } : null;
  }
  const c = await ctx.db.get(h.campaignId);
  return c ? { h, c } : null;
}

// "1641 N. Alexis Ct, Glenview" → "1641 alexis": house number + first street word, directions dropped.
function streetKey(addr: string) {
  const t = addr.toLowerCase().split(",")[0].replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean)
    .filter(w => !["n", "s", "e", "w", "north", "south", "east", "west"].includes(w));
  return t.length >= 2 && /^\d/.test(t[0]) ? `${t[0]} ${t[1]}` : "";
}

// Logs the scan and returns what the landing page shows (no owner names: the page is public).
export const scan = mutation({
  args: { code: v.string(), repeat: v.optional(v.boolean()) },
  handler: async (ctx, { code, repeat }) => {
    await syncRoster(ctx);
    const r = await byCode(ctx, code);
    if (!r) return null;
    const { h, c } = r;
    const now = Date.now();
    if (!h) {
      if (!repeat) await ctx.db.patch(c._id, { scans: c.scans + 1, wpScans: (c.wpScans ?? 0) + 1 });
      return { code: c.wpCode ?? "", propAddr: "", propShort: "", replied: false, design: c.design, agent: agentCard(c), askAddress: true };
    }
    if (!repeat) {
      await ctx.db.patch(h._id, { scans: h.scans + 1, firstScanAt: h.firstScanAt ?? now, lastScanAt: now });
      await ctx.db.patch(c._id, { scans: c.scans + 1, scannedHouseholds: c.scannedHouseholds + (h.scans === 0 ? 1 : 0) });
    }
    return { code: h.code, propAddr: h.propAddr, propShort: h.propShort, replied: !!h.leadAt, design: c.design, agent: agentCard(c) };
  },
});

export const reply = mutation({
  args: {
    code: v.string(),
    fullName: v.string(),
    email: v.string(),
    phone: v.string(),
    timeline: v.string(),
    want: v.string(),
    notes: v.optional(v.string()),
    propAddr: v.optional(v.string()), // Wise Pelican mailing code: the homeowner types the address
    website: v.optional(v.string()), // honeypot
  },
  handler: async (ctx, a) => {
    await syncRoster(ctx);
    if (a.website) return { ok: true };
    const r = await byCode(ctx, a.code);
    if (!r) throw new Error("This code wasn't found. Please call or text us instead.");
    const { c } = r;
    let h = r.h;
    const viaWp = !h;
    const typedAddr = s(a.propAddr, 160);
    if (viaWp && typedAddr.length < 5) throw new Error("Please add the address of your home");
    if (viaWp) {
      const key = streetKey(typedAddr);
      if (key) {
        const hs = await ctx.db.query("mailHouseholds").withIndex("by_campaign", q => q.eq("campaignId", c._id)).collect();
        h = hs.find(x => streetKey(x.propAddr) === key) ?? hs.find(x => streetKey(x.mailAddr) === key) ?? null;
      }
    }
    const fullName = s(a.fullName, 80);
    const email = s(a.email, 120).toLowerCase();
    const phone = s(a.phone, 30);
    if (fullName.length < 2) throw new Error("Please add your name");
    if (!email && !phone) throw new Error("Please add an email or a phone number so we can reach you");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("That email doesn't look right");
    if (phone && phone.replace(/\D/g, "").length < 10) throw new Error("That phone number doesn't look right");
    const agent = agentCard(c);
    const answers: Record<string, string> = { Name: fullName };
    if (phone) answers.Phone = phone;
    if (email) answers.Email = email;
    answers.Property = viaWp ? typedAddr : (h?.propAddr ?? "");
    answers["Thinking of selling"] = s(a.timeline, 60);
    answers["Would like"] = s(a.want, 80);
    if (s(a.notes)) answers.Notes = s(a.notes, 1000);
    if (h) answers["Mailed to"] = [h.nameLine, h.mailAddr, `${h.mailCity} ${h.mailState} ${h.mailZip}`.trim()].filter(Boolean).join(", ");
    if (viaWp && h) answers["Matched home on the list"] = h.propAddr;
    answers.Mailer = `${c.name} (${DESIGN_TITLES[c.design] ?? c.design})${viaWp ? " · Wise Pelican 6x9" : ""}`;
    answers["Mailer code"] = viaWp ? (c.wpCode ?? "") : (h?.code ?? "");
    const id = await ctx.db.insert("formSubmissions", {
      formId: MAILER_FORM_ID,
      formTitle: "Mailer reply",
      group: "Seller",
      audience: "client",
      agentEmail: agent.email.toLowerCase(),
      agentName: agent.name,
      contactName: fullName,
      contactEmail: email || undefined,
      contactPhone: phone || undefined,
      propertyAddress: answers.Property,
      answers,
      status: "new",
      isLead: true,
    });
    const first = !h?.leadAt;
    if (h) await ctx.db.patch(h._id, { leadAt: h.leadAt ?? Date.now(), submissionId: id });
    if (first) await ctx.db.patch(c._id, { leads: c.leads + 1 });
    await ctx.scheduler.runAfter(0, internal.notify.formSubmitted, { id });
    await ctx.scheduler.runAfter(60 * 60 * 1000, internal.notify.escalateIfUnanswered, { id });
    await ctx.scheduler.runAfter(0, internal.lofty.pushLead, { id });
    return { ok: true };
  },
});

// Ops check (run_app_function): totals per campaign, no household details.
export const stats = internalQuery({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const cs = await ctx.db.query("mailCampaigns").order("desc").take(100);
    return cs.map(c => ({ id: c._id, name: c.name, agent: c.agentName, design: c.design, status: c.status, homes: c.households, scans: c.scans, scanned: c.scannedHouseholds, leads: c.leads, wpCode: c.wpCode, wpScans: c.wpScans }));
  },
});

export { isAdminEmail };

// Read-only public check used by e2e: does this code exist? (No data returned.)
export const exists = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => !!(await byCode(ctx, code)),
});
