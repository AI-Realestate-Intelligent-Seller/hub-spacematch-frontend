// Emails page (Michael 2026-10-31, #team-app-design 1793460359.025149): agents can write their own
// templates (most won't, the library is done-for-you). Personal by default; "Suggest for team" goes
// to admins/ops, who approve it into everyone's library. Plus the team's "today's rate" setting.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { hubUrl, sendMail, shell, table } from "./notify";

const RATE_KEY = "emails:rate";
const DEFAULT_RATE = { ratePct: 7.24, source: "Freddie Mac 30-year average", asOf: "2026-10-29" };
const REVIEW_TO = ["michael@spacematchinc.com", "smm@spacematchinc.com"];
const clean = (s: string, max: number) => s.trim().slice(0, max);
const canReview = (x: { isAdmin: boolean; isOps: boolean }) => x.isAdmin || x.isOps;

export const overview = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    const mine = await ctx.db.query("emailTemplates").withIndex("by_owner", q => q.eq("ownerUserId", ctx.userId)).order("desc").take(200);
    const team = await ctx.db.query("emailTemplates").withIndex("by_status", q => q.eq("status", "team")).order("desc").take(200);
    const review = canReview(me)
      ? await ctx.db.query("emailTemplates").withIndex("by_status", q => q.eq("status", "suggested")).order("desc").take(100)
      : [];
    const rateRow = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", RATE_KEY)).first();
    const rate = rateRow ? (JSON.parse(rateRow.value) as typeof DEFAULT_RATE) : DEFAULT_RATE;
    return { mine, team, review, canReview: canReview(me), rate };
  },
});

export const save = authenticatedMutation({
  args: {
    id: v.optional(v.id("emailTemplates")),
    title: v.string(),
    segment: v.string(),
    subject: v.string(),
    body: v.string(),
    basedOn: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const me = await hubViewer(ctx, ctx.userId);
    const fields = { title: clean(a.title, 120) || clean(a.subject, 120) || "Untitled", segment: clean(a.segment, 40), subject: clean(a.subject, 200), body: clean(a.body, 8000) };
    if (!fields.body) throw new Error("Write something in the email first.");
    const now = Date.now();
    if (a.id) {
      const row = await ctx.db.get(a.id);
      if (!row) throw new Error("Template not found.");
      if (row.ownerUserId !== ctx.userId && !canReview(me)) throw new Error("You can only edit your own templates.");
      // Editing a team template you own sends it back for review; reviewers edit in place.
      const status = row.status === "team" && !canReview(me) ? "suggested" : row.status === "declined" ? "mine" : row.status;
      await ctx.db.patch(a.id, { ...fields, status, updatedAt: now });
      return a.id;
    }
    return ctx.db.insert("emailTemplates", {
      ...fields, basedOn: a.basedOn, ownerUserId: ctx.userId, ownerEmail: me.email, ownerName: me.name, status: "mine", createdAt: now, updatedAt: now,
    });
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id("emailTemplates") },
  handler: async (ctx, { id }) => {
    const me = await hubViewer(ctx, ctx.userId);
    const row = await ctx.db.get(id);
    if (!row) return;
    if (row.ownerUserId !== ctx.userId && !canReview(me)) throw new Error("You can only delete your own templates.");
    await ctx.db.delete(id);
  },
});

export const suggest = authenticatedMutation({
  args: { id: v.id("emailTemplates") },
  handler: async (ctx, { id }) => {
    const me = await hubViewer(ctx, ctx.userId);
    const row = await ctx.db.get(id);
    if (!row || row.ownerUserId !== ctx.userId) throw new Error("Template not found.");
    if (canReview(me)) {
      await ctx.db.patch(id, { status: "team", reviewedBy: me.email, updatedAt: Date.now() });
      return "team";
    }
    await ctx.db.patch(id, { status: "suggested", reviewNote: undefined, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.emailTemplates.mailReview, { id });
    return "suggested";
  },
});

export const review = authenticatedMutation({
  args: { id: v.id("emailTemplates"), approve: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, { id, approve, note }) => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!canReview(me)) throw new Error("Only Michael or the office can approve team templates.");
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Template not found.");
    await ctx.db.patch(id, { status: approve ? "team" : "declined", reviewNote: note ? clean(note, 500) : undefined, reviewedBy: me.email, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.emailTemplates.mailOwner, { id });
  },
});

export const setRate = authenticatedMutation({
  args: { ratePct: v.number() },
  handler: async (ctx, { ratePct }) => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!canReview(me)) throw new Error("Only Michael or the office can change the team rate.");
    if (!(ratePct > 1 && ratePct < 15)) throw new Error("Enter a rate between 1% and 15%.");
    const value = JSON.stringify({ ratePct, source: `Set by ${me.name}`, asOf: new Date().toISOString().slice(0, 10) });
    const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", RATE_KEY)).first();
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("hubSettings", { key: RATE_KEY, value });
  },
});

export const forMail = internalQuery({ args: { id: v.id("emailTemplates") }, handler: (ctx, { id }) => ctx.db.get(id) });

export const mailReview = internalAction({
  args: { id: v.id("emailTemplates") },
  handler: async (ctx, { id }) => {
    const r = (await ctx.runQuery(internal.emailTemplates.forMail, { id })) as Doc<"emailTemplates"> | null;
    if (!r) return;
    const html = shell(
      `${r.ownerName} suggested an email for the team`,
      `<p style="color:#3d3a35;font-size:15px">Approve it and every agent gets it in their Emails library.</p>` +
        table([["Template", r.title], ["Subject", r.subject], ["Email", r.body.slice(0, 600) + (r.body.length > 600 ? "…" : "")]]),
      { href: `${hubUrl()}/emails?tab=review`, label: "Review it" },
    );
    for (const to of REVIEW_TO) {
      try { await sendMail(to, `Email template to review: ${r.title}`, html); } catch (e) { console.error("template review mail", String(e)); }
    }
  },
});

export const mailOwner = internalAction({
  args: { id: v.id("emailTemplates") },
  handler: async (ctx, { id }) => {
    const r = (await ctx.runQuery(internal.emailTemplates.forMail, { id })) as Doc<"emailTemplates"> | null;
    if (!r || (r.status !== "team" && r.status !== "declined")) return;
    const ok = r.status === "team";
    const html = shell(
      ok ? "Your email is in the team library" : "Your email wasn't added to the team library",
      `<p style="color:#3d3a35;font-size:15px">${ok ? "Every agent can use it now. Thanks for sharing it." : "It's still saved under My templates for you to use."}</p>` +
        table([["Template", r.title], ...(r.reviewNote ? [["Note", r.reviewNote] as [string, string]] : [])]),
      { href: `${hubUrl()}/emails?tab=mine`, label: "Open Emails" },
    );
    try { await sendMail(r.ownerEmail, ok ? `Approved: ${r.title}` : `Not added: ${r.title}`, html); } catch (e) { console.error("template owner mail", String(e)); }
  },
});

export const removeInternal = internalMutation({
  args: { ids: v.array(v.id("emailTemplates")) },
  handler: async (ctx, { ids }) => { for (const id of ids) if (await ctx.db.get(id)) await ctx.db.delete(id); },
});
