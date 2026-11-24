import { internalQuery } from "./_generated/server";
import { pickRow } from "./rosterSync";

// Raw rosterAgents rows for actions (rosterSync.syncRoster). Internal only.
export const rows = internalQuery({
  args: {},
  handler: async ctx => (await ctx.db.query("rosterAgents").collect()).map(pickRow),
});
