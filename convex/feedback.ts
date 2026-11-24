// "Suggest a fix or add-on" (Michael 2026-10-18): agents post ideas, everyone can "Me too",
// Viktor categorizes + merges + estimates weekly (internal fns below, run via run_app_function),
// Michael/admins approve in the Review tab, agents get an email when their idea moves.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { FEEDBACK_AREAS, FEEDBACK_CATEGORIES, FEEDBACK_KINDS, FEEDBACK_STATUS, autoCategory } from "./feedbackDefs";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { esc, hubUrl, sendMail, shell, table } from "./notify";

const DECISIONS = ["approved", "building", "shipped", "later", "declined", "reviewed"];
const NOTIFY_ON = ["approved", "shipped", "later", "declined"];
const BLOCKING_TO = "michael@spacematchinc.com";

async function withUrls(ctx: QueryCtx, rows: Doc<"feedback">[]) {
  return Promise.all(
    rows.map(async r => ({
      ...r,
      votes: r.voters.length,
      shotUrl: r.shotId ? await ctx.storage.getUrl(r.shotId) : null,
    })),
  );
}

export const uploadUrl = authenticatedMutation({ args: {}, handler: ctx => ctx.storage.generateUploadUrl() });

export const create = authenticatedMutation({
  args: {
    kind: v.string(),
    area: v.string(),
    title: v.string(),
    details: v.string(),
    blocking: v.optional(v.boolean()),
    shotId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, a) => {
    const viewer = await hubViewer(ctx, ctx.userId);
    if (!FEEDBACK_KINDS.some(k => k.id === a.kind)) throw new Error("Pick fix, make it better, or add-on");
    if (!(FEEDBACK_AREAS as readonly string[]).includes(a.area)) throw new Error("Pick where in the Hub");
    const title = a.title.trim().slice(0, 120);
    const details = a.details.trim().slice(0, 3000);
    if (title.length < 4) throw new Error("Add a short title");
    const id = await ctx.db.insert("feedback", {
      fromUserId: ctx.userId,
      fromEmail: viewer.email,
      fromName: viewer.name,
      kind: a.kind,
      area: a.area,
      title,
      details,
      blocking: a.kind === "fix" ? !!a.blocking : undefined,
      shotId: a.shotId,
      voters: [ctx.userId],
      category: autoCategory(a.kind, a.area, `${title} ${details}`),
      categorySource: "auto",
      status: "new",
      createdAt: Date.now(),
    });
    if (a.kind === "fix" && a.blocking) await ctx.scheduler.runAfter(0, internal.feedback.mailBlocking, { id });
    return id;
  },
});

// Everyone sees the team's ideas (so they "Me too" instead of re-posting); admins get the review queue.
export const list = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const viewer = await hubViewer(ctx, ctx.userId);
    const rows = await ctx.db.query("feedback").order("desc").take(400);
    const items = await withUrls(ctx, rows);
    return {
      items: items.map(r => ({ ...r, mine: r.fromUserId === ctx.userId, voted: r.voters.includes(ctx.userId), voters: [] as Id<"users">[] })),
      isAdmin: viewer.isAdmin,
      myId: ctx.userId,
    };
  },
});

export const vote = authenticatedMutation({
  args: { id: v.id("feedback") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r) throw new Error("Not found");
    const has = r.voters.includes(ctx.userId);
    await ctx.db.patch(id, { voters: has ? r.voters.filter(u => u !== ctx.userId) : [...r.voters, ctx.userId] });
    return !has;
  },
});

// Admin decision from the Review tab.
export const decide = authenticatedMutation({
  args: { id: v.id("feedback"), status: v.string(), note: v.optional(v.string()), category: v.optional(v.string()) },
  handler: async (ctx, { id, status, note, category }) => {
    const viewer = await hubViewer(ctx, ctx.userId);
    if (!viewer.isAdmin) throw new Error("Only admins can approve");
    const r = await ctx.db.get(id);
    if (!r) throw new Error("Not found");
    if (!DECISIONS.includes(status)) throw new Error("Bad status");
    if (category && !FEEDBACK_CATEGORIES[category]) throw new Error("Bad category");
    const trimmed = note?.trim().slice(0, 1000);
    await ctx.db.patch(id, {
      status,
      decisionNote: trimmed || r.decisionNote,
      decidedBy: viewer.name,
      decidedAt: Date.now(),
      shippedAt: status === "shipped" ? Date.now() : r.shippedAt,
      ...(category ? { category, categorySource: "admin" } : {}),
    });
    if (NOTIFY_ON.includes(status) && status !== r.status) await ctx.scheduler.runAfter(0, internal.feedback.mailAgent, { id });
    return null;
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id("feedback") },
  handler: async (ctx, { id }) => {
    const viewer = await hubViewer(ctx, ctx.userId);
    const r = await ctx.db.get(id);
    if (!r) return null;
    if (!viewer.isAdmin && !(r.fromUserId === ctx.userId && r.status === "new")) throw new Error("You can only delete your own new ideas");
    if (r.shotId) await ctx.storage.delete(r.shotId);
    await ctx.db.delete(id);
    return null;
  },
});

// ───────── Viktor's weekly review (run_app_function, prod) ─────────

// Everything Viktor needs: open items (new/reviewed/approved/building) + last 14 days of decisions.
export const forReview = internalQuery({
  args: {},
  handler: async ctx => {
    const since = Date.now() - 14 * 864e5;
    const rows = await ctx.db.query("feedback").order("desc").take(1000);
    const pick = rows.filter(r => ["new", "reviewed", "approved", "building"].includes(r.status) || (r.decidedAt ?? 0) > since);
    const items = await withUrls(ctx, pick);
    return {
      counts: Object.fromEntries(Object.keys(FEEDBACK_STATUS).map(s => [s, rows.filter(r => r.status === s).length])),
      categories: FEEDBACK_CATEGORIES,
      items: items.map(({ voters: _v, ...r }) => ({ ...r, createdIso: new Date(r.createdAt).toISOString() })),
    };
  },
});

// Viktor writes category / priority / estimate / note; merges duplicates into the main item.
export const applyReview = internalMutation({
  args: {
    items: v.array(
      v.object({
        id: v.id("feedback"),
        category: v.string(),
        priority: v.optional(v.string()),
        estimate: v.optional(v.string()),
        viktorNote: v.optional(v.string()),
        mergedInto: v.optional(v.id("feedback")),
      }),
    ),
  },
  handler: async (ctx, { items }) => {
    const now = Date.now();
    let n = 0;
    for (const it of items) {
      const r = await ctx.db.get(it.id);
      if (!r) continue;
      if (!FEEDBACK_CATEGORIES[it.category]) throw new Error(`Bad category ${it.category}`);
      const patch: Partial<Doc<"feedback">> = {
        category: it.category,
        categorySource: "viktor",
        priority: it.priority,
        estimate: it.estimate,
        viktorNote: it.viktorNote,
        reviewedAt: now,
      };
      if (it.mergedInto && it.mergedInto !== it.id) {
        const main = await ctx.db.get(it.mergedInto);
        if (main) {
          patch.mergedInto = it.mergedInto;
          patch.status = "merged";
          const voters = [...new Set([...main.voters, ...r.voters])];
          await ctx.db.patch(main._id, { voters });
        }
      } else if (r.status === "new") patch.status = "reviewed";
      await ctx.db.patch(it.id, patch);
      n++;
    }
    return n;
  },
});

// Viktor (or a Slack-thread approval) moves items: approved / building / shipped / later / declined.
export const setStatusInternal = internalMutation({
  args: { ids: v.array(v.id("feedback")), status: v.string(), note: v.optional(v.string()), by: v.optional(v.string()) },
  handler: async (ctx, { ids, status, note, by }) => {
    if (!DECISIONS.includes(status)) throw new Error("Bad status");
    for (const id of ids) {
      const r = await ctx.db.get(id);
      if (!r) continue;
      await ctx.db.patch(id, {
        status,
        decisionNote: note?.trim() || r.decisionNote,
        decidedBy: by ?? "Michael Kang",
        decidedAt: Date.now(),
        shippedAt: status === "shipped" ? Date.now() : r.shippedAt,
      });
      if (NOTIFY_ON.includes(status) && status !== r.status) await ctx.scheduler.runAfter(0, internal.feedback.mailAgent, { id });
    }
    return ids.length;
  },
});

export const forMail = internalQuery({ args: { id: v.id("feedback") }, handler: (ctx, { id }) => ctx.db.get(id) });

const AGENT_LINE: Record<string, string> = {
  approved: "Michael approved it. It goes into the next Hub update.",
  shipped: "It's live in the Hub now. Thanks for making the app better.",
  later: "Good idea, but not this round. It stays on the list for a later update.",
  declined: "Michael decided not to build this one.",
};

export const mailAgent = internalAction({
  args: { id: v.id("feedback") },
  handler: async (ctx, { id }) => {
    const r = await ctx.runQuery(internal.feedback.forMail, { id });
    if (!r || !AGENT_LINE[r.status]) return;
    const label = FEEDBACK_STATUS[r.status];
    const html = shell(
      `Your Hub idea: ${label}`,
      `<p style="color:#3d3a35;font-size:15px">${esc(AGENT_LINE[r.status])}</p>` +
        table([
          ["Your idea", r.title],
          ["Status", label],
          ...(r.decisionNote ? [["Note", r.decisionNote] as [string, string]] : []),
        ]),
      { href: `${hubUrl()}/feedback`, label: "See all ideas" },
    );
    try {
      await sendMail(r.fromEmail, `Your Hub idea is ${label.toLowerCase()}: ${r.title}`, html);
    } catch (e) {
      console.error("feedback mail", String(e));
    }
  },
});

export const mailBlocking = internalAction({
  args: { id: v.id("feedback") },
  handler: async (ctx, { id }) => {
    const r = await ctx.runQuery(internal.feedback.forMail, { id });
    if (!r) return;
    const html = shell(
      `${r.fromName} is blocked: ${r.title}`,
      `<p style="color:#3d3a35;font-size:15px">An agent reported something broken in the Hub that's stopping their work. Forward it to Viktor in #team-app-design to fix it now, or it waits for the weekly review.</p>` +
        table([
          ["From", `${r.fromName} (${r.fromEmail})`],
          ["Where", r.area],
          ["Problem", r.title],
          ["Details", r.details || "—"],
        ]),
      { href: `${hubUrl()}/feedback`, label: "Open feedback" },
    );
    try {
      await sendMail(BLOCKING_TO, `BLOCKED · Hub problem from ${r.fromName}: ${r.title}`, html);
    } catch (e) {
      console.error("feedback blocking mail", String(e));
    }
  },
});

// Viktor: remove spam / test rows.
export const removeInternal = internalMutation({
  args: { ids: v.array(v.id("feedback")) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      const r = await ctx.db.get(id);
      if (!r) continue;
      if (r.shotId) await ctx.storage.delete(r.shotId);
      await ctx.db.delete(id);
    }
    return ids.length;
  },
});
