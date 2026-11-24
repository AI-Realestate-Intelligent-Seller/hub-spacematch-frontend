import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { requestFields } from "./schema";
import { AGENTS, isAdminEmail } from "./agentsData";

import { internal } from "./_generated/api";
import { ADMIN_EMAILS } from "./agentsData";
import { normalizeAddressFields } from "./address";

// CMA limits approved by Michael 2026-10-16: 2 per agent per month, 40 per team.
export const AGENT_CAP = 2;
export const TEAM_CAP = 40;

export function monthStart(now = Date.now()) {
  // Chicago month boundary (approx. UTC-5/6 → use UTC-5).
  const d = new Date(now - 5 * 3600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + 5 * 3600_000;
}

// New builds this month (revisions don't count; declined approvals don't count).
export async function cmaQuota(ctx: QueryCtx, agentName?: string) {
  const since = monthStart();
  const rows = await ctx.db
    .query("cmaRequests")
    .withIndex("by_creation_time", q => q.gte("_creationTime", since))
    .collect();
  const counted = rows.filter(r => r.status !== "approval" && r.statusNote !== "Declined by Michael");
  const agentUsed = agentName
    ? counted.filter(r => r.agentName === agentName).length
    : 0;
  return { agentUsed, agentCap: AGENT_CAP, teamUsed: counted.length, teamCap: TEAM_CAP, pendingApproval: rows.filter(r => r.status === "approval").length };
}

export const quota = authenticatedQuery({
  args: { agentName: v.optional(v.string()) },
  handler: async (ctx, { agentName }) => {
    const { email, isAdmin } = await viewer(ctx, ctx.userId);
    const name = agentName ?? AGENTS.find(a => a.email.toLowerCase() === email)?.name;
    return { ...(await cmaQuota(ctx, name)), agentName: name ?? null, isAdmin };
  },
});

// Michael approves / declines an over-cap request.
export const decideApproval = authenticatedMutation({
  args: { id: v.id("cmaRequests"), approve: v.boolean() },
  handler: async (ctx, { id, approve }) => {
    const { isAdmin } = await viewer(ctx, ctx.userId);
    if (!isAdmin) throw new Error("Only admins can approve extra CMAs");
    const r = await ctx.db.get(id);
    if (!r || r.status !== "approval") throw new Error("Nothing to approve");
    await ctx.db.patch(id, approve
      ? { status: "submitted", statusNote: "Approved by Michael. In the queue." }
      : { status: "failed", statusNote: "Declined by Michael" });
    return null;
  },
});

async function viewer(ctx: QueryCtx, userId: Doc<"users">["_id"]) {
  const user = await ctx.db.get(userId);
  const email = (user?.email ?? "").toLowerCase();
  return { user, email, isAdmin: isAdminEmail(email) };
}

export const me = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const { user, email, isAdmin } = await viewer(ctx, ctx.userId);
    return { name: user?.name ?? "", email, isAdmin };
  },
});

// Agents upload OMs, rent rolls, T-12s, CoStar/Crexi exports before submitting.
export const generateUploadUrl = authenticatedMutation({
  args: {},
  handler: async ctx => await ctx.storage.generateUploadUrl(),
});

export const submit = authenticatedMutation({
  args: requestFields,
  handler: async (ctx, raw) => {
    const args = normalizeAddressFields(raw);
    const { email } = await viewer(ctx, ctx.userId);
    if (!args.street.trim() || !args.city.trim() || !args.zip.trim()) {
      throw new Error("Property address is required");
    }
    if (!args.clientName.trim()) throw new Error("Client name is required");
    if (!args.agentName.trim()) throw new Error("Agent is required");
    if ((args.attachments ?? []).length > 25) {
      throw new Error("Please attach at most 25 files");
    }
    const quota = await cmaQuota(ctx, args.agentName);
    const isAdmin = ADMIN_EMAILS.includes(email);
    const overCap = !isAdmin && (quota.agentUsed >= quota.agentCap || quota.teamUsed >= quota.teamCap);
    const id = await ctx.db.insert("cmaRequests", {
      ...args,
      userId: ctx.userId,
      submittedByEmail: email,
      status: overCap ? "approval" : "submitted",
      statusNote: overCap
        ? quota.teamUsed >= quota.teamCap
          ? `Team limit reached (${quota.teamCap} CMAs this month). Sent to Michael for approval.`
          : `${args.agentName} has used ${quota.agentUsed} of ${quota.agentCap} CMAs this month. Sent to Michael for approval.`
        : undefined,
    });
    if (overCap) {
      await ctx.scheduler.runAfter(0, internal.notify.cmaApprovalNeeded, { id });
    }
    return id;
  },
});

const FIELD_LABELS: Record<string, string> = {
  reportType: "Sale / lease",
  lease: "Lease details",
  investor: "Investor numbers",
  kind: "Residential / commercial",
  commercial: "Building facts & income",
  attachments: "Documents",
  agentName: "Agent",
  clientName: "Client name",
  clientEmail: "Client email",
  clientPhone: "Client phone",
  street: "Street",
  unit: "Unit",
  city: "City",
  zip: "ZIP",
  propertyType: "Property type",
  beds: "Bedrooms",
  bathsFull: "Full baths",
  bathsHalf: "Half baths",
  sqft: "Square feet",
  yearBuilt: "Year built",
  basement: "Basement",
  garage: "Garage",
  hoaDues: "HOA dues",
  condition: "Condition",
  upgrades: "Upgrades",
  otherUpgrades: "Other upgrades",
  knownIssues: "Known issues",
  sellerPriceExpectation: "Price expectation",
  timeline: "Timeline",
  purpose: "Purpose",
  neededBy: "Needed by",
  branding: "Branding",
  schools: "Schools",
  compNotes: "Comp preferences",
  notes: "Notes",
};

const norm = (v: unknown) => JSON.stringify(v ?? null);

async function editable(
  ctx: QueryCtx,
  userId: Doc<"users">["_id"],
  id: Doc<"cmaRequests">["_id"],
) {
  const r = await ctx.db.get(id);
  if (!r) throw new Error("Request not found");
  const { email, isAdmin } = await viewer(ctx, userId);
  if (!isAdmin && r.userId !== userId) throw new Error("Not your request");
  return { r, email };
}

// Agent fixes or adds details after submitting. Queued requests just update;
// finished ones go back to Viktor for a rebuild.
export const update = authenticatedMutation({
  args: { id: v.id("cmaRequests"), ...requestFields },
  handler: async (ctx, { id, ...raw }) => {
    const args = normalizeAddressFields(raw);
    const { r, email } = await editable(ctx, ctx.userId, id);
    if (!args.street.trim() || !args.city.trim() || !args.zip.trim()) {
      throw new Error("Property address is required");
    }
    if (!args.clientName.trim()) throw new Error("Client name is required");
    if ((args.attachments ?? []).length > 25) {
      throw new Error("Please attach at most 25 files");
    }
    const changedKeys = (Object.keys(requestFields) as (keyof typeof args)[])
      .filter(k => k !== "agentEmail" && k !== "agentPhone" && k !== "state")
      .filter(k => norm(args[k]) !== norm(r[k as keyof typeof r]));
    if (!changedKeys.length) return { changed: [], status: r.status };
    const changed = changedKeys.map(k => FIELD_LABELS[k] ?? k);
    const short = (x: unknown) => {
      if (x === undefined || x === null || x === "") return "";
      const t = typeof x === "string" ? x : JSON.stringify(x);
      return t.length > 1500 ? `${t.slice(0, 1500)}…` : t;
    };
    const diff = changedKeys.map(k =>
      k === "attachments"
        ? {
            field: k,
            from: (r.attachments ?? []).map(a => a.name).join(", "),
            to: (args.attachments ?? []).map(a => a.name).join(", "),
          }
        : {
            field: k,
            from: short(r[k as keyof typeof r]),
            to: short(args[k]),
          },
    );

    // Optional fields cleared in the form arrive as undefined → unset them.
    const patch: Record<string, unknown> = {};
    for (const k of Object.keys(requestFields)) {
      patch[k] = (args as Record<string, unknown>)[k];
    }
    patch.revisions = [
      ...(r.revisions ?? []),
      { at: Date.now(), byEmail: email, type: "details", changed, diff },
    ];
    if (r.status === "submitted" || r.status === "approval") {
      // Not picked up yet: the build will use the new details.
    } else if (r.status === "needs_info") {
      patch.status = "submitted";
      patch.statusNote = "Details updated. Back in the queue.";
    } else if (r.status === "building") {
      patch.revisionPending = true;
    } else {
      patch.status = "revision";
      patch.statusNote = `Updated ${changed.join(", ")}. Viktor is rebuilding the CMA.`;
    }
    await ctx.db.patch(id, patch);
    return { changed, status: (patch.status as string) ?? r.status };
  },
});

// Agent overrides Viktor's suggested list price on a finished CMA; the worker
// rebuilds the PDF + workbook at that price (value range stays Viktor's).
export const setListPrice = authenticatedMutation({
  args: {
    id: v.id("cmaRequests"),
    listPrice: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { id, listPrice, note }) => {
    const { r, email } = await editable(ctx, ctx.userId, id);
    if (r.status !== "ready" && r.status !== "revision") {
      throw new Error("The list price can be changed once the CMA is ready");
    }
    const isLease = r.reportType === "lease";
    if (!Number.isFinite(listPrice) || listPrice < (isLease ? 1 : 10000)) {
      throw new Error(
        isLease
          ? "Enter the asking rent in dollars"
          : "Enter a list price in dollars",
      );
    }
    // Commercial lease rates are $/SF/yr (e.g. 27.50), keep cents.
    const price = isLease
      ? Math.round(listPrice * 100) / 100
      : Math.round(listPrice);
    const unit = !isLease ? "" : r.kind === "commercial" ? "/SF/yr" : "/mo";
    const recommended = r.recommendedListPrice ?? r.listPrice;
    await ctx.db.patch(id, {
      agentListPrice: price,
      agentListPriceNote: note?.trim() || undefined,
      recommendedListPrice: recommended,
      listPrice: price,
      status: "revision",
      statusNote: `${isLease ? "Asking rent" : "List price"} changed to $${price.toLocaleString("en-US")}${unit}. Viktor is updating the PDF and workbook.`,
      revisions: [
        ...(r.revisions ?? []),
        {
          at: Date.now(),
          byEmail: email,
          type: "list_price",
          changed: ["List price"],
          listPrice: price,
          note: note?.trim() || undefined,
        },
      ],
    });
    return null;
  },
});

async function withUrls(ctx: QueryCtx, r: Doc<"cmaRequests">) {
  return {
    ...r,
    attachments: await Promise.all(
      (r.attachments ?? []).map(async a => ({
        ...a,
        url: await ctx.storage.getUrl(a.storageId),
      })),
    ),
    pdfUrl: r.pdfStorageId ? await ctx.storage.getUrl(r.pdfStorageId) : null,
    workbookUrl: r.workbookStorageId
      ? await ctx.storage.getUrl(r.workbookStorageId)
      : null,
  };
}

export const list = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const { isAdmin } = await viewer(ctx, ctx.userId);
    const rows = isAdmin
      ? await ctx.db.query("cmaRequests").order("desc").take(200)
      : await ctx.db
          .query("cmaRequests")
          .withIndex("by_user", q => q.eq("userId", ctx.userId))
          .order("desc")
          .take(200);
    return await Promise.all(rows.map(r => withUrls(ctx, r)));
  },
});

export const get = authenticatedQuery({
  args: { id: v.id("cmaRequests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r) return null;
    const { isAdmin } = await viewer(ctx, ctx.userId);
    if (!isAdmin && r.userId !== ctx.userId) return null;
    return await withUrls(ctx, r);
  },
});
