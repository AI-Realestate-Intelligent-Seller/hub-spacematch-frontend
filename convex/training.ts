// SpaceMatch Academy progress: modules done, certification checks (graded here), staff sign-offs.
// Stored in hubSettings `training:<userId>`. Staff (admin/ops/leaders) see the whole team and sign off tracks.
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { AGENTS } from "./agentsData";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";
import {
  PASS_MARK,
  TRACK_IDS,
  TRAINING_MODULE_IDS,
  TRAINING_TRACKS,
} from "./trainingDefs";

type Quiz = { best: number; total: number; at: number; tries: number };
type Cert = { by: string; at: number };
type Row = {
  done: string[];
  email: string;
  name: string;
  updatedAt: number;
  quiz?: Record<string, Quiz>;
  certs?: Record<string, Cert>;
};
const key = (userId: string) => `training:${userId}`;
const parse = (value: string): Row => ({
  quiz: {},
  certs: {},
  ...(JSON.parse(value) as Row),
});

function trackStatus(r: Row | null) {
  const done = new Set(
    (r?.done ?? []).filter(id => TRAINING_MODULE_IDS.includes(id)),
  );
  return TRAINING_TRACKS.map(t => {
    const n = t.modules.filter(m => done.has(m.id)).length;
    const quiz = r?.quiz?.[t.id] ?? null;
    const cert = r?.certs?.[t.id] ?? null;
    const passed = !!quiz && quiz.best >= PASS_MARK;
    const status = cert
      ? "certified"
      : n === t.modules.length && passed
        ? "ready"
        : n > 0 || quiz
          ? "in_progress"
          : "not_started";
    return {
      id: t.id,
      title: t.title,
      done: n,
      total: t.modules.length,
      quiz,
      passed,
      cert,
      status,
    };
  });
}

export const mine = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const row = await ctx.db
      .query("hubSettings")
      .withIndex("by_key", q => q.eq("key", key(ctx.userId)))
      .unique();
    const viewer = await hubViewer(ctx, ctx.userId);
    const data = row ? parse(row.value) : null;
    return {
      done: (data?.done ?? []).filter(id => TRAINING_MODULE_IDS.includes(id)),
      total: TRAINING_MODULE_IDS.length,
      tracks: trackStatus(data),
      isStaff: viewer.isStaff,
      isShared: viewer.isShared,
    };
  },
});

async function loadOwn(ctx: MutationCtx & { userId: Id<"users"> }) {
  const viewer = await hubViewer(ctx, ctx.userId);
  if (viewer.isShared)
    throw new Error("Sign in with your own email so your progress is yours.");
  const row = await ctx.db
    .query("hubSettings")
    .withIndex("by_key", q => q.eq("key", key(ctx.userId)))
    .unique();
  const data: Row = row
    ? parse(row.value)
    : {
        done: [],
        email: viewer.email,
        name: viewer.name,
        updatedAt: 0,
        quiz: {},
        certs: {},
      };
  const save = async (next: Row) => {
    const value = JSON.stringify({
      ...next,
      email: viewer.email,
      name: viewer.name,
      updatedAt: Date.now(),
    });
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("hubSettings", { key: key(ctx.userId), value });
  };
  return { data, save };
}

export const toggle = authenticatedMutation({
  args: { moduleId: v.string(), done: v.boolean() },
  handler: async (ctx, { moduleId, done }) => {
    if (!TRAINING_MODULE_IDS.includes(moduleId))
      throw new Error("Unknown module");
    const { data, save } = await loadOwn(ctx);
    const cur = new Set(data.done);
    if (done) cur.add(moduleId);
    else cur.delete(moduleId);
    await save({ ...data, done: [...cur] });
    return null;
  },
});

// Certification check: answers are option indexes in the original (unshuffled) order. Keeps the best score.
export const submitQuiz = authenticatedMutation({
  args: { trackId: v.string(), answers: v.array(v.number()) },
  handler: async (ctx, { trackId, answers }) => {
    const t = TRAINING_TRACKS.find(x => x.id === trackId);
    if (!t) throw new Error("Unknown track");
    if (answers.length !== t.quiz.length)
      throw new Error("Answer every question");
    const correct = t.quiz.map((q, i) => answers[i] === q.answer);
    const score = correct.filter(Boolean).length;
    const { data, save } = await loadOwn(ctx);
    const prev = data.quiz?.[trackId];
    const quiz = {
      ...(data.quiz ?? {}),
      [trackId]: {
        best: Math.max(score, prev?.best ?? 0),
        total: t.quiz.length,
        at: Date.now(),
        tries: (prev?.tries ?? 0) + 1,
      },
    };
    await save({ ...data, quiz });
    return { score, total: t.quiz.length, passed: score >= PASS_MARK, correct };
  },
});

// Staff sign-off after the agent is "ready" (all modules + check passed). on=false removes it.
export const certify = authenticatedMutation({
  args: { email: v.string(), trackId: v.string(), on: v.boolean() },
  handler: async (ctx, { email, trackId, on }) => {
    const viewer = await hubViewer(ctx, ctx.userId);
    if (!viewer.isStaff) throw new Error("Only team leads can sign off");
    if (!TRACK_IDS.includes(trackId)) throw new Error("Unknown track");
    const rows = (await ctx.db.query("hubSettings").collect()).filter(r =>
      r.key.startsWith("training:"),
    );
    const row = rows.find(
      r => parse(r.value).email.toLowerCase() === email.toLowerCase(),
    );
    if (!row) throw new Error("This agent hasn't started the Academy yet");
    const data = parse(row.value);
    const st = trackStatus(data).find(s => s.id === trackId);
    if (on && st?.status !== "ready" && st?.status !== "certified")
      throw new Error("They need every module done and the check passed first");
    const certs = { ...(data.certs ?? {}) };
    if (on)
      certs[trackId] = { by: viewer.name || viewer.email, at: Date.now() };
    else delete certs[trackId];
    await ctx.db.patch(row._id, { value: JSON.stringify({ ...data, certs }) });
    return null;
  },
});

// Staff view: every agent with per-track status (agents with no progress included).
export const team = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const viewer = await hubViewer(ctx, ctx.userId);
    if (!viewer.isStaff) return null;
    const rows = (await ctx.db.query("hubSettings").collect())
      .filter(r => r.key.startsWith("training:"))
      .map(r => parse(r.value));
    const byEmail = new Map(rows.map(r => [r.email.toLowerCase(), r]));
    const summarize = (name: string, email: string) => {
      const r = byEmail.get(email) ?? null;
      const tracks = trackStatus(r);
      return {
        name,
        email,
        updatedAt: r?.updatedAt ?? null,
        tracks,
        done: tracks.reduce((n, t) => n + t.done, 0),
        total: TRAINING_MODULE_IDS.length,
        certified: tracks.filter(t => t.status === "certified").length,
        ready: tracks.filter(t => t.status === "ready").length,
      };
    };
    const list = AGENTS.map(a => summarize(a.name, a.email.toLowerCase()));
    for (const r of rows)
      if (!AGENTS.some(a => a.email.toLowerCase() === r.email.toLowerCase()))
        list.push(summarize(r.name, r.email.toLowerCase()));
    return list.sort(
      (a, b) =>
        b.ready - a.ready ||
        b.certified - a.certified ||
        b.done - a.done ||
        (b.updatedAt ?? 0) - (a.updatedAt ?? 0) ||
        a.name.localeCompare(b.name),
    );
  },
});
