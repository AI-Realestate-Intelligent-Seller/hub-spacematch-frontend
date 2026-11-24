// Help-request deadlines (shared by server + board): now = 1h, today = end of
// that day in Chicago, week = Friday end of day in Chicago.
const TZ = "America/Chicago";

function ctParts(t: number) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", weekday: "short", timeZoneName: "shortOffset" });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  const off = Number((p.timeZoneName ?? "GMT-6").replace("GMT", "") || "0"); // e.g. -5
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), wd, off };
}

// 23:59:59 Chicago time, `addDays` after the Chicago date of t.
function endOfDayCT(t: number, addDays = 0) {
  const { y, m, d, off } = ctParts(t);
  return Date.UTC(y, m - 1, d + addDays, 23, 59, 59) - off * 36e5;
}

export function helpDueAt(urgency: string, createdAt: number): number {
  if (urgency === "now") return createdAt + 36e5;
  if (urgency === "today") return endOfDayCT(createdAt);
  const { wd } = ctParts(createdAt);
  const toFri = (5 - wd + 7) % 7 || (wd === 5 ? 0 : 7);
  return endOfDayCT(createdAt, wd === 6 ? 6 : toFri);
}

export const HELP_STATUSES = ["new", "in_progress", "waiting", "done"] as const;
export const HELP_STATUS_LABEL: Record<string, string> = { new: "New", in_progress: "In progress", waiting: "Waiting on agent", done: "Done" };
export const normStatus = (s: string) => (s === "open" ? "new" : s);
