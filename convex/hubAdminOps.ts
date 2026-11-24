import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Ops-side setter for WhatsApp numbers on support cards (run via run_app_function).
export const setWhatsappInternal = internalMutation({
  args: { email: v.string(), phone: v.string() },
  handler: async (ctx, { email, phone }) => {
    const intl = phone.replace(/\D/g, "");
    if (intl.length < 11 || intl.length > 15) throw new Error("Enter a full international number");
    const key = `whatsapp:${email}`;
    const row = await ctx.db.query("hubSettings").withIndex("by_key", q => q.eq("key", key)).unique();
    if (row) await ctx.db.patch(row._id, { value: intl });
    else await ctx.db.insert("hubSettings", { key, value: intl });
    return intl;
  },
});
