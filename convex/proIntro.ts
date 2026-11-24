import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";

// spacematchinc.com /trusted-local-pros: contact info is hidden until the visitor leaves
// their name + email or phone. Each unlock is a lead in the Hub inbox (team inbox, no agent).
// Same visitor within 24h → the pro is appended to their existing request, no new email.
// Each new request is also pushed to Lofty as a Buyer lead (lofty.pushLead); repeats add a Lofty note.
const FORM_ID = "pro-intro";
const DAY = 24 * 60 * 60 * 1000;
const clean = (s: string, max = 200) => s.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const digits = (s: string) => s.replace(/\D/g, "");

export const request = internalMutation({
  args: {
    vendorId: v.string(), fullName: v.string(), email: v.string(), phone: v.string(),
    need: v.string(), hp: v.string(), page: v.string(),
  },
  handler: async (ctx, a) => {
    const id = ctx.db.normalizeId("vendors", a.vendorId);
    const x = id ? await ctx.db.get(id) : null;
    if (!x || x.private || x.hidden || x.onWebsite === false) throw new Error("This pro is no longer listed");
    const contact = { name: x.name, company: x.company, phone: x.phone, email: x.email, website: x.website };
    if (a.hp) return { ok: true, contact: {} }; // honeypot: bots get nothing

    const fullName = clean(a.fullName, 80);
    const email = clean(a.email, 120).toLowerCase();
    const phone = clean(a.phone, 30);
    if (fullName.length < 2) throw new Error("Please add your name");
    if (!email && !phone) throw new Error("Please add an email or a phone number");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("That email doesn't look right");
    if (phone && digits(phone).length < 10) throw new Error("That phone number doesn't look right");

    const pro = [x.name, x.company && x.company !== x.name ? x.company : "", [x.category, x.subcategory].filter(Boolean).join(" / ")]
      .filter(Boolean).join(" · ");
    const need = clean(a.need, 500);

    // Dedupe: same visitor in the last 24h → append this pro to their open request.
    const recent = await ctx.db.query("formSubmissions").order("desc").take(300);
    const prev = recent.find(s =>
      s.formId === FORM_ID && s._creationTime > Date.now() - DAY &&
      ((email && s.contactEmail === email) || (phone && s.contactPhone && digits(s.contactPhone) === digits(phone))));
    if (prev) {
      const list = prev.answers["Pros requested"] ?? "";
      if (!list.includes(pro)) {
        const answers: Record<string, string> = { ...prev.answers, "Pros requested": `${list}\n${pro}`.trim().slice(0, 3000) };
        if (need && !(prev.answers["Looking for help with"] ?? "").includes(need)) {
          answers["Looking for help with"] = `${prev.answers["Looking for help with"] ?? ""}\n${need}`.trim().slice(0, 1500);
        }
        await ctx.db.patch(prev._id, { answers, ...(email && !prev.contactEmail ? { contactEmail: email } : {}), ...(phone && !prev.contactPhone ? { contactPhone: phone } : {}) });
        await ctx.scheduler.runAfter(30_000, internal.lofty.addNote, {
          id: prev._id,
          text: `Trusted Local Pros (website): also requested ${pro}${need ? `\nLooking for help with: ${need}` : ""}`,
        });
      }
      return { ok: true, contact };
    }

    const answers: Record<string, string> = { Name: fullName };
    if (phone) answers.Phone = phone;
    if (email) answers.Email = email;
    answers["Pros requested"] = pro;
    if (need) answers["Looking for help with"] = need;
    answers.Source = "spacematchinc.com/trusted-local-pros";
    const sid = await ctx.db.insert("formSubmissions", {
      formId: FORM_ID,
      formTitle: "Trusted Local Pros (website)",
      group: "Leads",
      audience: "client",
      agentEmail: "",
      agentName: "",
      contactName: fullName,
      contactEmail: email || undefined,
      contactPhone: phone || undefined,
      answers,
      status: "new",
      isLead: true,
    });
    await ctx.scheduler.runAfter(0, internal.notify.formSubmitted, { id: sid });
    await ctx.scheduler.runAfter(0, internal.lofty.pushLead, { id: sid }); // Buyer lead, tags Trusted Local Pros + Website
    return { ok: true, contact };
  },
});

// Ops check: latest website pro requests and their Lofty status (no contact details returned).
export const recent = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("formSubmissions").order("desc").take(300);
    return rows.filter(r => r.formId === FORM_ID).slice(0, 20)
      .map(r => ({ id: r._id, at: r._creationTime, name: r.contactName, loftyLeadId: r.loftyLeadId ?? null, loftyError: r.loftyError ?? null }));
  },
});
