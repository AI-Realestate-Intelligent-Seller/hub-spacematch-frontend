// Team roster screen (/team, Michael 2026-11-16 "full"): admins + ops add, edit and remove agents
// without a code change. Rows in rosterAgents are merged over SEED_AGENTS (agentsData.applyRoster).
// Adding an agent also creates their Hub login (temporary password to text them) and their Drive
// video upload folder. Removing one blocks sign-in, signs them out and scrambles their password.
import { modifyAccountCredentials } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { AGENTS, REMOVED_EMAILS, agentSlug, isAdminEmail } from "./agentsData";
import { AGENT_UPLOADS_ROOT, AGENT_VIDEO_FOLDERS, driveFolderUrl } from "./agentVideoFolders";
import { authenticatedAction, authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import { issueLogin } from "./hubLogins";
import { syncRoster } from "./rosterSync";
import { callTool } from "./viktorTools";

declare const process: { env: Record<string, string | undefined> };

const DOMAIN = "spacematchinc.com";
const clean = (s: string | undefined, max: number) => (s ?? "").trim().replace(/\s+\n/g, "\n").slice(0, max);
const errOf = (e: unknown) => (e as Error).message?.slice(0, 300) ?? String(e);

// ---------- reads ----------

// Everyone's browser (also public pages: forms, meet-me links, mailer landing) loads the live roster.
// Same fields the Hub already shows publicly on meet-me pages and mailers; no Drive ids.
export const publicList = query({
  args: {},
  handler: async ctx => {
    await syncRoster(ctx);
    return AGENTS.map(({ folderId: _f, ...a }) => a);
  },
});

export const viewerInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await hubViewer(ctx, userId);
    return { allowed: me.isAdmin || me.isOps, email: me.email };
  },
});

// The /team screen: current agents with login status, plus people removed on this screen.
export const list = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!me.isAdmin && !me.isOps) return null;
    const rows = await ctx.db.query("rosterAgents").collect();
    const accts = await ctx.db.query("authAccounts").take(2000);
    const pw = new Set(accts.filter(a => a.provider === "password").map(a => a.providerAccountId.toLowerCase()));
    const agents = AGENTS.map(a => {
      const e = a.email.toLowerCase();
      const r = rows.find(x => x.email === e);
      const folder = a.folderId ?? AGENT_VIDEO_FOLDERS[e]?.folderId;
      return {
        name: a.name,
        email: e,
        phone: a.phone,
        title: a.title ?? "",
        lic: a.lic ?? "",
        bio: a.bio ?? "",
        photo: a.photo ?? "",
        added: !!a.added,
        addedAt: a.added ? r?.createdAt ?? null : null,
        hasLogin: pw.has(e),
        folderUrl: folder ? driveFolderUrl(folder) : null,
        folderError: r?.folderError ?? null,
        canRemove: e !== "michael@spacematchinc.com" && e !== me.email && !isAdminEmail(e),
      };
    });
    const removed = rows
      .filter(r => r.status === "removed")
      .sort((a, b) => (b.removedAt ?? 0) - (a.removedAt ?? 0))
      .map(r => ({ name: r.name, email: r.email, removedAt: r.removedAt ?? null }));
    return { agents, removed, me: me.email };
  },
});

// Sign-in gate (ViktorSpacesEmail): blocked for seed removals and removals made on /team.
export const isRemoved = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await syncRoster(ctx);
    return REMOVED_EMAILS.includes(email.trim().toLowerCase());
  },
});

// ---------- writes ----------

export const uploadUrl = authenticatedMutation({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!me.isAdmin && !me.isOps) throw new Error("Only admins and ops can change the team roster");
    return await ctx.storage.generateUploadUrl();
  },
});

const fields = {
  email: v.string(),
  name: v.string(),
  phone: v.string(),
  title: v.optional(v.string()),
  lic: v.optional(v.string()),
  bio: v.optional(v.string()),
  photoId: v.optional(v.id("_storage")),
};

export const upsertInternal = internalMutation({
  args: { ...fields, isNew: v.boolean(), by: v.string() },
  handler: async (ctx, a) => {
    await syncRoster(ctx);
    const email = a.email;
    const existing = await ctx.db.query("rosterAgents").withIndex("by_email", q => q.eq("email", email)).unique();
    const onRoster = AGENTS.find(x => x.email.toLowerCase() === email);
    if (a.isNew && onRoster) throw new Error(`${onRoster.name} is already on the team (${email})`);
    if (a.isNew && existing?.status === "removed") throw new Error(`${existing.name} was removed. Use Restore under Former members instead.`);
    if (!a.isNew && !onRoster) throw new Error("That agent isn't on the team");
    if (a.isNew && REMOVED_EMAILS.includes(email)) throw new Error("That email belongs to a former team member. Ask Viktor to restore them.");
    const slug = agentSlug(a.name);
    const clash = AGENTS.find(x => agentSlug(x.name) === slug && x.email.toLowerCase() !== email);
    if (clash) throw new Error(`${clash.name} already uses that name. Add a middle initial.`);
    let photoUrl = existing?.photoUrl;
    if (a.photoId && a.photoId !== existing?.photoId) {
      photoUrl = (await ctx.storage.getUrl(a.photoId)) ?? undefined;
      if (existing?.photoId) await ctx.storage.delete(existing.photoId);
    }
    const now = Date.now();
    const doc = {
      email,
      name: a.name,
      phone: a.phone,
      title: a.title || undefined,
      lic: a.lic || undefined,
      bio: a.bio || undefined,
      photoId: a.photoId ?? existing?.photoId,
      photoUrl,
      status: "active",
      updatedAt: now,
    };
    if (existing) await ctx.db.patch(existing._id, doc);
    else await ctx.db.insert("rosterAgents", { ...doc, addedBy: a.by, createdAt: now });
    return { needsFolder: !(existing?.folderId ?? onRoster?.folderId ?? AGENT_VIDEO_FOLDERS[email]) };
  },
});

// Add a new agent (isNew) or edit someone already on the team.
export const save = authenticatedAction({
  args: { ...fields, isNew: v.boolean() },
  handler: async (ctx, a): Promise<{ password: string | null; loginError: string | null }> => {
    const me = await ctx.runQuery(internal.roster.viewerInternal, { userId: ctx.userId });
    if (!me.allowed) throw new Error("Only admins and ops can change the team roster");
    const email = a.email.trim().toLowerCase();
    const name = clean(a.name, 60).replace(/\s+/g, " ");
    const phone = clean(a.phone, 30);
    if (!/^[^@\s]+@[^@\s]+$/.test(email) || email.split("@")[1] !== DOMAIN) throw new Error(`Use their @${DOMAIN} email`);
    if (name.split(" ").length < 2) throw new Error("Add their first and last name");
    if (phone.replace(/\D/g, "").length < 10) throw new Error("Add their cell number");
    const res = await ctx.runMutation(internal.roster.upsertInternal, {
      email,
      name,
      phone,
      title: clean(a.title, 80),
      lic: clean(a.lic, 40),
      bio: clean(a.bio, 1500),
      photoId: a.photoId,
      isNew: a.isNew,
      by: me.email,
    });
    if (res.needsFolder) await ctx.scheduler.runAfter(0, internal.roster.createFolder, { email, name });
    if (!a.isNew) return { password: null, loginError: null };
    try {
      const r = await issueLogin(ctx, email, name);
      return { password: r.password, loginError: null };
    } catch (e) {
      return { password: null, loginError: errOf(e) };
    }
  },
});

export const setStatusInternal = internalMutation({
  args: { email: v.string(), status: v.string() },
  handler: async (ctx, { email, status }) => {
    await syncRoster(ctx);
    const existing = await ctx.db.query("rosterAgents").withIndex("by_email", q => q.eq("email", email)).unique();
    const now = Date.now();
    if (status === "removed") {
      const a = AGENTS.find(x => x.email.toLowerCase() === email);
      if (!a) throw new Error("That agent isn't on the team");
      if (existing) await ctx.db.patch(existing._id, { status, removedAt: now, updatedAt: now });
      else await ctx.db.insert("rosterAgents", { email, name: a.name, phone: a.phone, status, addedBy: "seed", createdAt: now, updatedAt: now, removedAt: now });
      // Sign them out everywhere.
      const users = await ctx.db.query("users").withIndex("email", q => q.eq("email", email)).collect();
      for (const u of users) {
        const sessions = await ctx.db.query("authSessions").withIndex("userId", q => q.eq("userId", u._id)).collect();
        for (const s of sessions) {
          const tokens = await ctx.db.query("authRefreshTokens").withIndex("sessionId", q => q.eq("sessionId", s._id)).collect();
          for (const t of tokens) await ctx.db.delete(t._id);
          await ctx.db.delete(s._id);
        }
      }
      return { name: a.name };
    }
    if (!existing || existing.status !== "removed") throw new Error("Not a former member");
    await ctx.db.patch(existing._id, { status: "active", removedAt: undefined, updatedAt: now });
    return { name: existing.name };
  },
});

export const remove = authenticatedAction({
  args: { email: v.string() },
  handler: async (ctx, a): Promise<{ name: string }> => {
    const me = await ctx.runQuery(internal.roster.viewerInternal, { userId: ctx.userId });
    if (!me.allowed) throw new Error("Only admins and ops can change the team roster");
    const email = a.email.trim().toLowerCase();
    if (email === "michael@spacematchinc.com" || isAdminEmail(email)) throw new Error("Admins can't be removed here");
    if (email === me.email) throw new Error("You can't remove yourself");
    const r = await ctx.runMutation(internal.roster.setStatusInternal, { email, status: "removed" });
    // A password they know no longer works (email-code and reset are blocked by isRemoved).
    const found = await ctx.runQuery(internal.adminAccounts.findUser, { email });
    if (found.account?.provider === "password") {
      const secret = crypto.getRandomValues(new Uint32Array(4)).join("-");
      await modifyAccountCredentials(ctx, { provider: "password", account: { id: email, secret } });
    }
    return r;
  },
});

// Bring back someone removed on this screen, with a fresh temporary password.
export const restore = authenticatedAction({
  args: { email: v.string() },
  handler: async (ctx, a): Promise<{ name: string; password: string | null; loginError: string | null }> => {
    const me = await ctx.runQuery(internal.roster.viewerInternal, { userId: ctx.userId });
    if (!me.allowed) throw new Error("Only admins and ops can change the team roster");
    const email = a.email.trim().toLowerCase();
    const r = await ctx.runMutation(internal.roster.setStatusInternal, { email, status: "active" });
    try {
      const l = await issueLogin(ctx, email, r.name);
      return { name: r.name, password: l.password, loginError: null };
    } catch (e) {
      return { name: r.name, password: null, loginError: errOf(e) };
    }
  },
});

// ---------- Drive video folder ----------

export const setFolder = internalMutation({
  args: { email: v.string(), folderId: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, { email, folderId, error }) => {
    const row = await ctx.db.query("rosterAgents").withIndex("by_email", q => q.eq("email", email)).unique();
    if (!row) return;
    await ctx.db.patch(row._id, folderId ? { folderId, folderError: undefined } : { folderError: error });
  },
});

type DriveHit = { id: string; name: string; isFolder?: boolean };

// Their own folder under AGENT UPLOADS (same place as everyone else's). Reuses one with their name.
export const createFolder = internalAction({
  args: { email: v.string(), name: v.string() },
  handler: async (ctx, { email, name }) => {
    // Dev/e2e (HUB_TEST_AS is never set on prod): no real Drive folders for test agents.
    if (process.env.HUB_TEST_AS) {
      await ctx.runMutation(internal.roster.setFolder, { email, error: "Skipped on the test deployment" });
      return { error: "Skipped on the test deployment" };
    }
    try {
      const q = `'${AGENT_UPLOADS_ROOT}' in parents and trashed = false and name = '${name.replace(/'/g, "\\'")}'`;
      const found = await callTool<{ results?: DriveHit[]; error?: string }>("mcp_gdrive_search", { query: q, max_results: 5 });
      let folderId = (found.results ?? []).find(f => f.isFolder !== false)?.id;
      if (!folderId) {
        const r = await callTool<{ folder_id?: string; error?: string }>("mcp_gdrive_create_folder", { name, parent_path: AGENT_UPLOADS_ROOT });
        if (r.error || !r.folder_id) throw new Error(r.error ?? "Drive didn't return a folder");
        folderId = r.folder_id;
      }
      await ctx.runMutation(internal.roster.setFolder, { email, folderId });
      return { folderId };
    } catch (e) {
      await ctx.runMutation(internal.roster.setFolder, { email, error: errOf(e) });
      return { error: errOf(e) };
    }
  },
});

export const retryFolder = authenticatedAction({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<{ folderId?: string; error?: string }> => {
    const me = await ctx.runQuery(internal.roster.viewerInternal, { userId: ctx.userId });
    if (!me.allowed) throw new Error("Only admins and ops can change the team roster");
    const a = AGENTS.find(x => x.email.toLowerCase() === email.toLowerCase());
    if (!a) throw new Error("That agent isn't on the team");
    return await ctx.runAction(internal.roster.createFolder, { email: a.email.toLowerCase(), name: a.name });
  },
});

// Ops / e2e cleanup: forget a roster row entirely (seed agents fall back to the code list).
export const deleteInternal = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const row = await ctx.db.query("rosterAgents").withIndex("by_email", q => q.eq("email", email.toLowerCase())).unique();
    if (!row) return false;
    if (row.photoId) await ctx.storage.delete(row.photoId);
    await ctx.db.delete(row._id);
    return true;
  },
});
