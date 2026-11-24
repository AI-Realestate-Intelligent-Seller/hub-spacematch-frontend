// "Request help" on each support person: logs the ask, emails the person, tracks open/done.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { HELP_STATUSES, HELP_STATUS_LABEL, normStatus } from "./helpDue";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { esc, hubUrl, sendMail, shell, table } from "./notify";

// Keep in sync with TEAM in src/lib/hub.ts (who can receive asks).
export const SUPPORT: { name: string; email: string }[] = [
  { name: "Cris Castillo", email: "smm@spacematchinc.com" },
  { name: "Anthony “Atom” Arpia", email: "tc@spacematchinc.com" },
  { name: "Michael Kang", email: "michael@spacematchinc.com" },
  { name: "Brandon Banks", email: "brandon@spacematchinc.com" },
  { name: "Sergio Monjane", email: "sergio.monjane@spacematchinc.com" },
];
const URGENCY: Record<string, string> = { now: "Urgent — within the hour", today: "Today", week: "This week" };

export const create = authenticatedMutation({
  args: { toEmail: v.string(), topic: v.string(), details: v.string(), urgency: v.string() },
  handler: async (ctx, a) => {
    const viewer = await hubViewer(ctx, ctx.userId);
    const to = SUPPORT.find(s => s.email === a.toEmail);
    if (!to) throw new Error("Pick someone from the support team");
    const topic = a.topic.trim().slice(0, 80);
    const details = a.details.trim().slice(0, 2000);
    if (!topic) throw new Error("Pick what you need help with");
    if (!URGENCY[a.urgency]) throw new Error("Pick when you need it");
    const id = await ctx.db.insert("helpRequests", {
      fromUserId: ctx.userId,
      fromEmail: viewer.email,
      fromName: viewer.name,
      toName: to.name,
      toEmail: to.email,
      topic,
      details,
      urgency: a.urgency,
      status: "new",
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.help.notify, { id });
    return id;
  },
});

export const forMail = internalQuery({ args: { id: v.id("helpRequests") }, handler: (ctx, { id }) => ctx.db.get(id) });

export const notify = internalAction({
  args: { id: v.id("helpRequests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.runQuery(internal.help.forMail, { id });
    if (!r) return;
    const html = shell(
      `${r.fromName} needs help: ${r.topic}`,
      `<p style="color:#3d3a35;font-size:15px">Logged in the Agent Hub. Mark it done there when it's handled so ${esc(r.fromName.split(" ")[0])} sees it.</p>` +
        table([
          ["From", `${r.fromName} (${r.fromEmail})`],
          ["Needs help with", r.topic],
          ["When", URGENCY[r.urgency] ?? r.urgency],
          ["Details", r.details || "—"],
        ]),
      { href: `${hubUrl()}/help`, label: "Open help requests" },
    );
    try {
      await sendMail(r.toEmail, `${r.urgency === "now" ? "URGENT · " : ""}Help request from ${r.fromName}: ${r.topic}`, html);
    } catch (e) {
      console.error("help mail", String(e));
    }
  },
});

// Requests I sent + requests sent to me (admins see everything, newest 500).
export const list = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const viewer = await hubViewer(ctx, ctx.userId);
    const norm = <T extends { status: string }>(rows: T[]) => rows.map(r => ({ ...r, status: normStatus(r.status) }));
    const mine = await ctx.db.query("helpRequests").withIndex("by_from", q => q.eq("fromUserId", ctx.userId)).order("desc").take(50);
    let toMe: typeof mine = [];
    if (viewer.isAdmin) toMe = await ctx.db.query("helpRequests").order("desc").take(500);
    else if (SUPPORT.some(s => s.email === viewer.email)) toMe = await ctx.db.query("helpRequests").withIndex("by_to", q => q.eq("toEmail", viewer.email)).order("desc").take(300);
    return {
      mine: norm(mine),
      toMe: norm(toMe),
      canHandle: viewer.isAdmin || SUPPORT.some(s => s.email === viewer.email),
      isAdmin: viewer.isAdmin,
      myEmail: viewer.email,
      support: SUPPORT,
    };
  },
});

export const setStatus = authenticatedMutation({
  args: { id: v.id("helpRequests"), status: v.string(), reply: v.optional(v.string()) },
  handler: async (ctx, { id, status, reply }) => {
    const viewer = await hubViewer(ctx, ctx.userId);
    const r = await ctx.db.get(id);
    if (!r) throw new Error("Not found");
    const canHandle = viewer.isAdmin || r.toEmail === viewer.email;
    const isAsker = r.fromUserId === ctx.userId;
    if (!canHandle && !isAsker) throw new Error("Only the person asked can update this");
    if (!(HELP_STATUSES as readonly string[]).includes(status)) throw new Error("Bad status");
    if (!canHandle && status !== "done" && status !== "in_progress") throw new Error("Only the person asked can update this");
    const note = reply?.trim().slice(0, 1000);
    const now = Date.now();
    await ctx.db.patch(id, {
      status,
      reply: note || r.reply,
      statusAt: now,
      statusBy: viewer.name,
      doneAt: status === "done" ? now : undefined,
      doneBy: status === "done" ? viewer.name : undefined,
    });
    // Tell the agent when someone else moves their request along.
    if (!isAsker && status !== "new") await ctx.scheduler.runAfter(0, internal.help.notifyAgent, { id, note: note ?? "" });
    return null;
  },
});

export const reassign = authenticatedMutation({
  args: { id: v.id("helpRequests"), toEmail: v.string() },
  handler: async (ctx, { id, toEmail }) => {
    const viewer = await hubViewer(ctx, ctx.userId);
    if (!viewer.isAdmin) throw new Error("Only admins can reassign");
    const r = await ctx.db.get(id);
    if (!r) throw new Error("Not found");
    const to = SUPPORT.find(s => s.email === toEmail);
    if (!to) throw new Error("Pick someone from the support team");
    if (to.email === r.toEmail) return null;
    await ctx.db.patch(id, { toEmail: to.email, toName: to.name, reassignedBy: viewer.name, statusAt: Date.now() });
    if (to.email !== viewer.email) await ctx.scheduler.runAfter(0, internal.help.notify, { id });
    return null;
  },
});

export const notifyAgent = internalAction({
  args: { id: v.id("helpRequests"), note: v.string() },
  handler: async (ctx, { id, note }) => {
    const r = await ctx.runQuery(internal.help.forMail, { id });
    if (!r) return;
    const label = HELP_STATUS_LABEL[normStatus(r.status)] ?? r.status;
    const html = shell(
      `Your help request: ${label}`,
      `<p style="color:#3d3a35;font-size:15px">${esc(r.statusBy ?? r.toName)} updated your request <b>${esc(r.topic)}</b>.</p>` +
        table([
          ["Status", label],
          ["Handled by", r.toName],
          ...(note ? [["Note", note] as [string, string]] : []),
          ["Your request", r.details || r.topic],
        ]),
      { href: `${hubUrl()}/help`, label: "Open help requests" },
    );
    try {
      await sendMail(r.fromEmail, `Help request ${label.toLowerCase()}: ${r.topic}`, html);
    } catch (e) {
      console.error("help agent mail", String(e));
    }
  },
});

// One-off: legacy "open" rows → "new".
export const migrateOpen = internalMutation({
  args: {},
  handler: async ctx => {
    let n = 0;
    for (const r of await ctx.db.query("helpRequests").collect()) if (r.status === "open") { await ctx.db.patch(r._id, { status: "new" }); n++; }
    return n;
  },
});

// WhatsApp numbers for support people (Michael 2026-10-18: Cris + Atom). Admin-editable in the Hub.
export const whatsapp = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query("hubSettings").collect();
    return Object.fromEntries(rows.filter(r => r.key.startsWith("whatsapp:")).map(r => [r.key.slice(9), r.value]));
  },
});

export const setWhatsapp = authenticatedMutation({
  args: { email: v.string(), phone: v.string() },
  handler: async (ctx, { email, phone }) => {
    const viewer = await hubViewer(ctx, ctx.userId);
    if (!viewer.isAdmin && viewer.email !== email) throw new Error("Only admins can change this");
    if (!SUPPORT.some(s => s.email === email)) throw new Error("Unknown person");
    const digits = phone.replace(/\D/g, "");
    const intl = digits.length === 10 ? `1${digits}` : digits;
    if (intl && (intl.length < 11 || intl.length > 15)) throw new Error("Enter a full phone number");
    const key = `whatsapp:${email}`;
    const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", key)).unique();
    if (!intl) { if (row) await ctx.db.delete(row._id); return null; }
    if (row) await ctx.db.patch(row._id, { value: intl });
    else await ctx.db.insert("hubSettings", { key, value: intl });
    return null;
  },
});
