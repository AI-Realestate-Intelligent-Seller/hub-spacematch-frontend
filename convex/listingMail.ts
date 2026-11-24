// Seller Launch Portal emails: feedback-to-review alerts, Monday numbers
// reminders, Tuesday ops nudge, optional Monday seller summary.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { esc, hubUrl, sendMail, shell, table } from "./notify";

const OPS_NUDGE = "smm@spacematchinc.com";

export const feedbackToReview = internalAction({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }): Promise<void> => {
    const r: { address: string; agentEmail: string; pending: number } | null = await ctx.runQuery(internal.listings.forReviewMail, { listingId });
    if (!r || !r.pending) return;
    await sendMail(
      r.agentEmail,
      `New showing feedback · ${r.address}`,
      shell(
        "New showing feedback to review",
        `<p style="font-size:15px;color:#333">ShowingTime feedback came in for <b>${esc(r.address)}</b>. It stays hidden from your seller until you tap <b>Publish</b>.</p><p style="font-size:14px;color:#6b665d">${r.pending} item(s) waiting.</p>`,
        { href: `${hubUrl()}/listings/${listingId}`, label: "Review feedback" },
      ),
    );
  },
});

// Seller tapped "Approve plan" on their page: tell the listing agent right away.
export const planApproved = internalAction({
  args: { listingId: v.id("listings"), titles: v.array(v.string()) },
  handler: async (ctx, { listingId, titles }): Promise<void> => {
    const r: { address: string; agentEmail: string; pending: number } | null = await ctx.runQuery(internal.listings.forReviewMail, { listingId });
    if (!r) return;
    await sendMail(
      r.agentEmail,
      `Seller approved the plan · ${r.address}`,
      shell(
        "Your seller approved the plan",
        `<p style="font-size:15px;color:#333">The seller for <b>${esc(r.address)}</b> approved what we'd do next:</p><ul style="font-size:15px;color:#333">${titles.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`,
        { href: `${hubUrl()}/listings/${listingId}`, label: "Open the listing" },
      ),
    );
  },
});

type Digest = {
  _id: string; address: string; agentEmail: string; agentName: string; sellerName: string; sellerEmail?: string;
  weeklyEmail: boolean; token: string; hasThisWeek: boolean; showings7: number; feedback7: number; stepsDone: number; stepsTotal: number;
  last?: { weekOf: string; zillowViews?: number; zillowSaves?: number; mlsSaved?: number; mlsMaybe?: number; mlsNotInterested?: number; adViews?: number };
};

// Monday 9am CT: each agent with live listings missing this week's numbers.
export const mondayReminders = internalAction({
  args: {},
  handler: async (ctx): Promise<{ agents: number }> => {
    const rows: Digest[] = (await ctx.runQuery(internal.listings.forDigest, {})) as Digest[];
    const byAgent = new Map<string, Digest[]>();
    for (const r of rows.filter(x => !x.hasThisWeek)) byAgent.set(r.agentEmail, [...(byAgent.get(r.agentEmail) ?? []), r]);
    for (const [email, ls] of byAgent) {
      const items = ls.map(l => `<li style="margin:6px 0"><a href="${hubUrl()}/listings/${l._id}" style="color:#9C7434;font-weight:700">${esc(l.address)}</a></li>`).join("");
      await sendMail(
        email,
        "30 seconds: this week's listing numbers",
        shell(
          "Update your sellers' numbers",
          `<p style="font-size:15px;color:#333">Your sellers see these on their launch page. Open each listing and fill in Zillow views/saves and MLS saved / maybe / not interested.</p><ul style="padding-left:18px">${items}</ul>`,
          { href: `${hubUrl()}/listings`, label: "Open my listings" },
        ),
      );
    }
    return { agents: byAgent.size };
  },
});

// Tuesday 10am CT: Cris gets the list of listings still missing numbers.
export const tuesdayNudge = internalAction({
  args: {},
  handler: async (ctx): Promise<{ missing: number }> => {
    const all: Digest[] = (await ctx.runQuery(internal.listings.forDigest, {})) as Digest[];
    const rows = all.filter(x => !x.hasThisWeek);
    if (!rows.length) return { missing: 0 };
    await sendMail(
      OPS_NUDGE,
      `${rows.length} listing(s) still missing weekly numbers`,
      shell("Weekly numbers still missing", table(rows.map(r => [r.agentName, r.address] as [string, string])), { href: `${hubUrl()}/listings`, label: "Open listings" }),
    );
    return { missing: rows.length };
  },
});

// Monday 5pm CT: optional summary to sellers who have it switched on.
export const sellerWeekly = internalAction({
  args: {},
  handler: async (ctx): Promise<{ sent: number }> => {
    const all: Digest[] = (await ctx.runQuery(internal.listings.forDigest, {})) as Digest[];
    const rows = all.filter(x => x.weeklyEmail && x.sellerEmail);
    for (const r of rows) {
      const n = r.last;
      const stats: [string, string][] = [
        ["Launch steps complete", `${r.stepsDone} of ${r.stepsTotal}`],
        ["Showings (last 7 days)", String(r.showings7)],
        ["New buyer feedback", String(r.feedback7)],
        ["Zillow views / saves", n && (n.zillowViews != null || n.zillowSaves != null) ? `${n.zillowViews ?? "–"} / ${n.zillowSaves ?? "–"}` : ""],
        ["MLS buyers: saved / maybe / not", n && (n.mlsSaved != null || n.mlsMaybe != null) ? `${n.mlsSaved ?? 0} / ${n.mlsMaybe ?? 0} / ${n.mlsNotInterested ?? 0}` : ""],
        ["Ad views", n?.adViews != null ? String(n.adViews) : ""],
      ];
      const html = shell(
        `Your weekly listing report`,
        `<p style="font-size:15px;color:#333">Hi ${esc(r.sellerName.split(/\s+/)[0])}, here's how <b>${esc(r.address)}</b> did this week. Your live page has the full timeline and buyer feedback.</p>${table(stats)}<p style="font-size:14px;color:#6b665d;margin-top:14px">Questions? Reply to ${esc(r.agentName)} directly.</p>`,
        { href: `${hubUrl()}/s/${r.token}`, label: "Open my listing page" },
      ).replace("SPACEMATCH AGENT HUB", "SPACEMATCH");
      await sendMail(r.sellerEmail!, `Weekly report · ${r.address}`, html);
    }
    return { sent: rows.length };
  },
});
