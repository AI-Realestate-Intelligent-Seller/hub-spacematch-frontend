// Agent's own copy of every Lob mailing (Michael 2026-11-12: "always send a copy of the mailer to the agent",
// "require their address", billed "like any other card"). One extra card per design per Lob run goes to the
// address saved here; its QR opens the sample page (/v/SAMPLE?d=…), so it never counts as a homeowner scan.
// Required before "Mail it for me" (sellerLists.place) and "Request mailing" (lob.request).
import { v } from "convex/values";
import { internalMutation, type QueryCtx } from "./_generated/server";
import { agentByEmail } from "./agentsData";
import { syncRoster } from "./rosterSync";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { hubViewer } from "./hubMe";

export type CopyAddress = { name: string; line1: string; line2?: string; city: string; state: string; zip: string };

const addrIn = v.object({ line1: v.string(), line2: v.optional(v.string()), city: v.string(), state: v.string(), zip: v.string() });

export async function copyAddressFor(ctx: QueryCtx, agentEmail: string): Promise<CopyAddress | null> {
  const r = await ctx.db.query("agentMailAddresses").withIndex("by_email", q => q.eq("email", agentEmail.toLowerCase())).first();
  if (!r) return null;
  return { name: r.name, line1: r.line1, line2: r.line2, city: r.city, state: r.state, zip: r.zip };
}

export const oneLine = (a: Pick<CopyAddress, "line1" | "line2" | "city" | "state" | "zip">) =>
  `${a.line1}${a.line2 ? ` ${a.line2}` : ""}, ${a.city}, ${a.state} ${a.zip}`;

// Whose copy address a viewer may read or change: their own, or anyone's for staff.
async function target(ctx: QueryCtx, userId: Parameters<typeof hubViewer>[1], agentEmail?: string) {
  const w = await hubViewer(ctx, userId);
  const email = (agentEmail || w.email).trim().toLowerCase();
  return { w, email, allowed: w.isStaff || email === w.email };
}

export const get = authenticatedQuery({
  args: { agentEmail: v.optional(v.string()) },
  handler: async (ctx, { agentEmail }) => {
    const { email, allowed } = await target(ctx, ctx.userId, agentEmail);
    if (!allowed) return { allowed: false as const, email, address: null };
    return { allowed: true as const, email, address: await copyAddressFor(ctx, email) };
  },
});

export const save = authenticatedMutation({
  args: { agentEmail: v.optional(v.string()), address: addrIn },
  handler: async (ctx, { agentEmail, address: a }) => {
    const { w, email, allowed } = await target(ctx, ctx.userId, agentEmail);
    if (!allowed) throw new Error("Only that agent or the office can change their mailing address");
    const t = (s: string | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
    const line1 = t(a.line1, 64), line2 = t(a.line2, 64), city = t(a.city, 40), state = t(a.state, 2).toUpperCase(), zip = t(a.zip, 10);
    if (!/\d/.test(line1) || line1.length < 5) throw new Error("Enter the street address (number and street)");
    if (city.length < 2) throw new Error("Enter the city");
    if (!/^[A-Z]{2}$/.test(state)) throw new Error("Enter the 2-letter state");
    if (!/^\d{5}(-\d{4})?$/.test(zip)) throw new Error("Enter a 5-digit ZIP");
    const name = agentByEmail(email)?.name ?? (email === w.email ? w.name : email);
    const row = { email, name, line1, line2: line2 || undefined, city, state, zip, updatedAt: Date.now(), updatedBy: w.email };
    const old = await ctx.db.query("agentMailAddresses").withIndex("by_email", q => q.eq("email", email)).first();
    if (old) await ctx.db.patch(old._id, row);
    else await ctx.db.insert("agentMailAddresses", row);
    return null;
  },
});

// e2e cleanup (dev): forget an agent's copy address.
export const removeInternal = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await syncRoster(ctx);
    const r = await ctx.db.query("agentMailAddresses").withIndex("by_email", q => q.eq("email", email.toLowerCase())).first();
    if (r) await ctx.db.delete(r._id);
    return null;
  },
});
