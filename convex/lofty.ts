// Forms → Lofty lead. Needs env LOFTY_PUSH=on; only forms listed in LOFTY_FORMS
// (default: open-house-signin) are pushed. Michael approved open house 2026-10-17.
// Open house leads use Lofty source "Open House" (leadSource 11), which Anna and the
// company Smart Plans exclude, so the agent follows up personally.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { formById } from "./formDefs";
import { AGENTS } from "./agentsData";
import { syncRoster } from "./rosterSync";

declare const process: { env: Record<string, string | undefined> };

async function callTool<T>(role: string, args: Record<string, unknown>): Promise<T> {
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
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Tool call failed");
  return json.result as T;
}

const LEAD_TYPE: Record<string, number> = {
  Seller: 1,
  Buyer: 2,
  Renter: 3,
  Landlord: 5,
  Business: -1,
  Leads: 2,
};

export const record = internalMutation({
  args: { id: v.id("formSubmissions"), leadId: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, { id, leadId, error }) => {
    await syncRoster(ctx);
    await ctx.db.patch(id, { loftyLeadId: leadId, loftyError: error });
  },
});

type ToolResult = { content?: string; error?: string };
type Wrapped = { status_code?: number; body?: any };

// Custom-API tools return a JSON string {status_code, body}.
export async function lofty(method: "get" | "post" | "put", path: string, json_body?: unknown): Promise<any> {
  // Pass the query string as query_params: some v2 endpoints drop an inline "?…".
  const [bare, qs] = path.split("?");
  const args: Record<string, unknown> = { path: bare };
  if (qs) args.query_params = Object.fromEntries(new URLSearchParams(qs));
  if (json_body !== undefined) args.json_body = json_body;
  const r = await callTool<ToolResult>(`custom_api_lofty_crm_${method}`, args);
  if (r.error || !r.content) throw new Error(r.error ?? "Lofty: empty response");
  const w = JSON.parse(r.content) as Wrapped;
  if ((w.status_code ?? 200) >= 400) throw new Error(`Lofty ${w.status_code}: ${JSON.stringify(w.body).slice(0, 300)}`);
  return w.body;
}

const norm = (x: string) => x.toLowerCase().replace(/-/g, " ").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

// Lofty member emails often differ from the Hub (cbrealty / personal), so match by
// email first, then by first + last name.
export async function loftyMembers(): Promise<any[]> {
  const body = await lofty("get", "/v1.0/members?limit=100");
  return body?.members ?? [];
}

async function loftyUserId(agentEmail: string, agentName: string): Promise<number | undefined> {
  return matchMember(await loftyMembers(), agentEmail, agentName);
}

export function matchMember(members: any[], agentEmail: string, agentName: string): number | undefined {
  const byEmail = members.find(m => (m.email ?? "").toLowerCase() === agentEmail.toLowerCase());
  if (byEmail) return byEmail.id;
  const a = norm(agentName).split(" ");
  const byName = members.find(m => {
    const mt = norm(`${m.firstName ?? ""} ${m.lastName ?? ""}`).split(" ");
    const firstOk = mt[0].startsWith(a[0]) || a[0].startsWith(mt[0]);
    const lastOk = a.includes(mt[mt.length - 1]) || mt.includes(a[a.length - 1]);
    return firstOk && lastOk;
  });
  return byName?.id;
}

export function loftyEnabledFor(formId: string): boolean {
  if (process.env.LOFTY_PUSH !== "on") return false;
  // pro-intro (website Trusted Local Pros unlocks → Buyer leads) approved by Michael 2026-10-25.
  const list = (process.env.LOFTY_FORMS ?? "open-house-signin").split(",").map(x => x.trim());
  // mailer-reply (QR on seller mailers → Seller lead, tag Mailer) asked by Michael 2026-10-26 ("as automated as possible").
  // why-spacematch (agent's Why SpaceMatch link → lead under that agent, tag Why SpaceMatch) approved by Michael 2026-10-26.
  // pricing-review (website seller uploads → Seller lead, tags Pricing Review + Website) asked by Michael 2026-10-27 ("option b").
  return list.includes(formId) || formId === "pro-intro" || formId === "mailer-reply" || formId === "why-spacematch" || formId === "pricing-review";
}

export const pushLead = internalAction({
  args: { id: v.id("formSubmissions") },
  handler: async (ctx, { id }) => {
    await syncRoster(ctx);
    // Extra copy into the agent's own Follow Up Boss, if they connected one (fub.ts).
    await ctx.scheduler.runAfter(0, internal.fub.pushLead, { id });
    const s = await ctx.runQuery(internal.notify.submissionForMail, { id });
    if (!s || s.audience !== "client" || !loftyEnabledFor(s.formId)) return;
    if (!s.contactEmail && !s.contactPhone) return;
    if (s.contactEmail?.endsWith("@example.com")) return; // e2e test leads never reach Lofty
    try {
      const assignedUserId = s.agentEmail ? await loftyUserId(s.agentEmail, s.agentName) : undefined;
      const isOpenHouse = s.formId === "open-house-signin";
      const isPros = s.formId === "pro-intro";
      const isMailer = s.formId === "mailer-reply";
      const isWhy = s.formId === "why-spacematch";
      const isPricing = s.formId === "pricing-review";
      const whyAsk = s.answers["Asked for"] ?? "";
      const whyTypes = whyAsk.startsWith("Sell-and-buy") ? [1, 2] : whyAsk.startsWith("Home search") ? [2] : [1];
      const address = (s.propertyAddress ?? "").trim();
      const [firstName, ...rest] = s.contactName.trim().split(/\s+/);
      const lead = {
        firstName: firstName.slice(0, 30),
        lastName: rest.join(" ").slice(0, 30) || undefined,
        emails: s.contactEmail ? [s.contactEmail] : [],
        phones: s.contactPhone ? [s.contactPhone.slice(0, 20)] : [],
        leadTypes: isWhy ? whyTypes : [LEAD_TYPE[s.group] ?? -1],
        source: isOpenHouse ? "Open House" : "SpaceMatch Hub",
        tagsAdd: (isOpenHouse ? ["Open House", address] : isPros ? ["Trusted Local Pros", "Website"] : isMailer ? ["Mailer", s.answers["Mailer code"] ? `Mailer ${s.answers["Mailer code"]}` : ""] : isWhy ? ["Why SpaceMatch"] : isPricing ? ["Pricing Review", "Website"] : ["Hub form", s.formTitle])
          .filter(Boolean)
          .map(t => t.slice(0, 30)),
        assignedUserId,
      };
      const res = await lofty("post", "/v1.0/leads", lead);
      const leadId = res?.leadId;
      if (!leadId) throw new Error(`Lofty: no leadId (${JSON.stringify(res).slice(0, 200)})`);
      const def = formById(s.formId);
      const pairs = def
        ? def.fields.map(f => [f.label, s.answers[f.id]] as const)
        : (Object.entries(s.answers) as [string, string][]);
      const lines = pairs
        .filter(([, val]) => val)
        .map(([k, val]) => `${k}: ${val}`);
      const note = [`${s.formTitle} via SpaceMatch Hub${s.agentName ? ` (for ${s.agentName})` : ""}`, ...lines]
        .join("\n")
        .slice(0, 3000);
      await lofty("post", "/v1.0/notes", { leadId, content: note });
      await ctx.runMutation(internal.lofty.record, { id, leadId: String(leadId) });
    } catch (e) {
      console.error("lofty pushLead", String(e));
      await ctx.runMutation(internal.lofty.record, { id, error: String(e).slice(0, 500) });
    }
  },
});

// Same visitor unlocked another pro: add it to their Lofty lead as a note.
export const addNote = internalAction({
  args: { id: v.id("formSubmissions"), text: v.string() },
  handler: async (ctx, { id, text }) => {
    await syncRoster(ctx);
    const s = await ctx.runQuery(internal.notify.submissionForMail, { id });
    if (!s?.loftyLeadId || !loftyEnabledFor(s.formId)) return;
    try {
      await lofty("post", "/v1.0/notes", { leadId: Number(s.loftyLeadId), content: text.slice(0, 3000) });
    } catch (e) {
      console.error("lofty addNote", String(e));
    }
  },
});

// Read-only check used to verify member matching (no writes).
export const checkMembers = internalAction({
  args: {},
  handler: async (ctx) => {
    await syncRoster(ctx);
    const out: Record<string, number | null> = {};
    for (const a of AGENTS) out[a.name] = (await loftyUserId(a.email, a.name)) ?? null;
    return out;
  },
});

// ---------- Listing → seller's Lofty contact (Michael 2026-11-02 "go all") ----------
// Saving a listing (or adding the seller's email/phone later) finds the seller in
// Lofty by email, then phone. Found → add tags + a note, nothing else changes.
// Not found → new Seller lead under the listing agent, stage Active Client,
// source "SpaceMatch Hub" (not one of Anna's company sources, so Anna and the
// company Smart Plans leave a listed seller alone). Tags: "Hub Listing" + street.
const LISTING_TAG = "Hub Listing";

type ListingForLofty = {
  address: string; mlsNumber?: string; price?: string; status: string; agentEmail: string; agentName: string;
  sellerName: string; sellerEmail?: string; sellerPhone?: string; token: string; loftyLeadId?: string;
};

export const listingForLofty = internalQuery({
  args: { id: v.id("listings") },
  handler: async (ctx, { id }): Promise<ListingForLofty | null> => {
    await syncRoster(ctx);
    const l = await ctx.db.get(id);
    if (!l) return null;
    return {
      address: l.address, mlsNumber: l.mlsNumber, price: l.price, status: l.status,
      agentEmail: l.agentEmail, agentName: l.agentName,
      sellerName: l.sellerName, sellerEmail: l.sellerEmail, sellerPhone: l.sellerPhone,
      token: l.token, loftyLeadId: l.loftyLeadId,
    };
  },
});

export const recordListing = internalMutation({
  args: { id: v.id("listings"), leadId: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, { id, leadId, error }) => {
    await syncRoster(ctx);
    const l = await ctx.db.get(id);
    if (!l) return;
    await ctx.db.patch(id, { loftyLeadId: leadId ?? l.loftyLeadId, loftyError: error, loftyAt: Date.now() });
  },
});

const digits10 = (p?: string) => {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
};

async function findLead(email?: string, phone?: string): Promise<any | undefined> {
  if (email) {
    const b = await lofty("get", `/v1.0/leads?email=${encodeURIComponent(email)}&limit=5`);
    const want = email.trim().toLowerCase();
    const hit = (b?.leads ?? []).find((x: any) => (x.emails ?? []).some((e: string) => e.trim().toLowerCase() === want));
    if (hit) return { ...hit, id: hit.leadId ?? hit.id }; // Lofty search rows carry leadId, not id
  }
  const d = digits10(phone);
  if (d.length === 10) {
    const b = await lofty("get", `/v1.0/leads?phone=${d}&limit=5`);
    const hit = (b?.leads ?? [])[0];
    if (hit) return { ...hit, id: hit.leadId ?? hit.id };
  }
  return undefined;
}

const isOwnContact = (l: ListingForLofty) => {
  const e = (l.sellerEmail ?? "").trim().toLowerCase();
  return !!e && (e === (l.agentEmail ?? "").trim().toLowerCase() || e.endsWith("@spacematchinc.com"));
};

/** One-off fix: drop a wrong Lofty link from a listing and store why. */
export const unlinkListing = internalMutation({
  args: { id: v.id("listings"), error: v.optional(v.string()) },
  handler: async (ctx, { id, error }) => {
    await syncRoster(ctx);
    await ctx.db.patch(id, { loftyLeadId: undefined, loftyError: error, loftyAt: Date.now() });
  },
});

/** Street part for the tag: "2147 W Thomas St #2, Chicago, IL" → "2147 W Thomas St #2". */
const streetTag = (address: string) => address.split(",")[0].trim().slice(0, 60);

export const syncListingSeller = internalAction({
  args: { id: v.id("listings"), force: v.optional(v.boolean()) },
  handler: async (ctx, { id, force }): Promise<{ status: string; leadId?: number | string; error?: string }> => {
    await syncRoster(ctx);
    const l: ListingForLofty | null = await ctx.runQuery(internal.lofty.listingForLofty, { id });
    if (!l) return { status: "gone" };
    if (!l.sellerEmail && !l.sellerPhone) return { status: "no-contact" };
    if (process.env.LOFTY_PUSH !== "on") {
      await ctx.runMutation(internal.lofty.recordListing, { id, error: "Lofty sync is turned off for this Hub." });
      return { status: "off" };
    }
    if (l.sellerEmail?.endsWith("@example.com")) { // e2e listings never reach Lofty
      await ctx.runMutation(internal.lofty.recordListing, { id, error: "Test listing (example.com email), not sent to Lofty." });
      return { status: "test" };
    }
    if (l.loftyLeadId && !force) return { status: "linked", leadId: l.loftyLeadId };
    if (isOwnContact(l)) { // placeholder: the agent typed their own / a SpaceMatch email as the seller's
      await ctx.runMutation(internal.lofty.recordListing, { id, error: "The seller email is the agent's own address. Add the seller's real email or phone to link Lofty." });
      return { status: "own-contact" };
    }
    try {
      const tags = [LISTING_TAG, streetTag(l.address)];
      const hub = process.env.HUB_URL ?? "https://hub.spacematchinc.com";
      const note = [
        `Listing in SpaceMatch Hub (${l.agentName})`,
        `Property: ${l.address}`,
        l.mlsNumber ? `MLS #: ${l.mlsNumber}` : "",
        l.price ? `List price: ${l.price}` : "",
        `Status: ${l.status}`,
        `Seller page: ${hub}/s/${l.token}`,
      ].filter(Boolean).join("\n");
      const found = l.loftyLeadId ? { id: Number(l.loftyLeadId) } : await findLead(l.sellerEmail, l.sellerPhone);
      let leadId: number;
      if (found?.id) {
        leadId = found.id;
        await lofty("put", `/v1.0/leads/${leadId}`, { tagsAdd: tags });
      } else {
        const assignedUserId = await loftyUserId(l.agentEmail, l.agentName);
        const [firstName, ...rest] = l.sellerName.trim().split(/\s+/);
        const parts = l.address.split(",").map((x: string) => x.trim());
        const zip = l.address.match(/\b(\d{5})\b\s*$/)?.[1];
        const res = await lofty("post", "/v1.0/leads", {
          firstName: firstName.slice(0, 30),
          lastName: rest.join(" ").slice(0, 30) || undefined,
          emails: l.sellerEmail ? [l.sellerEmail] : [],
          phones: l.sellerPhone ? [l.sellerPhone.slice(0, 20)] : [],
          leadTypes: [1],
          source: "SpaceMatch Hub",
          stage: "Active Client",
          streetAddress: parts[0],
          city: parts[1] || undefined,
          state: "IL",
          zipCode: zip,
          tagsAdd: tags,
          assignedUserId,
        });
        leadId = res?.leadId;
        if (!leadId) throw new Error(`Lofty: no leadId (${JSON.stringify(res).slice(0, 200)})`);
        // Lofty merges a POST into an existing lead with the same email and ignores tagsAdd then.
        await lofty("put", `/v1.0/leads/${leadId}`, { tagsAdd: tags });
      }
      await lofty("post", "/v1.0/notes", { leadId, content: note.slice(0, 3000) });
      await ctx.runMutation(internal.lofty.recordListing, { id, leadId: String(leadId) });
      return { status: found?.id ? "tagged" : "created", leadId };
    } catch (e) {
      const msg = String(e);
      console.error("lofty syncListingSeller", msg);
      const friendly = /200136|token|401/i.test(msg) ? "Lofty API key needs to be regenerated (Lofty → Settings → API). It will link on the next try." : msg.slice(0, 300);
      await ctx.runMutation(internal.lofty.recordListing, { id, error: friendly });
      return { status: "error", error: msg.slice(0, 300) };
    }
  },
});

/** One-off: link every listing with a seller email/phone (run after the API key is fixed). */
export const syncAllListings = internalAction({
  args: {},
  handler: async (ctx): Promise<unknown[]> => {
    await syncRoster(ctx);
    const ids: string[] = await ctx.runQuery(internal.lofty.unlinkedListings, {});
    const out: unknown[] = [];
    for (const id of ids) out.push(await ctx.runAction(internal.lofty.syncListingSeller, { id: id as any }));
    return out;
  },
});

export const unlinkedListings = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => (await ctx.db.query("listings").collect()).filter(l => !l.loftyLeadId && (l.sellerEmail || l.sellerPhone)).map(l => l._id),
});
