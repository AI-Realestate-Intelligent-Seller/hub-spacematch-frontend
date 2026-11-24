// Outbound notifications (email via the Viktor Spaces mail proxy, auth@viktor.space).
// Shares the 100/hour per-project cap with sign-in codes — keep volume low.
import { OFFICE_ADDRESS } from "./officeDefs";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { OPS_EMAILS, TEAM_COPY_EMAIL } from "./agentsData";
import { formById } from "./formDefs";

declare const process: { env: Record<string, string | undefined> };

export const hubUrl = () =>
  process.env.HUB_URL ?? "https://hub-spacematchinc.viktor.space";

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendMail(to: string, subject: string, html: string) {
  if (process.env.HUB_MAIL === "off") {
    console.log("HUB_MAIL=off, skipped mail to", to, subject);
    return;
  }
  const apiUrl = process.env.VIKTOR_SPACES_API_URL;
  const projectName = process.env.VIKTOR_SPACES_PROJECT_NAME;
  const projectSecret = process.env.VIKTOR_SPACES_PROJECT_SECRET;
  if (!apiUrl || !projectName || !projectSecret) throw new Error("Mail not configured");
  const res = await fetch(`${apiUrl}/api/viktor-spaces/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_name: projectName,
      project_secret: projectSecret,
      space_id: process.env.VIKTOR_AUTH_RESOURCE_ID,
      to_email: to,
      subject,
      html_content: html,
    }),
  });
  if (!res.ok) throw new Error(`Mail failed ${res.status}: ${await res.text()}`);
}

export const shell = (title: string, body: string, cta?: { href: string; label: string }) => `
<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;background:#F7F5F1;padding:0 0 24px">
  <div style="background:#0A0A0A;padding:18px 24px;color:#D9BC8C;font-size:13px;letter-spacing:3px;font-weight:700">SPACEMATCH AGENT HUB</div>
  <div style="padding:24px">
    <h2 style="font-family:Georgia,serif;color:#0A0A0A;margin:0 0 14px;font-size:22px">${esc(title)}</h2>
    ${body}
    ${cta ? `<p style="margin:22px 0 0"><a href="${cta.href}" style="background:#9C7434;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;display:inline-block">${esc(cta.label)}</a></p>` : ""}
  </div>
  <div style="padding:0 24px;color:#8a847a;font-size:12px">SpaceMatch Inc. · a team of Real Broker, LLC · ${OFFICE_ADDRESS}</div>
</div>`;

export const table = (rows: [string, string][]) =>
  `<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px">${rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#6b665d;font-size:13px;width:40%;vertical-align:top">${esc(k)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#0A0A0A">${esc(v).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("")}</table>`;

export const submissionForMail = internalQuery({
  args: { id: v.id("formSubmissions") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

// New form answer → assigned agent (or team inbox) + copy to team@.
export const formSubmitted = internalAction({
  args: { id: v.id("formSubmissions") },
  handler: async (ctx, { id }) => {
    const s = await ctx.runQuery(internal.notify.submissionForMail, { id });
    if (!s) return;
    const def = formById(s.formId);
    const rows: [string, string][] = def
      ? def.fields.map(f => [f.label, s.answers[f.id] ?? ""])
      : Object.entries(s.answers); // code-defined intake (e.g. website pro-intro) has no form def
    const lead = s.isLead
      ? `<p style="background:#fff3e0;border-left:4px solid #9C7434;padding:10px 12px;margin:0 0 14px;font-size:14px"><b>New lead — please reach out within 1 hour.</b> If it's still unanswered in an hour, Michael and Cris get an alert.</p>`
      : "";
    const contact = [s.contactPhone, s.contactEmail].filter(Boolean).join(" · ");
    const html = shell(
      `${s.formTitle}: ${s.contactName}`,
      `${lead}<p style="margin:0 0 14px;color:#3A3833">${esc(contact)}${s.agentName ? ` · for ${esc(s.agentName)}` : ""}</p>${table(rows)}`,
      { href: `${hubUrl()}/inbox?open=${id}`, label: "Open in the Hub" },
    );
    const subject = `${s.isLead ? "🔔 New lead · " : ""}${s.formTitle} — ${s.contactName}`;
    const recipients = new Set<string>();
    if (s.agentEmail) recipients.add(s.agentEmail.toLowerCase());
    if (s.audience === "team" || !s.agentEmail) OPS_EMAILS.forEach(e => recipients.add(e));
    recipients.add(TEAM_COPY_EMAIL);
    for (const to of recipients) {
      try {
        await sendMail(to, subject, html);
      } catch (e) {
        console.error("formSubmitted mail", to, String(e));
      }
    }
  },
});

// 1 hour after a lead arrives, if nobody marked it contacted → alert Michael + Cris.
export const escalateIfUnanswered = internalMutation({
  args: { id: v.id("formSubmissions") },
  handler: async (ctx, { id }) => {
    const s = await ctx.db.get(id);
    if (!s || s.status !== "new" || s.escalatedAt) return;
    await ctx.db.patch(id, { escalatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.notify.escalationMail, { id });
  },
});

export const escalationMail = internalAction({
  args: { id: v.id("formSubmissions") },
  handler: async (ctx, { id }) => {
    const s = await ctx.runQuery(internal.notify.submissionForMail, { id });
    if (!s) return;
    const html = shell(
      `Unanswered lead (1 hour): ${s.contactName}`,
      `<p style="margin:0 0 14px">${esc(s.formTitle)} for <b>${esc(s.agentName || "the team")}</b> has not been marked contacted.</p>${table([
        ["Phone", s.contactPhone ?? ""],
        ["Email", s.contactEmail ?? ""],
        ["Property", s.propertyAddress ?? ""],
      ])}`,
      { href: `${hubUrl()}/inbox?open=${id}`, label: "Open lead" },
    );
    for (const to of ["michael@spacematchinc.com", "smm@spacematchinc.com"]) {
      try {
        await sendMail(to, `⚠️ Lead not contacted after 1 hour — ${s.contactName}`, html);
      } catch (e) {
        console.error("escalation mail", to, String(e));
      }
    }
  },
});

export const requestForMail = internalQuery({
  args: { id: v.id("cmaRequests") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

export const cmaApprovalNeeded = internalAction({
  args: { id: v.id("cmaRequests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.runQuery(internal.notify.requestForMail, { id });
    if (!r) return;
    const html = shell(
      `Extra CMA needs your OK`,
      `<p style="margin:0 0 14px">${esc(r.statusNote ?? "")}</p>${table([
        ["Agent", r.agentName],
        ["Client", r.clientName],
        ["Address", `${r.street}${r.unit ? ` #${r.unit}` : ""}, ${r.city}`],
        ["Purpose", r.purpose],
      ])}`,
      { href: `${hubUrl()}/requests`, label: "Approve or decline" },
    );
    try {
      await sendMail("michael@spacematchinc.com", `CMA approval: ${r.agentName} — ${r.street}`, html);
    } catch (e) {
      console.error("approval mail", String(e));
    }
  },
});
