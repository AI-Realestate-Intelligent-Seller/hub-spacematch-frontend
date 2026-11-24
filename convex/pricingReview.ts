import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { ADMIN_EMAILS, AGENTS } from "./agentsData";
import { syncRoster } from "./rosterSync";

// spacematchinc.com/pricing-review (Michael 2026-10-27, #luxury-presence-spacematchinc 1793135630.153479):
// sellers upload photos, appraisal, survey, etc. for a detailed pricing review.
// One submission →
//   1. Hub inbox lead (team, files attached) + email to team@/ops   (formSubmissions, formId "pricing-review")
//   2. Lofty Seller lead tagged "Pricing Review" + "Website"        (lofty.pushLead)
//   3. Lead Desk card to vet / book an agent                         (deskLeads, stage to_vet)
//   4. CMA request waiting for an admin's Approve tap               (cmaRequests, status "approval")
// The CMA never builds on its own: a public form must not spend CMA credits without a person looking first.
export const FORM_ID = "pricing-review";
export const MAX_FILES = 20;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 250 * 1024 * 1024;
const UPLOADS_PER_HOUR = 400; // site-wide cap on anonymous upload URLs

const clean = (s: string, max = 200) => s.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const cleanMulti = (s: string, max = 2000) => s.replace(/[\u0000-\u0009\u000b-\u001f]/g, " ").trim().slice(0, max);
const digits = (s: string) => s.replace(/\D/g, "");

export const PROPERTY_TYPES = ["Single-family", "Condo", "Townhome", "2–4 unit", "Other"];
export const CONDITIONS = ["Needs work", "Original / dated", "Average / well maintained", "Partially updated", "Fully renovated", "Not sure"];
export const REASONS = ["Thinking about selling", "Just curious what it's worth", "Estate / inherited property", "Refinance or divorce", "Buying my next home first"];
export const TIMELINES = ["ASAP (0–30 days)", "1–3 months", "3–6 months", "6+ months", "Not sure yet"];

// Desk vetting options differ slightly from the CMA form's.
const DESK_TYPE: Record<string, string> = { "Single-family": "Single family", Condo: "Condo", Townhome: "Townhouse", "2–4 unit": "2–4 unit", Other: "Single family" };
const DESK_CONDITION: Record<string, string> = {
  "Needs work": "Needs work", "Original / dated": "Needs light updates", "Average / well maintained": "Move-in ready",
  "Partially updated": "Needs light updates", "Fully renovated": "Move-in ready", "Not sure": "Not sure",
};
const DESK_TIMELINE: Record<string, string> = {
  "ASAP (0–30 days)": "ASAP (0–30 days)", "1–3 months": "1–3 months", "3–6 months": "3–6 months", "6+ months": "6+ months", "Not sure yet": "Just curious",
};

/** Anonymous upload URL for the website form (rate limited site-wide). */
export const uploadUrl = internalMutation({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const now = Date.now();
    const recent = await ctx.db.query("publicUploadTickets").withIndex("by_at", q => q.gte("at", now - 3600_000)).take(UPLOADS_PER_HOUR + 1);
    if (recent.length > UPLOADS_PER_HOUR) throw new Error("Uploads are busy right now. Please try again in a few minutes or text us at (773) 985-7153.");
    await ctx.db.insert("publicUploadTickets", { at: now });
    for (const old of await ctx.db.query("publicUploadTickets").withIndex("by_at", q => q.lt("at", now - 86400_000)).take(50)) {
      await ctx.db.delete(old._id);
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const submit = internalMutation({
  args: {
    fullName: v.string(), email: v.string(), phone: v.string(),
    street: v.string(), unit: v.string(), city: v.string(), zip: v.string(),
    propertyType: v.string(), beds: v.string(), baths: v.string(), sqft: v.string(),
    condition: v.string(), reason: v.string(), timeline: v.string(), priceInMind: v.string(), notes: v.string(),
    files: v.array(v.object({ storageId: v.string(), name: v.string() })),
    hp: v.string(), page: v.string(),
  },
  handler: async (ctx, a) => {
    await syncRoster(ctx);
    if (a.hp) return { ok: true }; // honeypot: bots get a fake success

    const fullName = clean(a.fullName, 80);
    const email = clean(a.email, 120).toLowerCase();
    const phone = clean(a.phone, 30);
    const street = clean(a.street, 120);
    const unit = clean(a.unit, 20).replace(/^#/, "");
    const city = clean(a.city, 60);
    const zip = clean(a.zip, 10);
    if (fullName.length < 2) throw new Error("Please add your name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("Please add a valid email so we can send your pricing review");
    if (digits(phone).length < 10) throw new Error("Please add a phone number (10 digits)");
    if (street.length < 4 || !/\d/.test(street)) throw new Error("Please add the property's street address");
    if (city.length < 2) throw new Error("Please add the city");
    if (!/^\d{5}$/.test(zip)) throw new Error("Please add a 5-digit ZIP code");
    if (a.files.length > MAX_FILES) throw new Error(`Please upload at most ${MAX_FILES} files`);

    // Every file must be a real, recent upload within the size limits.
    const files: { storageId: Id<"_storage">; name: string; size: number; contentType?: string }[] = [];
    let total = 0;
    for (const f of a.files) {
      const id = ctx.db.system.normalizeId("_storage", f.storageId);
      const meta = id ? await ctx.db.system.get(id) : null;
      if (!id || !meta) throw new Error("One of the files didn't finish uploading. Please try again.");
      if (meta.size > MAX_FILE_BYTES) throw new Error(`"${clean(f.name, 60)}" is over 50 MB`);
      if (files.some(x => x.storageId === id)) continue;
      total += meta.size;
      files.push({ storageId: id, name: clean(f.name, 120) || "file", size: meta.size, contentType: meta.contentType ?? undefined });
    }
    if (total > MAX_TOTAL_BYTES) throw new Error("That's more than 250 MB in total. Please send fewer or smaller files.");

    const pick = (val: string, list: string[]) => (list.includes(val) ? val : "");
    const propertyType = pick(a.propertyType, PROPERTY_TYPES) || "Other";
    const condition = pick(a.condition, CONDITIONS) || "Not sure";
    const reason = pick(a.reason, REASONS);
    const timeline = pick(a.timeline, TIMELINES);
    const beds = clean(a.beds, 10);
    const baths = clean(a.baths, 10);
    const sqft = clean(a.sqft, 12);
    const priceInMind = clean(a.priceInMind, 60);
    const notes = cleanMulti(a.notes, 2000);
    const address = `${street}${unit ? ` #${unit}` : ""}, ${city}, IL ${zip}`;
    const fileList = files.map(f => `${f.name} (${(f.size / 1048576).toFixed(1)} MB)`).join("\n");

    // 4. CMA request (approval first). Website requests are filed under the team account.
    // Owner = team@ (shared login); fall back to another admin, then (dev) any user.
    let teamUser = null;
    for (const e of ["team@spacematchinc.com", "michael@spacematchinc.com", ...ADMIN_EMAILS]) {
      teamUser = await ctx.db.query("users").withIndex("email", q => q.eq("email", e)).first();
      if (teamUser) break;
    }
    teamUser ??= await ctx.db.query("users").first();
    const michael = AGENTS.find(x => x.name === "Michael Kang");
    let cmaId: Id<"cmaRequests"> | undefined;
    if (teamUser && michael) {
      cmaId = await ctx.db.insert("cmaRequests", {
        reportType: "sale",
        kind: "residential",
        attachments: files,
        agentName: michael.name,
        agentEmail: michael.email,
        agentPhone: michael.phone,
        clientName: fullName,
        clientEmail: email,
        clientPhone: phone,
        street, unit: unit || undefined, city, state: "IL", zip,
        propertyType: propertyType === "Other" ? "Other" : propertyType,
        beds: beds || undefined,
        bathsFull: baths || undefined,
        sqft: sqft || undefined,
        condition: condition === "Not sure" ? "Average / well maintained" : condition,
        upgrades: [],
        otherUpgrades: notes || undefined,
        sellerPriceExpectation: priceInMind || undefined,
        timeline: timeline || undefined,
        purpose: "Pricing check for a seller",
        branding: "SpaceMatch · a team of Real Broker",
        schools: "Include assigned schools",
        notes: [
          "Website Pricing Review (spacematchinc.com/pricing-review). The seller uploaded their own files: read them (photos, appraisal, survey) and cite what they show.",
          reason && `Why: ${reason}`,
          condition === "Not sure" && "Seller picked condition 'Not sure': judge it from the photos.",
        ].filter(Boolean).join("\n"),
        userId: teamUser._id,
        submittedByEmail: "website",
        status: "approval",
        statusNote: `Website Pricing Review from ${fullName} (${files.length} file${files.length === 1 ? "" : "s"}). An admin taps Approve to build the CMA.`,
      });
    }

    // 1. Inbox lead with the files.
    const answers: Record<string, string> = { Name: fullName, Phone: phone, Email: email, Property: address, "Property type": propertyType };
    if (beds || baths) answers["Beds / baths"] = `${beds || "?"} bd / ${baths || "?"} ba`;
    if (sqft) answers["Square feet"] = sqft;
    answers.Condition = condition;
    if (reason) answers["Why now"] = reason;
    if (timeline) answers.Timeline = timeline;
    if (priceInMind) answers["Price in mind"] = priceInMind;
    if (notes) answers["Anything we should know"] = notes;
    answers.Files = files.length ? fileList : "No files uploaded";
    answers["Next step"] = cmaId
      ? "Call within 1 hour. The CMA request is waiting in Requests: tap Approve to build it, then send the written pricing opinion within 48 hours."
      : "Call within 1 hour, then send the written pricing opinion within 48 hours.";
    answers.Source = "spacematchinc.com/pricing-review";
    const sid = await ctx.db.insert("formSubmissions", {
      formId: FORM_ID,
      formTitle: "Pricing Review (website)",
      group: "Seller",
      audience: "client",
      agentEmail: "",
      agentName: "",
      contactName: fullName,
      contactEmail: email,
      contactPhone: phone,
      propertyAddress: address,
      answers,
      status: "new",
      isLead: true,
      attachments: files,
    });

    // 3. Lead Desk card (ops vet + book an agent).
    await ctx.db.insert("deskLeads", {
      stage: "to_vet",
      source: "Website",
      sourceRef: `pricing-review:${sid}`,
      rawText: Object.entries(answers).map(([k, val]) => `${k}: ${val}`).join("\n").slice(0, 3000),
      leadType: "seller",
      name: fullName,
      phone,
      email,
      details: Object.fromEntries(Object.entries({
        address,
        propertyType: DESK_TYPE[propertyType] ?? "",
        bedsBaths: beds || baths ? `${beds || "?"} bd / ${baths || "?"} ba` : "",
        condition: DESK_CONDITION[condition] ?? "",
        priceInMind: priceInMind || "wants a pricing review",
        whySelling: reason,
        timeline: DESK_TIMELINE[timeline] ?? "",
      }).filter(([, val]) => val)),
      notes: `Pricing Review from the website: ${files.length} file${files.length === 1 ? "" : "s"} uploaded (see Inbox).${cmaId ? " CMA request waiting for Approve in Requests." : ""}${notes ? `\nSeller's note: ${notes.slice(0, 500)}` : ""}`,
      history: [{ at: Date.now(), by: "Hub", text: "Came in from spacematchinc.com/pricing-review" }],
      createdAt: Date.now(),
      createdBy: "auto",
    });

    await ctx.scheduler.runAfter(0, internal.notify.formSubmitted, { id: sid });
    await ctx.scheduler.runAfter(0, internal.lofty.pushLead, { id: sid }); // Seller lead, tags Pricing Review + Website
    return { ok: true };
  },
});

// Ops check: latest website pricing reviews (no contact details).
export const recent = internalQuery({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    const rows = await ctx.db.query("formSubmissions").order("desc").take(300);
    return rows.filter(r => r.formId === FORM_ID).slice(0, 20).map(r => ({
      id: r._id, at: r._creationTime, name: r.contactName, files: r.attachments?.length ?? 0,
      loftyLeadId: r.loftyLeadId ?? null, loftyError: r.loftyError ?? null,
    }));
  },
});

// Ops/test cleanup: remove a test submission + its desk card, CMA request and files.
export const removeInternal = internalMutation({
  args: { id: v.id("formSubmissions") },
  handler: async (ctx, { id }) => {
    await syncRoster(ctx);
    const s = await ctx.db.get(id);
    if (!s || s.formId !== FORM_ID) return { removed: false };
    const desk = await ctx.db.query("deskLeads").withIndex("by_sourceRef", q => q.eq("sourceRef", `pricing-review:${id}`)).first();
    if (desk) await ctx.db.delete(desk._id);
    const cmas = await ctx.db.query("cmaRequests").withIndex("by_status", q => q.eq("status", "approval")).collect();
    for (const c of cmas) {
      if (c.submittedByEmail === "website" && c.clientEmail === s.contactEmail && c.street && s.propertyAddress?.startsWith(c.street)) await ctx.db.delete(c._id);
    }
    for (const f of s.attachments ?? []) {
      try { await ctx.storage.delete(f.storageId); } catch { /* already gone */ }
    }
    await ctx.db.delete(id);
    return { removed: true, desk: !!desk };
  },
});
