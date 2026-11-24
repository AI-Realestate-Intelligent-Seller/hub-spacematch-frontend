// Lead Desk side effects: Google Calendar (team@ → agent invite), agent email + push,
// Lofty lead/note, client texts from the office line (Quo), escalations, email intake.
// Env: DESK_CAL=on (calendar writes), DESK_TEXTS=on (client texts), LOFTY_PUSH=on, HUB_MAIL.
import { OFFICE_ADDRESS } from "./officeDefs";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, type ActionCtx } from "./_generated/server";
import { AGENTS, agentByEmail, agentSlug } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { type Busy, LEAD_TYPES, detailLines, fmtTime, fmtWhen, isoCT, kindLabel, outcomeLabel, parseLeadText } from "./deskDefs";
import { authenticatedAction } from "./functions";
import { gmailFind } from "./gateway";
import { loftyMembers, matchMember } from "./lofty";
import { esc, hubUrl, sendMail, shell, table } from "./notify";

declare const process: { env: Record<string, string | undefined> };

// Lead Desk calendar = team@'s shared "RG/Teamspacematch" calendar (empty, team@ owns it),
// so bookings don't clutter Michael's own primary calendar. Agents get a normal invite.
const DESK_CALENDAR = "c_dvcetbcmujqug7uvnhmnoqem6s@group.calendar.google.com";
const QUO_LINE = "PNw9iO94aa"; // (773) 985-7153
const OFFICE = OFFICE_ADDRESS;
const ALERT_EMAILS = ["michael@spacematchinc.com", "smm@spacematchinc.com", "tc@spacematchinc.com"];
const OPS = ["smm@spacematchinc.com", "tc@spacematchinc.com"];

type Lead = Doc<"deskLeads">;

/** Gateway call that tolerates non-JSON content (e.g. "draft created, needs approval"). */
async function gw(role: string, args: Record<string, unknown>): Promise<any> {
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
  if (!res.ok) throw new Error(`${role} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  if (!json.success) throw new Error(`${role}: ${json.error ?? "tool failed"}`);
  const r = json.result as { content?: string; error?: string; draft_id?: string };
  if (r?.draft_id) throw new Error("Waiting for approval of Google Calendar writes in Slack");
  if (!r?.content) throw new Error(`${role}: ${r?.error ?? "no content"}`);
  try {
    return JSON.parse(r.content);
  } catch {
    if (/draft/i.test(r.content)) throw new Error("Waiting for approval of Google Calendar writes in Slack");
    throw new Error(`${role}: ${r.content.slice(0, 200)}`);
  }
}

async function loftyCall(method: "get" | "post" | "put", path: string, body?: unknown) {
  const args: Record<string, unknown> = { path };
  if (body !== undefined) args.json_body = body;
  const w = await gw(`custom_api_lofty_crm_${method}`, args);
  if ((w.status_code ?? 200) >= 400) throw new Error(`Lofty ${w.status_code}: ${JSON.stringify(w.body).slice(0, 200)}`);
  return w.body;
}

const isTest = (l: Lead) => !!l.email?.endsWith("@example.com") || /555-?01\d\d/.test(l.phone ?? "");
const first = (n?: string) => (n ?? "").trim().split(/\s+/)[0] ?? "";

function e164(p?: string) {
  const d = (p ?? "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return "";
}

const where = (l: Lead) =>
  l.apptKind === "office" ? OFFICE : l.apptKind === "phone" ? `Phone: ${l.phone ?? ""}` : l.apptKind === "video" ? "Google Meet (link in the invite)" : (l.apptLocation ?? l.details.address ?? "");

function leadRows(l: Lead): [string, string][] {
  return [
    ["When", l.apptStart ? `${fmtWhen(l.apptStart)} (${l.apptMinutes ?? 60} min)` : ""],
    ["Meeting", kindLabel(l.apptKind ?? "")],
    ["Where", where(l)],
    ["Client", l.name],
    ["Phone", l.phone ?? ""],
    ["Email", l.email ?? ""],
    ...detailLines(l),
    ["Booked by", l.bookedByName ?? ""],
  ];
}

async function pushTo(ctx: ActionCtx, email: string, title: string, body: string, url: string) {
  try {
    await ctx.runAction(internal.push.toEmail, { email, title, body, url });
  } catch (e) {
    console.error("desk push", email, String(e));
  }
}

async function mail(to: string, subject: string, html: string) {
  try {
    await sendMail(to, subject, html);
  } catch (e) {
    console.error("desk mail", to, String(e));
  }
}

const btn = (href: string, label: string, dark = false) =>
  `<a href="${href}" style="background:${dark ? "#0A0A0A" : "#9C7434"};color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;display:inline-block;margin:0 8px 8px 0">${esc(label)}</a>`;

// ── Availability (staff, live from Google Calendar free/busy) ─────────
export const availability = authenticatedAction({
  args: { from: v.number(), days: v.number(), emails: v.optional(v.array(v.string())) },
  handler: async (ctx, { from, days, emails }): Promise<{ busy: Record<string, Busy[]>; errors: Record<string, string>; checkedAt: number }> => {
    const me = await ctx.runQuery(internal.desk.viewerInternal, { userId: ctx.userId });
    if (!me.allowed) throw new Error("The Lead Desk is for admins and ops only");
    const list = (emails ?? AGENTS.map(a => a.email.toLowerCase())).filter(e => agentByEmail(e)).slice(0, 40);
    const c = await gw("mcp_composio_googlecalendar_free_busy_query", {
      items: list.map(id => ({ id })),
      timeMin: new Date(from).toISOString(),
      timeMax: new Date(from + Math.min(days, 21) * 864e5).toISOString(),
      timeZone: "America/Chicago",
    });
    const cals = (c?.data?.calendars ?? {}) as Record<string, { busy?: { start: string; end: string }[]; errors?: { reason?: string }[] }>;
    const busy: Record<string, Busy[]> = {};
    const errors: Record<string, string> = {};
    for (const e of list) {
      const cal = cals[e];
      if (!cal) { errors[e] = "not returned"; busy[e] = []; continue; }
      if (cal.errors?.length) errors[e] = cal.errors.map(x => x.reason ?? "error").join(", ");
      busy[e] = (cal.busy ?? []).map(b => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
    }
    return { busy, errors, checkedAt: Date.now() };
  },
});

// ── Booking side effects ──────────────────────────────────────────────
async function calendarCreate(l: Lead): Promise<{ id: string; link?: string }> {
  const agent = agentByEmail(l.agentEmail ?? "")!;
  const start = l.apptStart ?? Date.now();
  const end = start + (l.apptMinutes ?? 60) * 60000;
  const desc = [
    `<b>Lead Desk appointment</b> · booked by ${esc(l.bookedByName ?? "ops")}`,
    "",
    ...leadRows(l).filter(([k, v]) => v && !["When", "Booked by"].includes(k)).map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`),
    "",
    `Accept or say you can't make it: ${hubUrl()}/a/${l.token}`,
  ].join("<br>");
  const c = await gw("mcp_composio_googlecalendar_create_event", {
    calendar_id: DESK_CALENDAR,
    summary: `${kindLabel(l.apptKind ?? "")}: ${l.name}${l.leadType ? ` (${LEAD_TYPES.find(t => t.id === l.leadType)?.label ?? ""})` : ""}`,
    start_datetime: isoCT(start),
    end_datetime: isoCT(end),
    timezone: "America/Chicago",
    location: where(l) || undefined,
    description: desc,
    attendees: [{ email: agent.email, displayName: agent.name }],
    send_updates: "all",
    exclude_organizer: true,
    create_meeting_room: l.apptKind === "video",
  });
  if (c?.successful === false) throw new Error(String(c.error ?? "calendar error").slice(0, 200));
  const ev = c?.data?.response_data ?? c?.data ?? {};
  if (!ev.id) throw new Error(`Calendar: no event id (${JSON.stringify(c).slice(0, 160)})`);
  return { id: ev.id, link: ev.htmlLink };
}

async function calendarDelete(eventId?: string) {
  if (!eventId || process.env.DESK_CAL !== "on") return;
  try {
    await gw("mcp_composio_googlecalendar_delete_event", { event_id: eventId, calendar_id: DESK_CALENDAR, send_updates: "all" });
  } catch (e) {
    console.error("desk calendar delete", String(e));
  }
}

async function loftyPush(l: Lead): Promise<string | undefined> {
  if (process.env.LOFTY_PUSH !== "on" || isTest(l)) return undefined;
  const agent = agentByEmail(l.agentEmail ?? "");
  const assignedUserId = agent ? matchMember(await loftyMembers(), agent.email, agent.name) : undefined;
  let leadId = l.loftyLeadId ? Number(l.loftyLeadId) : undefined;
  if (!leadId) {
    const [fn, ...rest] = l.name.split(/\s+/);
    const types = l.leadType === "both" ? [1, 2] : [{ seller: 1, buyer: 2, renter: 3, landlord: 5 }[l.leadType] ?? -1];
    const res = await loftyCall("post", "/v1.0/leads", {
      firstName: fn.slice(0, 30),
      lastName: rest.join(" ").slice(0, 30) || undefined,
      emails: l.email ? [l.email] : [],
      phones: l.phone ? [l.phone.slice(0, 20)] : [],
      leadTypes: types,
      source: "SpaceMatch Lead Desk",
      tagsAdd: ["Lead Desk", l.source.slice(0, 30), l.details.address?.slice(0, 30) ?? ""].filter(Boolean),
      assignedUserId,
    });
    leadId = res?.leadId;
    if (!leadId) throw new Error(`Lofty: no leadId (${JSON.stringify(res).slice(0, 160)})`);
  } else if (assignedUserId) {
    await loftyCall("put", `/v1.0/leads/${leadId}`, { assignedUserId });
  }
  const note = [`Lead Desk: ${kindLabel(l.apptKind ?? "")} with ${l.agentName} on ${l.apptStart ? fmtWhen(l.apptStart) : ""} (booked by ${l.bookedByName})`, ...leadRows(l).filter(([k, v]) => v && !["When", "Booked by", "Client"].includes(k)).map(([k, v]) => `${k}: ${v}`)].join("\n");
  await loftyCall("post", "/v1.0/notes", { leadId, content: note.slice(0, 3000) });
  try {
    await loftyCall("put", `/v1.0/leads/${leadId}`, { stage: "Appointment Set" });
  } catch (e) {
    console.error("desk lofty stage", String(e));
  }
  return String(leadId);
}

export const onBooked = internalAction({
  args: { id: v.id("deskLeads"), seq: v.number(), prevEventId: v.optional(v.string()), rebook: v.boolean() },
  handler: async (ctx, { id, seq, prevEventId, rebook }) => {
    await syncRoster(ctx);
    const l = await ctx.runQuery(internal.desk.getLead, { id });
    if (!l || (l.bookSeq ?? 0) !== seq || !l.agentEmail) return;
    await calendarDelete(prevEventId);
    // 1) Google Calendar invite to the agent
    if (process.env.DESK_CAL === "on") {
      try {
        const ev = await calendarCreate(l);
        await ctx.runMutation(internal.desk.patchInternal, { id, seq, set: { calendarEventId: ev.id, calendarLink: ev.link, calendarError: undefined } });
      } catch (e) {
        await ctx.runMutation(internal.desk.patchInternal, { id, seq, set: { calendarError: String((e as Error).message ?? e).slice(0, 300) } });
      }
    } else {
      await ctx.runMutation(internal.desk.patchInternal, { id, seq, set: { calendarError: "Calendar writes are off on this environment" } });
    }
    // 2) Email + push to the agent
    const link = `${hubUrl()}/a/${l.token}`;
    const html = shell(
      `New appointment: ${l.name}`,
      `<p style="margin:0 0 14px;font-size:15px"><b>${esc(fmtWhen(l.apptStart ?? 0))}</b> · ${esc(kindLabel(l.apptKind ?? ""))}${where(l) ? ` · ${esc(where(l))}` : ""}</p>
       <p style="margin:0 0 14px">Please tap <b>Accept</b> or <b>Can't make it</b> within 30 minutes. If we don't hear back, ops and Michael get an alert.</p>
       <p style="margin:0 0 14px">${btn(`${link}?do=accept`, "Accept")}${btn(`${link}?do=decline`, "Can't make it", true)}</p>
       ${table(leadRows(l))}`,
      { href: `${hubUrl()}/appointments`, label: "My appointments in the Hub" },
    );
    await mail(l.agentEmail, `📅 ${rebook ? "Updated" : "New"} appointment: ${l.name} · ${fmtWhen(l.apptStart ?? 0)}`, html);
    await pushTo(ctx, l.agentEmail, `New appointment: ${l.name}`, `${fmtWhen(l.apptStart ?? 0)} · ${kindLabel(l.apptKind ?? "")}. Tap to accept.`, `/a/${l.token}`);
    // 3) Lofty
    try {
      const leadId = await loftyPush(l);
      if (leadId) await ctx.runMutation(internal.desk.patchInternal, { id, set: { loftyLeadId: leadId, loftyError: undefined } });
    } catch (e) {
      await ctx.runMutation(internal.desk.patchInternal, { id, set: { loftyError: String((e as Error).message ?? e).slice(0, 300) } });
    }
  },
});

export const onCancelled = internalAction({
  args: { id: v.id("deskLeads"), eventId: v.optional(v.string()), agentEmail: v.string(), reason: v.string() },
  handler: async (ctx, { id, eventId, agentEmail, reason }) => {
    await syncRoster(ctx);
    await calendarDelete(eventId);
    const l = await ctx.runQuery(internal.desk.getLead, { id });
    if (!l || !agentEmail) return;
    await mail(agentEmail, `Cancelled: ${l.name}`, shell(`Appointment cancelled: ${l.name}`, `<p>Ops cancelled this Lead Desk appointment${reason ? `: ${esc(reason)}` : ""}. It's off your calendar. No action needed.</p>`));
  },
});

export const onAccepted = internalAction({
  args: { id: v.id("deskLeads"), seq: v.number() },
  handler: async (ctx, { id, seq }) => {
    await syncRoster(ctx);
    const l = await ctx.runQuery(internal.desk.getLead, { id });
    if (!l || (l.bookSeq ?? 0) !== seq) return;
    if (l.bookedByEmail && agentByEmail(l.bookedByEmail)?.email !== l.agentEmail) {
      await pushTo(ctx, l.bookedByEmail, `${first(l.agentName)} accepted`, `${l.name} · ${fmtWhen(l.apptStart ?? 0)}`, "/desk");
    }
    if (l.textClient && (l.apptStart ?? 0) > Date.now() + 60 * 60000) await sendClientText(ctx, l, "confirm");
  },
});

export const onDeclined = internalAction({
  args: { id: v.id("deskLeads"), eventId: v.optional(v.string()) },
  handler: async (ctx, { id, eventId }) => {
    await syncRoster(ctx);
    await calendarDelete(eventId);
    const l = await ctx.runQuery(internal.desk.getLead, { id });
    if (!l) return;
    const to = new Set([...OPS, ...(l.bookedByEmail ? [l.bookedByEmail] : [])]);
    const html = shell(
      `${first(l.agentName)} can't make it: ${l.name}`,
      `<p style="margin:0 0 14px"><b>Reason:</b> ${esc(l.declineReason ?? "")}</p><p style="margin:0 0 14px">Pick another agent or time on the Lead Desk.</p>${table(leadRows(l))}`,
      { href: `${hubUrl()}/desk?open=${id}`, label: "Rebook on the Lead Desk" },
    );
    for (const e of to) {
      await mail(e, `↩️ Rebook needed: ${l.name} (${first(l.agentName)} can't make it)`, html);
      await pushTo(ctx, e, `Rebook: ${l.name}`, `${first(l.agentName)} can't make it. ${l.declineReason ?? ""}`, `/desk?open=${id}`);
    }
  },
});

export const escalate = internalAction({
  args: { id: v.id("deskLeads"), seq: v.number() },
  handler: async (ctx, { id, seq }) => {
    await syncRoster(ctx);
    const l = await ctx.runQuery(internal.desk.getLead, { id });
    if (!l || (l.bookSeq ?? 0) !== seq || l.stage !== "booked") return;
    const agent = agentByEmail(l.agentEmail ?? "");
    const html = shell(
      `No answer from ${first(l.agentName)} (30 min)`,
      `<p style="margin:0 0 14px">${esc(l.agentName ?? "")} hasn't accepted the appointment with <b>${esc(l.name)}</b> on ${esc(fmtWhen(l.apptStart ?? 0))}.${agent ? ` Call or text ${esc(first(agent.name))}: ${esc(agent.phone)}.` : ""}</p>${table(leadRows(l))}`,
      { href: `${hubUrl()}/desk?open=${id}`, label: "Open on the Lead Desk" },
    );
    for (const e of ALERT_EMAILS) {
      await mail(e, `⚠️ ${first(l.agentName)} hasn't accepted: ${l.name} · ${fmtWhen(l.apptStart ?? 0)}`, html);
      await pushTo(ctx, e, `No answer from ${first(l.agentName)}`, `${l.name} · ${fmtWhen(l.apptStart ?? 0)}`, `/desk?open=${id}`);
    }
  },
});

export const askOutcome = internalAction({
  args: { id: v.id("deskLeads"), reminder: v.boolean() },
  handler: async (ctx, { id, reminder }) => {
    await syncRoster(ctx);
    const l = await ctx.runQuery(internal.desk.getLead, { id });
    if (!l || l.outcome || !l.agentEmail) return;
    const link = `${hubUrl()}/a/${l.token}`;
    const html = shell(
      `${reminder ? "Reminder: " : ""}How did it go with ${l.name}?`,
      `<p style="margin:0 0 14px">${esc(kindLabel(l.apptKind ?? ""))} on ${esc(fmtWhen(l.apptStart ?? 0))}. One tap:</p>
       <p>${btn(`${link}?outcome=met`, "Met, following up")}${btn(`${link}?outcome=signed`, "Signed")}${btn(`${link}?outcome=rescheduled`, "Rescheduled", true)}${btn(`${link}?outcome=no_show`, "No-show", true)}${btn(`${link}?outcome=not_fit`, "Not a fit", true)}</p>`,
    );
    await mail(l.agentEmail, `${reminder ? "Reminder: " : ""}How did it go with ${l.name}?`, html);
    await pushTo(ctx, l.agentEmail, `How did it go with ${l.name}?`, "One tap to log the outcome.", `/a/${l.token}`);
  },
});

export const onOutcome = internalAction({
  args: { id: v.id("deskLeads"), by: v.string() },
  handler: async (ctx, { id, by }) => {
    await syncRoster(ctx);
    const l = await ctx.runQuery(internal.desk.getLead, { id });
    if (!l?.outcome) return;
    if (l.loftyLeadId && process.env.LOFTY_PUSH === "on") {
      try {
        await loftyCall("post", "/v1.0/notes", { leadId: Number(l.loftyLeadId), content: `Lead Desk outcome (${by}): ${outcomeLabel(l.outcome)}${l.outcomeNote ? `\n${l.outcomeNote}` : ""}` });
      } catch (e) {
        console.error("desk outcome lofty", String(e));
      }
    }
    if (l.outcome === "signed") {
      await mail("michael@spacematchinc.com", `🎉 Signed: ${l.name} with ${l.agentName} (${l.source})`, shell(`Signed: ${l.name}`, `<p>${esc(l.agentName ?? "")} signed ${esc(l.name)} from <b>${esc(l.source)}</b>.${l.outcomeNote ? ` ${esc(l.outcomeNote)}` : ""}</p>`, { href: `${hubUrl()}/desk?tab=report`, label: "Lead Desk report" }));
    }
    if (l.outcome === "rescheduled") {
      for (const e of OPS) await mail(e, `↩️ Rebook needed: ${l.name} (rescheduled)`, shell(`Rescheduled: ${l.name}`, `<p>${esc(l.agentName ?? "")}: ${esc(l.outcomeNote ?? "no note")}. Book the new time on the Lead Desk.</p>`, { href: `${hubUrl()}/desk?open=${id}`, label: "Rebook" }));
    }
  },
});

// ── Client texts (office line) ────────────────────────────────────────
export function clientTextBody(l: Pick<Lead, "name" | "agentName" | "agentEmail" | "apptStart" | "apptKind" | "apptLocation" | "details">, which: string): string {
  const agent = agentByEmail(l.agentEmail ?? "");
  const af = first(l.agentName);
  const when = fmtWhen(l.apptStart ?? 0).replace(/, (\d)/, " at $1");
  const at = l.apptKind === "listing" || l.apptKind === "showing" ? (l.apptLocation ?? l.details.address ?? "") : "";
  const how =
    l.apptKind === "phone" ? `by phone (${af} will call you)` : l.apptKind === "video" ? "by video call" : l.apptKind === "office" ? `at our office, ${OFFICE}` : at ? `at ${at}` : "";
  if (which === "confirm") {
    return `Hi ${first(l.name)}, this is SpaceMatch. You're set with ${l.agentName} on ${when}${how ? ` ${how}` : ""}. ${af}'s cell: ${agent?.phone ?? ""}. About ${af}: ${hubUrl()}/m/${agentSlug(l.agentName ?? "")} . Reply here if you need to change the time.`;
  }
  if (which === "r24") return `Reminder from SpaceMatch: you're meeting ${af} tomorrow at ${fmtTime(l.apptStart ?? 0)}${how ? ` ${how}` : ""}. Reply here if you need to reschedule.`;
  return `See you soon! ${af} from SpaceMatch, today at ${fmtTime(l.apptStart ?? 0)}${how ? ` ${how}` : ""}. ${af}'s cell: ${agent?.phone ?? ""}.`;
}

async function sendClientText(ctx: ActionCtx, l: Lead, which: string) {
  const to = e164(l.phone);
  if (!to || isTest(l)) return;
  if (process.env.DESK_TEXTS !== "on") {
    await ctx.runMutation(internal.desk.patchInternal, { id: l._id, set: {}, note: `Client text (${which}) skipped: texts are off on this environment` });
    return;
  }
  try {
    await gw("mcp_pd_openphone_send_message", { from: QUO_LINE, to, content: clientTextBody(l, which) });
    await ctx.runMutation(internal.desk.patchInternal, { id: l._id, set: { textError: undefined }, textSent: which, note: `Texted the client (${which === "confirm" ? "confirmation" : which === "r24" ? "24 h reminder" : "2 h reminder"})` });
  } catch (e) {
    await ctx.runMutation(internal.desk.patchInternal, { id: l._id, set: { textError: String((e as Error).message ?? e).slice(0, 300) } });
  }
}

export const clientText = internalAction({
  args: { id: v.id("deskLeads"), seq: v.number(), which: v.string() },
  handler: async (ctx, { id, seq, which }) => {
    await syncRoster(ctx);
    const l = await ctx.runQuery(internal.desk.getLead, { id });
    if (!l || (l.bookSeq ?? 0) !== seq || l.stage !== "accepted" || !l.textClient) return;
    await sendClientText(ctx, l, which);
  },
});

// ── Email intake: Peak Presence YouTube leads + bookings land in "To vet" ──
export const scanIntake = internalAction({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }): Promise<{ found: number; added: number }> => {
    await syncRoster(ctx);
    const q = `from:mail.peakpresencee.com newer_than:${days ?? 2}d (subject:"NEW YT SELLER LEAD" OR subject:"NEW YOUTUBE ADS APPOINTMENT")`;
    const msgs = await gmailFind("mcp_pd_gmail_", q, 50, ["id", "subject", "date", "snippet", "bodyText"]);
    const items = msgs
      .map(m => {
        const raw = String(m.bodyText || (m as { snippet?: string }).snippet || "").replace(/\s+/g, " ").trim();
        const p = parseLeadText(raw);
        const appt = /APPOINTMENT/i.test(m.subject ?? "");
        const when = raw.replace(/&amp;/g, "&").match(/Date & Time:\s*(.+?)(?=\s+[A-Z][a-z]+:|$)/)?.[1]?.replace(/\s*Add to.*$/, "").slice(0, 90);
        return {
          sourceRef: `gmail:${m.id}`,
          source: "YouTube ads (Peak Presence)",
          leadType: "seller",
          name: p.name ?? "Unknown",
          phone: p.phone,
          email: p.email,
          address: p.address,
          notes: appt ? `Booked a phone appointment on Peak Presence's calendar${when ? `: ${when}` : ""}.` : undefined,
          rawText: raw,
          at: m.date ? Date.parse(m.date) : Date.now(),
        };
      })
      .filter(i => i.name !== "Unknown" || i.phone);
    const r: { added: number } = items.length ? await ctx.runMutation(internal.desk.ingest, { items }) : { added: 0 };
    // New Peak Presence leads → Lofty, so Anna texts them within minutes (Michael 2026-11-08).
    if (r.added) await ctx.runAction(internal.leadTrackActions.peakToLofty, {});
    return { found: items.length, added: r.added };
  },
});

