// Agent Videos (Michael 2026-10-26): agents upload high-quality raw clips into their own Drive
// folder (VIDEOS- Team › AGENT UPLOADS), then tell the editor what each clip is. The editor
// (Vidchops) works from the shared Drive + the "Video log" sheet. Big phone videos go straight to
// Drive (resumable, original quality); Convex upload URLs time out after 2 minutes, so no in-app copy.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { AGENTS } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { AGENT_UPLOADS_ROOT, AGENT_VIDEO_FOLDERS, VIDEO_LOG_SHEET, driveFolderUrl } from "./agentVideoFolders";
import { authenticatedAction, authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";

declare const process: { env: Record<string, string | undefined> };

export const VIDEO_KINDS = [
  "Intro / about me",
  "Why I joined SpaceMatch",
  "Listing walkthrough",
  "Neighborhood spot",
  "Market update",
  "Seller tip",
  "Buyer tip",
  "Just listed / just sold",
  "Client story",
  "Behind the scenes",
  "Other",
] as const;

export const USE_FOR = ["Team Instagram", "My own socials", "Listing Reel", "Website / agent page", "YouTube"] as const;

const fileV = v.object({
  id: v.string(),
  name: v.string(),
  size: v.number(),
  mimeType: v.string(),
  createdTime: v.string(),
  link: v.string(),
});

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
  const r = json.result as T & { error?: string | null };
  if (r && typeof r === "object" && r.error) throw new Error(String(r.error));
  return r;
}

// Seed agents: generated map. Agents added on the Team roster screen: their rosterAgents folder.
const folderFor = (email: string) => {
  const e = email.toLowerCase();
  if (AGENT_VIDEO_FOLDERS[e]) return AGENT_VIDEO_FOLDERS[e];
  const a = AGENTS.find(x => x.email.toLowerCase() === e);
  return a?.folderId ? { name: a.name, folderId: a.folderId } : undefined;
};

// ---------- reads ----------

export const mine = authenticatedQuery({
  args: { as: v.optional(v.string()) },
  handler: async (ctx, { as }) => {
    const me = await hubViewer(ctx, ctx.userId);
    // Staff can look at any agent's page; agents only see their own.
    const asAgent = as && me.isStaff ? AGENTS.find(a => a.email === as) : undefined;
    const email = asAgent?.email ?? me.email;
    const f = folderFor(email);
    const cache = await ctx.db
      .query("agentVideoFiles")
      .withIndex("by_agent", q => q.eq("agentEmail", email))
      .unique();
    const briefs = await ctx.db
      .query("agentVideoBriefs")
      .withIndex("by_agent", q => q.eq("agentEmail", email))
      .order("desc")
      .take(50);
    return {
      email,
      name: f?.name ?? me.name,
      folderId: f?.folderId ?? null,
      folderUrl: f ? driveFolderUrl(f.folderId) : null,
      // Michael 2026-10-27: the whole AGENT UPLOADS folder is shared with every agent (see + share all clips).
      teamFolderUrl: driveFolderUrl(AGENT_UPLOADS_ROOT),
      files: cache?.files ?? [],
      checkedAt: cache?.checkedAt ?? null,
      checkError: cache?.error ?? null,
      briefs,
      isStaff: me.isStaff,
      agents: me.isStaff ? AGENTS.filter(a => folderFor(a.email)).map(a => ({ name: a.name, email: a.email })) : [],
      logUrl: me.isStaff ? `https://docs.google.com/spreadsheets/d/${VIDEO_LOG_SHEET}/edit` : null,
    };
  },
});

export const team = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!me.isStaff) return null;
    const caches = await ctx.db.query("agentVideoFiles").collect();
    const briefs = await ctx.db.query("agentVideoBriefs").withIndex("by_created").order("desc").take(300);
    const rows = AGENTS.filter(a => folderFor(a.email)).map(a => {
      const c = caches.find(x => x.agentEmail === a.email);
      const mineB = briefs.filter(b => b.agentEmail === a.email);
      const latest = c?.files.reduce<string | null>((m, f) => (!m || f.createdTime > m ? f.createdTime : m), null) ?? null;
      return {
        name: a.name,
        email: a.email,
        folderUrl: driveFolderUrl(folderFor(a.email)!.folderId),
        files: c?.files.length ?? 0,
        latest,
        checkedAt: c?.checkedAt ?? null,
        briefsNew: mineB.filter(b => b.status === "new").length,
        briefs: mineB.length,
      };
    });
    return { rows, briefs: briefs.slice(0, 40) };
  },
});

export const viewerInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await syncRoster(ctx);
    const me = await hubViewer(ctx, userId);
    return { email: me.email, isStaff: me.isStaff };
  },
});

// ---------- Drive file list (refresh on open / button) ----------

type DriveFile = { id: string; name: string; mimeType: string; size: string; createdTime: string; webViewLink: string; isFolder?: boolean };

async function listFolder(folderId: string) {
  const r = await callTool<{ results: DriveFile[] }>("mcp_gdrive_search", {
    query: `'${folderId}' in parents and trashed = false`,
    max_results: 500,
  });
  return (r.results ?? [])
    .filter(f => !f.isFolder)
    .map(f => ({
      id: f.id,
      name: f.name,
      size: Number(f.size) || 0,
      mimeType: f.mimeType ?? "",
      createdTime: f.createdTime ?? "",
      link: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
    }))
    .sort((a, b) => b.createdTime.localeCompare(a.createdTime));
}

export const saveFiles = internalMutation({
  args: { agentEmail: v.string(), files: v.optional(v.array(fileV)), error: v.optional(v.string()) },
  handler: async (ctx, { agentEmail, files, error }) => {
    await syncRoster(ctx);
    const row = await ctx.db
      .query("agentVideoFiles")
      .withIndex("by_agent", q => q.eq("agentEmail", agentEmail))
      .unique();
    const patch = files
      ? { files, checkedAt: Date.now(), error: undefined }
      : { error: error ?? "Couldn't read Drive", checkedAt: row?.checkedAt ?? Date.now() };
    if (row) await ctx.db.patch(row._id, patch);
    else await ctx.db.insert("agentVideoFiles", { agentEmail, files: files ?? [], ...patch });
  },
});

async function refreshOne(ctx: { runMutation: any }, email: string) {
  const f = folderFor(email);
  if (!f) return { email, ok: false, error: "No upload folder" };
  try {
    const files = await listFolder(f.folderId);
    await ctx.runMutation(internal.agentVideos.saveFiles, { agentEmail: email, files });
    return { email, ok: true, count: files.length };
  } catch (e) {
    const error = (e as Error).message.slice(0, 300);
    await ctx.runMutation(internal.agentVideos.saveFiles, { agentEmail: email, error });
    return { email, ok: false, error };
  }
}

export const refresh = authenticatedAction({
  args: { as: v.optional(v.string()), all: v.optional(v.boolean()) },
  handler: async (ctx, { as, all }): Promise<{ email: string; ok: boolean; count?: number; error?: string }[]> => {
    const me = await ctx.runQuery(internal.agentVideos.viewerInternal, { userId: ctx.userId });
    if (all) {
      if (!me.isStaff) throw new Error("Staff only");
      const emails = AGENTS.map(a => a.email).filter(e => folderFor(e));
      const out = [];
      for (let i = 0; i < emails.length; i += 5) {
        out.push(...(await Promise.all(emails.slice(i, i + 5).map(e => refreshOne(ctx, e)))));
      }
      return out;
    }
    const email = as && me.isStaff ? as : me.email;
    return [await refreshOne(ctx, email)];
  },
});

// Ops check / manual run: bunx convex run agentVideos:refreshInternal '{"email":"..."}'
export const refreshInternal = internalAction({
  args: { email: v.string() },
  handler: async (ctx, { email }) => refreshOne(ctx, email),
});

// ---------- briefs for the editor ----------

export const submitBrief = authenticatedMutation({
  args: {
    as: v.optional(v.string()),
    kind: v.string(),
    title: v.string(),
    address: v.optional(v.string()),
    useFor: v.array(v.string()),
    notes: v.optional(v.string()),
    files: v.array(v.string()),
  },
  handler: async (ctx, a) => {
    const me = await hubViewer(ctx, ctx.userId);
    const target = a.as && me.isStaff ? AGENTS.find(x => x.email === a.as) : undefined;
    const email = target?.email ?? me.email;
    const f = folderFor(email);
    if (!f) throw new Error("Your login doesn't have an upload folder yet. Sign in with your own @spacematchinc.com email.");
    const title = a.title.trim();
    if (!title) throw new Error("Add a short title so the editor knows what it is.");
    if (a.files.length === 0) throw new Error("Pick at least one uploaded clip.");
    const id = await ctx.db.insert("agentVideoBriefs", {
      agentEmail: email,
      agentName: f.name,
      kind: a.kind.slice(0, 60),
      title: title.slice(0, 120),
      address: a.address?.trim().slice(0, 160) || undefined,
      useFor: a.useFor.slice(0, 6),
      notes: a.notes?.trim().slice(0, 1500) || undefined,
      files: a.files.slice(0, 30),
      status: "new",
      createdAt: Date.now(),
      createdBy: me.email,
    });
    await ctx.scheduler.runAfter(0, internal.agentVideos.appendLog, { id });
    return id;
  },
});

export const setStatus = authenticatedMutation({
  args: { id: v.id("agentVideoBriefs"), status: v.union(v.literal("new"), v.literal("editing"), v.literal("posted")), postedUrl: v.optional(v.string()) },
  handler: async (ctx, { id, status, postedUrl }) => {
    const me = await hubViewer(ctx, ctx.userId);
    if (!me.isStaff) throw new Error("Staff only");
    await ctx.db.patch(id, { status, ...(postedUrl !== undefined ? { postedUrl: postedUrl.trim() || undefined } : {}) });
  },
});

export const removeBrief = authenticatedMutation({
  args: { id: v.id("agentVideoBriefs") },
  handler: async (ctx, { id }) => {
    const me = await hubViewer(ctx, ctx.userId);
    const b = await ctx.db.get(id);
    if (!b) return;
    if (!me.isStaff && (b.agentEmail !== me.email || b.status !== "new")) throw new Error("Only new notes can be removed.");
    await ctx.db.delete(id);
  },
});

export const briefInternal = internalQuery({
  args: { id: v.id("agentVideoBriefs") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const markLogged = internalMutation({
  args: { id: v.id("agentVideoBriefs"), sheetRange: v.optional(v.string()), sheetError: v.optional(v.string()) },
  handler: async (ctx, { id, sheetRange, sheetError }) => {
    await syncRoster(ctx);
    if (await ctx.db.get(id)) await ctx.db.patch(id, { sheetRange, sheetError });
  },
});

const csvCell = (s: string) => `"${s.replace(/"/g, '""').replace(/\r?\n/g, " / ")}"`;

export const logRow = (b: Doc<"agentVideoBriefs">) => {
  const when = new Date(b.createdAt).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" });
  const f = folderFor(b.agentEmail);
  return [
    when,
    b.agentName,
    `${b.kind}: ${b.title}`,
    b.address ?? "",
    b.useFor.join(", "),
    b.notes ?? "",
    b.files.join(", "),
    f ? driveFolderUrl(f.folderId) : "",
    "New",
  ]
    // A leading = + - @ would make Sheets treat agent text as a formula.
    .map(s => csvCell(/^[=+\-@]/.test(s) ? `'${s}` : s))
    .join(",");
};

export const appendLog = internalAction({
  args: { id: v.id("agentVideoBriefs") },
  handler: async (ctx, { id }) => {
    await syncRoster(ctx);
    const b = await ctx.runQuery(internal.agentVideos.briefInternal, { id });
    if (!b) return;
    if (process.env.HUB_MAIL === "off") {
      await ctx.runMutation(internal.agentVideos.markLogged, { id, sheetError: "Skipped on dev (HUB_MAIL=off)" });
      return;
    }
    try {
      const r = await callTool<{ updated_range?: string }>("mcp_gdrive_google_sheets_write", {
        unified_uri: VIDEO_LOG_SHEET,
        values_csv: logRow(b),
      });
      await ctx.runMutation(internal.agentVideos.markLogged, { id, sheetRange: r.updated_range ?? "appended" });
    } catch (e) {
      await ctx.runMutation(internal.agentVideos.markLogged, { id, sheetError: (e as Error).message.slice(0, 300) });
    }
  },
});
