// Server-only functions used by Viktor's CMA queue worker (called with the
// deploy key via query_app_database). Never exposed to app users.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { statusValidator } from "./schema";

export const pendingCount = internalQuery({
  args: {},
  handler: async ctx => {
    // New requests plus agent edits / list-price changes waiting for a rebuild.
    let n = 0;
    for (const status of ["submitted", "revision"] as const) {
      const rows = await ctx.db
        .query("cmaRequests")
        .withIndex("by_status", q => q.eq("status", status))
        .take(50);
      n += rows.length;
    }
    return n;
  },
});

export const listByStatus = internalQuery({
  args: { status: v.string() },
  handler: async (ctx, { status }) => {
    const rows = await ctx.db.query("cmaRequests").order("desc").take(500);
    return rows.filter(r => r.status === status);
  },
});

export const getRequest = internalQuery({
  args: { id: v.id("cmaRequests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r) return null;
    // Signed download URLs for the agent's uploads (OM, rent roll, exports).
    const attachments = await Promise.all(
      (r.attachments ?? []).map(async a => ({
        ...a,
        url: await ctx.storage.getUrl(a.storageId),
      })),
    );
    return { ...r, attachments };
  },
});

export const setStatus = internalMutation({
  args: {
    id: v.id("cmaRequests"),
    status: statusValidator,
    statusNote: v.optional(v.string()),
    valueLow: v.optional(v.number()),
    valueHigh: v.optional(v.number()),
    listPrice: v.optional(v.number()),
    recommendedListPrice: v.optional(v.number()),
  },
  handler: async (ctx, { id, status, ...rest }) => {
    const r = await ctx.db.get(id);
    if (!r) throw new Error("Request not found");
    const patch: Record<string, unknown> = { status, ...rest };
    if (status === "building") {
      patch.pickedUpAt = Date.now();
      patch.revisionPending = false;
    }
    if (status === "ready") {
      patch.completedAt = Date.now();
      // The agent edited while this build ran: keep the new files but queue
      // the edit for another pass.
      if (r.revisionPending) {
        patch.status = "revision";
        patch.revisionPending = false;
        patch.statusNote =
          "Your edits came in while this version was building. Viktor is updating the report with them.";
      }
    }
    await ctx.db.patch(id, patch);
    // Started from New Leads → tell Michael, Cristina and Anthony it's ready.
    if (patch.status === "ready" && r.submittedByEmail === "new-leads" && r.status !== "ready") {
      await ctx.scheduler.runAfter(0, internal.leadTrackActions.cmaReadyAlert, { cmaId: id });
    }
    return null;
  },
});

export const attachFiles = internalMutation({
  args: {
    id: v.id("cmaRequests"),
    pdfStorageId: v.optional(v.id("_storage")),
    workbookStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { id, ...files }) => {
    const patch: Record<string, unknown> = {};
    if (files.pdfStorageId) patch.pdfStorageId = files.pdfStorageId;
    if (files.workbookStorageId)
      patch.workbookStorageId = files.workbookStorageId;
    await ctx.db.patch(id, patch);
    return null;
  },
});
