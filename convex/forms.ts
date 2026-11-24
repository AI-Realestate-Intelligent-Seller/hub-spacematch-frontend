import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { mutation, type QueryCtx } from "./_generated/server";
import { AGENTS, OPS_EMAILS, agentByEmail, agentBySlug, isAdminEmail } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { formById } from "./formDefs";
import { authenticatedMutation, authenticatedQuery } from "./functions";

const clean = (s: string | undefined, max = 4000) => (s ?? "").trim().slice(0, max);

// Public: clients submit without an account. Honeypot + size limits keep spam out.
export const submit = mutation({
  args: {
    formId: v.string(),
    agent: v.optional(v.string()), // agent slug from the link (?a=)
    answers: v.record(v.string(), v.string()),
    website: v.optional(v.string()), // honeypot, must stay empty
  },
  handler: async (ctx, { formId, agent, answers, website }) => {
    await syncRoster(ctx);
    const def = formById(formId);
    if (!def) throw new Error("This form no longer exists");
    if (website) return { ok: true }; // bot
    const a: Record<string, string> = {};
    for (const f of def.fields) {
      const val = clean(answers[f.id]);
      if (f.required && !val) throw new Error(`Please fill in “${f.label}”`);
      if (val) a[f.id] = val;
    }
    if (!a.fullName && !a.agentName) {
      // Team forms use agentName; client forms need a name.
      throw new Error("Please add your name");
    }
    const isClient = def.audience === "client";
    if (isClient && !a.email && !a.phone) {
      throw new Error("Please add an email or a phone number so we can reach you");
    }
    if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) {
      throw new Error("That email doesn't look right");
    }

    // Routing: client forms → agent from the link; team forms → selected agent's
    // name is recorded but the item goes to the team inbox (Michael, Cris, Atom).
    let routed = isClient ? agentBySlug(agent) : undefined;
    if (def.id === "lead-handoff" && a.toAgent) {
      routed = AGENTS.find(x => x.name === a.toAgent);
    }
    const fromAgent = def.audience === "team" ? AGENTS.find(x => x.name === a.agentName) : undefined;
    const contactName = a.fullName ?? a.leadName ?? a.agentName ?? "Unknown";

    const id = await ctx.db.insert("formSubmissions", {
      formId: def.id,
      formTitle: def.title,
      group: def.group,
      audience: def.audience,
      agentEmail: routed?.email.toLowerCase() ?? "",
      agentName: routed?.name ?? fromAgent?.name ?? "",
      contactName,
      contactEmail: a.email ?? a.leadEmail,
      contactPhone: a.phone ?? a.leadPhone,
      propertyAddress: a.propertyAddress,
      answers: a,
      status: "new",
      isLead: !!def.lead,
    });
    await ctx.scheduler.runAfter(0, internal.notify.formSubmitted, { id });
    if (def.lead) {
      await ctx.scheduler.runAfter(60 * 60 * 1000, internal.notify.escalateIfUnanswered, { id });
      await ctx.scheduler.runAfter(0, internal.lofty.pushLead, { id });
    }
    return { ok: true };
  },
});

async function who(ctx: QueryCtx, userId: Doc<"users">["_id"]) {
  const user = await ctx.db.get(userId);
  const email = (user?.email ?? "").toLowerCase();
  return {
    email,
    name: user?.name ?? agentByEmail(email)?.name ?? "",
    isAdmin: isAdminEmail(email),
    isOps: OPS_EMAILS.includes(email),
  };
}

const canSee = (s: Doc<"formSubmissions">, me: Awaited<ReturnType<typeof who>>) =>
  me.isAdmin ||
  s.agentEmail === me.email ||
  (me.isOps && (s.audience === "team" || !s.agentEmail));

export const inbox = authenticatedQuery({
  args: { scope: v.optional(v.union(v.literal("mine"), v.literal("all"))) },
  handler: async (ctx, { scope }) => {
    const me = await who(ctx, ctx.userId);
    let rows: Doc<"formSubmissions">[];
    if ((me.isAdmin || me.isOps) && scope !== "mine") {
      rows = await ctx.db.query("formSubmissions").order("desc").take(300);
    } else {
      rows = await ctx.db
        .query("formSubmissions")
        .withIndex("by_agent", q => q.eq("agentEmail", me.email))
        .order("desc")
        .take(300);
    }
    return { rows: rows.filter(r => canSee(r, me)), me };
  },
});

export const setStatus = authenticatedMutation({
  args: {
    id: v.id("formSubmissions"),
    status: v.union(v.literal("new"), v.literal("contacted"), v.literal("done")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, notes }) => {
    const me = await who(ctx, ctx.userId);
    const s = await ctx.db.get(id);
    if (!s || !canSee(s, me)) throw new Error("Not found");
    await ctx.db.patch(id, {
      status,
      handledByEmail: me.email,
      handledAt: Date.now(),
      ...(notes !== undefined ? { notes: clean(notes, 2000) } : {}),
    });
    return null;
  },
});

// Admin/ops reassign a submission to an agent.
export const assign = authenticatedMutation({
  args: { id: v.id("formSubmissions"), agentName: v.string() },
  handler: async (ctx, { id, agentName }) => {
    const me = await who(ctx, ctx.userId);
    if (!me.isAdmin && !me.isOps) throw new Error("Only admins, Cris or Atom can reassign");
    const a = AGENTS.find(x => x.name === agentName);
    if (!a) throw new Error("Unknown agent");
    await ctx.db.patch(id, { agentEmail: a.email.toLowerCase(), agentName: a.name });
    await ctx.scheduler.runAfter(0, internal.notify.formSubmitted, { id });
    return null;
  },
});

export const counts = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await who(ctx, ctx.userId);
    const mine = await ctx.db
      .query("formSubmissions")
      .withIndex("by_agent", q => q.eq("agentEmail", me.email))
      .collect();
    const newRows = await ctx.db
      .query("formSubmissions")
      .withIndex("by_status", q => q.eq("status", "new"))
      .collect();
    const visibleNew = newRows.filter(r => canSee(r, me));
    return {
      newCount: visibleNew.length,
      newLeads: visibleNew.filter(r => r.isLead).slice(0, 5),
      totalMine: mine.length,
    };
  },
});

// Signed download links for files attached to a submission (website pricing reviews).
export const files = authenticatedQuery({
  args: { id: v.id("formSubmissions") },
  handler: async (ctx, { id }) => {
    const me = await who(ctx, ctx.userId);
    const s = await ctx.db.get(id);
    if (!s || !canSee(s, me)) return [];
    return await Promise.all((s.attachments ?? []).map(async a => ({
      name: a.name, size: a.size, contentType: a.contentType ?? null, url: await ctx.storage.getUrl(a.storageId),
    })));
  },
});
