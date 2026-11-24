import { internalQuery } from "./_generated/server";
export const accounts = internalQuery({
  args: {},
  handler: async ctx => {
    const accts = await ctx.db.query("authAccounts").take(1000);
    return accts.map(a => ({ id: a.providerAccountId, provider: a.provider, verified: a.emailVerified ?? null, created: new Date(a._creationTime).toISOString().slice(0, 16) }));
  },
});
